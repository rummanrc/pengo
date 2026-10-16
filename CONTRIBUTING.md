# Contributing to Pengo

Use the [development guide](docs/development.md) to run Pengo and the [AI guide](docs/ai-guide.md) to find implementation entry points. Preserve the static web runtime and offline native packaging unless the task changes that architecture.

## Workflow

1. Inspect behavior and relevant docs. Check `git status` so unrelated work is preserved.
2. Edit source, not `www/` or staged Android assets. For data changes, first confirm the [pipeline inputs](docs/data-pipeline.md) exist.
3. Run checks appropriate to the change using [testing](docs/testing.md). `SKIP` is not a pass.
4. Update affected contract documentation and acceptance checks.
5. Review the diff for unexpected data/ID changes, fallback-bundle consistency, and credits.

No formatter, linter, CI workflow, or PR template is checked in. Follow nearby code style. Keep `course.js` compatible with the dukpy harness; other runtime code already uses modern JavaScript.

## Review checklist

- Describe the trigger and resulting behavior, with meaningful validation and any checks that could not run.
- Explain content source and changes to IDs/counts/examples/furigana; rebuild `data/bundle.js` when data changes.
- Confirm new runtime files are included by packaging.
- Keep `pengo:v1` and the released Android application ID stable. The pre-release rename migrates legacy browser progress; a change of native application ID requires backup export/import.
- Check relevant mobile/desktop layouts, both themes, focus, Japanese text, and reduced motion.
- Carry attribution changes with new content.

## Documentation ownership

| Change | Owning documents |
| --- | --- |
| Capabilities/journeys | `docs/product.md`, root README |
| Components/startup | `docs/architecture.md`, `docs/decisions.md` |
| Routes/styles | `docs/frontend.md` |
| Storage/IDs/backups | `docs/data-model.md`, `docs/security.md` |
| Build inputs/transforms | `docs/data-pipeline.md` |
| Plan/SRS behavior | `docs/course.md`, `docs/interfaces.md` |
| Packaging/toolchain/versioning | `docs/deployment.md` |
| Checks/regressions | `docs/testing.md` |
| Confirmed/fixed limitations | `docs/maintenance.md` |
| Company requirements, review, acceptance, handover | `docs/company-delivery.md`, relevant `docs/delivery/` records |

`docs/verification.md` is a dated record; rerun checks and update its date before presenting old results as evidence for new changes.

Generated `data/` is tracked. `www/`, `dist/`, Gradle output, and staged native assets are ignored. Local virtual environments are not currently ignored; keep them outside the repo or avoid adding them. Resources are tracked ordinary files in this checkout, despite upstream submodule text. Original contributions are Apache-2.0; keep `resources/CREDITS.md` and the separate third-party data licenses with distributed content.
