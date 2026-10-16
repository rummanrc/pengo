"""Build the offline Pengo APK (debug, or unsigned release for F-Droid).

Steps:
  1. python scripts/sync_www.py            -> fresh temporary runtime/
  2. copy www/ into android assets          -> android/app/src/main/assets/www/
  3. run Gradle assembleDebug               -> android/app/build/outputs/apk/debug/app-debug.apk
  4. copy APK to dist/pengo-debug.apk

Prerequisites (once): JDK 17+, Android SDK (platform-34 + build-tools),
and either a system Gradle or the wrapper jar. See README.md.

Run: python3 scripts/build_apk.py [--assets-only | --release]

F-Droid builds and signs the release itself. --release intentionally creates
an unsigned APK; it is not directly installable or a signed public release.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANDROID = ROOT / "android"
ASSETS_WWW = ANDROID / "app" / "src" / "main" / "assets" / "www"


def robust_rmtree(path):
    for _ in range(5):
        try:
            if Path(path).exists():
                shutil.rmtree(path)
            return
        except OSError:
            time.sleep(0.5)
    shutil.rmtree(path)


def sync_assets():
    # Never carry deleted or obsolete files from an older www/ into a release.
    with tempfile.TemporaryDirectory(prefix="pengo-runtime-") as directory:
        runtime = Path(directory) / "www"
        subprocess.run([sys.executable, str(ROOT / "scripts" / "sync_www.py"),
                        "--out", str(runtime)], check=True)
        robust_rmtree(ASSETS_WWW)
        shutil.copytree(runtime, ASSETS_WWW)
    n = sum(1 for _ in ASSETS_WWW.rglob("*") if _.is_file())
    print("assets synced: %d files" % n)


def find_gradle():
    jar = ANDROID / "gradle" / "wrapper" / "gradle-wrapper.jar"
    if jar.is_file():
        return [sys.executable if False else ("gradlew.bat" if os.name == "nt" else "./gradlew")]
    exe = shutil.which("gradle")
    if exe:
        return [exe]
    print("No Gradle found: install Gradle (https://gradle.org/install/)")
    print("or provide android/gradle/wrapper/gradle-wrapper.jar, then rerun.")
    sys.exit(2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--assets-only", action="store_true")
    mode.add_argument("--release", action="store_true", help="Build an unsigned release for F-Droid")
    args = parser.parse_args()
    sync_assets()
    if args.assets_only:
        print("assets-only: %s" % ASSETS_WWW)
        return
    for var in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        if os.environ.get(var):
            print("%s=%s" % (var, os.environ[var]))
    variant = "release" if args.release else "debug"
    filename = "app-release-unsigned.apk" if args.release else "app-debug.apk"
    apk = ANDROID / "app/build/outputs/apk" / variant / filename
    destination = ROOT / "dist" / ("pengo-release-unsigned.apk" if args.release else "pengo-debug.apk")
    cmd = find_gradle() + [":app:assembleRelease" if args.release else ":app:assembleDebug", "--console=plain"]
    print("running:", " ".join(cmd), "in", ANDROID)
    subprocess.run(cmd, cwd=str(ANDROID), check=True)
    if not apk.is_file():
        raise RuntimeError("APK not produced: %s" % apk)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(apk, destination)
    print("APK: %s" % destination)
    if args.release:
        print("Unsigned release: F-Droid must sign this before installation/distribution.")


if __name__ == "__main__":
    main()
