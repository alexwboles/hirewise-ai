# 🤝 HireWise AI — the hire-to-onboard suite

**Job post → resume screen → pipeline → offer → first 30 days. One hire record, end to end.**

Small businesses write vague job posts ("competitive salary! we're a family!") and then drown in unqualified applicants — and when they finally hire someone, onboarding is a sticky note. HireWise AI fixes the whole arc: a job-post builder that writes polished posts in 3 tones and flags risky language, a resume screener that scores fit with evidence and writes tailored interview questions, a candidate pipeline, offer/rejection letters — and, since the 2026-10-19 merge with OnboardPilot AI, Day 1 / Week 1 / Day 30 onboarding checklists on the same hire's journey.

100% local — no accounts, no servers, no API keys. Open `index.html` in a browser and go. Your data never leaves the device (localStorage only). Existing OnboardPilot users keep their data: the onboarding module still reads the `onboardpilot_v1` localStorage key.

## Features

### Hiring
1. **📝 Job Post Builder** — role, company, location, pay range, must-haves → polished post in 3 tones (professional / friendly / bold), copy-to-clipboard.
2. **🚩 Red-Flag Checker** — catches clichés ("rockstar", "ninja"), vague pay, "fast-paced family", always-available language, age-coded words, and bloated requirement lists — each with a plain-language fix.
3. **🔍 Resume Screener** — paste resume text + must-haves → fit score (Strong / Maybe / No) with evidence bullets, experience extraction, and job-hopping detection.
4. **❓ Gap-Tailored Interview Questions** — 5 questions generated per candidate, probing exactly the must-haves their resume didn't show.
5. **📋 Candidate Pipeline** — Applied → Screening → Interview → Offer → Hired/Rejected board with one-click stage moves, score badges, interview scorecards, stall detection, and localStorage persistence.
6. **👥 3 Demo Resumes** — strong match, career changer, and weak match to try the screener instantly.
7. **📊 Pipeline Stats** — live strip with total candidates, per-stage counts, and average screening score.
8. **🔎 Pipeline Search** — filter the board by candidate name, role, or verdict.
9. **📝 Candidate Notes** — per-candidate notes on pipeline cards, saved locally.
10. **⬇️ Pipeline CSV Export** — one-click download of the full pipeline (name, role, score, verdict, stage, notes, date) with safe quoting.
11. **✉️ Offer Letters & Rejection Emails** — draft from a hired/rejected candidate's card (3 rejection tones).
12. **⌨️ Keyboard Shortcut** — Ctrl/Cmd+Enter generates the post or scores the resume from the keyboard.

### Onboarding (merged from OnboardPilot AI, 2026-10-19)
13. **🔗 One-click handoff** — a hired candidate's card gets a "Start onboarding" button: pick a role template, start date, and buddy → their Day 1 / Week 1 / Day 30 checklist is created on the Onboard tab, linked to the pipeline record.
14. **📋 Role-based checklists** — 6 built-in role templates (Retail Associate, Line Cook, Barista, Front Desk, Warehouse Associate, Office Admin), each across Day 1 / Week 1 / Day 30 with task categories (Paperwork / Training / Culture / Tools) and owner hints (Manager / Buddy / New hire).
15. **📄 Generic document checklist** — Day-1 document items (ID, tax withholding, payroll, emergency contact) carry a "generic guidance only — not legal or tax advice" note.
16. **📈 Progress tracking** — per-hire dashboard with progress rings, per-phase bars, overdue Day-1 flags, start-date countdown, and phase milestones (Day 1 → start+1, Week 1 → start+7, Day 30 → start+30) with per-task due dates.
17. **🤝 Buddies** — buddy roster, one buddy per hire, copy-ready check-in nudges when buddy tasks go overdue.
18. **🛠️ Custom roles** — build your own role templates with your own tasks per phase.
19. **💬 Welcome messages** — one-click draft from a local template (optional OpenAI key in Settings for an AI draft — never required).
20. **📓 Manager notes + 30-day pulse** — timestamped note journal and 1–5 "how's it going" check-ins per hire.
21. **⬇️ HR CSV export** — roster export (name, role, start date, buddy, progress %, overdue, countdown).

## How to run

No build step. Either:

```bash
# option 1: just open it
open index.html            # macOS
xdg-open index.html        # Linux
start index.html           # Windows

# option 2: tiny static server
npx serve .                # or: python3 -m http.server 8000
```

## Pricing vision

| Plan | Price | For |
|------|-------|-----|
| Free | $0 | 1 active job post, 10 screenings/mo |
| Pro | $29/mo | Unlimited posts + screenings, team pipeline, templates |
| Agency | $79/mo | Multi-location, white-label posts |

## Architecture

```
index.html        tabbed UI (post / screener / pipeline / onboard)
css/style.css     hiring-room theme; onboarding styles scoped under #panel-onboard
js/logic.js       hiring logic — shared between browser & Node tests
js/samples.js     3 demo resumes
js/app.js         hiring UI wiring, localStorage pipeline, pipeline→onboard bridge
js/onboard.js     onboarding logic, ported verbatim from OnboardPilot AI
                  (localStorage key onboardpilot_v1 preserved — old data carries over)
js/onboard-ui.js  onboarding UI wiring, exposes window.__hwOnboard for the bridge
test/smoke.sh     46 checks (files, syntax, generation, screening, pipeline, onboarding)
test/e2e.sh       16 end-to-end flows through the real logic
```

The "AI" is local heuristics: keyword/synonym matching for screening, template-based generation with tone variation for posts, and rule-based red-flag detection. If you later add an `OPENAI_API_KEY`, the generation functions are isolated in `js/logic.js` and easy to enhance — but nothing requires it.

## Tests

```bash
bash test/smoke.sh   # 46 checks
bash test/e2e.sh     # 16 flows
```

## Merge history

- **2026-10-19 (workstream E):** `onboardpilot-ai` merged into `hirewise-ai` per the portfolio consolidation analysis (merge #8). The onboardpilot-ai repo is archived with a pointer here. Nothing was dropped: all 6 role templates, buddies, custom roles, milestones, nudges, pulses, notes, welcome drafts, CSV export, and settings (incl. the optional OpenAI key) work inside the new Onboard tab, and existing `onboardpilot_v1` browser data is picked up automatically.

Built overnight by Muse for Alex — free forever, no paid services.
