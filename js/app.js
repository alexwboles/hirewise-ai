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
    $("postOut").innerHTML = ["professional", "friendly", "bold"].map((tone) =>
      `<div class="postcard"><div class="postcard-head"><span class="tonetag">${tone}</span>
       <button class="copybtn" data-tone="${tone}">Copy</button></div>
       <pre>${escapeHtml(posts[tone])}</pre></div>`
    ).join("");
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
  const STAGES = ["applied", "screening", "interview", "offer"];
  const STAGE_LABEL = { applied: "Applied", screening: "Screening", interview: "Interview", offer: "Offer" };
  function loadPipe() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function savePipe(p) { localStorage.setItem(KEY, JSON.stringify(p)); renderPipe(); }
  function addCandidate(c) { const p = loadPipe(); p.push(c); savePipe(p); }
  window.__hwAddCandidate = addCandidate; // for tests

  function renderPipe() {
    const p = loadPipe();
    $("pipeOut").innerHTML = STAGES.map((st) => {
      const cards = p.map((c, i) => ({ c, i })).filter((x) => x.c.stage === st);
      return `<div class="column"><h3>${STAGE_LABEL[st]} (${cards.length})</h3>` +
        cards.map(({ c, i }) =>
          `<div class="card verdict-${c.verdict}">
             <strong>${escapeHtml(c.name)}</strong>
             <div class="meta">${escapeHtml(c.role)} · ${c.score}/100</div>
             <div class="cardbtns">
               ${st !== "applied" ? `<button data-mv="${i}|back">←</button>` : ""}
               ${st !== "offer" ? `<button data-mv="${i}|fwd">→</button>` : `<span class="hired">★</span>`}
               <button data-del="${i}" class="del">Delete</button>
             </div></div>`
        ).join("") + `</div>`;
    }).join("");
    document.querySelectorAll("[data-mv]").forEach((b) => b.addEventListener("click", () => {
      const [i, dir] = b.dataset.mv.split("|");
      const pl = loadPipe(); const c = pl[+i];
      const idx = STAGES.indexOf(c.stage);
      c.stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, idx + (dir === "fwd" ? 1 : -1)))];
      savePipe(pl);
    }));
    document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const pl = loadPipe(); pl.splice(+b.dataset.del, 1); savePipe(pl);
    }));
  }
  $("clearPipe").addEventListener("click", () => { if (confirm("Clear the whole pipeline?")) savePipe([]); });
  renderPipe();

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
