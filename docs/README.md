# Engineering documentation

This set describes Pengo as inspected on **2026-10-07**. Source remains authoritative when behavior changes. Implemented behavior, operating procedures, and known gaps are identified separately.

For a new engineer, read [product](product.md), [architecture](architecture.md), [development](development.md), and [testing](testing.md). For an AI assistant, start with [the AI guide](ai-guide.md).

| Document | Scope | Primary implementation |
| --- | --- | --- |
| [Product](product.md) | Scope, journeys, capability requirements | `app.js`, `index.html` |
| [Daily learning improvements](learning-improvements.md) | Implemented feature priorities, rationale, next content track | Practice scripts and tests |
| [Design and reminders](design-and-reminders.md) | Adventure UI, mascot generation, opt-in reminders and platform limits | Design/reminder scripts, native reminder classes |
| [Exploration refresh](exploration-refresh.md) | All-level read-only discovery, Back buttons, animated cards, daily word and complete mascot prompts | App, recall/design UI and exploration tests |
| [Discovery cards](discovery-cards.md) | Flip-card interaction, source research, layered components and verification | Recall UI, component extractor and browser tests |
| [Architecture](architecture.md) | Components, startup, packaging flows | Root scripts, `MainActivity.java` |
| [Development](development.md) | Setup and change workflows | `package.json`, scripts, tests |
| [Frontend](frontend.md) | Routes, rendering, CSS, accessibility | `app.js`, `styles.css`, onboarding |
| [Data model](data-model.md) | Content, IDs, storage, backups | `data/`, store helpers |
| [Data pipeline](data-pipeline.md) | Inputs/outputs, furigana, provenance | Python scripts, resource credits |
| [Study plan](course.md) | Curriculum, unlocking, sampling, streaks, SRS | `course.js`, course integration |
| [Interfaces](interfaces.md) | JavaScript API and native bridge | Course, Platform, Java activity |
| [Testing](testing.md) | Automated checks and manual acceptance matrix | Existing test drivers and runtime |
| [Deployment](deployment.md) | Web staging, APK builds, release/rollback | Packaging, Gradle, Docker |
| [F-Droid release](fdroid.md) | Unsigned release builds, app identity, store metadata and submission requirements | F-Droid, licensing, updates |
| [iOS debug builds](ios.md) | iPhone/simulator setup, signing, native behavior and acceptance | Swift WKWebView shell, Xcode, iOS builder |
| [Security](security.md) | Privacy and trust boundaries | Rendering, storage, native bridge |
| [Maintenance](maintenance.md) | Troubleshooting and confirmed gaps | All implementation |
| [Decisions](decisions.md) | Observed design and tradeoffs | All implementation |
| [AI guide](ai-guide.md) | Task entry points and compatibility constraints | All implementation |
| [Verification](verification.md) | Dated checks for this documentation work | Test drivers, data, staging, docs |
| [Company delivery](company-delivery.md) | Japanese document mapping and delivery practices | Official references and project drafts |
| [NFR worksheet](delivery/nonfunctional-requirements.md) | Quality targets and supported platforms | Draft N-01…N-14 |
| [Delivery plan](delivery/project-plan.md) | Roles, WBS, evidence checkpoints | Proposed W-01…W-09 |
| [Risk/change register](delivery/register.md) | Gaps, owners, change decisions | Initial R-01…R-09 |
| [Review/acceptance](delivery/review-and-acceptance.md) | Findings, test results, acceptance | Reusable template |
| [Release/handover](delivery/release-and-handover.md) | Candidate, readiness, support/recovery | Reusable template |
| [Contributing](../CONTRIBUTING.md) | Review and documentation workflow | Repository conventions |

## Conventions

Diagrams are editable Mermaid code fences. Mermaid-enabled Markdown viewers render them; other viewers show their source. Surrounding prose explains each flow without requiring a renderer.

Paths in tables are relative to the repository root. Function names are navigation anchors: use `rg -n 'functionName' app.js`. Data shapes use JavaScript notation; they are not runtime-enforced schemas. There is no HTTP application API or database server.

When a contract changes, update its owning document and acceptance checks. Counts and verification results are dated snapshots; recompute them. A documented limitation is not an implemented fix. [Maintenance](maintenance.md) separates confirmed gaps from proposed follow-up work.
