# Delivery plan — 開発計画書・WBS・体制表

**Status:** Proposed company handover preparation, 2026-10-07. This is a work breakdown, not authorization to implement runtime fixes or a committed schedule. Dates, effort, people, and costs remain unset.

## Roles

| Role | Responsibility | Person |
| --- | --- | --- |
| Product/delivery owner | Audience, scope, requirements/acceptance | Unassigned |
| Engineering owner | Source/design, ID/storage compatibility, build | Unassigned |
| QA reviewer | Device matrix, executed evidence, defect disposition | Unassigned |
| Japanese content reviewer | Reading/grammar/example accuracy | Unassigned |
| Operations/support owner | Host/store/keys, support, recovery | Unassigned |
| Rights/privacy reviewer | Distribution rights and actual operator data handling | Unassigned |

One person can hold several roles; still record who made each decision. No company policy requiring separate approvers was supplied.

## Work breakdown

| WBS | Work | Dependency | Deliverable | Status |
| --- | --- | --- | --- | --- |
| W-01 | Describe implementation | Source inspection | Engineering docs/verification | Prepared by documentation task |
| W-02 | Agree scope/NFR/platforms | W-01 | Baseline P/N IDs and exclusions | Pending |
| W-03 | Recover source inputs/rights | W-01 | Provenance/ID map/rights record | Pending; known gaps |
| W-04 | Triage K-01…K-17 | W-02 | Fix/accept/defer with owners | Pending |
| W-05 | Implement selected changes | Approved W-04 scope | Reviewed implementation/checks | Outside documentation work |
| W-06 | Reproduce candidate | W-03, relevant W-05 | Clean runtime/native artifact identities | Web staged; production/native pending |
| W-07 | Integration/content/accessibility tests | Candidate, W-02 | Linked P/N/T/K evidence | Pending beyond current code/data checks |
| W-08 | Acceptance/release decision | W-07, risk disposition | Completed review/release record | Pending |
| W-09 | Operational handover | W-08 | Owner/runbook/recovery rehearsal | Pending |

[Verification](../verification.md) records actual checks. W-01 completion does not complete later work.

## Baseline and checkpoints

Identify a delivery by source/docs revision, content provenance/ID map, toolchain, artifact hashes, supported platforms, and acceptance record. Scope/quality/schedule/ID/distribution changes need a recorded impact/decision in [the register](register.md).

Suggested checkpoints are requirements agreement, design/risk review, promised-test execution, and accepted-artifact handover. They can occur iteratively; this does not prescribe waterfall. Assigned people should estimate dates/effort after clarifying dependencies.
