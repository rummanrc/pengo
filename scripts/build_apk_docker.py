"""Build the offline Pengo APK inside Docker.

No local JDK / Android SDK / Gradle needed - only Docker Desktop
(Linux containers) running.

Run: python3 scripts/build_apk_docker.py [--release] [--tag NAME] [--no-cache]

Result: dist/pengo-debug.apk, or dist/pengo-release-unsigned.apk for F-Droid.
"""
import argparse
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

TAG = "pengo-builder"
ROOT = Path(__file__).resolve().parent.parent


def run(cmd):
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", action="store_true", help="Build an unsigned release for F-Droid")
    parser.add_argument("--tag", default=TAG)
    parser.add_argument("--no-cache", action="store_true")
    args = parser.parse_args()
    if not shutil.which("docker"):
        print("Docker CLI not found: install Docker Desktop, then rerun.")
        sys.exit(2)
    variant = "release" if args.release else "debug"
    filename = "pengo-release-unsigned.apk" if args.release else "pengo-debug.apk"
    container = "pengo-apk-extract-" + uuid.uuid4().hex[:12]
    destination = ROOT / "dist" / filename
    tag = args.tag + ":" + variant if ":" not in args.tag else args.tag
    run([
        "docker",
        "build",
        "--platform=linux/amd64",
        "-f",
        str(ROOT / "docker/Dockerfile"),
        "--build-arg",
        "BUILD_TYPE=" + variant,
        "-t",
        tag,
    ] + (["--no-cache"] if args.no_cache else []) + [str(ROOT)])
    run(["docker", "create", "--platform=linux/amd64", "--name", container, tag])
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        run(["docker", "cp", container + ":/app/dist/" + filename, str(destination)])
    finally:
        subprocess.run(["docker", "rm", "-f", container],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("APK:", destination)
    if args.release:
        print("Unsigned release: F-Droid signs the official build; this APK cannot be installed as-is.")


if __name__ == "__main__":
    main()
