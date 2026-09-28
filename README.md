# 🤝 HireWise AI

**Write job posts that attract great people. Screen applicants in seconds.**

Small businesses write vague job posts ("competitive salary! we're a family!") and then drown in unqualified applicants. HireWise AI fixes both ends: a job-post builder that writes polished posts in 3 tones and flags risky language, plus a resume screener that scores fit with evidence and writes tailored interview questions.

100% local — no accounts, no servers, no API keys. Open `index.html` in a browser and go. Your data never leaves the device (localStorage only).

## Features

1. **📝 Job Post Builder** — role, company, location, pay range, must-haves → polished post in 3 tones (professional / friendly / bold), copy-to-clipboard.
2. **🚩 Red-Flag Checker** — catches clichés ("rockstar", "ninja"), vague pay, "fast-paced family", always-available language, age-coded words, and bloated requirement lists — each with a plain-language fix.
3. **🔍 Resume Screener** — paste resume text + must-haves → fit score (Strong / Maybe / No) with evidence bullets, experience extraction, and job-hopping detection.
4. **❓ Gap-Tailored Interview Questions** — 5 questions generated per candidate, probing exactly the must-haves their resume didn't show.
5. **📋 Candidate Pipeline** — Applied → Screening → Interview → Offer board with one-click stage moves, score badges, and localStorage persistence.
6. **👥 3 Demo Resumes** — strong match, career changer, and weak match to try the screener instantly.

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
index.html        tabbed UI (builder / screener / pipeline)
css/style.css     calm light theme
js/logic.js       all AI-ish logic — shared between browser & Node tests
js/samples.js     3 demo resumes
js/app.js         UI wiring, localStorage pipeline
test/smoke.sh     12 checks (files, syntax, generation, screening)
test/e2e.sh       7 end-to-end flows through the real logic
```

The "AI" is local heuristics: keyword/synonym matching for screening, template-based generation with tone variation for posts, and rule-based red-flag detection. If you later add an `OPENAI_API_KEY`, the generation functions are isolated in `js/logic.js` and easy to enhance — but nothing requires it.

## Tests

```bash
bash test/smoke.sh   # 12 checks
bash test/e2e.sh     # 7 flows
```

Built overnight by Muse for Alex — free forever, no paid services.
