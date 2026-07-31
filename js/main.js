/* main.js — home page: branding, search, featured+grid projects, testimonials slider */
(function () {
  const cfg = window.APP_CONFIG.brand;
  let ALL_PROJECTS = [];

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    paintBrand();
    initNav();
    ALL_PROJECTS = await Store.projects();
    populateFilters();
    renderProjects(ALL_PROJECTS);
    await renderTestimonials();
    wireSearch();
    wireTestimonialModal();
    initFAQ();
    initCounters();
    initReveal();
    initSmoothScroll();
    initMarketTicker();
  }

  function initMarketTicker() {
    const svg = document.getElementById("mkChart");
    if (!svg) return;
    const line = svg.querySelector(".mk-line"), area = svg.querySelector(".mk-area");
    const priceEl = document.getElementById("mkPrice"), dot = document.getElementById("mkDot");
    const N = 46; let vals = [], v = 46, base;
    for (let i = 0; i < N; i++) { v += (Math.random() - 0.42) * 6; v = Math.max(14, Math.min(86, v)); vals.push(v); }
    base = vals[0];
    function render() {
      const pts = vals.map((y, i) => `${(i / (N - 1) * 100).toFixed(2)},${(100 - y).toFixed(2)}`).join(" ");
      line.setAttribute("points", pts);
      area.setAttribute("points", `0,100 ${pts} 100,100`);
      if (dot) dot.style.top = (100 - vals[N - 1]).toFixed(2) + "%";
      if (priceEl) { const pct = (vals[N - 1] - base) / base * 100; priceEl.textContent = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%"; priceEl.style.color = pct >= 0 ? "var(--ok)" : "var(--danger)"; }
    }
    render();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setInterval(() => { let n = vals[N - 1] + (Math.random() - 0.42) * 8; n = Math.max(14, Math.min(86, n)); vals.push(n); vals.shift(); render(); }, 750);
  }

  function paintBrand() {
    const brandHTML = `${mugSVG}<span>Coffee &amp; Deals<small>Real Estate</small></span>`;
    document.getElementById("brand").innerHTML = brandHTML;
    const fb = document.getElementById("footBrand"); if (fb) fb.innerHTML = brandHTML;
    const hp = document.getElementById("heroPhoto");
    if (hp) { const heroSrc = cfg.heroImage || "assets/hero-cut.png"; hp.innerHTML = `<img src="${esc(heroSrc)}" alt="Luxury home" onerror="this.onerror=null;this.src='assets/hero-villa.svg'">`; }
    document.getElementById("aboutPhoto").innerHTML = photoOrPlaceholder(cfg.photo, cfg.owner);
    document.getElementById("year").textContent = new Date().getFullYear();
    const tel = "tel:" + cfg.phone.replace(/\s+/g, ""), mail = "mailto:" + cfg.email;
    setLink("contactCall", tel); setLink("contactMail", mail);
    setLink("footPhone", tel, "☎ " + cfg.phone); setLink("footMail", mail, "✉ " + cfg.email);
  }
  function setLink(id, href, text) { const el = document.getElementById(id); if (el) { el.href = href; if (text) el.textContent = text; } }

  function populateFilters() {
    const locs = [...new Set(ALL_PROJECTS.map(p => shortLoc(p.location)))].sort();
    const locSel = document.getElementById("fLocation"); locs.forEach(l => locSel.add(new Option(l, l)));
    const projSel = document.getElementById("fProject"); ALL_PROJECTS.forEach(p => projSel.add(new Option(p.name, p.id)));
  }
  function shortLoc(l) { const m = (l || "").match(/Sector\s*\d+[A-Z]?/i); return m ? m[0] : (l || "").split(",")[0].trim(); }

  function wireSearch() {
    document.getElementById("btnSearch").addEventListener("click", applyFilters);
    document.getElementById("btnReset").addEventListener("click", resetFilters);
    document.getElementById("clearLink").addEventListener("click", (e) => { e.preventDefault(); resetFilters(); });
    ["fCategory", "fType", "fBudget", "fLocation", "fProject", "fSort"].forEach(id => document.getElementById(id).addEventListener("change", applyFilters));
  }
  function sortProjects(list, mode) {
    if (!mode) return list;
    const arr = list.slice();
    const possVal = p => { const m = (p.possession || "").match(/(20\d\d)/); return m ? +m[1] : 9999; };
    if (mode === "price-asc") arr.sort((a, b) => (a.priceFromCr || 0) - (b.priceFromCr || 0));
    else if (mode === "price-desc") arr.sort((a, b) => (b.priceFromCr || 0) - (a.priceFromCr || 0));
    else if (mode === "poss") arr.sort((a, b) => possVal(a) - possVal(b));
    else if (mode === "name") arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return arr;
  }
  function applyFilters() {
    const loc = val("fLocation"), proj = val("fProject"), cat = val("fCategory"), type = val("fType"), budget = parseFloat(val("fBudget")) || Infinity, sort = val("fSort");
    let filtered = ALL_PROJECTS.filter(p => (!loc || shortLoc(p.location) === loc) && (!proj || p.id === proj) && (!cat || p.category === cat) && (!type || p.type === type) && ((p.priceFromCr || 0) <= budget));
    filtered = sortProjects(filtered, sort);
    renderProjects(filtered, !!sort);
    document.getElementById("resultCount").textContent = `${filtered.length} of ${ALL_PROJECTS.length} projects`;
  }
  function resetFilters() {
    ["fLocation", "fProject", "fCategory", "fType", "fBudget", "fSort"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("resultCount").textContent = ""; renderProjects(ALL_PROJECTS);
  }
  const val = (id) => document.getElementById(id).value;

  function mediaHTML(p) {
    if (!p.image) return `<div class="fallback">${esc(p.name)}</div>`;
    const fb = p.imageFallback ? ` data-fb="${esc(p.imageFallback)}"` : "";
    const water = (p.water === true) && !/\.svg($|\?)/i.test(p.image) ? `<div class="water-band"></div>` : "";
    return `<img class="thumb" src="${esc(p.image)}" alt="${esc(p.name)}"${fb} onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';}else{this.style.display='none';this.closest('.tile-media,.fp-media').querySelector('.fallback').style.display='flex';}">
       <div class="fallback" style="display:none">${esc(p.name)}</div>${water}`;
  }
  function makeFeatured(p, tag, alt) {
    const cat = p.category === "Ready to Move" ? "rtm" : "uc";
    const a = document.createElement("a");
    a.href = `project.html?id=${encodeURIComponent(p.id)}`;
    a.className = "featured-project reveal" + (alt ? " alt" : "");
    a.innerHTML = `
      <div class="fp-media"><div class="chip ${cat}">${esc(p.category)}</div>${mediaHTML(p)}</div>
      <div class="fp-body">
        <div class="fp-tag${alt ? " alt" : ""}">${esc(tag)}</div>
        <div class="fp-meta">${esc(p.type)} · ${esc(p.possession || "")}</div>
        <h3>${esc(p.name)}</h3>
        <p class="fp-desc">${esc(p.tagline || p.about || "")}</p>
        <div class="fp-foot"><span class="fp-loc">📍 ${esc(p.location)}</span><span class="fp-price">${esc(p.priceLabel || crLabel(p.priceFromCr))}</span></div>
      </div>`;
    return a;
  }

  function tileHTML(p, i) {
    const catClass = p.category === "Ready to Move" ? "rtm" : "uc";
    const el = document.createElement("a");
    el.href = `project.html?id=${encodeURIComponent(p.id)}`; el.className = "tile"; el.style.transitionDelay = (i * 70) + "ms";
    el.innerHTML = `
        <div class="tile-media"><div class="chip ${catClass}">${esc(p.category)}</div>${mediaHTML(p)}</div>
        <div class="tile-body">
          <h3>${esc(p.name)}</h3>
          <div class="tile-loc">📍 ${esc(p.location)}</div>
          <div class="tile-meta"><span class="pill">${esc(p.type)}</span><span class="pill">${esc(p.config || "")}</span></div>
          <div class="tile-foot"><div class="tile-price">${esc(p.priceLabel || crLabel(p.priceFromCr))}<small>${esc(p.possession || "")}</small></div><span class="btn btn-outline btn-sm">View →</span></div>
        </div>`;
    return el;
  }
  function renderProjects(list, sortActive) {
    const grid = document.getElementById("projectGrid"), feat = document.getElementById("featuredWrap"), none = document.getElementById("noResults");
    grid.innerHTML = ""; feat.innerHTML = "";
    none.style.display = list.length ? "none" : "block";
    if (!list.length) return;
    if (sortActive) { list.forEach((p, i) => grid.appendChild(tileHTML(p, i))); if (window.revealNow) window.revealNow(); return; }
    const featured = list.find(p => p.featured) || list.slice().sort((a, b) => (b.priceFromCr || 0) - (a.priceFromCr || 0))[0];
    const second = list.find(p => p.featured2 && p.id !== featured.id);
    const rest = list.filter(p => p.id !== featured.id && (!second || p.id !== second.id));
    const fCat = featured.category === "Ready to Move" ? "rtm" : "uc";
    const fp = document.createElement("a");
    fp.href = `project.html?id=${encodeURIComponent(featured.id)}`; fp.className = "featured-project reveal";
    fp.innerHTML = `
      <div class="fp-media"><div class="chip ${fCat}">${esc(featured.category)}</div>${mediaHTML(featured)}</div>
      <div class="fp-body">
        <div class="fp-tag">Featured Project</div>
        <div class="fp-meta">${esc(featured.type)} · ${esc(featured.possession || "")}</div>
        <h3>${esc(featured.name)}</h3>
        <p class="fp-desc">${esc(featured.tagline || featured.about || "")}</p>
        <div class="fp-foot"><span class="fp-loc">📍 ${esc(featured.location)}</span><span class="fp-price">${esc(featured.priceLabel || crLabel(featured.priceFromCr))}</span></div>
      </div>`;
    feat.appendChild(fp);
    if (second) feat.appendChild(makeFeatured(second, "Also Featured", true));
    rest.forEach((p, i) => {
      const catClass = p.category === "Ready to Move" ? "rtm" : "uc";
      const el = document.createElement("a");
      el.href = `project.html?id=${encodeURIComponent(p.id)}`; el.className = "tile"; el.style.transitionDelay = (i * 70) + "ms";
      el.innerHTML = `
        <div class="tile-media"><div class="chip ${catClass}">${esc(p.category)}</div>${mediaHTML(p)}</div>
        <div class="tile-body">
          <h3>${esc(p.name)}</h3>
          <div class="tile-loc">📍 ${esc(p.location)}</div>
          <div class="tile-meta"><span class="pill">${esc(p.type)}</span><span class="pill">${esc(p.config || "")}</span></div>
          <div class="tile-foot"><div class="tile-price">${esc(p.priceLabel || crLabel(p.priceFromCr))}<small>${esc(p.possession || "")}</small></div><span class="btn btn-outline btn-sm">View →</span></div>
        </div>`;
      grid.appendChild(el);
    });
    requestAnimationFrame(() => { feat.querySelectorAll(".reveal").forEach(t => t.classList.add("in")); grid.querySelectorAll(".tile").forEach(t => t.classList.add("in")); });
  }

  let TESTI = [], testiIdx = 0, testiTimer = null;
  async function renderTestimonials() {
    const stage = document.getElementById("testiFeature"), dots = document.getElementById("testiDots");
    TESTI = await Store.testimonials(false);
    if (!TESTI.length) { stage.className = ""; stage.innerHTML = `<p class="muted center">Be the first to share your experience.</p>`; dots.innerHTML = ""; return; }
    for (const t of TESTI) { if (t.email && t._grav === undefined) t._grav = await gravatarUrl(t.email); }
    stage.className = "orbit-stage";
    stage.innerHTML = TESTI.map((t, i) => `
      <article class="orbit-card" data-i="${i}">
        ${avatarHTML(t)}
        <div class="tc-stars">${"★".repeat(t.rating || 5)}</div>
        <p class="tc-quote">&ldquo;${esc(t.text)}&rdquo;</p>
        <div class="tc-who"><b>${esc(t.name)}</b><span>${esc(t.role || "")}</span></div>
      </article>`).join("");
    stage.querySelectorAll(".orbit-card").forEach(c => c.addEventListener("click", () => { const i = +c.dataset.i; if (i !== testiIdx) { layout(i); resetTestiTimer(); } }));
    dots.innerHTML = TESTI.map((_, i) => `<button data-i="${i}" aria-label="Testimonial ${i + 1}"></button>`).join("");
    dots.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { layout(+b.dataset.i); resetTestiTimer(); }));
    testiIdx = 0; layout(0); resetTestiTimer();
  }
  function avatarHTML(t) {
    const ini = initials(t.name);
    return t._grav
      ? `<div class="tc-avatar"><img src="${esc(t._grav)}" alt="${esc(t.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="tc-av" style="display:none">${esc(ini)}</div></div>`
      : `<div class="tc-avatar"><div class="tc-av" style="display:flex">${esc(ini)}</div></div>`;
  }
  function layout(active) {
    testiIdx = active; const N = TESTI.length;
    document.querySelectorAll("#testiFeature .orbit-card").forEach((card, i) => {
      let off = i - active; if (off > N / 2) off -= N; if (off < -N / 2) off += N;
      const a = Math.abs(off);
      const scale = 1 - Math.min(a, 3) * 0.13;
      card.style.transform = `translate(-50%,-50%) translateX(${off * 150}px) scale(${scale.toFixed(3)})`;
      card.style.opacity = a === 0 ? 1 : a === 1 ? 0.5 : a === 2 ? 0.22 : 0;
      card.style.zIndex = 50 - a;
      card.style.pointerEvents = a <= 2 ? "auto" : "none";
      card.classList.toggle("active", off === 0);
    });
    document.querySelectorAll("#testiDots button").forEach((b, bi) => b.classList.toggle("active", bi === active));
  }
  function resetTestiTimer() { if (testiTimer) clearInterval(testiTimer); if (TESTI.length > 1) testiTimer = setInterval(() => layout((testiIdx + 1) % TESTI.length), 5000); }

  function wireTestimonialModal() {
    const modal = document.getElementById("testiModal");
    const open = () => modal.classList.add("open"), close = () => modal.classList.remove("open");
    document.getElementById("btnAddTesti").addEventListener("click", open);
    modal.querySelector("[data-close]").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    document.getElementById("tSubmit").addEventListener("click", async () => {
      const name = document.getElementById("tName").value.trim(), role = document.getElementById("tRole").value.trim(), text = document.getElementById("tText").value.trim(), rating = parseInt(document.getElementById("tRating").value, 10);
      const emailEl = document.getElementById("tEmail"); const email = emailEl ? emailEl.value.trim() : "";
      if (name.length < 2 || text.length < 8) { toast("Please add your name and a few words.", "err"); return; }
      if (isAbusive(text) || isAbusive(name)) { toast("Your comment contains inappropriate language and can't be posted.", "err"); return; }
      const nt = await Store.addTestimonial({ name, role, text, rating, email });
      await Store.setTestimonialApproved(nt.id, true);
      close();
      document.getElementById("tName").value = document.getElementById("tRole").value = document.getElementById("tText").value = "";
      if (emailEl) emailEl.value = "";
      await renderTestimonials();
      toast("Thanks! Your review is now live. ☕", "ok");
    });
  }
})();
