# Risks, issues, and changes — リスク・課題・変更管理表

**Status:** Initial register, 2026-10-07. Owners/deadlines unassigned. [Maintenance](../maintenance.md) owns technical K-gap descriptions; link them instead of duplicating them.

An issue is observed; a risk is a potential consequence; a change alters a baseline. Track open → assigned → in progress → verified/closed, or deferred/accepted with an actual accountable decision. A recommendation is not consent.

## Initial register

| ID | Reference | Impact | Next disposition | Owner/due | Status |
| --- | --- | --- | --- | --- | --- |
| R-01 | K-01/K-08 | Content refresh not reproducible; IDs vulnerable | Recover exact inputs/provenance; agree migration | Unassigned/TBD | Open |
| R-02 | K-02 | Distribution rights/ownership unresolved | Rights/application license review | Unassigned/TBD | Open |
| R-03 | K-03/K-11 | Production native path not established | Select path, complete toolchain/signing/identity | Unassigned/TBD | Open |
| R-04 | K-04 | Persistence/import can fail or break state | Agree readiness targets/scoped fixes | Unassigned/TBD | Open |
| R-05 | K-05/K-06/K-16 | Review/due/mock-test expectations conflict | Agree product behavior/copy | Unassigned/TBD | Open |
| R-06 | K-12/N-11/N-13 | Platform/accessibility acceptance unproven | Select matrix and execute checks | Unassigned/TBD | Open |
| R-07 | K-09 | Stale assets can remain packaged | Clean candidate staging; decide fix | Unassigned/TBD | Open |
| R-08 | K-13/N-09 | External navigation can expand bridge risk | Define native content/navigation policy | Unassigned/TBD | Open |
| R-09 | N-06/N-10 | Support/host/data responsibilities unset | Assign operator and actual retention/support flow | Unassigned/TBD | Open |

Other K gaps need fix/accept/defer decisions when relevant to chosen requirements. This register does not authorize runtime changes in this documentation task.

## Issue/risk entry template

| Field | Record |
| --- | --- |
| ID/opened/reporter/type | TBD |
| Condition and reproduction | Exact steps/platform/artifact, redacted logs |
| Linked P/N/T/K IDs | TBD |
| Impact/likelihood | Assessed severity; separate actual harm from potential harm |
| Owner/deadline/response | TBD; fix/avoid/accept/defer with reason |
| Decision maker/date/evidence | Pending |
| Resolution revision/verification | Pending |

## Change request template

| Field | Record |
| --- | --- |
| ID/requester/date/baseline | TBD |
| Trigger and requested behavior | TBD |
| Affected P/N scope/exclusions | TBD |
| Impact | Routes, storage/IDs/backups, content rights, native/build, effort/schedule, tests |
| Options/recommendation | TBD |
| Decision/maker/date | Pending |
| Implementation/docs revision | Pending |
| Verification/acceptance | Pending |

Do not commit personal backups/secrets as evidence. Template entries are not actual change requests or approvals.
