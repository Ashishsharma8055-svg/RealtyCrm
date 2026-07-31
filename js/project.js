/* project.js — project detail: animated slides, ROI, OTP inventory */
(function () {
  const cfg = window.APP_CONFIG, brand = cfg.brand;
  let PROJECT = null, CHART_GROWTH = null, CHART_SPLIT = null;
  let confirmationResult = null, demoCode = null, verifiedMobile = null, verifiedName = null, pendingAgent = null, otpFallback = false;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    initNav(); paintCommon();
    const id = new URLSearchParams(location.search).get("id");
    PROJECT = id ? await Store.project(id) : null;
    if (!PROJECT) { document.getElementById("app").innerHTML = `<div class="container" style="padding:160px 0;text-align:center"><h2>Project not found</h2><a class="btn btn-gold" href="index.html">← Back to all projects</a></div>`; return; }
    document.title = PROJECT.name + " · Coffee & Deals";
    renderProject(); wireRail(); buildROI(); wireOTP(); wireEnquiry();
    initReveal(); initSmoothScroll();
  }

  function paintCommon() {
    const brandHTML = `${mugSVG}<span>Coffee &amp; Deals<small>Real Estate</small></span>`;
    document.getElementById("brand").innerHTML = brandHTML;
    document.getElementById("footBrand").innerHTML = brandHTML;
    document.getElementById("year").textContent = new Date().getFullYear();
    document.getElementById("footPhone").href = "tel:" + brand.phone.replace(/\s+/g, ""); document.getElementById("footPhone").textContent = "☎ " + brand.phone;
    const fm = document.getElementById("footMail"); if (fm) { fm.href = "mailto:" + brand.email; fm.textContent = "✉ " + brand.email; }
  }

  function renderProject() {
    const p = PROJECT;
    const why = (p.why || []).map((w, i) => `<div class="why-card reveal"><div class="n">${i + 1}</div><p style="margin:0">${esc(w)}</p></div>`).join("");
    const usp = (p.usp || []).map(u => `<li><span class="tick">✔</span><span>${esc(u)}</span></li>`).join("");
    document.getElementById("app").innerHTML = `
      <section class="pj-banner">
        ${p.image ? `<img class="pj-banner-img" src="${esc(p.image)}" alt="${esc(p.name)}"${p.imageFallback ? ` data-fb="${esc(p.imageFallback)}"` : ""} onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';}else{this.style.display='none';}">` : ""}
        <div class="pj-banner-scrim"></div>
        <div class="container pj-banner-in">
          <a class="pj-back" href="index.html#projects">← All projects</a>
          <div><span class="pj-cat">${esc(p.category)}</span></div>
          <h1>${esc(p.name)}</h1>
          <div class="loc">📍 ${esc(p.location)}</div>
          <p class="pj-tag">${esc(p.tagline || "")}</p>
          <div class="pj-facts">
            <div class="f"><div class="k">Configuration</div><div class="v">${esc(p.config || "—")}</div></div>
            <div class="f"><div class="k">Starting Price</div><div class="v">${esc(p.priceLabel || crLabel(p.priceFromCr))}</div></div>
            <div class="f"><div class="k">Possession</div><div class="v">${esc(p.possession || "—")}</div></div>
            <div class="f"><div class="k">Type</div><div class="v">${esc(p.type)}</div></div>
          </div>
          <div class="hero-cta" style="margin-top:1.8rem">
            <a class="btn btn-gold" href="#inventory" style="background:var(--white);color:var(--ink)">Check Live Inventory</a>
            <a class="btn btn-ghost" href="#roi">Investor Projections</a>
          </div>
        </div>
      </section>

      <div class="slide-rail"><div class="container" id="rail">
        <div class="rail-dot active" data-target="s-about"><span class="n">01</span> About</div>
        <div class="rail-dot" data-target="s-why"><span class="n">02</span> Why this</div>
        <div class="rail-dot" data-target="s-usp"><span class="n">03</span> USP</div>
        <div class="rail-dot" data-target="s-roi"><span class="n">04</span> Investor ROI</div>
        <div class="rail-dot" data-target="s-inv"><span class="n">05</span> Live Inventory</div>
      </div></div>

      <section class="slide" id="s-about"><div class="container"><div class="reveal">
        <div class="slide-num">01</div><span class="eyebrow">About the project</span>
        <h2>${esc(p.name)}</h2><p class="lead">${esc(p.about || p.description || "")}</p>
        <div class="tile-meta" style="margin-top:1.4rem"><span class="pill">${esc(p.category)}</span><span class="pill">${esc(p.type)}</span><span class="pill">Payment: ${esc(p.paymentPlan || "On request")}</span></div>
      </div></div></section>

      <section class="slide" id="s-why"><div class="container">
        <div class="reveal"><div class="slide-num">02</div><span class="eyebrow">Why this project</span><h2>Three reasons it makes sense</h2></div>
        <div class="why-grid">${why}</div></div></section>

      <section class="slide" id="s-usp"><div class="container"><div class="reveal">
        <div class="slide-num">03</div><span class="eyebrow">Unique selling points</span><h2>What sets it apart</h2>
        <ul class="usp-list">${usp}</ul></div></div></section>

      <section class="slide" id="s-roi"><div class="container">
        <div class="reveal"><div class="slide-num">04</div><span class="eyebrow">If you're an investor</span>
        <h2>The numbers, like a CFO would model them</h2>
        <p class="lead">Drag the levers below to stress-test the investment case. Projections combine capital appreciation and rental yield over your holding period.</p></div>
        <div class="roi-wrap">
          <div class="roi-controls reveal">
            <div class="rowc"><label>Entry price <b id="lblEntry"></b></label><input type="range" id="inEntry" min="1" max="15" step="0.1"></div>
            <div class="rowc"><label>Annual appreciation <b id="lblAppr"></b></label><input type="range" id="inAppr" min="4" max="20" step="0.5"></div>
            <div class="rowc"><label>Rental yield (p.a.) <b id="lblYield"></b></label><input type="range" id="inYield" min="0" max="6" step="0.1"></div>
            <div class="rowc"><label>Holding period <b id="lblHold"></b></label><input type="range" id="inHold" min="2" max="12" step="1"></div>
            <div class="roi-kpis">
              <div class="kpi"><div class="k">Projected value</div><div class="v" id="kpiValue"></div></div>
              <div class="kpi"><div class="k">Total gain</div><div class="v pos" id="kpiGain"></div></div>
              <div class="kpi"><div class="k">Rental income</div><div class="v" id="kpiRent"></div></div>
              <div class="kpi"><div class="k">Overall ROI</div><div class="v pos" id="kpiROI"></div></div>
            </div>
            <div class="kpi" style="margin-top:14px"><div class="k">Effective CAGR (capital + rent)</div><div class="v pos" id="kpiCAGR"></div></div>
          </div>
          <div>
            <div class="chart-box reveal"><h4>Projected wealth build-up (₹ Cr)</h4><div class="chart-canvas"><canvas id="growthChart"></canvas></div></div>
            <div class="chart-box reveal" style="margin-top:20px"><h4>Return composition at exit</h4><div class="chart-canvas" style="height:200px"><canvas id="splitChart"></canvas></div></div>
            <div class="cfo-note">CFO's note: figures are model-based projections using your chosen assumptions, not guaranteed returns. Real outcomes depend on market cycles, timing, financing cost and liquidity. Always corroborate with independent due diligence.</div>
          </div>
        </div></div></section>

      <section class="inv-cta" id="s-inv"><a id="inventory"></a><div class="container">
        <span class="eyebrow" style="justify-content:center;color:var(--accent)">Real-time availability</span>
        <h2>Check the live inventory</h2>
        <p>For serious buyers only — verify your mobile with an OTP and I'll open up real-time unit availability, sizes and pricing for ${esc(p.name)}.</p>
        <button class="btn btn-gold" id="openOtp" style="background:var(--white);color:var(--ink)">🔓 Unlock Live Inventory</button>
        <div class="inv-panel" id="invPanel" style="margin-top:2.4rem;text-align:left"><div class="container" style="padding:0">
          <table class="inv-table" id="invTable"></table>
          <div class="inv-enq"><span class="muted" style="font-size:.85rem">Tap &ldquo;Open&rdquo; on any available unit to reveal costing &mdash; I&rsquo;ll follow up with the best price.</span></div>
        </div></div>
      </div></section>`;
  }

  function wireRail() {
    const dots = [...document.querySelectorAll(".rail-dot")];
    dots.forEach(d => d.addEventListener("click", () => { const t = document.getElementById(d.dataset.target); (t || document.getElementById("s-about")).scrollIntoView({ behavior: "smooth", block: "start" }); }));
    const map = { "s-about": 0, "s-why": 1, "s-usp": 2, "s-roi": 3, "s-inv": 4 };
    const io = new IntersectionObserver((entries) => { entries.forEach(e => { if (e.isIntersecting && map[e.target.id] != null) { dots.forEach(x => x.classList.remove("active")); dots[map[e.target.id]].classList.add("active"); } }); }, { threshold: 0.4 });
    ["s-about", "s-why", "s-usp", "s-roi", "s-inv"].forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  function buildROI() {
    const r = PROJECT.roi || { entryPriceCr: PROJECT.priceFromCr || 3, apprRate: 11, rentalYield: 3, holdYears: 5 };
    const el = (id) => document.getElementById(id);
    el("inEntry").value = r.entryPriceCr; el("inAppr").value = r.apprRate; el("inYield").value = r.rentalYield; el("inHold").value = r.holdYears;
    ["inEntry", "inAppr", "inYield", "inHold"].forEach(id => el(id).addEventListener("input", recompute));
    recompute();
  }
  function recompute() {
    const entry = +v("inEntry"), appr = +v("inAppr"), yield_ = +v("inYield"), hold = +v("inHold");
    document.getElementById("lblEntry").textContent = crLabel(entry);
    document.getElementById("lblAppr").textContent = appr + "%";
    document.getElementById("lblYield").textContent = yield_ + "%";
    document.getElementById("lblHold").textContent = hold + " yrs";
    const years = [], capital = [], cumRent = [], total = []; let rentAccum = 0;
    for (let y = 0; y <= hold; y++) {
      const cap = entry * Math.pow(1 + appr / 100, y);
      if (y > 0) rentAccum += entry * Math.pow(1 + appr / 100, y - 1) * (yield_ / 100);
      years.push("Yr " + y); capital.push(+cap.toFixed(3)); cumRent.push(+rentAccum.toFixed(3)); total.push(+(cap + rentAccum).toFixed(3));
    }
    const finalVal = capital[capital.length - 1], gain = finalVal - entry, totalRet = finalVal + rentAccum - entry;
    const roiPct = (totalRet / entry) * 100, cagr = (Math.pow((finalVal + rentAccum) / entry, 1 / hold) - 1) * 100;
    setTxt("kpiValue", crLabel(finalVal)); setTxt("kpiGain", "+" + crLabel(gain)); setTxt("kpiRent", crLabel(rentAccum));
    setTxt("kpiROI", "+" + roiPct.toFixed(0) + "%"); setTxt("kpiCAGR", cagr.toFixed(1) + "% p.a.");
    drawGrowth(years, capital, cumRent, total); drawSplit(entry, gain, rentAccum);
  }
  function drawGrowth(labels, capital, rent, total) {
    const ctx = document.getElementById("growthChart");
    if (CHART_GROWTH) { CHART_GROWTH.data.labels = labels; CHART_GROWTH.data.datasets[0].data = capital; CHART_GROWTH.data.datasets[1].data = rent; CHART_GROWTH.data.datasets[2].data = total; CHART_GROWTH.update(); return; }
    const grad = ctx.getContext("2d").createLinearGradient(0, 0, 0, 260); grad.addColorStop(0, "rgba(91,143,201,.28)"); grad.addColorStop(1, "rgba(91,143,201,0)");
    CHART_GROWTH = new Chart(ctx, { type: "line",
      data: { labels, datasets: [
        { label: "Capital value", data: capital, borderColor: "#5b8fc9", backgroundColor: grad, fill: true, tension: .35, borderWidth: 3, pointRadius: 0 },
        { label: "Cumulative rent", data: rent, borderColor: "#4b7d5b", borderDash: [6, 4], tension: .35, borderWidth: 2, pointRadius: 0 },
        { label: "Total wealth", data: total, borderColor: "#0f0f0e", tension: .35, borderWidth: 2, pointRadius: 0 } ] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
        plugins: { legend: { labels: { color: "#2c2c2a", font: { size: 11 }, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => c.dataset.label + ": ₹" + c.parsed.y.toFixed(2) + " Cr" } } },
        scales: { y: { ticks: { color: "#6c6a66", callback: (v) => "₹" + v + "Cr" }, grid: { color: "rgba(15,15,14,.06)" } }, x: { ticks: { color: "#6c6a66" }, grid: { display: false } } } } });
  }
  function drawSplit(principal, gain, rent) {
    const ctx = document.getElementById("splitChart"); const data = [principal, gain, rent];
    if (CHART_SPLIT) { CHART_SPLIT.data.datasets[0].data = data; CHART_SPLIT.update(); return; }
    CHART_SPLIT = new Chart(ctx, { type: "doughnut",
      data: { labels: ["Principal", "Capital gain", "Rental income"], datasets: [{ data, backgroundColor: ["#0f0f0e", "#5b8fc9", "#4b7d5b"], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "right", labels: { color: "#2c2c2a", font: { size: 11 }, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => c.label + ": ₹" + c.parsed.toFixed(2) + " Cr" } } } } });
  }

  const SESSION_KEY = "cnd_session", SESSION_MIN = 30;
  function saveSession(name, mobile, agent) { try { localStorage.setItem(SESSION_KEY, JSON.stringify({ name, mobile, agent: agent || null, ts: Date.now() })); } catch (e) {} }
  function getSession() { try { const s = JSON.parse(localStorage.getItem(SESSION_KEY)); if (s && s.name && s.mobile && (Date.now() - s.ts) < SESSION_MIN * 60000) return s; } catch (e) {} return null; }

  // One enquiry record per visitor (mobile) + project. A "view" record is created on unlock;
  // opening a unit upgrades that same record instead of creating a duplicate.
  function genCode() {
    const raw = (Date.now().toString(36) + Math.random().toString(36).slice(2)).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return "CND-" + raw.slice(-6);
  }
  function addInterest(rec, project, unit, ts) {
    if (!Array.isArray(rec.interests)) rec.interests = [];
    let it = rec.interests.find(x => x.project === project);
    if (!it) { it = { project, units: [], firstTs: ts, lastTs: ts }; rec.interests.push(it); }
    it.lastTs = ts;
    if (unit && !it.units.includes(unit)) it.units.push(unit);
  }
  // ONE lifetime record per visitor (matched on mobile). It carries a unique code and
  // accumulates every project viewed + every unit opened, with first/last dates.
  async function upsertEnquiry(name, mobile, project, unit, agent) {
    const key = s => (s || "").toString().replace(/\D/g, "").slice(-10);
    const now = Date.now();
    const isUnit = unit && unit !== "(inventory view)";
    const agentObj = agent && agent.isAgent ? { isAgent: true, firm: agent.firm || "", designation: agent.designation || "" } : null;
    let list = [];
    try { list = await Store.enquiries(); } catch (e) {}
    let rec = list.find(e => key(e.mobile) === key(mobile));
    if (!rec) {
      rec = { user: name, mobile, code: genCode(), status: "Open", createdTs: now, ts: now, interests: [] };
      if (agentObj) rec.agent = agentObj;
      addInterest(rec, project, isUnit ? unit : null, now);
      try { await Store.addEnquiry(rec); } catch (e) {}
      try { if (window.LeadRelay) window.LeadRelay.push(rec); } catch (e) {}
      return;
    }
    if (agentObj) rec.agent = agentObj;
    if (!Array.isArray(rec.interests)) { // migrate old per-project shape
      rec.interests = [];
      if (rec.project) addInterest(rec, rec.project, (rec.unit && rec.unit !== "(inventory view)") ? rec.unit : null, rec.ts || now);
    }
    if (name) rec.user = name;
    if (!rec.code) rec.code = genCode();
    if (!rec.createdTs) rec.createdTs = rec.ts || now;
    rec.ts = now; rec.status = rec.status || "Open";
    addInterest(rec, project, isUnit ? unit : null, now);
    try { await Store.updateEnquiry(rec.id, { user: rec.user, code: rec.code, createdTs: rec.createdTs, ts: now, status: rec.status, interests: rec.interests, agent: rec.agent || null }); } catch (e) {}
    try { if (window.LeadRelay) window.LeadRelay.push(rec); } catch (e) {}
  }

  function wireOTP() {
    const modal = document.getElementById("otpModal");
    const open = () => { modal.classList.add("open"); resetOtp(); }, close = () => modal.classList.remove("open");
    document.getElementById("openOtp").addEventListener("click", async () => {
      const s = getSession();
      if (s) {
        verifiedName = s.name; verifiedMobile = s.mobile; pendingAgent = s.agent || null; saveSession(s.name, s.mobile, s.agent);
        await upsertEnquiry(s.name, s.mobile, PROJECT.name, "(inventory view)", s.agent);
        await showInventory();
      } else open();
    });
    const agentRadios = modal.querySelectorAll('input[name="isAgent"]');
    agentRadios.forEach(r => r.addEventListener("change", () => { document.getElementById("agentFields").style.display = (modal.querySelector('input[name="isAgent"]:checked') || {}).value === "yes" ? "block" : "none"; }));
    modal.querySelector("[data-close]").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    document.getElementById("oSend").addEventListener("click", sendOtp);
    document.getElementById("oVerify").addEventListener("click", verifyOtp);
    document.getElementById("oBack").addEventListener("click", resetOtp);
    const boxes = [...document.querySelectorAll("#otpInputs input")];
    boxes.forEach((b, i) => { b.addEventListener("input", () => { b.value = b.value.replace(/\D/g, ""); if (b.value && i < 5) boxes[i + 1].focus(); }); b.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !b.value && i > 0) boxes[i - 1].focus(); }); });
  }
  function resetOtp() { otpFallback = false; document.getElementById("otpStep1").style.display = "block"; document.getElementById("otpStep2").style.display = "none"; document.querySelectorAll("#otpInputs input").forEach(b => b.value = ""); document.getElementById("demoHint").style.display = "none"; const dh2 = document.getElementById("demoHint2"); if (dh2) dh2.style.display = "none"; const noRadio = document.querySelector('#otpStep1 input[name="isAgent"][value="no"]'); if (noRadio) noRadio.checked = true; const af = document.getElementById("agentFields"); if (af) af.style.display = "none"; }
  async function sendOtp() {
    const name = document.getElementById("oName").value.trim();
    // Country code (editable, default +91) + local number.
    let cc = (document.getElementById("oCC").value || "+91").trim().replace(/[^\d+]/g, "");
    if (!cc.startsWith("+")) cc = "+" + cc.replace(/\D/g, "");
    const localNum = document.getElementById("oMobile").value.trim().replace(/\D/g, "");
    const mobile = cc + " " + localNum;                 // display form, e.g. "+91 9873133190"
    if (name.length < 2) { toast("Please enter your name.", "err"); return; }
    if (cc.length < 2 || cc.length > 5) { toast("Enter a valid country code, e.g. +91.", "err"); return; }
    if (localNum.length < 6 || localNum.length > 12) { toast("Enter a valid mobile number.", "err"); return; }
    const isAgent = ((document.querySelector('#otpStep1 input[name="isAgent"]:checked') || {}).value === "yes");
    const firm = (document.getElementById("oFirm").value || "").trim(), desig = (document.getElementById("oDesig").value || "").trim();
    if (isAgent && firm.length < 2) { toast("Please enter your firm name.", "err"); return; }
    pendingAgent = isAgent ? { isAgent: true, firm, designation: desig } : null;
    verifiedName = name; verifiedMobile = mobile;
    document.getElementById("maskedNum").textContent = maskNum(mobile);
    otpFallback = false;
    if (cfg.otpMode === "firebase") {
      try {
        const fb = await Store.firebase.ensure();
        if (!window._recaptcha) window._recaptcha = new fb.authM.RecaptchaVerifier(fb.auth, "recaptcha-container", { size: "invisible" });
        const e164 = cc + localNum;                     // E.164, e.g. "+919873133190"
        confirmationResult = await fb.authM.signInWithPhoneNumber(fb.auth, e164, window._recaptcha);
        gotoStep2(); toast("OTP sent via SMS.", "ok");
      } catch (err) {
        console.error("OTP send failed:", err);
        // Safety net: if the real SMS can't be sent (Firebase setup still
        // settling, quota, etc.), don't block the visitor — show the code
        // on-screen, clearly labelled, so lead capture keeps working.
        showFallbackCode((err && err.code) || "sms_unavailable");
      }
    } else {
      demoCode = cfg.demoOtpFixed || String(Math.floor(100000 + Math.random() * 900000));
      console.log("%c[DEMO OTP] " + demoCode, "color:#5b8fc9;font-weight:bold");
      const dh2 = document.getElementById("demoHint2"); dh2.style.display = "block";
      dh2.innerHTML = `Your verification code is <b style="font-size:1.15rem">${demoCode}</b>. Enter it below to view live inventory.`;
      gotoStep2();
    }
  }
  // Explicit on-screen fallback when SMS delivery fails.
  function showFallbackCode(reason) {
    otpFallback = true;
    demoCode = cfg.demoOtpFixed || String(Math.floor(100000 + Math.random() * 900000));
    console.warn("[OTP fallback] SMS unavailable (" + reason + "). On-screen code: " + demoCode);
    toast("SMS unavailable right now — showing your code on screen.", "err");
    const dh2 = document.getElementById("demoHint2");
    if (dh2) {
      dh2.style.display = "block";
      dh2.innerHTML = `<b>⚠️ SMS couldn't be sent</b> (${esc(reason)}). For now, your verification code is <b style="font-size:1.15rem">${demoCode}</b>. Enter it below to continue. Real SMS resumes automatically once Firebase Phone Auth is fully active.`;
    }
    gotoStep2();
  }
  function gotoStep2() { document.getElementById("otpStep1").style.display = "none"; document.getElementById("otpStep2").style.display = "block"; document.querySelector("#otpInputs input").focus(); }
  async function verifyOtp() {
    const code = [...document.querySelectorAll("#otpInputs input")].map(b => b.value).join("");
    if (code.length !== 6) { toast("Enter the 6-digit code.", "err"); return; }
    let ok = false;
    if (cfg.otpMode === "firebase" && !otpFallback) { try { await confirmationResult.confirm(code); ok = true; } catch (e) { ok = false; } } else { ok = (code === demoCode); }
    if (!ok) { toast("Incorrect OTP. Please try again.", "err"); return; }
    saveSession(verifiedName, verifiedMobile, pendingAgent);
    await upsertEnquiry(verifiedName, verifiedMobile, PROJECT.name, "(inventory view)", pendingAgent);
    document.getElementById("otpModal").classList.remove("open");
    toast("Verified ☕ Opening live inventory…", "ok"); await showInventory();
  }
  let INV_UNITS = [], IS_DOWNTOWN = false, INV_SORT = { k: "unitNo", dir: 1 };
  const OPENED = new Set();
  function onInvBtn(btn) { if (btn.dataset.state === "sheet") { generateCostsheet(btn.dataset.unit); return; } enquireUnit(btn); }
  function invSizeNum(u) { const m = String(u.size || "").replace(/,/g, "").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; }
  function invCostNum(u) { const m = String(u.costingCr == null ? "" : u.costingCr).replace(/[^\d.]/g, ""); return parseFloat(m) || 0; }
  function sortInvUnits(units) {
    const a = units.slice(), k = INV_SORT.k, d = INV_SORT.dir;
    a.sort((x, y) => {
      if (k === "unitNo") return d * String(x.unitNo || "").localeCompare(String(y.unitNo || ""), undefined, { numeric: true });
      const vx = k === "size" ? invSizeNum(x) : invCostNum(x), vy = k === "size" ? invSizeNum(y) : invCostNum(y);
      return d * (vx - vy);
    });
    return a;
  }
  function invRowsHTML(units) {
    return units.map(u => {
      const opened = OPENED.has(u.unitNo);
      const costCell = opened ? `<b>${esc(crLabel(u.costingCr))}</b>` : `<span class="cost-locked"><span class="lock" aria-hidden="true">🔒</span><span class="cost-blur">On Enquiry</span></span>`;
      const btn = !opened ? `<button class="btn btn-gold btn-sm enqBtn" data-unit="${esc(u.unitNo)}" data-cost="${esc(crLabel(u.costingCr))}">Open</button>`
        : IS_DOWNTOWN ? `<button class="btn btn-sheet btn-sm enqBtn" data-state="sheet" data-unit="${esc(u.unitNo)}" data-cost="${esc(crLabel(u.costingCr))}">🧾 Get Cost Sheet</button>`
          : `<button class="btn btn-outline btn-sm" disabled>✓ Interest noted</button>`;
      return `<tr><td><b>${esc(u.unitNo)}</b></td><td>${esc(u.size)}</td><td>${esc(u.desc)}</td><td class="cost-cell">${costCell}</td><td>${btn}</td></tr>`;
    }).join("");
  }
  function renderInvTable() {
    const table = document.getElementById("invTable");
    const arrow = k => INV_SORT.k === k ? (INV_SORT.dir > 0 ? " ▲" : " ▼") : "";
    const head = `<thead><tr><th class="sortable" data-k="unitNo">Unit No${arrow("unitNo")}</th><th class="sortable" data-k="size">Size${arrow("size")}</th><th>Description</th><th class="sortable" data-k="cost">Costing${arrow("cost")}</th><th></th></tr></thead>`;
    table.innerHTML = head + `<tbody>${invRowsHTML(sortInvUnits(INV_UNITS))}</tbody>`;
    table.querySelectorAll("th.sortable").forEach(th => th.addEventListener("click", () => { const k = th.dataset.k; if (INV_SORT.k === k) INV_SORT.dir *= -1; else { INV_SORT.k = k; INV_SORT.dir = 1; } renderInvTable(); }));
    table.querySelectorAll(".enqBtn").forEach(b => b.addEventListener("click", () => onInvBtn(b)));
  }
  function inr(n) { n = Math.round(n || 0); const neg = n < 0; let s = String(Math.abs(n)); let last3 = s.slice(-3); let rest = s.slice(0, -3); if (rest) last3 = "," + last3; rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ","); return (neg ? "-" : "") + "₹" + (rest + last3); }
  function generateCostsheet(unitNo) {
    const u = (INV_UNITS || []).find(x => x.unitNo === unitNo) || {};
    const size = parseFloat(String(u.size || "").replace(/[^0-9.]/g, "")) || 0;
    let bsp = parseFloat(u.bsp) || 0;
    const plc = 0;
    let ep;
    if (bsp && size) { ep = bsp * size + plc; }
    else { let c = parseFloat(String(u.costingCr).replace(/[^0-9.]/g, "")) || 0; if (c > 0 && c < 100000) c = c * 1e7; ep = c + plc; if (size && ep) bsp = Math.round(ep / size); }
    const g = 0.05, EOI = 2500000, p10 = 0.10 * ep, p30 = 0.30 * ep, p25 = 0.25 * ep, p05 = 0.05 * ep;
    const plan = [
      ["EOI", "Fix", EOI, EOI * g, EOI],
      ["Booking Amount within 30 Days (less EOI)", "10%", p10 - EOI, (p10 * g) - (EOI * g), (p10 - EOI) + p10 * g],
      ["Within 120 days of Booking", "10%", p10, p10 * g, p10 + p10 * g],
      ["Within 180 days of Booking", "10%", p10, p10 * g, p10 + p10 * g],
      ["Completing of top residential floor slab", "30%", p30, p30 * g, p30 + p30 * g],
      ["On Application of OC", "25%", p25, p25 * g, p25 + p25 * g],
      ["On receipt of OC", "10%", p10, p10 * g, p10 + p10 * g],
      ["On offer of possession + All other Charges", "5%", p05, p05 * g, p05 + p05 * g]
    ];
    const aT = ep, gT = ep * g, tT = ep + ep * g;
    const rowsHtml = plan.map(r => `<tr><td>${esc(r[0])}</td><td class="c">${esc(r[1])}</td><td class="r">${inr(r[2])}</td><td class="r">${inr(r[3])}</td><td class="r">${inr(r[4])}</td></tr>`).join("");
    const ov = document.createElement("div"); ov.className = "cs-overlay"; ov.setAttribute("data-lenis-prevent", "");
    ov.innerHTML = `
      <div class="cs-sheet">
        <div class="cs-actions no-print"><button class="btn btn-gold btn-sm cs-print">🖨 Print / Save PDF</button><button class="btn btn-outline btn-sm cs-close">✕ Close</button></div>
        <div class="cs-head"><div class="cs-brand">${mugSVG}<span>Coffee &amp; Deals</span></div><div class="cs-title">Cost Sheet · Payment Plan</div></div>
        <div class="cs-meta">
          <div><span>Project</span><b>BPTP Downtown</b></div>
          <div><span>Unit No.</span><b>${esc(unitNo)}</b></div>
          <div><span>Size</span><b>${size ? size.toLocaleString("en-IN") + " sq.ft" : "—"}</b></div>
          <div><span>BSP</span><b>${bsp ? inr(bsp) + " /sq.ft" : "—"}</b></div>
        </div>
        <table class="cs-price">
          <tr><td>Price (BSP × Size)</td><td class="r">${inr(bsp * size || ep)}</td></tr>
          <tr><td>PLC (As Applicable)</td><td class="r">${inr(plc)}</td></tr>
          <tr class="eff"><td>Effective Price</td><td class="r">${inr(ep)}</td></tr>
        </table>
        <table class="cs-plan">
          <thead><tr><th>Tenure</th><th class="c">Demand</th><th class="r">Amount</th><th class="r">GST (5%)</th><th class="r">Total</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr><td>Total</td><td class="c">100%</td><td class="r">${inr(aT)}</td><td class="r">${inr(gT)}</td><td class="r">${inr(tT)}</td></tr></tfoot>
        </table>
        <div class="cs-extra">Extra charges (as applicable): Possession Charges · RERA Registration · Stamp Duty</div>
        <div class="cs-note">This is only for understanding, not an official commitment. Kindly reach out to me directly, as this is the sole discretion of BPTP.</div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
    ov.querySelector(".cs-close").addEventListener("click", () => ov.remove());
    ov.querySelector(".cs-print").addEventListener("click", () => window.print());
  }
  async function showInventory() {
    const all = await Store.inventoryFor(PROJECT.name);
    const units = all.filter(u => (u.status || "").toLowerCase() === "available"); // public sees only available units
    const panel = document.getElementById("invPanel"), table = document.getElementById("invTable");
    if (!units.length) {
      table.innerHTML = `<tr><td style="padding:24px;color:var(--ink-soft)">No available units right now. Contact Ashish for upcoming availability.</td></tr>`;
    } else {
      IS_DOWNTOWN = /downtown/i.test(PROJECT.name) || PROJECT.id === "downtown-66";
      INV_UNITS = units;
      renderInvTable();
    }
    panel.classList.add("show");
    document.getElementById("openOtp").textContent = "✅ Inventory unlocked";
    document.getElementById("s-inv").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function enquireUnit(btn) {
    const s = getSession() || (verifiedName && verifiedMobile ? { name: verifiedName, mobile: verifiedMobile } : null);
    if (!s) { openEnquiry(btn.dataset.unit); return; } // fallback if session expired
    const unit = btn.dataset.unit, cost = btn.dataset.cost;
    await upsertEnquiry(s.name, s.mobile, PROJECT.name, unit, s.agent);
    OPENED.add(unit);
    const row = btn.closest("tr"), cell = row.querySelector(".cost-cell");
    if (cell) cell.innerHTML = `<b>${esc(cost)}</b>`;
    if (IS_DOWNTOWN) {
      btn.dataset.state = "sheet"; btn.textContent = "🧾 Get Cost Sheet";
      btn.classList.remove("btn-gold"); btn.classList.add("btn-sheet");
    } else {
      btn.textContent = "✓ Interest noted"; btn.disabled = true; btn.classList.remove("btn-gold"); btn.classList.add("btn-outline");
    }
    toast("Interest noted — Ashish will follow up with the best price. ☕", "ok");
  }

  let enqUnit = "";
  function wireEnquiry() {
    const modal = document.getElementById("enqModal");
    modal.querySelector("[data-close]").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
    document.getElementById("eSubmit").addEventListener("click", async () => {
      const user = document.getElementById("eName").value.trim() || verifiedName || "", mobile = document.getElementById("eMobile").value.trim() || verifiedMobile || "";
      if (user.length < 2 || mobile.length < 8) { toast("Add your name and mobile.", "err"); return; }
      await upsertEnquiry(user, mobile, PROJECT.name, enqUnit);
      modal.classList.remove("open"); toast("Enquiry sent to Ashish. He'll reach out shortly. ☕", "ok");
    });
  }
  function openEnquiry(unit) {
    enqUnit = unit;
    document.getElementById("enqUnitLbl").textContent = PROJECT.name + " · Unit " + unit;
    document.getElementById("eName").value = verifiedName || ""; document.getElementById("eMobile").value = verifiedMobile || "";
    document.getElementById("enqModal").classList.add("open");
  }
  const v = (id) => document.getElementById(id).value;
  const setTxt = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
  function maskNum(m) { const d = m.replace(/\D/g, ""); return d.length > 4 ? "•••• " + d.slice(-4) : m; }
})();
