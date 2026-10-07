# Review and acceptance — レビュー記録・テスト結果報告書・受入確認書

**Status:** Reusable template, 2026-10-07. Copy into a dated record when conducting review/testing/acceptance. Pending fields are not approvals. Actual documentation checks are in [verification](../verification.md).

## Identity

| Field | Value |
| --- | --- |
| Record/date/type | TBD; requirements/design/code/content/security/test/acceptance |
| Source/document baseline | TBD commit/revision |
| Candidate and SHA-256 | TBD |
| Author/reviewer/product owner | Unassigned |
| Scope/exclusions | P/N IDs and excluded cases |
| Environment | Device, OS, browser/WebView, tools, locale/timezone |

## Findings

| Finding ID | Requirement/design | Evidence | Severity/owner | Disposition/verification |
| --- | --- | --- | --- | --- |
| TBD | TBD | Review pending | Unassigned | Pending |

For content review, record exact ID/character/field, expected Japanese, source, and reviewer. Link architectural outcomes to [decisions](../decisions.md), unresolved findings to [the register](register.md).

## Executed results

| Case ID | P/N IDs | Procedure/input | Expected | Actual/result | Evidence/defect |
| --- | --- | --- | --- | --- | --- |
| T-XX | TBD | Exact scenario/environment | TBD | Not executed/pending | TBD |

Use pass/fail/blocked/not run. A successful exit after `SKIP` is not pass. Identify dukpy/Node engine and UI/native checks actually run. Attach redacted logs/output/screenshots or reproducible evidence; do not commit private user backups.

For compatibility, record old-backup roundtrip and ID mapping. Content review needs linguistic evidence beyond valid JSON. State planned/executed/pass/fail/blocked/not-run counts, P/N coverage, measured targets, regression scope, defects/accepted limitations, and QA recommendation. Assertion count alone does not prove all requirements.

## Acceptance decision

| Field | Value |
| --- | --- |
| Accepted scope/artifact and requirement baseline | Pending |
| Outcome | Pending; accept/conditional/reject after actual decision |
| Conditions/exclusions/known gaps | TBD with owner/date and register links |
| Product/customer decision maker | Unassigned |
| Decision date/evidence | Pending |

Acceptance covers the identified artifact/scope. Carry conditions and evidence into [release/handover](release-and-handover.md).
