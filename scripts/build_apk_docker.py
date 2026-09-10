"""Build the offline KnowKanji APK inside Docker.

No local JDK / Android SDK / Gradle needed - only Docker Desktop
(Linux containers) running.

Run:  python scripts/build_apk_docker.py [--tag NAME] [--no-cache]

Result: dist/knowkanji-debug.apk (extracted from the built image).
"""
import shutil
import subprocess
import sys
from pathlib import Path

TAG = "knowkanji-builder"
CONTAINER = "kk-apk-extract"
APK_IN_IMAGE = "/app/dist/knowkanji-debug.apk"


def run(cmd):
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True)


def main():
    if not shutil.which("docker"):
        print("Docker CLI not found: install Docker Desktop, then rerun.")
        sys.exit(2)
    tag = TAG
    extra = []
    for i, a in enumerate(sys.argv[1:]):
        if a == "--tag" and i + 1 < len(sys.argv[1:]):
            tag = sys.argv[1:][i + 1]
        if a == "--no-cache":
            extra.append("--no-cache")
    run(["docker", "build", "-f", "docker/Dockerfile", "-t", tag] + extra + ["."])
    subprocess.run(["docker", "rm", "-f", CONTAINER],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    run(["docker", "create", "--name", CONTAINER, tag])
    Path("dist").mkdir(parents=True, exist_ok=True)
    try:
        run(["docker", "cp", "%s:%s" % (CONTAINER, APK_IN_IMAGE), "dist/knowkanji-debug.apk"])
    finally:
        subprocess.run(["docker", "rm", "-f", CONTAINER],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("APK: dist/knowkanji-debug.apk")


if __name__ == "__main__":
    main()