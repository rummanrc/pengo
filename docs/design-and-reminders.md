# Pengo's adventure design and reminders

Implemented and verified on **2026-10-07 (Asia/Tokyo)**. These changes build on [daily learning improvements](learning-improvements.md). They take inspiration from approachable learning apps while keeping Pengo's own penguin character, Japanese study content, and real progress.

## Delivered features

| Feature | Learner experience | Implementation |
| --- | --- | --- |
| Adventure Home | A welcoming mascot, a clear three-question start, resume after interruption, and encouraging goal-complete copy | `design.js`, Home renderers |
| Learning trail | Actionable due review, mixed practice, and the current plan batch; completion comes from real state | `adventurePathHTML` |
| Daily progress | A goal ring, seven days of actual practice, streak, achievements, and learning milestones | `dailyPracticeCardHTML`, existing Practice/Course rules |
| Quick practice | One tap for a mix, due reviews, mistakes, or recall; detailed choices remain under “Build your own session” | `practice-ui.js`, `practiceQuickChoicesHTML` |
| Expressive Pengo | A new waving illustration, rotating study tips, supportive answer feedback, and a brief completion celebration | Mascot assets, `bindPengoUI`, player/result helpers |
| Consistent styling | Warm backgrounds, teal controls, pastel cards, raised buttons, clear navigation, and matching dark mode | Adventure section in `styles.css`, native system bars |
| Respectful motion | Short entrance/feedback animations and finite celebrations; reduced motion disables decorative animation | CSS motion rules |
| Optional return reminders | A chosen local time, explicit opt-in, test notification, and clear platform limitations | `reminders.js`, native reminder classes, worker |

Home offers a stopping point after the daily goal. Quick starts preserve a saved session rather than replacing it. There is no fabricated XP, leaderboard, streak penalty, automatic endless session, or measured retention claim. Session lengths, illustrations, copy, and reminders should be evaluated with actual learners.

## Mascot asset and generation record

The new transparent illustration is [assets/pengo-adventure.png](../assets/pengo-adventure.png). It was generated using the **built-in image generation tool**, with [assets/pengo-mascot.png](../assets/pengo-mascot.png) as the character identity reference. The original remains available. The generated image was copied without raster edits; existing study/happy illustrations supply answer feedback. Small interface icons remain inline SVG.

Final generation prompt:

> Use case: stylized-concept. Asset type: transparent mascot illustration for the Pengo Japanese learning app home hero. Input image is a character identity reference. Create a new full-body pose of exactly this cheerful small navy-blue penguin, preserving its white face and belly, rosy round cheeks, golden beak and feet, little swept-up tuft, and bright blue backpack. Pengo is standing proudly, holding a small green Japanese study book under one flipper and waving with the other, with a delighted encouraging smile. Keep the existing polished rounded cartoon illustration style with clean navy edges and gentle dimensional shading. Add just two small golden sparkle accents near the raised flipper. Composition: single centered character, fully visible from tuft to feet, generous transparent margin, no environment, no ground, no text, no lettering, no watermark. Actual transparent background. This is an expressive welcome mascot, not a Duolingo character.

## Reminder behavior

Reminders default to **off**, with a suggested time of 19:00. Settings requests notification permission only after the learner presses Enable. Denial leaves reminders off and provides settings/calendar guidance. Changing a reminder time does not clear the daily duplicate guard.

Pengo delivers at most one daily reminder, within the first hour after the chosen local time, when the daily practice goal is still unmet. It skips stale delivery instead of producing a late nag. Test notifications are explicit actions and do not consume the daily reminder. Notification taps open `#/practice?start=1&size=3`, which resumes an existing session when present.

### Native Android

`StudyReminders` owns device preferences, notification channel `pengo_daily_practice`, and an inexact `AlarmManager.setAndAllowWhileIdle` alarm. `ReminderReceiver` delivers and schedules the next local day without starting the WebView. `ReminderRestoreReceiver` restores opted-in schedules after boot, device clock/timezone changes, or package updates. `ReminderTime` computes local calendar times instead of adding a fixed 24 hours.

Android 13+ uses the `POST_NOTIFICATIONS` runtime permission. Older supported versions still honor app/channel notification settings. No internet or exact-alarm permission is introduced. Android/battery policies can delay inexact alarms; reminders are invitations rather than precise appointments. See the official [alarm behavior](https://developer.android.com/develop/background-work/services/alarms) and [notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission) references.

The JavaScript bridge sends the goal-complete date after learning/answers, goal changes, imports, and startup. This suppresses today's native reminder and removes an outstanding daily notification. Notifications never depend on a browser timer on Android. A force-stopped app or restrictive device settings can prevent delivery until the learner reopens it.

### Hosted browser

In a secure context with notification support, explicit opt-in registers `reminder-worker.js`. The page checks every 30 seconds and on visibility changes; browser throttling or suspension can delay these checks. `ServiceWorkerRegistration.showNotification` displays the notification, and the worker handles notification taps. It does **not** schedule reminders, cache study files, or implement push subscriptions. Mobile notification display uses the service-worker API described by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API).

Daily browser alerts require Pengo to remain open, possibly in a background tab. Closed-page push would require a push service/backend, as described in [the Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API); none is added here. Unsupported browsers retain the calendar option. Hosted offline reload remains a separate caching project.

“Add to calendar” downloads a recurring five-minute `.ics` event with the selected floating local time and a display alarm. The learner must import it and choose alert settings in their calendar app. Calendar reminders can work after closing Pengo, but follow the calendar's behavior and cannot check the Pengo daily goal. Turning off or erasing Pengo reminders does not remove an event already imported into an external calendar.

## Storage and privacy

Browser device preferences use `pengo:reminders:v1` (`enabled`, `time`, `lastDate`). Android uses private SharedPreferences `pengo_reminders`, with permission/schedule/delivery and goal-date state. These preferences are separate from transferable `knowkanji:v1` progress backups. Importing progress does not enable reminders on a new device or replace its reminder time; it does update native goal suppression. Confirmed erasure turns off Pengo reminders, cancels the native alarm, and resets device preferences. OS permission remains the OS's choice.

No account, analytics, remote push server, or notification credential is introduced. Android's existing platform backup setting still applies; “outside progress backups” does not mean excluded from OS backups.

## Validation and practical limits

- `npm test`: 97 course assertions, 37 practice checks, 17 reminder-rule checks, and 7 notification-worker checks.
- Existing Chrome practice integration: 46 checks, including saved sessions, shared SRS, backups, and fallback data loading.
- Chrome design/reminder integration: 40 checks, including live service-worker notification display in an isolated context, permission denial, calendar download, goal/duplicate suppression, device-preference isolation, erasure, dark mode, reduced motion, and route layouts at 320/390/768/1024/1440px.
- Native JUnit/Robolectric: 26 tests, including full activity startup/permission callbacks, cold notification entry, independent receiver delivery, channel denial, late/duplicate suppression, goal completion, boot/timezone restoration, and daylight-saving transitions.
- Android debug APK compilation and runtime asset parity verified.

Run commands are in [testing](testing.md). These checks do not establish physical-device delivery under OEM power management, complete accessibility conformance, or improved retention/JLPT outcomes. Device acceptance and learner observation remain separate evidence.
