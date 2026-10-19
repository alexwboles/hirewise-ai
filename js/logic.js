/* HireWise AI — shared logic (browser + Node). No network, no keys, all local. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HireWise = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STOP = new Set(
    ("a,an,the,and,or,of,to,in,on,for,with,by,at,from,as,is,are,was,were,be,been," +
      "it,its,this,that,these,those,you,your,we,our,they,their,he,she,his,her," +
      "will,can,should,must,have,has,had,do,does,did,not,no,all,any,each,other," +
      "more,most,some,such,than,then,so,up,out,about,into,over,after,before," +
      "i,me,my,mine")
      .split(",")
  );

  function norm(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function words(s) {
    return norm(s).split(" ").filter((w) => w && !STOP.has(w) && w.length > 1);
  }
  // Does resume text mention a must-have skill? Fuzzy: all significant words of the
  // must-have appear, or a known synonym matches.
  const SYNONYMS_RAW = {
    "customer service": ["client service", "customer support", "guest service"],
    "communication": ["communicator", "interpersonal"],
    "microsoft office": ["ms office", "excel", "word", "powerpoint", "spreadsheets"],
    "food safety": ["servsafe", "food handler", "haccp"],
    "driver's license": ["drivers license", "driving licence", "valid license", "clean driving record"],
    "cpr": ["first aid"],
    "sales": ["selling", "revenue", "quota"],
    "management": ["managed", "supervisor", "lead", "team lead"],
    "cash handling": ["cashier", "register", "pos"],
  };
  // normalize synonym keys the same way phrases are normalized
  const SYNONYMS = {};
  for (const k of Object.keys(SYNONYMS_RAW)) SYNONYMS[norm(k)] = SYNONYMS_RAW[k];
  function stem(w) { return w.slice(0, Math.min(w.length, 5)); }
  const BOILERPLATE = [/references available on request\.?/gi, /references available upon request\.?/gi];
  function cleanText(text) {
    let t = text || "";
    for (const re of BOILERPLATE) t = t.replace(re, " ");
    return t;
  }
  function mentions(text, phrase) {
    const p = norm(phrase);
    if (!p) return false;
    const tWords = norm(cleanText(text)).split(" ").filter(Boolean);
    const padded = " " + tWords.join(" ") + " ";
    if (padded.includes(" " + p + " ")) return true;
    const syns = SYNONYMS[p] || [];
    for (const s of syns) if (padded.includes(" " + norm(s) + " ")) return true;
    // fuzzy: every significant word of the phrase matches a word stem in the text,
    // ("weekend availability" matches "Available weekends") — with a proximity
    // window so boilerplate like "References available on request" can't match
    // a "weekends" mention six words away.
    const ws = p.split(" ").filter((w) => !STOP.has(w));
    if (!ws.length) return false;
    const tStems = tWords.map(stem);
    const stems = ws.map(stem);
    if (stems.length === 1) return tStems.includes(stems[0]);
    const idxLists = stems.map((s) => {
      const out = [];
      tStems.forEach((ts, i) => { if (ts === s) out.push(i); });
      return out;
    });
    if (idxLists.some((l) => !l.length)) return false;
    for (const a of idxLists[0]) {
      let ok = true;
      for (let k = 1; k < idxLists.length; k++) {
        if (!idxLists[k].some((b) => Math.abs(b - a) <= 5)) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  function payLine(d) {
    const min = (d.payMin || "").trim(), max = (d.payMax || "").trim();
    const type = d.payType === "salary" ? "per year" : "per hour";
    if (min && max) return `$${min}–$${max} ${type}`;
    if (min) return `from $${min} ${type}`;
    if (max) return `up to $${max} ${type}`;
    return "";
  }

  const TONE_OPENERS = {
    professional: (c) => `Join ${c} as our newest team member.`,
    friendly: (c) => `Come work with us at ${c} — we'd love to meet you!`,
    bold: (c) => `${c} is hiring. If you're great at what you do, keep reading.`,
  };
  const TONE_CTA = {
    professional: "To apply, please send your resume and a brief cover note.",
    friendly: "Sound like you? Send us your resume — we reply to every applicant!",
    bold: "Think you can do the job? Prove it. Send your resume today.",
  };

  function bulletList(items) {
    return items.map((i) => `• ${i}`).join("\n");
  }

  function generatePosts(d) {
    const role = (d.role || "Team Member").trim();
    const company = (d.company || "Our Company").trim();
    const loc = (d.location || "").trim();
    const pay = payLine(d);
    const musts = (d.mustHaves || []).filter(Boolean);
    const nices = (d.niceToHaves || []).filter(Boolean);
    const out = {};
    for (const tone of ["professional", "friendly", "bold"]) {
      const lines = [];
      lines.push(`${role}${loc ? " — " + loc : ""}`);
      lines.push("");
      lines.push(TONE_OPENERS[tone](company));
      lines.push("");
      lines.push("What you'll do:");
      lines.push(bulletList(musts.length ? musts.map((m) => rephraseDuty(m, tone)) : ["Help our team deliver great results every day."]));
      if (nices.length) {
        lines.push("");
        lines.push(tone === "bold" ? "Bonus points if you have:" : "Nice to have:");
        lines.push(bulletList(nices));
      }
      if (pay) {
        lines.push("");
        lines.push(`Pay: ${pay}${tone === "friendly" ? " — and we review pay as you grow with us." : "."}`);
      }
      lines.push("");
      lines.push(TONE_CTA[tone]);
      out[tone] = lines.join("\n");
    }
    return out;
  }

  function rephraseDuty(m, tone) {
    const t = m.trim().replace(/\.$/, "");
    if (tone === "friendly") return t.charAt(0).toUpperCase() + t.slice(1) + " (we'll train you on our way of doing it).";
    if (tone === "bold") return t.charAt(0).toUpperCase() + t.slice(1) + " — and do it better than anyone else.";
    return t.charAt(0).toUpperCase() + t.slice(1) + ".";
  }

  function redFlags(d, postText) {
    const flags = [];
    const text = (postText || "").toLowerCase();
    const reqCount = (d.mustHaves || []).filter(Boolean).length + (d.niceToHaves || []).filter(Boolean).length;
    if (/(rockstar|ninja|guru|superstar|wizard|rock star)/.test(text))
      flags.push({ flag: "Cliché terms (rockstar / ninja / guru)", severity: "medium", why: "Top candidates find these vague and off-putting.", fix: "Describe the actual work instead: name the skills and outcomes." });
    if (/fast-paced/.test(text) && !/for example|e\.g\.|such as/.test(text))
      flags.push({ flag: '"Fast-paced environment" with no specifics', severity: "medium", why: "Reads as code for understaffed and chaotic.", fix: "Say what a busy day actually looks like." });
    if (!payLine(d))
      flags.push({ flag: "No pay range listed", severity: "high", why: "Posts with pay get far more — and better — applicants.", fix: "Add the real range. Vague 'competitive salary' doesn't count." });
    if (/(24\/7|always available|must be available)/.test(text))
      flags.push({ flag: "Always-available language", severity: "high", why: "Signals burnout and scares off great people with lives.", fix: "State the actual schedule and how overtime is handled." });
    if (/(young|energetic|digital native|recent graduate)/.test(text))
      flags.push({ flag: "Possible age-coded language", severity: "high", why: '"Young" and "energetic" can signal age discrimination.', fix: "Describe stamina or skills needed, not age." });
    if (reqCount > 8)
      flags.push({ flag: `${reqCount} requirements listed`, severity: "medium", why: "Long lists make qualified people self-select out.", fix: "Keep must-haves to 3–5. Move the rest to 'nice to have'." });
    if (/we'?re a family/.test(text))
      flags.push({ flag: '"We\'re a family"', severity: "low", why: "Cliché that can read as boundary-free culture.", fix: "Say what the team is actually like day to day." });
    if (!flags.length)
      flags.push({ flag: "None found — looking good", severity: "ok", why: "No common red flags detected in this post.", fix: "Have one team member read it aloud before publishing." });
    return flags;
  }

  const ASPIRATIONAL = ["eager to", "willing to", "want to", "would like to", "learning to",
    "studying", "interested in", "looking to learn", "keen to learn"];
  // full = resume shows the skill; partial = aspirational ("eager to learn X"); none = absent
  function matchStrength(text, phrase) {
    if (!mentions(text, phrase)) return "none";
    const p = norm(phrase);
    const t = norm(text);
    let context = "";
    const idx = t.indexOf(p);
    if (idx >= 0) {
      context = " " + t.slice(Math.max(0, idx - 60), idx) + " ";
    } else {
      const ws = p.split(" ").filter((w) => !STOP.has(w));
      for (const w of ws) {
        const i = t.indexOf(w);
        if (i >= 0) { context = " " + t.slice(Math.max(0, i - 60), i) + " "; break; }
      }
    }
    const asp = ASPIRATIONAL.some((a) => context.includes(" " + a) || context.includes(a + " "));
    return asp ? "partial" : "full";
  }

  function extractYears(text) {
    let max = 0;
    const re = /(\d+)\s*(?:\+)?\s*years?/gi;
    let m;
    while ((m = re.exec(text))) max = Math.max(max, parseInt(m[1], 10));
    return max;
  }

  function screenResume(input) {
    const resume = input.resumeText || "";
    const musts = (input.mustHaves || []).filter(Boolean);
    const t = norm(resume);
    const matched = [], partial = [], missing = [];
    for (const m of musts) {
      const s = matchStrength(resume, m);
      if (s === "full") matched.push(m);
      else if (s === "partial") partial.push(m);
      else missing.push(m);
    }

    let score = 0;
    const evidence = [];
    if (musts.length) {
      const per = 60 / musts.length;
      score += matched.length * per + partial.length * (per / 2);
      for (const m of matched) evidence.push({ type: "match", text: `Matches requirement: "${m}"` });
      for (const m of partial) evidence.push({ type: "info", text: `Mentioned "${m}" but still learning — probe in interview` });
      for (const m of missing) evidence.push({ type: "miss", text: `No evidence of: "${m}"` });
    }
    const years = extractYears(resume);
    if (years >= 5) { score += 15; evidence.push({ type: "match", text: `${years} years of experience mentioned` }); }
    else if (years >= 2) { score += 10; evidence.push({ type: "match", text: `${years} years of experience mentioned` }); }
    else if (years > 0) { score += 4; evidence.push({ type: "info", text: `Only ${years} year(s) of experience mentioned` }); }

    if (/(certified|certificate|license|degree|diploma|trained)/.test(t)) {
      score += 5; evidence.push({ type: "match", text: "Certification, license, or education mentioned" });
    }
    const roleWords = words(input.role || "").filter((w) => w.length > 3);
    if (roleWords.some((w) => t.includes(w))) {
      score += 5; evidence.push({ type: "match", text: "Resume mentions the role or closely related titles" });
    }
    if (resume.trim().length < 150) {
      score -= 10; evidence.push({ type: "miss", text: "Resume is very short — may be incomplete" });
    }
    // job-hopping heuristic: many 4-digit year ranges
    const stints = (resume.match(/\b(19|20)\d{2}\b/g) || []).length;
    if (stints >= 8) { score -= 5; evidence.push({ type: "miss", text: "Many short date ranges — ask about job changes" }); }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const verdict = score >= 70 ? "strong" : score >= 40 ? "maybe" : "no";

    const questions = [];
    for (const m of [...partial, ...missing].slice(0, 3))
      questions.push(`This role needs "${m}" — tell me about a time you've done something like that.`);
    const fillers = [
      `Why does the ${input.role || "role"} position interest you right now?`,
      "Tell me about a difficult situation at work and how you handled it.",
      "What would a great first 90 days look like to you in this role?",
      "How do you like to receive feedback from a manager?",
      "What questions do you have for me about the team?",
    ];
    for (const f of fillers) {
      if (questions.length >= 5) break;
      questions.push(f);
    }
    return { score, verdict, matched, partial, missing, evidence, questions: questions.slice(0, 5), years };
  }

  /* ---- pipeline: stats + CSV export ---- */
  const PIPE_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"];
  const TERMINAL_STAGES = ["hired", "rejected"];

  // ---- interview scorecard: 1-5 per category, weighted toward skills ----
  const SCORE_CATS = [
    { id: "communication", label: "Communication", weight: 1 },
    { id: "skills", label: "Skills & experience", weight: 2 },
    { id: "culture", label: "Culture fit", weight: 1 },
  ];
  // ratings: { communication: 1-5, skills: 1-5, culture: 1-5 } (any subset ok).
  // Returns { ratings, rated, weighted, max, pct } — pct over rated cats only.
  function scoreInterview(ratings) {
    const out = { ratings: {}, rated: 0, weighted: 0, max: 0, pct: null };
    for (const c of SCORE_CATS) {
      const r = parseInt((ratings || {})[c.id], 10);
      if (r >= 1 && r <= 5) {
        out.ratings[c.id] = r;
        out.rated++;
        out.weighted += r * c.weight;
        out.max += 5 * c.weight;
      }
    }
    if (out.rated) out.pct = Math.round((out.weighted / out.max) * 100);
    return out;
  }

  // Per-stage counts + average screening score. Unknown stages pass through.
  function pipeStats(candidates) {
    const perStage = {};
    for (const s of PIPE_STAGES) perStage[s] = 0;
    let sum = 0, n = 0;
    for (const c of candidates || []) {
      if (perStage[c.stage] === undefined) perStage[c.stage] = 0;
      perStage[c.stage]++;
      if (typeof c.score === "number" && isFinite(c.score)) { sum += c.score; n++; }
    }
    return { perStage, total: (candidates || []).length, avgScore: n ? Math.round(sum / n) : null };
  }

  function csvCell(v) {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // Full pipeline export: Name,Role,Score,Verdict,Stage,Notes,Added (ISO date)
  function pipelineToCSV(candidates) {
    const rows = [["Name", "Role", "Score", "Verdict", "Stage", "Notes", "Added"]];
    for (const c of candidates || []) {
      rows.push([
        c.name || "", c.role || "",
        typeof c.score === "number" ? String(c.score) : "",
        c.verdict || "", c.stage || "",
        c.notes || "",
        c.ts ? new Date(c.ts).toISOString().slice(0, 10) : "",
      ]);
    }
    return rows.map((r) => r.map(csvCell).join(",")).join("\n");
  }

  // ---- stage history: how long has this candidate sat in each stage? ----
  // stampStage appends {stage, at} when the stage actually changes.
  function stampStage(c, stage, atMs) {
    if (!c) return c;
    const at = atMs == null ? Date.now() : atMs;
    c.stageLog = c.stageLog || [];
    const last = c.stageLog[c.stageLog.length - 1];
    if (!last || last.stage !== stage) c.stageLog.push({ stage, at });
    c.stage = stage;
    return c;
  }

  // Whole days in the current stage (falls back to `ts` for pre-log candidates).
  function daysInStage(c, nowMs) {
    const now = nowMs == null ? Date.now() : nowMs;
    const log = (c && c.stageLog) || [];
    const since = log.length ? log[log.length - 1].at : (c && c.ts) || now;
    return Math.max(0, Math.floor((now - since) / 864e5));
  }

  // Non-terminal candidates sitting longer than maxDays (default 7).
  function stalledCandidates(candidates, maxDays, nowMs) {
    const max = maxDays == null ? 7 : maxDays;
    return (candidates || [])
      .filter((c) => TERMINAL_STAGES.indexOf(c.stage) === -1 && daysInStage(c, nowMs) > max)
      .map((c) => ({ candidate: c, days: daysInStage(c, nowMs) }))
      .sort((a, b) => b.days - a.days);
  }

  // ---- offer letter draft (hired candidates) ----
  function offerLetter(d) {
    d = d || {};
    const name = (d.name || "[Candidate name]").trim() || "[Candidate name]";
    const role = (d.role || "[Role]").trim() || "[Role]";
    const company = (d.company || "[Company]").trim() || "[Company]";
    const pay = (d.pay || "").trim();
    const payType = d.payType === "salary" ? "per year" : "per hour";
    const start = (d.startDate || "[start date]").trim() || "[start date]";
    const manager = (d.manager || "[Hiring manager]").trim() || "[Hiring manager]";
    const warm = d.tone === "warm";
    const lines = [
      warm ? `Dear ${name} — great news.` : `Dear ${name},`,
      "",
      warm
        ? `We're thrilled to offer you the ${role} position at ${company}. You stood out through the whole process, and we'd love to have you on the team.`
        : `We are pleased to offer you the position of ${role} at ${company}.`,
      "",
      "The details:",
      `• Start date: ${start}`,
      pay ? `• Pay: $${pay} ${payType}` : "• Pay: [pay rate]",
      `• Reporting to: ${manager}`,
      "",
      "This offer is contingent on any background checks or references we discussed. " +
        "To accept, just reply to this email — we'll send the paperwork right over.",
      "",
      warm ? "Welcome aboard — we can't wait to work with you." : "We look forward to working with you.",
      "",
      `Best regards,`,
      manager,
      company,
    ];
    return lines.join("\n");
  }

  // ---- rejection email (rejected candidates) ----
  // tones: "warm" (default), "brief", "encouraging" (keeps the door open).
  function rejectionEmail(d) {
    d = d || {};
    const name = (d.name || "[Candidate name]").trim() || "[Candidate name]";
    const role = (d.role || "[Role]").trim() || "[Role]";
    const company = (d.company || "[Company]").trim() || "[Company]";
    const tone = ["warm", "brief", "encouraging"].indexOf(d.tone) === -1 ? "warm" : d.tone;
    const subject = `Thank you for applying — ${role} at ${company}`;
    let body;
    if (tone === "brief") {
      body = [
        `Hi ${name},`,
        "",
        `Thank you for applying for the ${role} role. We've decided to move forward with another candidate this time.`,
        "",
        `We appreciate your interest in ${company} and wish you the best.`,
        "",
        company,
      ].join("\n");
    } else if (tone === "encouraging") {
      body = [
        `Hi ${name},`,
        "",
        `Thank you for taking the time to apply for the ${role} role at ${company} — we genuinely enjoyed meeting you.`,
        "",
        `We've decided to go with another candidate for this opening, but you made a strong impression. We'd love to keep your resume on file and reach out when something fits.`,
        "",
        `Wishing you the best in your search,`,
        company,
      ].join("\n");
    } else {
      body = [
        `Hi ${name},`,
        "",
        `Thank you so much for your interest in the ${role} position at ${company}, and for the time you put into the process.`,
        "",
        `After careful consideration, we've decided to move forward with another candidate. This wasn't an easy call — please don't read it as a verdict on your abilities.`,
        "",
        `We're grateful you considered us, and we wish you every success.`,
        "",
        `Warmly,`,
        company,
      ].join("\n");
    }
    return { subject, body, tone };
  }

  // ---- interview scheduling (stored on the candidate, local only) ----
  const INTERVIEW_TYPES = ["phone", "video", "onsite"];
  // iv: { date: "YYYY-MM-DD", time: "HH:MM" (optional), type, interviewer, notes }
  // Returns the entry, or null when the date is invalid.
  function scheduleInterview(c, iv) {
    if (!c) return null;
    iv = iv || {};
    const date = String(iv.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const time = String(iv.time || "").trim();
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
    const type = INTERVIEW_TYPES.indexOf(iv.type) !== -1 ? iv.type : "phone";
    c.interviews = Array.isArray(c.interviews) ? c.interviews : [];
    const entry = {
      id: "iv" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
      date, time, type,
      interviewer: String(iv.interviewer || "").trim(),
      notes: String(iv.notes || "").trim(),
      done: false,
    };
    c.interviews.push(entry);
    return entry;
  }
  function removeInterview(c, id) {
    if (!c || !Array.isArray(c.interviews)) return false;
    const i = c.interviews.findIndex((x) => x.id === id);
    if (i === -1) return false;
    c.interviews.splice(i, 1);
    return true;
  }
  function interviewAt(iv) {
    if (!iv || !iv.date) return null;
    const ms = new Date(iv.date + "T" + (iv.time || "09:00") + ":00").getTime();
    return isFinite(ms) ? ms : null;
  }
  // Upcoming (non-past) interviews across candidates, soonest first.
  // Returns [{ candidate, interview, at }]. Additive: old candidates without
  // an `interviews` array simply contribute nothing.
  function upcomingInterviews(candidates, nowMs, limit) {
    const now = nowMs == null ? Date.now() : nowMs;
    const out = [];
    for (const c of candidates || []) {
      for (const iv of c.interviews || []) {
        const at = interviewAt(iv);
        if (at == null || at < now) continue;
        out.push({ candidate: c, interview: iv, at });
      }
    }
    out.sort((a, b) => a.at - b.at);
    return limit != null ? out.slice(0, limit) : out;
  }

  // ---- candidate notes journal (timestamped entries; legacy `notes` string untouched) ----
  function addNoteToLog(c, text, atMs) {
    const t = String(text || "").trim();
    if (!c || !t) return null;
    c.noteLog = Array.isArray(c.noteLog) ? c.noteLog : [];
    const entry = {
      id: "n" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
      at: atMs == null ? Date.now() : atMs,
      text: t,
    };
    c.noteLog.push(entry);
    return entry;
  }

  // ---- stage conversion funnel: per live stage, % of entered candidates that moved on ----
  function stageConversion(candidates) {
    const stages = ["applied", "screening", "interview", "offer"];
    const out = {};
    for (const s of stages) out[s] = { entered: 0, advanced: 0, pct: null };
    for (const c of candidates || []) {
      const log = Array.isArray(c.stageLog) && c.stageLog.length
        ? c.stageLog.map((x) => x.stage)
        : [c.stage].filter(Boolean);
      const seen = [];
      for (const s of log) if (seen[seen.length - 1] !== s) seen.push(s);
      for (const s of stages) {
        const i = seen.indexOf(s);
        if (i === -1) continue;
        out[s].entered++;
        const next = seen[i + 1];
        // advancing means moving forward to a later stage that is not an exit;
        // "rejected" ends the funnel, "hired" advances "offer".
        if (next && PIPE_STAGES.indexOf(next) > PIPE_STAGES.indexOf(s) && next !== "rejected") out[s].advanced++;
      }
    }
    for (const s of stages) {
      const e = out[s].entered;
      out[s].pct = e ? Math.round((out[s].advanced / e) * 100) : null;
    }
    return out;
  }

  return { generatePosts, redFlags, screenResume, mentions, norm, payLine,
    pipeStats, pipelineToCSV, PIPE_STAGES, TERMINAL_STAGES, SCORE_CATS, scoreInterview,
    stampStage, daysInStage, stalledCandidates, offerLetter, rejectionEmail,
    INTERVIEW_TYPES, scheduleInterview, removeInterview, interviewAt, upcomingInterviews,
    addNoteToLog, stageConversion };
});
