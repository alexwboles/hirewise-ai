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
    $("screenOut").innerHTML = `
      <div class="scorecard verdict-${r.verdict}">
        <div class="scorenum">${r.score}<span>/100</span></div>
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
      addCandidate({ name, role: input.role || "—", score: r.score, verdict: r.verdict, stage: "applied", ts: Date.now() });
      document.querySelector('[data-panel="panel-pipe"]').click();
    });
  }
  $("runScreen").addEventListener("click", runScreen);

  // ---- pipeline ----
  const KEY = "hirewise.pipeline.v1";
  const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"];
  const STAGE_LABEL = { applied: "Applied", screening: "Screening", interview: "Interview",
    offer: "Offer", hired: "Hired", rejected: "Rejected" };
  let scoringId = null; // candidate index with the scorecard form open
  let cmpSel = [];      // candidate indices ticked for side-by-side compare
  function loadPipe() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function savePipe(p) { localStorage.setItem(KEY, JSON.stringify(p)); renderPipe(); }
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

  function ivChip(c) {
    return c.interview && c.interview.pct != null
      ? `<span class="score-chip iv" title="Interview scorecard">IV ${c.interview.pct}%</span>` : "";
  }

  function stageChip(c, st) {
    if (HW.TERMINAL_STAGES.indexOf(st) !== -1) return "";
    const d = HW.daysInStage(c);
    return `<span class="stage-chip${d > 7 ? " stalled" : ""}" title="Time in this stage">${d}d</span>`;
  }

  function cardHtml(c, i, st) {
    if (scoringId === i) {
      return `<div class="card verdict-${c.verdict}">
        <strong>${escapeHtml(c.name)}</strong>
        <div class="meta">Interview scorecard</div>
        ${HW.SCORE_CATS.map((cat) =>
          `<label class="sc-row">${cat.label} (×${cat.weight})
            <select data-sc="${cat.id}">${[1, 2, 3, 4, 5].map((n) =>
              `<option value="${n}"${c.interview && c.interview.ratings[cat.id] === n ? " selected" : ""}>${n}</option>`).join("")}
            </select></label>`).join("")}
        <div class="cardbtns">
          <button data-scoresave="${i}" class="primary">Save score</button>
          <button data-scorecancel>Cancel</button>
        </div></div>`;
    }
    const terminal = st === "hired" || st === "rejected";
    return `<div class="card verdict-${c.verdict}">
       <strong>${escapeHtml(c.name)}</strong>
       <div class="meta">${escapeHtml(c.role)}<span class="score-chip">${c.score}</span>${ivChip(c)}${stageChip(c, st)}</div>
       ${c.notes ? `<div class="pnote">${escapeHtml(c.notes)}</div>` : ""}
       <div class="cardbtns">
         ${!terminal && st !== "applied" ? `<button data-mv="${i}|back" aria-label="Move back">←</button>` : ""}
         ${!terminal ? `<button data-mv="${i}|fwd" aria-label="Move forward">→</button>` : ""}
         ${st === "hired" ? `<span class="hired-tag">★ hired</span> <button data-offer="${i}">Offer letter</button>` : ""}
         ${st === "rejected" ? `<button data-rejmail="${i}">Rejection email</button>` : ""}
         <button data-score="${i}">Score</button>
         <button data-note="${i}">Notes</button>
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
    const iv = (c) => (c.interview && c.interview.pct != null ? c.interview.pct + "%" : "—");
    const rows = [
      ["Role", a.role, b.role],
      ["Resume score", a.score + "/100", b.score + "/100"],
      ["Verdict", a.verdict, b.verdict],
      ["Stage", STAGE_LABEL[a.stage] || a.stage, STAGE_LABEL[b.stage] || b.stage],
      ["Interview", iv(a), iv(b)],
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

  function renderPipe() {
    const p = loadPipe();
    renderPipeStats();
    $("pipeCount").textContent = p.length ? p.length : "";
    const stalled = HW.stalledCandidates(p, 7);
    $("stallOut").innerHTML = stalled.length
      ? `<div class="notice"><strong>Stalled.</strong> ` + stalled.map((s) =>
        `${escapeHtml(s.candidate.name)} — ${s.days} days in ${STAGE_LABEL[s.candidate.stage] || escapeHtml(s.candidate.stage)}`).join("; ") + "</div>"
      : "";
    const filtered = p.map((c, i) => ({ c, i })).filter((x) => cardMatches(x.c));
    $("pipeOut").innerHTML = STAGES.map((st) => {
      const cards = filtered.filter((x) => x.c.stage === st);
      return `<div class="column"><h3>${STAGE_LABEL[st]} <span class="count">${cards.length}</span></h3>` +
        cards.map(({ c, i }) => cardHtml(c, i, st)).join("") + `</div>`;
    }).join("") +
      (filtered.length !== p.length ? `<p class="hint">Showing ${filtered.length} of ${p.length} candidates (search active).</p>` : "");
    document.querySelectorAll("[data-mv]").forEach((b) => b.addEventListener("click", () => {
      const [i, dir] = b.dataset.mv.split("|");
      const pl = loadPipe(); const c = pl[+i];
      const idx = STAGES.indexOf(c.stage);
      HW.stampStage(c, STAGES[Math.max(0, Math.min(STAGES.length - 1, idx + (dir === "fwd" ? 1 : -1)))]);
      savePipe(pl);
    }));
    document.querySelectorAll("[data-note]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); const c = pl[+b.dataset.note];
      const v = prompt("Notes for " + c.name + ":", c.notes || "");
      if (v === null) return;
      c.notes = v.trim(); savePipe(pl);
    }));
    document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); pl.splice(+b.dataset.del, 1); savePipe(pl);
    }));
    document.querySelectorAll("[data-score]").forEach((b) => b.addEventListener("click", () => {
      scoringId = +b.dataset.score; renderPipe();
    }));
    document.querySelectorAll("[data-scorecancel]").forEach((b) => b.addEventListener("click", () => {
      scoringId = null; renderPipe();
    }));
    document.querySelectorAll("[data-scoresave]").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.scoresave;
      const pl = loadPipe();
      const ratings = {};
      b.closest(".card").querySelectorAll("[data-sc]").forEach((sel) => { ratings[sel.dataset.sc] = +sel.value; });
      pl[i].interview = HW.scoreInterview(ratings);
      scoringId = null;
      savePipe(pl);
    }));
    document.querySelectorAll("[data-reject]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); HW.stampStage(pl[+b.dataset.reject], "rejected"); savePipe(pl);
    }));
    document.querySelectorAll("[data-reopen]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); HW.stampStage(pl[+b.dataset.reopen], "screening"); savePipe(pl);
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
  }
  $("clearPipe").addEventListener("click", () => { if (confirm("Clear the whole pipeline?")) savePipe([]); });
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
  // ---- document modal: offer letters + rejection emails ----
  function openDoc(title, formHtml, render) {
    $("docTitle").textContent = title;
    $("docForm").innerHTML = formHtml;
    $("docModal").classList.remove("hidden");
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
    if (e.key === "Escape") $("docModal").classList.add("hidden");
  });

  renderPipe();

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
