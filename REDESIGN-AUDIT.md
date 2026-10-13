# REDESIGN-AUDIT.md — HireWise AI (2026-10-13)

## Competitors researched
- **Lever** — sleek dark sidebar, "Dashboard / People / Jobs" nav, drag-and-drop pipeline stages, candidate profile drawer with notes + tags, low-friction manager review.
- **Greenhouse** — Kanban-style candidate management board, per-job pipeline stages, team scorecards with 1–5 ratings, structured interview kits.
- **Breezy HR** — candidate cards with match-score badges, visual pipeline, drag between stages, score-based shortlists.

## Visual gaps vs competitors
1. **No app chrome.** Topbar + horizontal tabs read as a landing page; Lever/Greenhouse use a persistent left rail with workspace nav.
2. **"Published preview" looks like a `<pre>` dump.** Lever/Ashby job posts are designed listings: company mark, headline, location/pay metadata, structured body. Ours is a code block.
3. **Scorecard is a number in a box.** Breezy leads with a match dial; ours shows `72/100` as plain text with no visual weight.
4. **Pipeline columns are flat gray** with identical headers; Greenhouse columns have stage identity, counts, and card affordances (score chips buried in meta line).
5. **Evidence list is unstyled bullets** — no positive/negative visual language.
6. **Identity is generic dark-green/teal** — same family as the other "pilot" tools; nothing says "hiring".

## Functional/flow gaps vs competitors
1. **No way to add a candidate directly on the pipeline** — Greenhouse/Lever let you add prospects to a stage without going through screening.
2. **Score ring/dial** missing on the scorecard (visual, but it's the signature hiring-software element).
3. **Interview scorecard (IV chip) exists but is invisible** on cards — tiny text.

## What this redesign does
- **Recruiter-desk shell:** ink sidebar (brand, vertical tabs, pipeline count, local pill) + cream workspace — same `.tab`/`.panel` hooks.
- **Terracotta accent** (#c2502e family) — warm, human, distinct from every other pilot tool.
- **Job-board preview:** postcard renders as a real listing (company logo block, serif headline, pay/location meta, Apply button mock) per tone.
- **Score dial:** SVG ring on the scorecard; verdict banner; evidence list with +/− markers.
- **Pipeline kanban:** ink stage headers with counts + avg score per column, score chips prominent, stalled chips, quick-add candidate form in the pipeline toolbar.
- Preserves all logic IDs/classes; smoke + e2e extended for quick-add and dial.
