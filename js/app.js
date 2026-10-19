/* HireWise AI — UI wiring. All data stays in localStorage. */
(function () {
  "use strict";
  const HW = window.HireWise;
  const $ = (id) => document.getElementById(id);

  // ---- tabs ----
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.panel).classList.add("active");
    });
  });

  const splitLines = (s) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);

  // ---- keyboard shortcuts: Ctrl/Cmd+Enter submits the current panel ----
  document.addEventListener("keydown", (e) => {
    if (!((e.ctrlKey || e.metaKey) && e.key === "Enter")) return;
    if (e.target.closest && e.target.closest("#panel-post")) { e.preventDefault(); renderPosts(); }
    else if (e.target.closest && e.target.closest("#panel-screen")) { e.preventDefault(); runScreen(); }
  });

  // ---- job post builder ----
  function readPostForm() {
    return {
      role: $("role").value, company: $("company").value, location: $("location").value,
      payMin: $("payMin").value, payMax: $("payMax").value, payType: $("payType").value,
      mustHaves: splitLines($("mustHaves").value), niceToHaves: splitLines($("niceToHaves").value),
    };
  }
  function renderPosts() {
    const d = readPostForm();
    const posts = HW.generatePosts(d);
    const full = Object.values(posts).join("\n");
    $("postOut").innerHTML = ["professional", "friendly", "bold"].map((tone) => {
      const coName = (d.company || "").trim() || "Your company";
      const coInitial = coName.charAt(0).toUpperCase();
      const coLoc = (d.location || "").trim();
      return `<div class="postcard tone-${tone}">
       <div class="postcard-top"><span class="tonetag">${tone}</span>
       <button class="copybtn" data-tone="${tone}">Copy</button></div>
       <div class="ad-frame">
         <div class="ad-company"><span class="ad-logo">${escapeHtml(coInitial)}</span>${escapeHtml(coName)}${coLoc ? " · " + escapeHtml(coLoc) : ""}</div>
         <pre>${escapeHtml(posts[tone])}</pre>
       </div></div>`;
    }).join("");
    document.querySelectorAll(".copybtn").forEach((b) =>
      b.addEventListener("click", () => {
        navigator.clipboard.writeText(posts[b.dataset.tone]).catch(() => {});
        b.textContent = "Copied!"; setTimeout(() => (b.textContent = "Copy"), 1500);
      }));
    const flags = HW.redFlags(d, full);
    $("flagsOut").innerHTML = flags.map((f) =>
      `<div class="flag sev-${f.severity}"><strong>${escapeHtml(f.flag)}</strong>
       <p>${escapeHtml(f.why)}</p><p class="fix">Fix: ${escapeHtml(f.fix)}</p></div>`
    ).join("");
  }
  $("genPost").addEventListener("click", renderPosts);

  // ---- screener ----
  function loadSample(i) {
    const s = window.HIREWISE_SAMPLES[i];
    $("candName").value = s.name;
    $("resumeText").value = s.text;
  }
  document.querySelectorAll("[data-sample]").forEach((b) =>
    b.addEventListener("click", () => loadSample(+b.dataset.sample)));

  function runScreen() {
    const input = {
      role: $("sRole").value, resumeText: $("resumeText").value,
      mustHaves: splitLines($("sMustHaves").value),
    };
    const r = HW.screenResume(input);
    const badge = r.verdict === "strong" ? "Strong fit" : r.verdict === "maybe" ? "Maybe" : "Not a fit";
    const circ = (2 * Math.PI * 34).toFixed(1);
    const arc = ((r.score / 100) * 2 * Math.PI * 34).toFixed(1);
    $("screenOut").innerHTML = `
      <div class="scorecard verdict-${r.verdict}">
        <div class="dial" role="img" aria-label="Fit score ${r.score} of 100">
          <svg viewBox="0 0 84 84" width="104" height="104" aria-hidden="true">
            <circle cx="42" cy="42" r="34" class="dial-track"/>
            <circle cx="42" cy="42" r="34" class="dial-fill" stroke-dasharray="${arc} ${circ}" transform="rotate(-90 42 42)"/>
            <text x="42" y="50" text-anchor="middle" class="dial-num">${r.score}</text>
          </svg>
        </div>
        <div class="verdict">${badge}</div>
      </div>
      <h3>Evidence</h3>
      <ul class="evi">${r.evidence.map((e) =>
        `<li class="evi-${e.type}">${escapeHtml(e.text)}</li>`).join("")}</ul>
      <h3>Interview questions (tailored to gaps)</h3>
      <ol>${r.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ol>
      <button id="addToPipe" class="primary">Add to pipeline →</button>`;
    $("addToPipe").addEventListener("click", () => {
      const name = $("candName").value.trim() || "Unnamed candidate";
      addCandidate({ name, role: input.role || "—", score: r.score, verdict: r.verdict,
        stage: "applied", ts: Date.now(),
        evidence: r.evidence, questions: r.questions, matched: r.matched, missing: r.missing });
      document.querySelector('[data-panel="panel-pipe"]').click();
    });
  }
  $("runScreen").addEventListener("click", runScreen);

  // ---- pipeline ----
  const KEY = "hirewise.pipeline.v1";
  const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"];
  const STAGE_LABEL = { applied: "Applied", screening: "Screening", interview: "Interview",
    offer: "Offer", hired: "Hired", rejected: "Rejected" };
  let cmpSel = [];       // candidate indices ticked for side-by-side compare
  let bulkSel = [];      // candidate indices ticked for bulk actions
  let profileIdx = null; // candidate index open in the profile drawer
  function loadPipe() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function savePipe(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* storage blocked — keep in-memory state */ }
    renderPipe(); renderIvStrip();
    if (profileIdx !== null) {
      const pl = loadPipe();
      if (pl[profileIdx]) renderDrawer(pl, pl[profileIdx]);
      else closeProfile();
    }
  }
  function addCandidate(c) { const p = loadPipe(); HW.stampStage(c, c.stage || "applied", c.ts || Date.now()); p.push(c); savePipe(p); }
  window.__hwAddCandidate = addCandidate; // for tests

  let pipeQuery = "";
  function cardMatches(c) {
    const q = pipeQuery.trim().toLowerCase();
    if (!q) return true;
    return ((c.name || "") + " " + (c.role || "") + " " + (c.verdict || "")).toLowerCase().includes(q);
  }

  function renderPipeStats() {
    const s = HW.pipeStats(loadPipe());
    $("pipeStats").innerHTML =
      `<span class="pstat"><strong>${s.total}</strong> candidates</span>` +
      STAGES.map((st) => `<span class="pstat">${STAGE_LABEL[st]} <strong>${s.perStage[st]}</strong></span>`).join("") +
      `<span class="pstat">Avg score <strong>${s.avgScore == null ? "—" : s.avgScore}</strong></span>`;
  }

  function stageChip(c, st) {
    if (HW.TERMINAL_STAGES.indexOf(st) !== -1) return "";
    const d = HW.daysInStage(c);
    return `<span class="stage-chip${d > 7 ? " stalled" : ""}" title="Time in this stage">${d}d</span>`;
  }

  function cardHtml(c, i, st) {
    const terminal = st === "hired" || st === "rejected";
    const scoreChip = (typeof c.score === "number" && isFinite(c.score))
      ? `<span class="score-chip">${c.score}</span>` : `<span class="score-chip unscored">new</span>`;
    const iv = c.interview && c.interview.pct != null;
    const ivCount = (c.interviews || []).length;
    return `<div class="card verdict-${c.verdict}" draggable="true" data-dragidx="${i}">
       <div class="card-top">
         <button class="cardname" data-profile="${i}" title="Open candidate dossier">${escapeHtml(c.name)}</button>
         <label class="bulk-check" title="Select for bulk actions"><input type="checkbox" data-bulk="${i}"${bulkSel.includes(i) ? " checked" : ""} aria-label="Select ${escapeHtml(c.name)}"></label>
       </div>
       <div class="meta">${escapeHtml(c.role)}${scoreChip}${iv ? `<span class="score-chip iv" title="Interview scorecard">IV ${c.interview.pct}%</span>` : ""}${ivCount ? `<span class="score-chip cal" title="Scheduled interviews">${ivCount} int.</span>` : ""}${stageChip(c, st)}</div>
       ${c.notes ? `<div class="pnote">${escapeHtml(c.notes)}</div>` : ""}
       <div class="cardbtns">
         ${!terminal && st !== "applied" ? `<button data-mv="${i}|back" aria-label="Move back">←</button>` : ""}
         ${!terminal ? `<button data-mv="${i}|fwd" aria-label="Move forward">→</button>` : ""}
         <button data-profile="${i}">Dossier</button>
         ${st === "hired" ? `<button data-offer="${i}">Offer letter</button> ${c.onboardId ? `<button data-viewon="${i}">View onboarding</button>` : `<button data-onboard="${i}" class="primary">Start onboarding</button>`}` : ""}
         ${st === "rejected" ? `<button data-rejmail="${i}">Rejection email</button>` : ""}
         ${!terminal ? `<button data-reject="${i}" class="del">Reject</button>` : `<button data-reopen="${i}">Reopen</button>`}
         <button data-del="${i}" class="del">Delete</button>
       </div>
       <label class="cmp-check"><input type="checkbox" data-cmp="${i}"${cmpSel.includes(i) ? " checked" : ""}> compare</label>
     </div>`;
  }

  function renderCompare() {
    const p = loadPipe();
    const [ia, ib] = cmpSel;
    const a = p[ia], b = p[ib];
    if (!a || !b) { cmpSel = []; renderPipe(); return; }
    renderPipeStats();
    $("pipeCount").textContent = p.length ? p.length : "";
    const obCount = (window.__hwOnboard && typeof window.__hwOnboard.count === "function") ? window.__hwOnboard.count() : 0;
    const obEl = $("onboardCount");
    if (obEl) obEl.textContent = obCount ? obCount : "";
    const iv = (c) => (c.interview && c.interview.pct != null ? c.interview.pct + "%" : "—");
    const rScore = (c) => (typeof c.score === "number" && isFinite(c.score) ? c.score + "/100" : "—");
    const rows = [
      ["Role", a.role, b.role],
      ["Resume score", rScore(a), rScore(b)],
      ["Verdict", a.verdict, b.verdict],
      ["Stage", STAGE_LABEL[a.stage] || a.stage, STAGE_LABEL[b.stage] || b.stage],
      ["Interview", iv(a), iv(b)],
      ["Scheduled", String((a.interviews || []).length), String((b.interviews || []).length)],
      ["Notes", a.notes || "—", b.notes || "—"],
    ];
    $("pipeOut").innerHTML =
      `<div class="compare-wrap"><div class="compare-head">
         <h3>${escapeHtml(a.name)} <span class="vs">vs</span> ${escapeHtml(b.name)}</h3>
         <button class="secondary" data-back-board>← Back to board</button></div>
       <table class="data compare"><tr><th></th><th>${escapeHtml(a.name)}</th><th>${escapeHtml(b.name)}</th></tr>` +
      rows.map((r) => `<tr><td><strong>${r[0]}</strong></td><td>${escapeHtml(String(r[1]))}</td><td>${escapeHtml(String(r[2]))}</td></tr>`).join("") +
      `</table></div>`;
    document.querySelector("[data-back-board]").addEventListener("click", () => { cmpSel = []; renderPipe(); });
  }

  function renderBulkBar() {
    const bar = $("bulkBar");
    const sel = $("bulkStage");
    if (!sel.options.length)
      sel.innerHTML = STAGES.map((s) => `<option value="${s}">${STAGE_LABEL[s]}</option>`).join("");
    if (!bulkSel.length) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    $("bulkCount").textContent = bulkSel.length + (bulkSel.length === 1 ? " candidate selected" : " candidates selected");
  }

  function emptyStateHtml() {
    return `<div class="empty-state">
      <p class="eyebrow">A clean desk</p>
      <h3>No candidates in the pipeline yet</h3>
      <p>Add your first candidate above, or score a resume on the
      <a href="#" id="emptyGoScreen">Screen resumes</a> tab — strong fits land here automatically.</p>
    </div>`;
  }

  // Drop a dragged card onto a column: stamps the stage, logs a rejection reason.
  function dropCandidate(idx, targetStage) {
    const pl = loadPipe();
    const c = pl[idx];
    if (!c || c.stage === targetStage || STAGES.indexOf(targetStage) === -1) return;
    if (targetStage === "rejected") {
      const reason = prompt("Rejection reason (logged on the candidate record):", "");
      if (reason === null) return; // dropped by mistake — put it back
      if (reason.trim()) HW.addNoteToLog(c, "Rejected: " + reason.trim());
    }
    HW.stampStage(c, targetStage);
    savePipe(pl);
  }

  function renderPipe() {
    const p = loadPipe();
    renderPipeStats();
    renderBulkBar();
    $("pipeCount").textContent = p.length ? p.length : "";
    const obN = (window.__hwOnboard && typeof window.__hwOnboard.count === "function") ? window.__hwOnboard.count() : 0;
    const obT = $("onboardCount");
    if (obT) obT.textContent = obN ? obN : "";
    const stalled = HW.stalledCandidates(p, 7);
    $("stallOut").innerHTML = stalled.length
      ? `<div class="notice"><strong>Stalled.</strong> ` + stalled.map((s) =>
        `${escapeHtml(s.candidate.name)} — ${s.days} days in ${STAGE_LABEL[s.candidate.stage] || escapeHtml(s.candidate.stage)}`).join("; ") + "</div>"
      : "";
    if (!p.length) {
      $("pipeOut").innerHTML = emptyStateHtml();
      const g = $("emptyGoScreen");
      if (g) g.addEventListener("click", (e) => { e.preventDefault(); document.querySelector('[data-panel="panel-screen"]').click(); });
      return;
    }
    const conv = HW.stageConversion(p);
    const filtered = p.map((c, i) => ({ c, i })).filter((x) => cardMatches(x.c));
    $("pipeOut").innerHTML = STAGES.map((st) => {
      const cards = filtered.filter((x) => x.c.stage === st);
      const cv = conv[st];
      const convLine = cv && cv.pct !== null
        ? `<span class="conv">${cv.entered} entered · ${cv.pct}% advanced</span>`
        : (cv && cv.entered ? `<span class="conv">${cv.entered} entered</span>` : "");
      return `<div class="column" data-stage="${st}"><h3>${STAGE_LABEL[st]} <span class="count">${cards.length}</span></h3>${convLine}` +
        cards.map(({ c, i }) => cardHtml(c, i, st)).join("") + `</div>`;
    }).join("") +
      (filtered.length !== p.length ? `<p class="hint">Showing ${filtered.length} of ${p.length} candidates (search active).</p>` : "");
    // ---- drag and drop between columns ----
    document.querySelectorAll(".card[data-dragidx]").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", card.dataset.dragidx);
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => card.classList.add("dragging"), 0);
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });
    document.querySelectorAll(".column").forEach((col) => {
      col.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        col.classList.add("droptarget");
      });
      col.addEventListener("dragleave", () => col.classList.remove("droptarget"));
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        col.classList.remove("droptarget");
        dropCandidate(parseInt(e.dataTransfer.getData("text/plain"), 10), col.dataset.stage);
      });
    });
    // ---- per-card buttons ----
    document.querySelectorAll("[data-mv]").forEach((b) => b.addEventListener("click", () => {
      const [i, dir] = b.dataset.mv.split("|");
      const pl = loadPipe(); const c = pl[+i];
      const idx = STAGES.indexOf(c.stage);
      HW.stampStage(c, STAGES[Math.max(0, Math.min(STAGES.length - 1, idx + (dir === "fwd" ? 1 : -1)))]);
      savePipe(pl);
    }));
    document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); pl.splice(+b.dataset.del, 1); savePipe(pl);
    }));
    document.querySelectorAll("[data-reject]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); const c = pl[+b.dataset.reject];
      const reason = prompt("Rejection reason (logged on the candidate record):", "");
      if (reason === null) return;
      if (reason.trim()) HW.addNoteToLog(c, "Rejected: " + reason.trim());
      HW.stampStage(c, "rejected");
      savePipe(pl);
    }));
    document.querySelectorAll("[data-reopen]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); HW.stampStage(pl[+b.dataset.reopen], "screening"); savePipe(pl);
    }));
    document.querySelectorAll("[data-profile]").forEach((b) => b.addEventListener("click", () => {
      openProfile(+b.dataset.profile);
    }));
    document.querySelectorAll("[data-bulk]").forEach((box) => box.addEventListener("change", () => {
      const i = +box.dataset.bulk;
      bulkSel = box.checked ? [...new Set([...bulkSel, i])] : bulkSel.filter((x) => x !== i);
      renderPipe();
    }));
    document.querySelectorAll("[data-cmp]").forEach((box) => box.addEventListener("change", () => {
      const i = +box.dataset.cmp;
      cmpSel = box.checked ? [...new Set([...cmpSel, i])].slice(-2) : cmpSel.filter((x) => x !== i);
      renderPipe();
    }));
    document.querySelectorAll("[data-offer]").forEach((b) => b.addEventListener("click", () => {
      const c = loadPipe()[+b.dataset.offer];
      openDoc("Offer letter — " + c.name,
        `<div class="doc-form">
           <label>Company <input data-f="company" placeholder="e.g. Sunny Side Diner"></label>
           <div class="row"><label>Pay <input data-f="pay" inputmode="decimal" placeholder="22"></label>
           <label>Type <select data-f="payType"><option value="hourly">per hour</option><option value="salary">per year</option></select></label></div>
           <div class="row"><label>Start date <input data-f="startDate" type="date"></label>
           <label>Hiring manager <input data-f="manager" placeholder="Your name"></label></div>
           <label>Tone <select data-f="tone"><option value="professional">Professional</option><option value="warm">Warm</option></select></label>
         </div>`,
        (v) => HW.offerLetter({ name: c.name, role: c.role, company: v.company, pay: v.pay,
          payType: v.payType, startDate: v.startDate, manager: v.manager, tone: v.tone }));
    }));
    document.querySelectorAll("[data-rejmail]").forEach((b) => b.addEventListener("click", () => {
      const c = loadPipe()[+b.dataset.rejmail];
      openDoc("Rejection email — " + c.name,
        `<div class="doc-form">
           <label>Company <input data-f="company" placeholder="e.g. Sunny Side Diner"></label>
           <label>Tone <select data-f="tone"><option value="warm">Warm</option><option value="encouraging">Encouraging (keep the door open)</option><option value="brief">Brief</option></select></label>
         </div>`,
        (v) => {
          const e = HW.rejectionEmail({ name: c.name, role: c.role, company: v.company, tone: v.tone });
          return "Subject: " + e.subject + "\n\n" + e.body;
        });
    }));
    // ---- pipeline → onboarding bridge (merged from OnboardPilot AI) ----
    document.querySelectorAll("[data-onboard]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe();
      openOnboardModal(pl, +b.dataset.onboard, pl[+b.dataset.onboard]);
    }));
    document.querySelectorAll("[data-viewon]").forEach((b) => b.addEventListener("click", () => {
      const c = loadPipe()[+b.dataset.viewon];
      if (window.__hwOnboard && c.onboardId) window.__hwOnboard.open(c.onboardId);
    }));
  }

  // ---- upcoming interviews strip ----
  function ivLabel(at) {
    const d = new Date(at);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const diff = Math.round((day - today) / 864e5);
    const time = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    if (diff === 0) return "Today " + time;
    if (diff === 1) return "Tomorrow " + time;
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + " " + time;
  }
  function renderIvStrip() {
    const out = $("ivOut");
    const p = loadPipe();
    const up = HW.upcomingInterviews(p, Date.now(), 6);
    if (!up.length) { out.innerHTML = ""; out.classList.add("hidden"); return; }
    out.classList.remove("hidden");
    out.innerHTML = `<span class="iv-title">Upcoming interviews</span>` + up.map((u) =>
      `<button class="iv-item" data-profile="${p.indexOf(u.candidate)}" title="Open dossier">
         <strong>${escapeHtml(u.candidate.name)}</strong>
         <span>${escapeHtml(u.candidate.role)}</span>
         <span class="iv-when">${ivLabel(u.at)}</span>
         <span class="iv-type">${escapeHtml(u.interview.type)}</span>
       </button>`).join("");
    out.querySelectorAll("[data-profile]").forEach((b) =>
      b.addEventListener("click", () => openProfile(+b.dataset.profile, "interviews")));
  }

  // ---- candidate profile drawer ----
  function openProfile(idx, anchor) {
    const p = loadPipe();
    if (!p[idx]) return;
    profileIdx = idx;
    renderDrawer(p, p[idx]);
    $("drawerTitle").textContent = p[idx].name;
    $("profileDrawer").classList.add("open");
    $("drawerScrim").classList.add("open");
    document.body.classList.add("drawer-open");
    if (anchor) {
      const t = $("drawerBody").querySelector('[data-anchor="' + anchor + '"]');
      if (t) t.scrollIntoView();
    }
  }
  function closeProfile() {
    profileIdx = null;
    $("profileDrawer").classList.remove("open");
    $("drawerScrim").classList.remove("open");
    document.body.classList.remove("drawer-open");
  }
  $("drawerClose").addEventListener("click", closeProfile);
  $("drawerScrim").addEventListener("click", closeProfile);

  function dialSvg(score, size) {
    const circ = (2 * Math.PI * 34).toFixed(1);
    const arc = ((Math.max(0, Math.min(100, score)) / 100) * 2 * Math.PI * 34).toFixed(1);
    return `<svg viewBox="0 0 84 84" width="${size || 84}" height="${size || 84}" aria-hidden="true">
      <circle cx="42" cy="42" r="34" class="dial-track"/>
      <circle cx="42" cy="42" r="34" class="dial-fill" stroke-dasharray="${arc} ${circ}" transform="rotate(-90 42 42)"/>
      <text x="42" y="50" text-anchor="middle" class="dial-num">${score}</text></svg>`;
  }

  function renderDrawer(p, c) {
    const scored = typeof c.score === "number" && isFinite(c.score);
    const verdictName = { strong: "Strong fit", maybe: "Maybe", no: "Not a fit", new: "Not scored yet" }[c.verdict] || c.verdict;
    const evidence = (c.evidence || []).map((e) =>
      `<li class="evi-${e.type === "match" ? "pos" : e.type === "miss" ? "neg" : "neu"}">${escapeHtml(e.text)}</li>`).join("");
    const questions = (c.questions || []).map((q) => `<li>${escapeHtml(q)}</li>`).join("");
    const scRows = HW.SCORE_CATS.map((cat) =>
      `<label class="dsc-row"><span>${cat.label} <em>×${cat.weight}</em></span>
         <select data-dsc="${cat.id}"><option value="">—</option>${[1, 2, 3, 4, 5].map((n) =>
           `<option value="${n}"${c.interview && c.interview.ratings[cat.id] === n ? " selected" : ""}>${n}</option>`).join("")}
       </select></label>`).join("");
    const ivList = (c.interviews || []).slice().sort((a, b) => (HW.interviewAt(a) || 0) - (HW.interviewAt(b) || 0)).map((iv) =>
      `<div class="iv-line"><div><strong>${escapeHtml(iv.date)}${iv.time ? " · " + escapeHtml(iv.time) : ""}</strong>
         <span class="iv-type">${escapeHtml(iv.type)}</span>${iv.interviewer ? ` · with ${escapeHtml(iv.interviewer)}` : ""}</div>
       ${iv.notes ? `<div class="small muted">${escapeHtml(iv.notes)}</div>` : ""}
       <button class="ghost del" data-ivdel="${iv.id}">Cancel</button></div>`).join("") ||
      `<p class="muted small">Nothing scheduled yet.</p>`;
    const journal = (c.noteLog || []).slice().reverse().map((n) =>
      `<div class="note-item"><div class="note-text">${escapeHtml(n.text)}</div>
       <div class="note-meta"><span class="muted small">${new Date(n.at).toLocaleDateString()}</span></div></div>`).join("") ||
      `<p class="muted small">No journal entries yet — log calls, impressions, anything worth remembering.</p>`;
    const log = Array.isArray(c.stageLog) && c.stageLog.length ? c.stageLog : [{ stage: c.stage || "applied", at: c.ts || Date.now() }];
    const journey = log.map((s, i) => {
      const next = log[i + 1];
      const days = next ? Math.max(0, Math.round((next.at - s.at) / 864e5)) : HW.daysInStage(c);
      return `<div class="jstep"><span class="jpin"></span>
        <div><strong>${escapeHtml(STAGE_LABEL[s.stage] || s.stage)}</strong>
        <span class="muted small"> · ${new Date(s.at).toLocaleDateString()}${next ? ` · ${days}d` : ""}</span></div></div>`;
    }).join("");
    const days = HW.daysInStage(c);

    $("drawerBody").innerHTML = `
      <div class="dossier-head">
        <div><div class="dossier-role">${escapeHtml(c.role || "—")}</div>
        <div class="dossier-meta"><span class="stage-badge">${escapeHtml(STAGE_LABEL[c.stage] || c.stage)}</span>
        <span class="due-chip">${days}d in stage</span>
        ${c.onboardId ? `<span class="due-chip">onboarding started</span>` : ""}</div></div>
      </div>

      <section class="dossier-sect" data-anchor="fit">
        <h4>Fit score</h4>
        ${scored
          ? `<div class="dossier-score verdict-${c.verdict}"><span class="dial">${dialSvg(c.score, 76)}</span>
             <div><div class="verdict-line">${escapeHtml(verdictName)}</div>
             ${c.missing && c.missing.length ? `<div class="small muted">Missing: ${escapeHtml(c.missing.join("; "))}</div>` : ""}</div></div>`
          : `<p class="muted small">Not scored yet — paste their resume on the Screen resumes tab.</p>`}
        ${evidence ? `<h5>Evidence</h5><ul class="evi compact">${evidence}</ul>` : ""}
        ${questions ? `<h5>Interview questions</h5><ol class="dossier-q">${questions}</ol>` : ""}
      </section>

      <section class="dossier-sect" data-anchor="scorecard">
        <h4>Interview scorecard</h4>
        ${c.interview && c.interview.pct != null ? `<p class="iv-total">Current: <strong>${c.interview.pct}%</strong></p>` : ""}
        ${scRows}
        <button class="primary" data-scoresave2>Save scorecard</button>
      </section>

      <section class="dossier-sect" data-anchor="interviews">
        <h4>Scheduled interviews</h4>
        ${ivList}
        <div class="iv-form">
          <div class="row"><label>Date <input type="date" data-ivf="date"></label>
          <label>Time <input type="time" data-ivf="time"></label></div>
          <div class="row"><label>Type <select data-ivf="type">${HW.INTERVIEW_TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label>
          <label>Interviewer <input data-ivf="interviewer" placeholder="Who's meeting them"></label></div>
          <label>Notes <input data-ivf="notes" placeholder="e.g. portfolio review, bring laptop"></label>
          <button class="secondary" data-ivadd>Schedule interview</button>
        </div>
      </section>

      <section class="dossier-sect" data-anchor="notes">
        <h4>Notes journal</h4>
        ${c.notes ? `<div class="pnote legacy-note">${escapeHtml(c.notes)} <button class="ghost del" data-note="${profileIdx}">Edit old note</button></div>` : ""}
        ${journal}
        <div class="note-add">
          <textarea id="noteNew" rows="2" placeholder="Add a journal entry…"></textarea>
          <button class="secondary" data-noteadd>Add note</button>
        </div>
      </section>

      <section class="dossier-sect" data-anchor="journey">
        <h4>Stage journey</h4>
        <div class="journey-list">${journey}</div>
      </section>`;

    const body = $("drawerBody");
    body.querySelector("[data-scoresave2]").addEventListener("click", () => {
      const pl = loadPipe(); const cand = pl[profileIdx]; if (!cand) return;
      const ratings = {};
      body.querySelectorAll("[data-dsc]").forEach((sel) => { ratings[sel.dataset.dsc] = +sel.value; });
      cand.interview = HW.scoreInterview(ratings);
      savePipe(pl);
    });
    body.querySelector("[data-ivadd]").addEventListener("click", () => {
      const vals = {};
      body.querySelectorAll("[data-ivf]").forEach((inp) => { vals[inp.dataset.ivf] = inp.value; });
      if (!vals.date) { alert("Pick a date for the interview."); return; }
      const pl = loadPipe(); const cand = pl[profileIdx]; if (!cand) return;
      if (!HW.scheduleInterview(cand, vals)) { alert("That date doesn't look right — use YYYY-MM-DD."); return; }
      savePipe(pl);
    });
    body.querySelectorAll("[data-ivdel]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); const cand = pl[profileIdx]; if (!cand) return;
      if (confirm("Cancel this interview?")) { HW.removeInterview(cand, b.dataset.ivdel); savePipe(pl); }
    }));
    body.querySelector("[data-noteadd]").addEventListener("click", () => {
      const ta = body.querySelector("#noteNew");
      const pl = loadPipe(); const cand = pl[profileIdx]; if (!cand) return;
      if (!HW.addNoteToLog(cand, ta.value)) { alert("Write the note first."); return; }
      savePipe(pl);
    });
    body.querySelectorAll("[data-note]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); const cand = pl[+b.dataset.note]; if (!cand) return;
      const v = prompt("Notes for " + cand.name + ":", cand.notes || "");
      if (v === null) return;
      cand.notes = v.trim(); savePipe(pl);
    }));
  }
  // Start onboarding for a hired candidate: pick a role template, start date, buddy.
  // Creates the Day 1 / Week 1 / Day 30 checklist on the same hire record journey.
  function openOnboardModal(pl, idx, c) {
    const bridge = window.__hwOnboard;
    if (!bridge) { alert("The onboarding module is still loading — try again in a moment."); return; }
    const roles = bridge.roles();
    const buddies = bridge.buddies();
    if (!roles.length) { alert("No role templates available yet — add one under Onboard → Roles first."); return; }
    const roleGuess = roles.find((r) => r.toLowerCase() === String(c.role || "").toLowerCase()) || roles[0];
    openDoc("Start onboarding — " + c.name,
      `<div class="doc-form">
         <label>Role template <select data-f="role">${roles.map((r) =>
           `<option${r === roleGuess ? " selected" : ""}>${escapeHtml(r)}</option>`).join("")}</select></label>
         <div class="row"><label>Start date <input data-f="startDate" type="date"></label>
         <label>Buddy <select data-f="buddy"><option value="">— none —</option>${buddies.map((x) =>
           `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("")}</select></label></div>
       </div>`,
      (v) => {
        const bName = v.buddy ? (buddies.find((x) => x.id === v.buddy) || {}).name : null;
        return `Creates a Day 1 / Week 1 / Day 30 onboarding checklist for ${c.name} ` +
          `(${v.role || "—"})${v.startDate ? ", starting " + v.startDate : " (no start date yet)"}.\n` +
          `Buddy: ${bName || "none"}.\n\nHit "Create checklist" to add them to the Onboard tab.`;
      });
    $("docCopy").textContent = "Create checklist";
    $("docCopy").onclick = () => {
      const vals = {};
      $("docForm").querySelectorAll("[data-f]").forEach((inp) => { vals[inp.dataset.f] = inp.value; });
      const h = bridge.add(c.name, vals.role, vals.startDate || null, vals.buddy || null, "pipeline");
      if (!h) { alert("Couldn't create the checklist for that role — pick a different template."); return; }
      pl[idx].onboardId = h.id;
      savePipe(pl);
      $("docModal").classList.add("hidden");
      $("docCopy").textContent = "Copy";
      bridge.open(h.id);
    };
  }
  $("clearPipe").addEventListener("click", () => { if (confirm("Clear the whole pipeline?")) savePipe([]); });
  $("quickAdd").addEventListener("click", () => {
    const name = $("qaName").value.trim();
    const role = $("qaRole").value.trim() || "—";
    if (!name) { alert("Enter a candidate name first."); return; }
    addCandidate({ name, role, score: null, verdict: "new", stage: "applied", ts: Date.now() });
    $("qaName").value = ""; $("qaRole").value = "";
  });
  $("pipeSearch").addEventListener("input", (e) => { pipeQuery = e.target.value; renderPipe(); });
  $("compareBtn").addEventListener("click", () => {
    if (cmpSel.length === 2) renderCompare();
    else alert("Tick “compare” on exactly two candidates first.");
  });
  $("exportPipe").addEventListener("click", () => {
    const csv = HW.pipelineToCSV(loadPipe());
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "hirewise-pipeline.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  // ---- bulk actions ----
  $("bulkApply").addEventListener("click", () => {
    const pl = loadPipe(); const st = $("bulkStage").value;
    bulkSel.forEach((i) => { if (pl[i]) HW.stampStage(pl[i], st); });
    bulkSel = []; savePipe(pl);
  });
  $("bulkReject").addEventListener("click", () => {
    if (!bulkSel.length || !confirm("Reject " + bulkSel.length + " candidate(s)?")) return;
    const pl = loadPipe();
    bulkSel.forEach((i) => { if (pl[i]) HW.stampStage(pl[i], "rejected"); });
    bulkSel = []; savePipe(pl);
  });
  $("bulkDelete").addEventListener("click", () => {
    if (!bulkSel.length || !confirm("Delete " + bulkSel.length + " candidate(s)?")) return;
    const pl = loadPipe();
    bulkSel.slice().sort((a, b) => b - a).forEach((i) => pl.splice(i, 1));
    bulkSel = []; savePipe(pl);
  });
  $("bulkClear").addEventListener("click", () => { bulkSel = []; renderPipe(); });

  // ---- document modal: offer letters + rejection emails ----
  function openDoc(title, formHtml, render) {
    $("docTitle").textContent = title;
    $("docForm").innerHTML = formHtml;
    $("docModal").classList.remove("hidden");
    $("docCopy").textContent = "Copy";
    const update = () => {
      const vals = {};
      $("docForm").querySelectorAll("[data-f]").forEach((inp) => { vals[inp.dataset.f] = inp.value; });
      $("docOut").textContent = render(vals);
    };
    $("docForm").querySelectorAll("[data-f]").forEach((inp) => inp.addEventListener("input", update));
    update();
    $("docCopy").onclick = () => {
      navigator.clipboard.writeText($("docOut").textContent).catch(() => {});
      $("docCopy").textContent = "Copied!";
      setTimeout(() => ($("docCopy").textContent = "Copy"), 1500);
    };
  }
  $("docClose").addEventListener("click", () => $("docModal").classList.add("hidden"));
  $("docModal").addEventListener("click", (e) => {
    if (e.target === $("docModal")) $("docModal").classList.add("hidden");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $("docModal").classList.add("hidden"); closeProfile(); }
  });

  renderPipe();
  renderIvStrip();

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
