# REDESIGN-AUDIT.md — HireWise AI, v2 "Talent Office" (2026-10-19)

Previous pass (2026-10-13, v1) gave the suite the "Hiring Room" shell: ink sidebar, cream paper,
terracotta accent, score dial, kanban columns, job-board preview cards, quick-add. This pass (v2)
keeps every feature, ID and localStorage key, and pushes the product the rest of the way to
"shippable" by closing the four functional gaps that still separate it from real ATS tools.

## Competitors researched (this pass)

- **Breezy HR** — drag-and-drop Kanban (Applied → Phone Screen → Interview → Offer → Hired) with
  stage actions that fire when a card enters a stage; color-coded match badges (green/yellow/red)
  on every card so recruiters scan boards without opening profiles; candidate profile split into
  skimmable sections; interview scheduling + self-scheduling from the candidate profile; CSV bulk import.
  Sources: https://help.breezy.hr/en/articles/5578273-getting-started-adding-and-managing-candidates,
  https://ventureharbour.com/breezy-hr-review/, https://resumegeni.com/blog/breezy-hr-ats-resume-guide
- **Workable** — candidate Kanban with bulk progress/disqualify; candidate profile with activity
  timeline; AI screening summaries with match scores and requirement checklists; standardized
  per-stage interview scorecards (aggregated results); interview scheduling with calendar sync;
  dual-layer UI (recruiter depth + a simplified hiring-manager review layer); ATS→HRIS continuity
  (recruitment and post-hire records in one place — the same reason we merged OnboardPilot in).
  Sources: https://recruit-talent.com/the-quest-for-the-easiest-ats-unpacking-workables-approach-to-streamlined-hiring/,
  https://peoplemanagingpeople.com/tools/workable-review/
- **JazzHR** — per-job dashboard tabs separating stages/data; candidate pipeline reports (conversion
  by stage, bottleneck detection); customizable columns; candidate texting; interview feedback with
  team votes; token-embedded offer-letter templates with versioned drafts.
  Sources: http://help.jazzhr.com/s/article/Job-Dashboard-Overview, https://www.jazzhr.com/blog/workflow-reports/
- **Join.com** (pipeline-pattern reference) — drag to advance, *drop to reject with a logged reason*;
  bulk-move up to 20 candidates between stages; per-role pipeline templates; live-updating shared board.
  Source: https://join.com/en/features/pipeline

## 6 layout / IA / visual patterns borrowed

1. **Drag-and-drop kanban with drop-to-reject + reason** (Breezy, join.com) — the signature interaction
   of hiring software; arrows stay as the keyboard/mobile fallback.
2. **Candidate profile drawer** (Workable, Breezy) — clicking a candidate's name opens a right-side
   dossier: fit-score dial, screening evidence, interview scorecard, scheduled interviews, notes
   journal, stage journey. Replaces the awkward in-card scorecard form and `prompt()` notes editing.
3. **Per-stage conversion readouts** (JazzHR workflow reports) — each column header shows how many
   candidates entered the stage and what % moved on, so bottlenecks are visible at a glance.
4. **Match badges on cards, not just numbers** (Breezy) — verdict-colored score chips already exist;
   v2 adds "days in stage" and interview-score affordances so cards scan like real ATS cards.
5. **Interview scheduling from the candidate** (Breezy, Workable) — date/time/type/interviewer stored
   on the candidate; an "Upcoming interviews" strip sits atop the board (their calendar-integration
   equivalent for a local-first tool).
6. **Bulk select + bulk actions** (Workable, join.com) — tick multiple cards, then advance / reject /
   delete in one motion. Reuses the existing checkbox affordance family (compare-2 stays as its own flow).

## 4 functional gaps closed (this pass)

1. **No drag-and-drop** — every competitor moves cards by dragging; we only had arrows. →
   HTML5 drag-and-drop between stages; dropping on Rejected asks for a logged reason (join.com
   pattern). Arrows remain for keyboard/mobile.
