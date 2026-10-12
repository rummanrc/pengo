"""Check Foundation scheduling/path boundaries and the JS bridge without an iOS SDK.
This does not replace a full Xcode build or WKWebView/device acceptance tests.
"""
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
subprocess.run(["node", str(ROOT / "tests/test_ios_bridge.cjs")], check=True)
with tempfile.TemporaryDirectory(prefix="pengo-ios-tests-") as directory:
    binary = Path(directory) / "ios-tests"
    subprocess.run(["swiftc", "-swift-version", "5", str(ROOT / "ios/Pengo/ReminderPlan.swift"),
                    str(ROOT / "ios/Pengo/OfflineFiles.swift"), str(ROOT / "tests/ios/main.swift"), "-o", str(binary)], check=True)
    subprocess.run([str(binary)], check=True)
