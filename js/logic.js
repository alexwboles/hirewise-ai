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

  return { generatePosts, redFlags, screenResume, mentions, norm, payLine };
});