2. **No candidate profile** — there was no place to see a whole person: score, evidence, interviews,
   notes, history were scattered or modal-only. → profile drawer (pattern 2). The in-card scorecard
   form and `prompt()` notes move into the drawer as proper UI.
3. **No interview scheduling** — Workable/Breezy schedule from the profile; we had only a scorecard.
   → interviews stored per candidate + upcoming strip on the pipeline.
4. **No bulk actions** — big screening rounds are painful one-card-at-a-time. → bulk select + bar
   (advance to stage / reject / delete).

New pure-logic surface (Node-testable, no UI): `scheduleInterview`, `upcomingInterviews`,
`stageConversion`, `addNoteToLog`, `removeInterview`. All additive — existing candidate objects
gain `interviews[]` and `noteLog[]` fields; old records keep working with no migration.

## New distinctive visual identity — "The Talent Office"

Executive-search bureau, not startup-SaaS. Workable/Breezy/JazzHR are all bright friendly SaaS;
Lever/Ashby are dark minimal. We go **editorial paper + espresso + brass**:

- **Typography:** Fraunces (serif, optical sizing) for brand, page titles, column headers, card
  names; Inter stays for UI chrome and body. Headlines set tight, letterspaced eyebrows stay.
- **Palette:** warm ivory paper (#f7f4ec), deep espresso sidebar (#221610), brass (#b08a3e) as the
  secondary accent, terracotta (#c2502e) retained as the primary action. Stage columns get their own
  inked identities: applied = slate, screening = brass, interview = terracotta, offer = green,
  hired = deep green, rejected = muted gray.
- **Texture:** hairline brass rules between sections, column headers as engraved plates with
  conversion lines ("12 entered · 67% advanced"), cards as index cards with serif names.
- **Profile drawer:** right-side dossier, espresso header band with brass rule, hairline-divided
  sections — reads like a candidate file folder.
- **Onboard side:** same identity; journey timeline re-plated in brass, progress rings kept.

Hard rules honored: zero border-radius anywhere (tests enforce: no `border-radius:[1-9]` other
than 50%); no purple/blue gradients; no emoji-heavy chrome; no boxy generic layouts — layered
cards, varied shapes, overlapping drawer, distinct per-stage color.

## Preservation (merge workstream E + all existing features)

- All localStorage keys/schemas unchanged: `hirewise.pipeline.v1`, `onboardpilot_v1`. Candidate
  objects only gain optional `interviews[]`, `noteLog[]`, plus `evidence`/`questions` when added
  from the screener (existing records work without them).
- Every feature preserved: job-post builder (3 tones + writing check), screener (dial, evidence,
  gap questions, 3 samples), pipeline (search, quick-add, arrows, compare-2, notes, offer-letter
  + rejection-email docs, scorecard, stalled banner, stats, CSV export, clear-all), Onboard tab
  (dashboard w/ progress rings, overdue flags, start countdown; new-hire wizard; buddies + nudges;
  6 role templates + custom roles; milestones w/ due dates; welcome-message drafts incl. optional
  OpenAI key; manager notes journal; 30-day pulse; CSV export; archive/restore), "Start
  onboarding"/"View onboarding" bridge (onboardId link).
- All IDs/classes/tests hooks preserved (see test/smoke.sh assertions: `#panel-onboard`,
  `#pipeStats`, `#stallOut`, `#docModal`, `.shell`, `.opnav`, …).

## QA + tests

- `python3 ~/workspace/skills/premium-ui/bin/shot.py` desktop 1440×900 + mobile 390×844 —
  pipeline board, profile drawer, Onboard tab, post builder, screener. Before/after in
  `redesign-shots/v2/`.
- `test/smoke.sh` + `test/e2e.sh` green; extended with new coverage: interview scheduling
  (valid/rejects bad date), upcoming ordering, stage conversion math, note journal, drawer wiring
  greps, bulk-action wiring greps, no-rounded-edges re-check.
