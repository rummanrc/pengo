# Nonfunctional requirements — 非機能要件定義書

**Status:** Draft worksheet, 2026-10-07. **Owner/reviewer:** Unassigned. IDs/criteria organize future agreement; they are not approved SLAs or verified results.

The approach uses [IPA's customizable nonfunctional guidance](https://www.ipa.go.jp/archive/digital/iot-en-ci/jyouryuu/hikinou/ent03-b.html) as a reference. Pengo criteria below are our app-specific recommendations, not a copied grade selection.

## Quality worksheet

| ID | Area / Japanese category | Current baseline | Criterion to agree | Evidence |
| --- | --- | --- | --- | --- |
| N-01 | Availability / 可用性 | Native bundled assets, no internet permission | Core library/art/plan/progress/backup work without app network on agreed devices | Airplane-mode T-15 |
| N-02 | Recovery | localStorage/manual backup | Data-loss tolerance, backup guidance, corrupt-state recovery/transfer; no server recovery assumed | T-07/T-12, failure report |
| N-03 | Performance / 性能・拡張性 | Full datasets loaded; current staged runtime ~40.4 MiB | Reference device/browser and cold-start/search/memory/size/import limits | Measurements; thresholds TBD |
| N-04 | Capacity | Local scans and whole-store writes | Largest expected dataset/notes/backup and acceptable behavior | Representative large-store check |
| N-05 | Maintainability / 運用・保守性 | Runbooks, debug build, no CI | New maintainer reproduces clean package/checks without undocumented state | Rebuild/handover rehearsal |
| N-06 | Support | No production support/SLA | Channel, response expectations, maintenance/incident roles | Owner record; targets TBD |
| N-07 | Migration / 移行性 | Direct backup, order-sensitive IDs | Oldest supported backup/data, ID mapping, origin/device transfer | Old-backup roundtrip, ID diff |
| N-08 | Plan migration | Pace/data derive batches | Define unlocked membership after pace/content updates | T-09, decision |
| N-09 | Security / セキュリティ | Trusted HTML/SVG, shallow import, bridge | Permitted content/URLs, validation/size limits, save-error reporting, artifact controls | Boundary/malformed-input checks |
| N-10 | Privacy | No account/analytics; plaintext backup; allowBackup | Actual hosting/support/device data handling and notice/retention responsibilities | Operator data-flow review |
| N-11 | Environment / システム環境・エコロジー | SDK min24, target34; browser matrix unset | Supported OS/WebView/browser/devices and toolchain | Platform matrix/results |
| N-12 | Resource use | Timers/local assets; opt-in native OS alarm | Decide battery/storage targets or explicit exclusions for irrelevant infrastructure items | Measurement or scope decision |
| N-13 | Accessibility/usability / 使用性・アクセシビリティ | Focus/labels/reduced motion; no audit | Learner/language needs, accessibility target, chosen assistive tools | T-14/T-15, audit evidence |
| N-14 | Content / 学習コンテンツ品質 | Generated examples/readings; rights gaps | Named linguistic reviewer, provenance/permission review, correction process | Content/rights record |

## Platform matrix

Configured compatibility is not tested support. Complete exact versions and evidence for each promise.

| Platform | Configured baseline | Reference versions/devices | Commitment/evidence |
| --- | --- | --- | --- |
| Desktop web | Modern JavaScript | TBD | TBD; T-01/T-04/T-14 pending |
| Mobile web | Responsive/safe areas | TBD | TBD; T-14 pending |
| Native Android | minSdk 24 | TBD | TBD; T-15 pending |
| Direct file browser | JSON fallback; SVG restrictions | TBD | Decide supported or best-effort; T-02 pending |
| Capacitor | Incomplete scaffolding | No accepted candidate | Separate implementation required |

## Agreement record

| Field | Value |
| --- | --- |
| Requirement revision/source commit | TBD |
| Selected IDs/exact thresholds/exclusions | TBD |
| Product/engineering/QA/operations reviewers | Unassigned |
| Decision/date/evidence | Pending |

Record target changes in [the register](register.md), results in [acceptance](review-and-acceptance.md), and remaining conditions in [handover](release-and-handover.md).
