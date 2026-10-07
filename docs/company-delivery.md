# Company delivery in Japan

Yes: the technical reference set now covers Pengo's design, but company delivery also needs agreed scope/quality targets, assigned responsibilities, review evidence, acceptance results, and operational handover. This is a recommended lightweight approach for Pengo, not a claim that all Japanese companies require one document set or development lifecycle.

IPA's Common Frame describes lifecycle work and roles from planning through development, operation, maintenance, and retirement. It is a useful reference for tailoring records to a company's process or contract. The mapping below is our recommendation for Pengo. [IPA Common Frame](https://www.ipa.go.jp/publish/secbooks20130304.html).

## Existing coverage

| Japanese document name | Existing Pengo coverage | Current status |
| --- | --- | --- |
| 要件定義書 — Requirements specification | [Product](product.md), P-01…P-14 and scope boundaries | Implementation described; stakeholder agreement unrecorded |
| 基本設計書 — Basic/external design | [Architecture](architecture.md), [frontend](frontend.md), [data model](data-model.md) | Components, routes, data described |
| 詳細設計書 — Detailed/internal design | [Course](course.md), [interfaces](interfaces.md), [pipeline](data-pipeline.md) | Algorithms/contracts/transforms described |
| テスト計画書・仕様書 — Test plan/specification | [Testing](testing.md), T-01…T-15 | Procedures documented; manual integration results pending |
| 運用・保守設計書 — Operations/maintenance design | [Deployment](deployment.md), [maintenance](maintenance.md), [security](security.md) | Procedures and gaps described; owners unset |
| 設計判断記録 — Design decisions | [Decisions](decisions.md) | Observed choices, no invented approvals |

Markdown can carry these deliverables. If a customer requires Excel/Word/PDF or Japanese-language deliverables, export/translate an agreed revision and identify the authoritative artifact. Japanese document names aid navigation; the whole set remains English.

## Extra records prepared

| Document | Purpose | Draft/template |
| --- | --- | --- |
| 非機能要件定義書 | Agree quality targets/platform coverage | [NFR worksheet](delivery/nonfunctional-requirements.md) |
| 開発計画書・WBS・体制表 | Assign roles, work packages, evidence checkpoints | [Delivery plan](delivery/project-plan.md) |
| 課題・リスク・変更管理表 | Track gaps, impact, owners, scope decisions | [Register](delivery/register.md) |
| レビュー記録・テスト結果報告書・受入確認書 | Record actual findings, results, acceptance | [Review/acceptance](delivery/review-and-acceptance.md) |
| リリース判定書・引継書 | Identify candidate, readiness, recovery, support | [Release/handover](delivery/release-and-handover.md) |

These are usable drafts. Targets, people, approvals, schedules, and acceptance remain unset where no decision exists. [Verification](verification.md) records only evidence actually obtained.

IPA's Nonfunctional Requirements Grades is a customizable tool for discussing requirement levels and avoiding different expectations between users/developers. It is a reference for the NFR worksheet, with infrastructure-heavy items tailored to an offline app. [IPA nonfunctional guidance](https://www.ipa.go.jp/archive/digital/iot-en-ci/jyouryuu/hikinou/ent03-b.html).

## Decisions before company release

| Decision | Pengo-specific reason | Current state |
| --- | --- | --- |
| Product/content ownership | Who approves accuracy and distribution? | Unassigned; source permission questions in credits |
| Reproducible content | How are exact raw inputs obtained/versioned and IDs preserved? | Vocab/corpus/deck sources missing; prebuilt app works |
| Supported platforms | Which devices/OS/WebViews/browsers are promised? | Configured SDK minimum, no validated support matrix |
| Review semantics | Should ordinary quizzes grade SRS? | Current distinction documented; product acceptance unset |
| Recovery | What happens on failed storage, corrupt backups, uninstall/origin change? | Export/import only; no cloud recovery/deep validator |
| Production distribution | Who owns keys, host/store accounts, release decisions? | Debug flow only; production ownership unset |
| Accessibility/usability | Which learners, languages, assistive tools, and target? | Some features; no conformance evidence |
| Support/change ownership | Who handles defects/content corrections? | No channel/SLA assigned |

For an external customer/vendor, separately agree deliverables, exclusions, acceptance, rights, source/artifact handover, support, and change-cost handling. This repository is a technical package, not a commercial contract.

## Japan-specific considerations

### Accessibility

Agree targets and evidence instead of inferring conformance from CSS/ARIA. The Digital Agency's guide addresses service teams, standards, smartphone accessibility, and procurement. Use it to choose Pengo's checks; these docs do not establish a universal obligation to a particular level. [Digital Agency accessibility guide](https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook).

Check keyboard/screen-reader navigation, dialog focus, zoom, Japanese ruby pronunciation, contrast, reduced motion, and TalkBack on agreed devices. Record T-14/T-15 results before conformance claims.

### Privacy

The observed app stores progress locally without accounts/analytics. Company assessment should also include host logs, support messages/requested backups, device backup, and future network features. APPI applicability depends on actual information and business handling; offline operation alone is not a legal determination. PPC's guideline defines relevant information/handling concepts. [PPC APPI guideline](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/).

Prepare a user-facing notice after operator/contact, hosting, support data, retention, and vendors are known. Do not invent “we collect nothing” or support/deletion promises. The internal security document is not a published privacy notice.

### Language and content

Define the audience before translation. Pengo teaches Japanese using English explanations; a Japanese company does not automatically imply Japanese learner-facing UI. Corporate handover may need a Japanese translation/terminology agreement.

Assign a content reviewer for readings, grammar, examples, and mnemonic claims. Include kana/full-width handling, ruby, input methods, and local date boundaries. Generated exam sessions are planning estimates, not a confirmed venue calendar.

### Ownership and distribution

Resolve application ownership/license and source distribution questions in `resources/CREDITS.md`, including the grammar deck, before promising customer rights or publishing commercially. Check actual host/store requirements for the intended release; repository SDK values alone do not establish eligibility.

## Proportionate process

An internal prototype can use short linked reviews with one person holding several roles. Customer delivery should retain an agreed baseline and real review/test/acceptance evidence. Add heavier approvals, procurement questionnaires, or formal audit reports when company policy, contract, deployment, or applicable obligations call for them.
