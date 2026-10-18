# iOS debug builds

Pengo has a standalone Swift/UIKit project at `ios/Pengo.xcodeproj`, targeting iOS/iPadOS 15 or later. It wraps the existing web runtime in WKWebView; no npm install, Capacitor migration, backend, or CocoaPods are needed. Android continues to use its existing Java shell.

## Run on your iPhone

1. Install full Xcode on a Mac. Launch it once to complete setup and install an iOS platform/runtime compatible with your phone. Command-line tools alone are insufficient. Select the full Xcode installation under **Xcode Settings → Locations → Command Line Tools**.
2. From the repository root, run `python3 scripts/build_ios.py --assets-only`.
3. Open `ios/Pengo.xcodeproj`. Select the **Pengo** target, then **Signing & Capabilities**. Leave **Automatically manage signing** enabled.
4. Sign into your Apple Account in Xcode Settings and select your **Personal Team**, or your paid development team. If `io.github.rummanrc.pengo` cannot be registered by your team, use a unique identifier such as `com.yourname.pengo.debug`. Keep it stable between updates to preserve the installation's data.
5. Connect and unlock your iPhone, trust the Mac, and select the phone as the run destination. Enable **Settings → Privacy & Security → Developer Mode** when prompted, restart, and confirm. If iOS asks you to trust the developer, follow its prompt in **Settings → General → VPN & Device Management**.
6. Press **Run** (⌘R). Xcode signs and installs the debug app. Later updates can use paired wireless debugging.

This is supported development installation outside the App Store. A free Apple Account suffices for basic personal-device testing. Apple currently limits Personal Teams to three installed apps per device and seven-day provisioning profiles; refresh the signing before expiry or rebuild/reinstall afterward. Update the existing installation rather than uninstalling if you want to retain progress. Export a backup before changing the bundle identifier or removing the app. See [Apple's Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account), [running on a device](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices), and [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).

You cannot install an unsigned iOS app the way you install an Android debug APK. Sending an arbitrary `.ipa` to another iPhone does not grant that device permission to run it. A personal sideloader can sign the IPA using the recipient's Apple Account as described below. For distributing provisioned builds to testers, use a paid Developer Program team with [registered-device distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices) or [TestFlight](https://developer.apple.com/testflight/). Store submission and distribution archives are separate release work.

## Personal installation with SideStore or AltStore Classic

Build an unsigned **device** IPA for the sideloader to sign:

```sh
npm run build:ipa
```

Output: `dist/pengo-ios-unsigned.ipa`, containing `Payload/Pengo.app` built in Release configuration for iPhoneOS (arm64). This is not the simulator app and is not directly installable until signed. The build requires Xcode, but no Apple Account, signing team, or connected phone. Rebuild the same way after changing the app.

For SideStore:

1. Follow the official [prerequisites](https://docs.sidestore.io/docs/installation/prerequisites) and [installation guide](https://docs.sidestore.io/docs/installation/install): install LocalDevVPN on the iPhone and iloader on the Mac, connect the phone by USB, trust the Mac, and use iloader to set up SideStore. Enter account credentials and verification codes directly into those apps.
2. Use a current official SideStore build. As checked on 2026-10-18, the [release notes](https://github.com/SideStore/SideStore/releases) say 0.6.4 and earlier have broken sign-in, while 0.7.0-alpha includes a fix. The [error guide](https://docs.sidestore.io/docs/troubleshooting/error-codes) directs iOS 26.4+ users with Minimuxer error 27 to the nightly channel. This matters for iOS 26.6.1; setup and refresh still require testing on the actual phone.
3. Enable Developer Mode and trust the developer as instructed. With Wi-Fi and LocalDevVPN connected, sign into SideStore using the same account and refresh SideStore itself once.
4. Transfer `pengo-ios-unsigned.ipa` to the iPhone's Files app, then import it using SideStore's app-install control. SideStore signs it for that phone. Open Pengo and check offline study, backup pickers, reminders, and progress persistence.
5. Configure refresh automation using the installed SideStore version's Shortcuts actions. Test the refresh manually first and confirm the expiry counters reset for both SideStore and Pengo. A daily trigger leaves time to notice a failure; it does not guarantee iOS will execute it successfully. Keep a backup of study progress using Pengo's export feature.

[SideStore's FAQ](https://docs.sidestore.io/docs/faq) describes on-device refresh after initial computer setup. Free-account signing still expires after seven days if refresh fails. Wi-Fi and LocalDevVPN must be available for a refresh; a pairing-file or authentication failure can require computer-assisted recovery. This workflow automates renewal rather than removing Apple's signing expiry.

[AltStore Classic](https://faq.altstore.io/altstore-classic/altserver) can sign the same IPA and refresh it when the phone can reach AltServer on the Mac through the same Wi-Fi network or USB. LiveContainer is optional for hosting more apps within the free account's app limit; Pengo does not require it, and its file-picker/notification compatibility has not been tested there.

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

Output: `dist/pengo-ios-device/Pengo.app`; it is for provisioned devices, not the simulator. Xcode Run is the easiest personal-device installation path. The `--ipa` mode above packages an unsigned device IPA for a sideloader; it does not export an App Store/ad hoc archive or embed credentials. Generated assets/builds and per-user Xcode settings are ignored.

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

On 2026-10-18, `npm run build:ios` succeeded with Xcode 27.1 (27A9275) and the iOS Simulator 27.1 SDK, producing `dist/pengo-ios-simulator/Pengo.app`. `npm run test:ios` passed all 31 Foundation checks and the JavaScript bridge checks, and `npm test` passed. `npm run build:ipa` also succeeded with the iPhoneOS 27.1 SDK. Its 22.6 MB archive was checked for ZIP integrity, iPhoneOS/arm64 targeting, executable permissions, and an exact copy of every staged offline runtime file. No simulator runtime or connected iPhone was available, so simulator launch, SideStore installation/refresh, and iPhone acceptance remain unverified. Before calling the port device-tested, run it on the phone and check:

- Cold launch in airplane mode; first-run intro; every JLPT subject; kanji SVG stroke animations and component views.
- Study/quiz progress survives termination and a signed update; iPhone safe areas, landscape, iPad layout, dark mode, and system bars.
- Export to Files, cancel, import an Android backup, invalid backup, and confirmed data erasure.
- Notification permission opt-in/denial, saving the time, a test alert, closed-app delivery, notification tap, today's goal suppression, turn-off, and permission changes in Settings.
- Date/time-zone changes and a daylight-saving transition where relevant.

This is the acceptance gate for iOS; passing the shared web tests alone does not establish native feature parity.
