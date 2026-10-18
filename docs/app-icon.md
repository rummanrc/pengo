# App icon

The master is `assets/pengo-icon.png`: an opaque 1024×1024 PNG with a large
Pengo portrait and book on an edge-to-edge mint background. Keep corners opaque;
iOS and modern Android launchers apply their own masks. The old inset illustration
and unrelated letter-P SVG favicon have been replaced by this shared artwork.

## Regeneration

After replacing the master, run `python3 scripts/build_icons.py` in a development
environment with Pillow installed. This updates the five Android density sets,
Android 7.1 round fallback icons, the adaptive artwork, and the 512px F-Droid
store image. Pillow is only needed to regenerate icons, not to build the app.
The existing iOS staging script derives its 1024px icon from the same master.
The web favicon, Apple touch icon, notification image and manifest use the master.

Android API 26+ resolves `mipmap-anydpi-v26/ic_launcher*.xml` to adaptive icons.
The foreground fills the central 72dp viewport of the 108dp adaptive canvas;
the launcher supplies its circle/squircle mask. Do not bake another icon-shaped
tile or transparent margin into this artwork. Older Android versions use the
checked-in density PNGs. See the [Android adaptive icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

## Visual acceptance

Check 32px and 48px previews, circle/squircle masks, and light/dark surfaces.
Pengo's eyes and beak must remain readable after masking. Check that the master,
store image and iOS icon have no alpha channel, that density sizes are
48/72/96/144/192px, and that the manifest size matches the master. Build Android
resources and restage iOS assets before shipping. Physical launcher acceptance
still requires installing the rebuilt app on each platform.

Verified on 2026-10-18: 32/48px and circle/squircle previews inspected; all
13 exported PNG dimensions, opacity and round masks checked; exports reproduce
byte for byte. `npm test`, Docker debug APK assembly, iOS asset staging and
Xcode `actool` icon compilation passed. The APK's web icon/HTML/manifest match
source, both adaptive definitions are packaged, and the old SVG is absent from
the APK. Physical Android/iOS launcher behavior was not tested.

## Artwork provenance

Generated on 2026-10-18 using the built-in image generation tool, with
`assets/pengo-mascot.png` as the character reference. The generated image was
resized to the 1024px master; other exports only resize or apply legacy circular
launcher masks. Final generation prompt:

> Use case: logo-brand. Create one finished production app icon for Pengo, a friendly Japanese study app. Input image is a CHARACTER IDENTITY REFERENCE only: preserve Pengo's navy penguin, cream white heart-shaped face, simple dark oval eyes, golden yellow happy beak and subtle pink cheeks. Simplify into a bold polished mascot portrait, with the large front-facing head dominating the square and just a hint of the familiar green open book at bottom. Background: solid mint teal edge to edge, opaque square. Composition: a very large close-up face, centered, symmetrical friendly expression. Main facial features must remain inside the central 60 percent circular safe area so Android launcher cropping works; dark head silhouette may extend out toward edges. The penguin should occupy about 85 percent of image width. Crisp clean smooth illustration, very minimal shading, thick readable shapes. Must be clearly recognizable at 32px. No tiny full-body character, no backpack, no scenery, no mountains, no white outer margins, no inset icon tile, no circular badge, no rounded-corner cutout, no border, no lettering, no watermark. Deliver a square 1024x1024 icon with fully opaque background right to all four edges.
