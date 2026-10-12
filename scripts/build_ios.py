"""Stage the shared offline runtime or build a debug iOS app with full Xcode.

python3 scripts/build_ios.py --assets-only
python3 scripts/build_ios.py                       # unsigned simulator .app
python3 scripts/build_ios.py --device --team TEAMID # signed device .app
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IOS = ROOT / "ios"


def stage():
    subprocess.run([sys.executable, str(ROOT / "scripts/sync_www.py")], check=True)
    destination = IOS / "Pengo/www"
    shutil.rmtree(destination, ignore_errors=True)
    shutil.copytree(ROOT / "www", destination)
    icon = IOS / "Pengo/Assets.xcassets/AppIcon.appiconset/icon-1024.png"
    sips = shutil.which("sips")
    if not sips:
        raise RuntimeError("iOS staging requires macOS (sips generates the app icon).")
    subprocess.run([sips, "-z", "1024", "1024", str(ROOT / "assets/pengo-icon.png"), "--out", str(icon)], check=True, stdout=subprocess.DEVNULL)
    print("iOS assets staged:", destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-only", action="store_true")
    parser.add_argument("--device", action="store_true")
    parser.add_argument("--team", help="Apple signing team ID for a device build")
    parser.add_argument("--bundle-id", help="Optional unique personal bundle identifier")
    args = parser.parse_args()
    stage()
    if args.assets_only:
        return
    available = subprocess.run(["xcrun", "--find", "simctl"], capture_output=True, text=True)
    if available.returncode:
        parser.exit(2, "Full Xcode and its iOS SDK are required; command-line tools alone cannot build iOS. Install Xcode, open it to finish setup, and select it in Xcode Settings > Locations > Command Line Tools. Assets have been staged.\n")
    if args.device and not args.team:
        parser.error("--device requires --team TEAMID. For free Personal Team signing, first run on your iPhone from Xcode to create provisioning assets.")
    command = ["xcodebuild", "-project", str(IOS / "Pengo.xcodeproj"), "-scheme", "Pengo", "-configuration", "Debug",
               "-destination", "generic/platform=iOS" if args.device else "generic/platform=iOS Simulator",
               "-derivedDataPath", str(IOS / "build"), "build"]
    if args.device:
        command += ["-allowProvisioningUpdates", "DEVELOPMENT_TEAM=" + args.team]
    else:
        command += ["CODE_SIGNING_ALLOWED=NO"]
    if args.bundle_id:
        command += ["PRODUCT_BUNDLE_IDENTIFIER=" + args.bundle_id]
    subprocess.run(command, check=True)
    built = IOS / "build/Build/Products" / ("Debug-iphoneos" if args.device else "Debug-iphonesimulator") / "Pengo.app"
    if not built.is_dir():
        raise RuntimeError("Xcode did not produce " + str(built))
    destination = ROOT / "dist" / ("pengo-ios-device" if args.device else "pengo-ios-simulator") / "Pengo.app"
    shutil.rmtree(destination, ignore_errors=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(built, destination)
    print("Debug app:", destination)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
