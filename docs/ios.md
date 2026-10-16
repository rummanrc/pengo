# iOS debug builds

Pengo has a standalone Swift/UIKit project at `ios/Pengo.xcodeproj`, targeting iOS/iPadOS 15 or later. It wraps the existing web runtime in WKWebView; no npm install, Capacitor migration, backend, or CocoaPods are needed. Android continues to use its existing Java shell.

## Run on your iPhone

1. Install full Xcode on a Mac. Launch it once to complete setup and install an iOS platform/runtime compatible with your phone. Command-line tools alone are insufficient. Select the full Xcode installation under **Xcode Settings → Locations → Command Line Tools**.
2. From the repository root, run `python3 scripts/build_ios.py --assets-only`.
3. Open `ios/Pengo.xcodeproj`. Select the **Pengo** target, then **Signing & Capabilities**. Leave **Automatically manage signing** enabled.
4. Sign into your Apple Account in Xcode Settings and select your **Personal Team**, or your paid development team. If `io.github.rummanrc.pengo` cannot be registered by your team, use a unique identifier such as `com.yourname.pengo.debug`. Keep it stable between updates to preserve the installation's data.
5. Connect and unlock your iPhone, trust the Mac, and select the phone as the run destination. Enable **Settings → Privacy & Security → Developer Mode** when prompted, restart, and confirm. If iOS asks you to trust the developer, follow its prompt in **Settings → General → VPN & Device Management**.
6. Press **Run** (⌘R). Xcode signs and installs the debug app. Later updates can use paired wireless debugging.

This is supported development installation outside the App Store. A free Apple Account suffices for basic personal-device testing. Apple currently limits Personal Teams to three installed apps per device and seven-day provisioning profiles; rebuild/reinstall after expiry. Update the existing installation rather than uninstalling if you want to retain progress. Export a backup before changing the bundle identifier or removing the app. See [Apple's Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account), [running on a device](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices), and [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).

You cannot install an unsigned iOS app the way you install an Android debug APK. Sending an arbitrary `.ipa` to another iPhone does not grant that device permission to run it. For distributing to testers, use a paid Developer Program team with [registered-device distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices) or [TestFlight](https://developer.apple.com/testflight/). This project prepares debug builds; store submission and distribution archives are separate release work.

## Simulator and command-line builds

Select an installed iPhone simulator in Xcode and press Run; no signing account or physical device is required. To build an unsigned simulator app:

```sh
npm run build:ios
```

Output: `dist/pengo-ios-simulator/Pengo.app`. After booting a simulator:

```sh
xcrun simctl install booted dist/pengo-ios-simulator/Pengo.app
xcrun simctl launch booted io.github.rummanrc.pengo
```

For a signed device build, first establish signing in Xcode, then:

```sh
python3 scripts/build_ios.py --device --team YOUR_TEAM_ID --bundle-id com.yourname.pengo.debug
```

Output: `dist/pengo-ios-device/Pengo.app`; it is for provisioned devices, not the simulator. Xcode Run is the easiest personal-device installation path. The builder does not export an IPA or embed credentials. Generated assets/builds and per-user Xcode settings are ignored.

The Xcode build phase restages the web assets and app icon automatically. Edit root runtime files, not `ios/Pengo/www/`. The shell uses `pengo://app/index.html` as a stable local origin, serves only files below the bundled `www/`, blocks remote embedded resources with CSP, and opens explicitly tapped external links in the system browser. Persistent WKWebView storage keeps the existing web data keys. Import/export uses native Files pickers and the same JSON format as Android. Notification taps open Home. JavaScript confirmation dialogs support confirmed data erasure and plan removal. Debug builds enable Safari Web Inspector on supported iOS versions.

## Reminders

Reminders are off until explicitly enabled. iOS local notifications require no push entitlement or server. The bridge maintains a cache for the web app's synchronous reminder reads and refreshes it after permission changes or app activation.

The shell schedules at most one notification per date for the next 60 calendar days and renews the window whenever the app activates. It cancels today's pending reminder when the web app reports that today's goal is complete. A saved goal from yesterday does not suppress tomorrow. Because iOS cannot execute arbitrary app logic at notification delivery while terminated, goal suppression uses the last state reported by this installation. Open Pengo at least every 60 days to keep reminders scheduled. Local-time triggers follow the device clock; schedule renewal also runs on significant time changes. Focus, notification settings, device state, and OS delivery behavior can affect alerts.

## Verification and remaining acceptance

```sh
npm test
npm run test:ios
```

The iOS checks compile/run the Foundation date scheduler and file-path boundary logic on macOS and exercise bridge calls, platform detection, and onboarding in Node. They do **not** compile UIKit/WebKit or run an iOS app.

The initial implementation was staged and checked on a Mac with only command-line tools. Full Xcode compilation and simulator/iPhone acceptance remain unverified. Before calling the port device-tested, build it in Xcode and check:

- Cold launch in airplane mode; first-run intro; every JLPT subject; kanji SVG stroke animations and component views.
- Study/quiz progress survives termination and a signed update; iPhone safe areas, landscape, iPad layout, dark mode, and system bars.
- Export to Files, cancel, import an Android backup, invalid backup, and confirmed data erasure.
- Notification permission opt-in/denial, saving the time, a test alert, closed-app delivery, notification tap, today's goal suppression, turn-off, and permission changes in Settings.
- Date/time-zone changes and a daylight-saving transition where relevant.

This is the acceptance gate for iOS; passing the shared web tests alone does not establish native feature parity.
