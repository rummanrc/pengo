"""Stage the shared offline runtime or build an iOS app with full Xcode.

python3 scripts/build_ios.py --assets-only
python3 scripts/build_ios.py                       # unsigned simulator .app
python3 scripts/build_ios.py --device --team TEAMID # signed device .app
python3 scripts/build_ios.py --ipa                  # unsigned device IPA for a sideloader
"""
import argparse
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

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
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--assets-only", action="store_true")
    mode.add_argument("--device", action="store_true")
    mode.add_argument("--ipa", action="store_true", help="Build an unsigned Release IPA for SideStore/AltStore to sign")
    parser.add_argument("--team", help="Apple signing team ID for a device build")
    parser.add_argument("--bundle-id", help="Optional unique personal bundle identifier")
    args = parser.parse_args()
    if args.device and not args.team:
        parser.error("--device requires --team TEAMID. For free Personal Team signing, first run on your iPhone from Xcode to create provisioning assets.")
    if args.team and not args.device:
        parser.error("--team is only used with --device; --ipa is signed later by your sideloader.")
    stage()
    if args.assets_only:
        return
    available = subprocess.run(["xcrun", "--find", "simctl"], capture_output=True, text=True)
    if available.returncode:
        parser.exit(2, "Full Xcode and its iOS SDK are required; command-line tools alone cannot build iOS. Install Xcode, open it to finish setup, and select it in Xcode Settings > Locations > Command Line Tools. Assets have been staged.\n")
    device_build = args.device or args.ipa
    configuration = "Release" if args.ipa else "Debug"
    command = ["xcodebuild", "-project", str(IOS / "Pengo.xcodeproj"), "-scheme", "Pengo", "-configuration", configuration,
               "-destination", "generic/platform=iOS" if device_build else "generic/platform=iOS Simulator",
               "-derivedDataPath", str(IOS / "build"), "build"]
    if args.device:
        command += ["-allowProvisioningUpdates", "DEVELOPMENT_TEAM=" + args.team]
    else:
        command += ["CODE_SIGNING_ALLOWED=NO"]
    if args.bundle_id:
        command += ["PRODUCT_BUNDLE_IDENTIFIER=" + args.bundle_id]
    subprocess.run(command, check=True)
    platform = "iphoneos" if device_build else "iphonesimulator"
    built = IOS / "build/Build/Products" / (configuration + "-" + platform) / "Pengo.app"
    if not built.is_dir():
        raise RuntimeError("Xcode did not produce " + str(built))
    output = "pengo-ios-unsigned" if args.ipa else ("pengo-ios-device" if args.device else "pengo-ios-simulator")
    destination = ROOT / "dist" / output / "Pengo.app"
    shutil.rmtree(destination, ignore_errors=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(built, destination)
    print(configuration + " app:", destination)
    if args.ipa:
        with (destination / "Info.plist").open("rb") as source:
            info = plistlib.load(source)
        if info.get("CFBundleSupportedPlatforms") != ["iPhoneOS"]:
            raise RuntimeError("An IPA requires an iPhoneOS build, not a simulator app.")
        ipa = ROOT / "dist/pengo-ios-unsigned.ipa"
        with ZipFile(ipa, "w", compression=ZIP_DEFLATED) as archive:
            for path in sorted(destination.rglob("*")):
                if path.is_file():
                    archive.write(path, "Payload/Pengo.app/" + path.relative_to(destination).as_posix())
        print("Unsigned IPA (must be signed by SideStore/AltStore before installation):", ipa)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
