"""Build the offline KnowKanji APK (debug).

Steps:
  1. python scripts/sync_www.py            -> www/
  2. copy www/ into android assets          -> android/app/src/main/assets/www/
  3. run Gradle assembleDebug               -> android/app/build/outputs/apk/debug/app-debug.apk
  4. copy APK to dist/knowkanji-debug.apk

Prerequisites (once): JDK 17+, Android SDK (platform-34 + build-tools),
and either a system Gradle or the wrapper jar. See README.md.

Run:  python scripts/build_apk.py [--assets-only]
"""
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANDROID = ROOT / "android"
ASSETS_WWW = ANDROID / "app" / "src" / "main" / "assets" / "www"
APK = ANDROID / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
DIST = ROOT / "dist" / "knowkanji-debug.apk"


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
    subprocess.run([sys.executable, str(ROOT / "scripts" / "sync_www.py")], check=True)
    robust_rmtree(ASSETS_WWW)
    shutil.copytree(ROOT / "www", ASSETS_WWW)
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
    sync_assets()
    if "--assets-only" in sys.argv:
        print("assets-only: %s" % ASSETS_WWW)
        return
    for var in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        if os.environ.get(var):
            print("%s=%s" % (var, os.environ[var]))
    cmd = find_gradle() + [":app:assembleDebug", "--console=plain"]
    print("running:", " ".join(cmd), "in", ANDROID)
    subprocess.run(cmd, cwd=str(ANDROID), check=True)
    assert APK.is_file(), "APK not produced: %s" % APK
    DIST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(APK, DIST)
    print("APK: %s" % APK)
    print("copy: %s" % DIST)


if __name__ == "__main__":
    main()