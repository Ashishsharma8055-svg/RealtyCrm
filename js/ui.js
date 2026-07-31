/* ui.js — shared helpers: escaping, toasts, reveal, smooth scroll, parallax */
(function () {
  window.esc = function (s) {
    return (s == null ? "" : String(s))
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };

  window.toast = function (msg, type) {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    const t = document.createElement("div");
    t.className = "toast " + (type || ""); t.textContent = msg; wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; setTimeout(() => t.remove(), 400); }, 3400);
  };

  window.initReveal = function () {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        if (!el.style.transitionDelay && !/\bd[1-4]\b/.test(el.className) && el.parentElement) {
          const sibs = Array.from(el.parentElement.children).filter(c => c.classList && c.classList.contains("reveal"));
          const idx = sibs.indexOf(el);
          if (idx > 0) el.style.transitionDelay = Math.min(idx * 90, 380) + "ms";
        }
        el.classList.add("in");
        io.unobserve(el);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal, .tile").forEach(el => io.observe(el));
  };

  function applyParallax(y) {
    const vh = window.innerHeight || 800;
    document.querySelectorAll("[data-parallax]").forEach(el => {
      const f = parseFloat(el.getAttribute("data-parallax")) || 0.1;
      const sc = parseFloat(el.getAttribute("data-parallax-scale")) || 0;
      const p = Math.max(0, Math.min(1, y / (vh * 0.9)));
      let tf = "translate3d(0," + (p * f * -160).toFixed(1) + "px,0)";
      if (sc) tf += " scale(" + (1 + p * sc).toFixed(3) + ")";
      el.style.transform = tf;
    });
  }
  let __pTick = false;
  function onScrollParallax() {
    if (__pTick) return; __pTick = true;
    requestAnimationFrame(() => { applyParallax(window.scrollY); __pTick = false; });
  }

  window.initSmoothScroll = function () {
    window.addEventListener("scroll", onScrollParallax, { passive: true });
    applyParallax(window.scrollY);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js";
    s.onload = function () {
      try {
        const lenis = new Lenis({ duration: 1.15, lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
        function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
        requestAnimationFrame(raf);
        window.__lenis = lenis;
        lenis.on("scroll", (e) => applyParallax((e && e.scroll) || window.scrollY));
        document.querySelectorAll('a[href^="#"]').forEach(a => {
          a.addEventListener("click", (ev) => {
            const id = a.getAttribute("href");
            if (id && id.length > 1) { const el = document.querySelector(id); if (el) { ev.preventDefault(); lenis.scrollTo(el, { offset: -70, duration: 1.2 }); } }
          });
        });
      } catch (err) {}
    };
    document.head.appendChild(s);
  };

  window.initNav = function () {
    const nav = document.getElementById("nav") || document.querySelector(".nav");
    const t = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (t && links) t.addEventListener("click", () => links.classList.toggle("open"));
    if (nav) {
      const onScroll = () => {
        if (window.scrollY > 40) { nav.classList.add("scrolled"); nav.classList.remove("on-dark"); }
        else { nav.classList.remove("scrolled"); nav.classList.add("on-dark"); }
      };
      window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    }
    if (links) links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => links.classList.remove("open")));
  };

  window.initCounters = function () {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target, target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "";
        const dur = 1400, start = performance.now();
        const tick = (now) => { const p = Math.min((now - start) / dur, 1); const eased = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(target * eased) + suffix; if (p < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll("[data-count]").forEach(el => io.observe(el));
  };

  window.buildMarquee = function (id, items) {
    const track = document.getElementById(id); if (!track) return;
    const one = items.map(s => `<span class="marquee-item">${esc(s)}</span>`).join("");
    track.innerHTML = one + one;
  };

  window.initFAQ = function () {
    document.querySelectorAll(".faq-item .faq-q").forEach(q => {
      q.addEventListener("click", () => {
        const item = q.closest(".faq-item"), a = item.querySelector(".faq-a"), open = item.classList.contains("open");
        item.classList.toggle("open");
        a.style.maxHeight = open ? "0" : a.querySelector(".inner").offsetHeight + "px";
      });
    });
  };

  // Always render a clean, readable "₹X.XX Cr". Accepts crore values (6.5, 6.05),
  // full rupee amounts (65000000 → 6.5 Cr), or strings like "6,50,00,000" / "6.5 Cr".
  window.crLabel = function (n) {
    if (n === "" || n == null) return "On request";
    let v = parseFloat(String(n).replace(/[^0-9.]/g, ""));
    if (isNaN(v)) return "On request";
    if (v >= 100000) v = v / 1e7;                  // a full rupee figure → convert to crores
    let s = v.toFixed(2).replace(/\.?0+$/, "");    // trim trailing zeros: 6.50→6.5, 6.00→6, 6.05→6.05
    return "₹" + s + " Cr";
  };

  // Basic abuse/offensive-language filter for public comments
  window.isAbusive = function (text) {
    const t = (" " + (text || "").toLowerCase() + " ").replace(/[^a-zऀ-ॿ ]+/g, " ");
    const bad = ["fuck","fucker","fucking","shit","bitch","bastard","asshole","dick","pussy","cunt","slut","whore","motherfucker","nigger","faggot","rape","rapist","retard","dickhead","cock","chutiya","chutiye","bhosdi","bhosda","madarchod","behenchod","bhenchod","gandu","gaand","harami","randi","kutta","kutti","kamina","kaminey","lund","lauda","lawda","bhadwa"];
    return bad.some(w => new RegExp("(^| )" + w + "(s|es|ing|er)?($| )").test(t));
  };

  // Gravatar URL from email (SHA-256); returns null if no email. d=404 so a missing
  // gravatar 404s and the UI falls back to a generated initials avatar.
  window.gravatarUrl = async function (email) {
    const e = (email || "").trim().toLowerCase();
    if (!e || !(window.crypto && crypto.subtle)) return null;
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e));
      const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
      return `https://www.gravatar.com/avatar/${hex}?s=120&d=404`;
    } catch (err) { return null; }
  };

  window.initials = function (name) {
    return (name || "?").split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  };

  window.photoOrPlaceholder = function (src, label, klass) {
    const safe = esc(label || "Ashish Sharma");
    return `<img src="${esc(src)}" alt="${safe}" class="${klass || ''}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
      <div class="placeholder" style="display:none;flex-direction:column;align-items:center;justify-content:center;height:100%;">
        <div class="mugbig">☕</div><b>${safe}</b><small style="opacity:.7">Drop your photo at<br>assets/ashish.jpg</small></div>`;
  };

  window.mugSVG = `<svg class="mug" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 16h22v14a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8V16Z" stroke="currentColor" stroke-width="2.4"/>
    <path d="M32 20h4a5 5 0 0 1 0 10h-4" stroke="currentColor" stroke-width="2.4"/>
    <path d="M16 6c-1.5 2-1.5 4 0 6M22 6c-1.5 2-1.5 4 0 6M28 6c-1.5 2-1.5 4 0 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".6"/>
  </svg>`;
})();
