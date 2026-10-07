# Release and handover — リリース判定書・引継書

**Status:** Draft template, 2026-10-07. No production release or approval recorded. Fill for a concrete candidate using [deployment](../deployment.md), [test/acceptance](review-and-acceptance.md), and [the register](register.md).

## Candidate identity

| Field | Value |
| --- | --- |
| Candidate/version/native versionCode | TBD |
| Source/docs baseline | TBD |
| Content provenance/ID-map revision | TBD |
| Toolchain/command | TBD |
| Package/APK location and SHA-256 | TBD |
| Origin/app ID/signing identity reference | TBD; no secret keys in docs |
| Agreed platform matrix | TBD |
| Requirements/acceptance evidence | Pending |

## Readiness

| Area | Required record | Current documentation baseline |
| --- | --- | --- |
| Scope/NFR | Agreed baseline | Draft only |
| Source/content/rights | Inputs, ID compatibility, permission disposition | Some inputs missing; rights unresolved |
| Reproducible candidate | Clean stage, toolchain, artifact hashes/native build | Static staging checked; production/native pending |
| Integration/content/accessibility | Executed promised cases/platforms | Code/data evidence; manual acceptance pending |
| Privacy/security | Actual operator data flow and selected target review | Internal docs, no legal/conformance determination |
| Signing/distribution | Protected ownership/recovery of keys/accounts | Debug flow only |
| Limitations | Register IDs, accountable decisions | Open initial register |
| Support/recovery | Assigned contact/runbook rehearsal | Unassigned |

## Handover inventory

Provide source revision, [engineering docs](../README.md), clean runtime/signed APK if in scope, content credits/provenance, build/install/run instructions, completed tests/acceptance/open defects, backup/update/rollback instructions, and secure account/key ownership references.

Disclose missing builder inputs. A runnable prebuilt package is not a complete reproducible content-source handover.

| Responsibility | Owner/contact | Handover evidence |
| --- | --- | --- |
| Product/content corrections | Unassigned | Exact ID/source review and regeneration workflow |
| Code/build maintenance | Unassigned | Clean reproduction rehearsal |
| Host/store account | Unassigned | Publishing/recovery and access ownership |
| Android signing/update | Unassigned | Key custody/recovery and compatible identity |
| Support/user data | Unassigned | Contact, consent/redaction, retention/access process |
| Incident/rollback | Unassigned | Escalation, prior artifact, store/ID compatibility |

Explain export/import before uninstalling or changing origin/identity. There is no cloud recovery. Artifact rollback leaves user state in place; record compatibility with newer schemas/IDs and rehearse recovery.

## Release decision

| Field | Value |
| --- | --- |
| Decision/approver/date | Pending/unassigned |
| Accepted artifact hash | Pending |
| Conditions/exclusions/owner/date | Pending |
| Evidence link | Pending |

This is a place to record a release decision, not permission to publish or an approval request for the already authorized documentation task.
