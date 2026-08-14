/* ============================================================
   RealtyCRM — standalone local build (v2)
   Runs fully in the browser. Data is saved in localStorage.
   No server, no build step, no internet required.
   ============================================================ */

const KEY = "realtycrm_v1";
const ENQUIRY_TYPES = ["CP+CL", "CL", "CP Details Only"];
const REQUIREMENTS = ["Plot", "Floor", "H-rise", "Other"];
const BUDGETS = ["Below 2 Cr", "2-2.5 Cr", "2.5-3 Cr", "3-3.5 Cr", "3.5-4 Cr", "4-5 Cr", "5 Cr+"];
const STAGES = ["Call", "F2F", "SVD", "Negotiation", "VDNB"];
const RATINGS = ["Hot", "Warm", "Cold"];
const STATUSES = ["Active", "Inactive", "Booked"];
const CATEGORIES = ["Investor", "EndUser"];
const GRADES = ["A", "B", "C"];
const CONNECT = ["Live", "Terminate"];
// Activity you schedule for NEXT time (the follow-up you're booking now).
const SCHEDULE_TYPES = ["Call", "Outbound Meeting", "Inbound Meeting", "Site Visit", "Casual Follow-up"];
const PROJ_TYPES = ["Plot", "Floor", "H-rise", "Other"];
const PROJ_STATUS = ["Live", "Sold Out", "Upcoming"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------- Data layer ---------- */
function emptyDB() { return { leads: [], brokers: [], customers: [], projects: [], activities: [], seq: 0 }; }
let DB = load();
function load() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : emptyDB(); } catch { return emptyDB(); } }
let CLOUD = null, cloudSaveTimer = null, _cloudDirty = false, _cloudBooted = false;
function scheduleCloudSave() {
  if (!CLOUD) return;
  _cloudDirty = true;                 // we have local changes not yet in the cloud
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    if (CLOUD.auth && CLOUD.auth.currentUser) {
      CLOUD.saveState(DB)
        .then(() => { _cloudDirty = false; toast("Saved to cloud ✓ (build v9)"); })
        .catch((e) => { console.error("CLOUD SAVE FAILED:", e); toast("⚠️ SAVE FAILED: " + ((e && (e.code || e.message)) || String(e))); });
    } else {
      toast("⚠️ Not signed in — NOT saved. Please sign in again.");
      _cloudDirty = false;
    }
  }, 400);
}
function save() { if (CLOUD) { scheduleCloudSave(); } else { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch {} } }
function nextId() { DB.seq = (DB.seq || 0) + 1; return DB.seq; }
function all(entity) { return DB[entity].slice().sort((a, b) => b.id - a.id); }
function upsert(entity, obj) {
  if (obj.id) { const i = DB[entity].findIndex((x) => x.id === obj.id); if (i >= 0) { obj.updated_at = now(); DB[entity][i] = { ...DB[entity][i], ...obj }; } }
  else { obj.id = nextId(); obj.created_at = now(); obj.updated_at = now(); DB[entity].push(obj); }
  save(); return obj;
}
function removeRow(entity, id) { DB[entity] = DB[entity].filter((x) => x.id !== id); save(); }
function activitiesFor(type, id) { return DB.activities.filter((a) => a.entity_type === type && a.entity_id === id).sort((a, b) => b.id - a.id); }
function addActivity(a) { a.id = nextId(); a.created_at = now(); DB.activities.push(a); save(); }
function leadById(id) { return DB.leads.find((x) => x.id === id); }
function brokerById(id) { return DB.brokers.find((x) => x.id === id); }

/* ---------- Website → CRM bridge ----------
   The public website writes each visitor enquiry into the shared Firestore
   `enquiries` collection. On cloud login we pull them in and turn any NEW
   ones into leads. Each imported lead remembers its `web_src` id so it is
   never imported twice, even across reloads or devices. */
async function importWebEnquiries() {
  // DISABLED BY DESIGN: website enquiries must NOT auto-appear in the Enquiry panel.
  // They live only in the Digital Enquiry view until you explicitly transfer one
  // (see transferEnquiry / transferAllNew), which is when a real lead is created.
  return;
  /* eslint-disable no-unreachable */
  if (!CLOUD || typeof CLOUD.loadEnquiries !== "function") return;
  let webs = [];
  try { webs = await CLOUD.loadEnquiries(); } catch (e) { return; }
  if (!Array.isArray(webs) || !webs.length) return;
  const seen = new Set(DB.leads.map((l) => l.web_src).filter(Boolean));
  let added = 0;
  webs.forEach((w) => {
    const srcId = w._id || w.code;
    if (!srcId || seen.has(srcId)) return;
    const projects = Array.isArray(w.interests)
      ? uniqList(w.interests.map((i) => i && i.project).filter(Boolean)) : [];
    const isAgent = !!(w.agent && w.agent.isAgent);
    const created = w.createdTs ? new Date(w.createdTs) : new Date();
    upsert("leads", {
      lead_number: w.code || ("WEB-" + srcId),
      customer_name: w.user || "",
      customer_mobile: w.mobile || "",
      source_type: isAgent ? "Channel Partner" : "Website",
      source_name: isAgent ? (w.agent.firm || "Website CP") : "Website",
      source_firm: isAgent ? (w.agent.firm || "") : "",
      enquiry_type: isAgent ? "CP+CL" : "CL",
      requirement: "",
      budget: "",
      stage: "Call",
      status: "Active",
      rating: "Warm",
      projects_shared: projects,
      notes: "Imported from website enquiry" + (projects.length ? " · interested in " + projects.join(", ") : ""),
      lead_date: isNaN(created) ? "" : created.toISOString().slice(0, 10),
      web_src: srcId
    });
    seen.add(srcId);
    added++;
  });
  if (added) toast(added + " new website lead" + (added > 1 ? "s" : "") + " imported");
}

/* ---------- Light / dark theme (remembered per device) ---------- */
(function themeSetup() {
  function apply(t) {
    const dark = t === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    const b = document.getElementById("themeToggle");
    if (b) { b.textContent = dark ? "☀" : "☾"; b.title = dark ? "Switch to light" : "Switch to dark"; }
    const lbl = document.getElementById("themeLabelSide");
    if (lbl) lbl.textContent = dark ? "Light mode" : "Dark mode";
  }
  const toggle = () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem("rcrm_theme", cur); } catch (e) {}
    apply(cur);
  };
  let t = "light"; try { t = localStorage.getItem("rcrm_theme") || "light"; } catch (e) {}
  apply(t);
  const wire = () => {
    ["themeToggle", "themeToggleSide"].forEach((id) => { const b = document.getElementById(id); if (b) b.onclick = toggle; });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();

/* ---------- Utils ---------- */
function pad(n) { return String(n).padStart(2, "0"); }
function now() { return new Date().toISOString().slice(0, 19).replace("T", " "); }
function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtDate(s) { return s ? String(s).slice(0, 16).replace("T", " ") : "—"; }
function timeOf(s) { return s && s.length >= 16 ? String(s).slice(11, 16) : ""; }
function badge(v) { return v ? `<span class="badge b-${/^[A-Za-z+ ]+$/.test(v) ? esc(v).replace(/[^A-Za-z]/g, "") : "default"}">${esc(v)}</span>` : "—"; }
function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200); }
// Tap-to-dial phone number (works on mobile). Stops row clicks from firing.
function telLink(m) { const s = (m || "").toString().trim(); if (!s) return "—"; const d = s.replace(/[^\d+]/g, ""); return `<a href="tel:${esc(d)}" class="tel" onclick="event.stopPropagation()">${esc(s)}</a>`; }
function stars(n) { n = Number(n) || 0; return `<span class="stars">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`; }

/* ---------- Follow-up model ---------- */
// An "open" follow-up = a lead (Active) or broker (Live) with a followup_at set.
// Cancelling a meeting clears followup_at (logged to the record) so it drops off.
function openFollowups() {
  const res = [];
  DB.leads.forEach((l) => {
    if (l.followup_at && l.status === "Active")
      res.push({ kind: "lead", id: l.id, name: l.customer_name || l.lead_number, at: l.followup_at, label: (l.enquiry_type || "Client") + " Follow-up", sub: [l.requirement, l.stage].filter(Boolean).join(" · "), lead_number: l.lead_number, ftype: l.followup_kind || "" });
  });
  DB.brokers.forEach((b) => {
    if (b.followup_at && b.connect === "Live")
      res.push({ kind: "broker", id: b.id, name: b.name, at: b.followup_at, label: "Broker Meeting", sub: b.firm || "" });
  });
  return res.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
function bucketFollowups() {
  const t = today(), out = { today: [], upcoming: [], missed: [] };
  openFollowups().forEach((f) => { const d = String(f.at).slice(0, 10); if (d === t) out.today.push(f); else if (d > t) out.upcoming.push(f); else out.missed.push(f); });
  return out;
}
function cancelFollowup(kind, id, reopenDate) {
  if (!confirm("Cancel this meeting / follow-up? It will be logged in the record and removed from the follow-up list.")) return;
  const row = kind === "lead" ? leadById(id) : brokerById(id);
  if (!row) return;
  addActivity({ entity_type: kind, entity_id: id, kind: kind === "broker" ? "Meeting Cancelled" : "Follow-up Cancelled", remark: "Scheduled " + fmtDate(row.followup_at) + " was cancelled.", activity_at: now() });
  row.followup_at = ""; save();
  toast("Cancelled and logged to record");
  if (reopenDate) openDaySchedule(reopenDate); else go(active);
}
function recordLabel(type, id) {
  if (type === "lead") { const l = leadById(id); return l ? { name: l.customer_name || l.lead_number, tag: l.lead_number, sub: [l.requirement, l.stage].filter(Boolean).join(" · ") } : { name: "Lead #" + id, tag: "", sub: "" }; }
  const b = brokerById(id); return b ? { name: b.name, tag: b.firm || "", sub: b.grade ? "Grade " + b.grade : "" } : { name: "Broker #" + id, tag: "", sub: "" };
}

/* ---------- Navigation ---------- */
const NAV = [
  ["dash", "Dashboard", '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>'],
  ["leads", "Enquiries", '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'],
  ["pipeline", "Deal Pipeline", '<rect x="3" y="4" width="4.5" height="16" rx="1"/><rect x="9.75" y="4" width="4.5" height="10" rx="1"/><rect x="16.5" y="4" width="4.5" height="13" rx="1"/>'],
  ["digital", "Digital Enquiry", '<path d="M4 4h16v12H5.2L4 17.5z"/><path d="M8 9h8M8 12h5"/>'],
  ["followups", "Follow-ups", '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/>'],
  ["calendar", "Calendar", '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'],
  ["brokers", "Brokers", '<path d="M8 11l2 2 4-4 3 3v3l-4 3-5-3-4-4 3-3z"/>'],
  ["customers", "Customers", '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 6a3 3 0 010 6M15 20a6 6 0 016 0"/>'],
  ["projects", "Projects", '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>'],
  ["inventory", "Inventory", '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>'],
  ["testimonials", "Testimonials", '<path d="M8 10h8M8 14h5"/><path d="M4 4h16v12H8l-4 4z"/>'],
  ["reports", "Reports", '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'],
  ["analytics", "Analytics", '<path d="M3 3v18h18"/><path d="M7 15l3-3 3 2 5-6"/><circle cx="10" cy="12" r="0.6"/><circle cx="13" cy="14" r="0.6"/>'],
  ["assistant", "AI Copilot", '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM18 14l.9 2.3L21 17l-2.1.7L18 20l-.9-2.3L15 17l2.1-.7z"/>'],
];
const META = {
  dash: ["Dashboard", "+ New Enquiry", () => openLeadForm()],
  leads: ["Enquiries", "+ New Enquiry", () => openLeadForm()],
  pipeline: ["Deal Pipeline", "+ New Enquiry", () => openLeadForm()],
  digital: ["Digital Enquiry", "⟳ Refresh", () => populateDigital()],
  followups: ["Follow-ups", "+ New Enquiry", () => openLeadForm()],
  calendar: ["Calendar", "+ New Enquiry", () => openLeadForm()],
  brokers: ["Brokers", "+ Empanel Broker", () => openBrokerForm()],
  customers: ["Customers", "+ Add Customer", () => openCustomerForm()],
  projects: ["Projects", "+ Add Project", () => openWebProjectForm()],
  inventory: ["Inventory", "+ Add Unit", () => openUnitForm()],
  testimonials: ["Testimonials", "+ Add Testimonial", () => openTestimonialForm()],
  reports: ["Reports & Analysis", "Print / PDF", () => { if (typeof window !== "undefined") window.print(); }],
  analytics: ["Analytics & Goals", "🎯 Set goals", () => openGoalsForm()],
  assistant: ["AI Copilot", "🔑 AI key", () => openAiConnect()],
};
let active = "dash";
const NAV_MAP = Object.fromEntries(NAV.map((n) => [n[0], n]));
// Sidebar layout: plain keys render as links; a {group} renders as a collapsible section.
const NAV_LAYOUT = [
  "dash", "pipeline", "digital", "followups", "reports", "analytics",
  { group: "Database", icon: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>', items: ["leads", "projects", "inventory", "customers", "brokers", "testimonials", "calendar"] },
  "assistant",
];
function navLinkHtml(k) {
  const n = NAV_MAP[k]; if (!n) return "";
  const [key, label, path] = n;
  return `<a class="${active === key ? "active" : ""}" data-nav="${key}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg><span>${label}</span></a>`;
}
function renderNav() {
  document.getElementById("nav").innerHTML = NAV_LAYOUT.map((item) => {
    if (typeof item === "string") return navLinkHtml(item);
    const open = item.items.includes(active);
    return `<details class="nav-group"${open ? " open" : ""}>
      <summary class="nav-group-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg><span>${item.group}</span><svg class="nav-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>
      <div class="nav-group-body">${item.items.map(navLinkHtml).join("")}</div>
    </details>`;
  }).join("");
}
function subFor(k) {
  const b = bucketFollowups();
  if (k === "dash") return "Live overview of your pipeline";
  if (k === "leads") return `${DB.leads.length} total leads`;
  if (k === "pipeline") return `${DB.leads.filter((l) => l.status === "Active").length} active leads · drag through the stages`;
  if (k === "digital") return "Website enquiries — review and transfer into your CRM";
  if (k === "inventory") return "Live unit availability across projects";
  if (k === "testimonials") return "Customer reviews shown on your website";
  if (k === "followups") return `${b.today.length} today · ${b.upcoming.length} upcoming · ${b.missed.length} missed`;
  if (k === "calendar") return "Meetings & follow-up schedule";
  if (k === "brokers") return `${uniqueFirms().length} firm${uniqueFirms().length === 1 ? "" : "s"} · ${DB.brokers.length} broker${DB.brokers.length === 1 ? "" : "s"} empanelled`;
  if (k === "customers") return `${DB.customers.length} customer records`;
  if (k === "projects") return "Your project catalogue — shared with the website";
  if (k === "reports") return "Executive analysis — leads, channels & customers";
  if (k === "analytics") return "Productivity, goals & an AI roadmap to hit your targets";
  if (k === "assistant") return "Draft messages, summaries & plans from your CRM";
}
function go(k) {
  active = k; renderNav();
  const m = META[k];
  document.getElementById("pageTitle").textContent = m[0];
  document.getElementById("pageSub").textContent = subFor(k);
  const btn = document.getElementById("primaryBtn");
  btn.textContent = m[1]; btn.onclick = m[2];
  document.getElementById("view").innerHTML = VIEWS[k]();
  bindView(k);
}

/* ---------- Charts ---------- */
function barChart(data, color, attr, rf) {
  const mx = Math.max(1, ...data.map((d) => d[1]));
  return `<div class="bars">${data.map((d) => {
    const interactive = rf ? `data-rf="${rf}:${esc(d[0])}"` : (attr ? `${attr}="${esc(d[0])}"` : "");
    const cls = (rf || attr) ? " tile-click" : "";
    const act = rf && reportFilters[rf] === d[0] ? " rf-active" : "";
    const h = Math.max(3, Math.round((d[1] / mx) * 100));
    return `<div class="bar-col${cls}${act}" ${interactive} title="${esc(d[0])}: ${d[1]}"><div class="bar-val">${d[1]}</div><div class="bar-track"><div class="bar" style="height:${h}%;background:linear-gradient(180deg, ${color}f2, ${color})"></div></div><div class="bar-label">${esc(d[0])}</div></div>`;
  }).join("")}</div>`;
}
function donut(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let acc = 0; const seg = [];
  parts.forEach((p) => { const a = (acc / total) * 360, b = ((acc + p.value) / total) * 360; seg.push(`${p.color} ${a}deg ${b}deg`); acc += p.value; });
  const bg = parts.every((p) => !p.value) ? "#e2e8f0 0deg 360deg" : seg.join(", ");
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${bg});-webkit-mask:radial-gradient(circle 34px at center, transparent 98%, #000 100%);mask:radial-gradient(circle 34px at center, transparent 98%, #000 100%);"></div><div class="legend">${parts.map((p) => `<div class="tile-click" data-drill="rating:${p.name}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)} <b>${p.value}</b></div>`).join("")}</div></div>`;
}

/* ---------- Views ---------- */
const VIEWS = { dash: viewDash, leads: viewLeads, pipeline: viewPipeline, digital: viewDigital, followups: viewFollowups, calendar: viewCalendar, brokers: viewBrokers, customers: viewCustomers, projects: viewProjectsWeb, inventory: viewInventory, testimonials: viewTestimonials, reports: viewReports, analytics: viewAnalytics, assistant: viewAssistant };

/* ---------- Deal Pipeline (kanban of active leads) ---------- */
function viewPipeline() {
  // Board = Active leads + any lead sitting in the VDNB stage (visit done, not booked —
  // these are Inactive but must still show in their VDNB column).
  const boardLeads = DB.leads.filter((l) => l.status === "Active" || l.stage === "VDNB");
  const known = new Set(STAGES);
  const cols = STAGES.map((s) => ({ stage: s, leads: [] }));
  boardLeads.forEach((l) => { const s = known.has(l.stage) ? l.stage : STAGES[0]; cols.find((c) => c.stage === s).leads.push(l); });
  const initials = (n) => esc((n || "?").slice(0, 1).toUpperCase());
  const card = (l) => {
    const proj = (l.projects_shared || []).filter(Boolean).join(", ");
    const sub = [esc(l.requirement) || "", proj ? esc(proj) : ""].filter(Boolean).join(" · ") || "—";
    const dead = l.status !== "Active";
    return `<div class="pl-card${dead ? " pl-card-dead" : ""}" draggable="true" data-pllead="${l.id}" data-profile="lead:${l.id}">
      <div class="pl-card-name">${esc(l.customer_name) || esc(l.lead_number)}${dead ? ` <span class="pl-tag-dead">${esc(l.status)}</span>` : ""}</div>
      <div class="pl-card-sub">${sub}</div>
      <div class="pl-card-foot"><span class="pl-av">${initials(l.customer_name)}</span>${l.budget ? `<span class="pl-val">${esc(l.budget)}</span>` : ""}</div>
    </div>`;
  };
  const columns = cols.map((c) => `<div class="pl-col${c.stage === "VDNB" ? " pl-col-vdnb" : ""}">
      <div class="pl-col-head"><span class="pl-col-dot"${c.stage === "VDNB" ? ' style="background:#94a3b8"' : ""}></span><span class="pl-col-title">${esc(c.stage)}</span><span class="pl-col-count">${c.leads.length}</span></div>
      <div class="pl-col-body" data-plstage="${esc(c.stage)}">${c.leads.map(card).join("") || `<div class="pl-empty">Drop a lead here</div>`}</div>
    </div>`).join("");
  const activeN = DB.leads.filter((l) => l.status === "Active").length;
  const bookedN = DB.leads.filter((l) => l.status === "Booked").length;
  const vdnbN = DB.leads.filter((l) => l.stage === "VDNB").length;
  return `<div class="pl-topbar">
      <div class="section-title" style="margin:0">Deal pipeline <span class="muted" style="font-weight:400">· drag a lead between stages to update it</span></div>
      <div class="pl-topstats"><span class="pl-chip pl-chip-active">${activeN} active</span>${vdnbN ? `<span class="pl-chip pl-chip-vdnb">${vdnbN} VDNB</span>` : ""}<span class="pl-chip pl-chip-booked">${bookedN} booked</span></div>
    </div>
    <div class="pl-board"><div class="pl-col pl-col-web" id="plWebCol" style="display:none"><div class="pl-col-head"><span class="pl-col-dot" style="background:#8a6d3b"></span><span class="pl-col-title">🌐 New · Website</span><span class="pl-col-count" id="plWebCount">0</span></div><div class="pl-col-body" id="plWebBody"></div></div>${columns}</div>`;
}
// Load untouched website (digital) enquiries into the pipeline's first "Website" column.
async function loadPipelineDigital() {
  const col = document.getElementById("plWebCol"); if (!col) return;
  let list = null; try { list = await loadWebEnquiries(); } catch (e) {}
  const news = (list || []).filter((e) => digiStatusOf(e) === "New");
  const body = document.getElementById("plWebBody"), cnt = document.getElementById("plWebCount");
  if (!news.length || !body) { col.style.display = "none"; return; }
  col.style.display = ""; if (cnt) cnt.textContent = news.length;
  body.innerHTML = news.map((e) => {
    const projs = (webInterests(e) || []).map((it) => it.project).filter(Boolean).join(", ");
    return `<div class="pl-card pl-card-web" data-digorow="${esc(String(e.id))}">
      <div class="pl-card-name">${esc(e.user) || "Website visitor"}</div>
      <div class="pl-card-sub">${projs ? esc(projs) : "Browsing inventory"}</div>
      <div class="pl-card-foot"><span class="pl-badge-web">🌐 Website</span>${e.mobile ? `<span class="pl-val" style="color:#8a6d3b">${esc(e.mobile)}</span>` : ""}</div>
    </div>`;
  }).join("");
  body.querySelectorAll("[data-digorow]").forEach((el) => (el.onclick = () => go("digital")));
}
function bindPipeline() {
  loadPipelineDigital();
  let dragId = null;
  document.querySelectorAll(".pl-card").forEach((el) => {
    el.addEventListener("dragstart", (e) => { dragId = Number(el.getAttribute("data-pllead")); el.classList.add("pl-dragging"); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; });
    el.addEventListener("dragend", () => { el.classList.remove("pl-dragging"); dragId = null; document.querySelectorAll(".pl-over").forEach((c) => c.classList.remove("pl-over")); });
  });
  document.querySelectorAll(".pl-col-body").forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("pl-over"); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; });
    col.addEventListener("dragleave", () => col.classList.remove("pl-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault(); col.classList.remove("pl-over");
      const stage = col.getAttribute("data-plstage");
      if (dragId != null) {
        const l = leadById(dragId);
        if (l) {
          const changes = [];
          if (l.stage !== stage) { l.stage = stage; changes.push("stage → " + stage); }
          // Keep status consistent with the column: VDNB = Inactive (visit done, not booked);
          // dropping into any working stage re-activates the lead.
          if (stage === "VDNB" && l.status !== "Inactive") { l.status = "Inactive"; changes.push("marked Inactive (VDNB)"); }
          else if (stage !== "VDNB" && l.status !== "Active") { l.status = "Active"; changes.push("re-activated"); }
          if (changes.length) {
            addActivity({ entity_type: "lead", entity_id: l.id, kind: "Pipeline move", remark: changes.join(" · "), activity_at: now() });
            save(); toast("Moved to " + stage); go("pipeline");
          }
        }
      }
    });
  });
}

/* ================= AI Copilot (Google Gemini + Groq fallback) =================
   The user pastes ONE key. We auto-detect the provider from its shape:
     • starts with "gsk_"  → Groq  (free, no credit card, no billing — most reliable)
     • otherwise (AIza…)   → Google Gemini (free tier; can hit billing quirks)
   Each provider tries a few free models in order and auto-retries transient
   failures (429/500/503) with short backoff, so one hiccup doesn't block a draft.
   The key lives in the cloud CRM doc (admin-only) — never in source, never on the site. */
function aiKey() { return (typeof DB !== "undefined" && DB && DB.gemini_key) || ""; }
function aiReady() { return !!aiKey(); }
function aiProvider(k) { k = k || aiKey(); return /^gsk_/.test(k) ? "groq" : "gemini"; }
function aiProviderLabel() { return aiProvider() === "groq" ? "Groq (Llama)" : "Google Gemini"; }
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Is this HTTP status worth retrying / trying the next model?
function _aiTransient(status) { return status === 429 || status === 500 || status === 502 || status === 503 || status === 504; }
function _aiFriendly(provider, status, body) {
  const b = (body || "").toLowerCase();
  if (status === 400) return "the API key looks wrong — re-paste it (🔑 AI key)";
  if (status === 401 || status === 403) return "key blocked or invalid — check it (🔑 AI key)";
  if (status === 429) {
    if (/prepay|credit|billing|depleted/.test(b)) return "this key's Google project has billing turned on, so Gemini won't use the free tier. Make a fresh key in a NEW project (no billing), or switch to a free Groq key — see 🔑 AI key";
    return "the free rate limit was hit — waiting a moment and retrying";
  }
  return "service busy, retrying";
}
// One raw call to Gemini for a given model.
async function _callGemini(key, model, prompt) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key);
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.75, maxOutputTokens: 900 } }) });
  if (!res.ok) { let t = ""; try { t = await res.text(); } catch (e) {} const err = new Error(t); err.status = res.status; err.body = t; throw err; }
  const data = await res.json();
  const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.map((p) => p.text || "").join("");
  if (!text) throw new Error("Empty response — try rephrasing.");
  return text.trim();
}
// One raw call to Groq (OpenAI-compatible chat completions).
async function _callGroq(key, model, prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key }, body: JSON.stringify({ model: model, temperature: 0.75, max_tokens: 900, messages: [{ role: "user", content: prompt }] }) });
  if (!res.ok) { let t = ""; try { t = await res.text(); } catch (e) {} const err = new Error(t); err.status = res.status; err.body = t; throw err; }
  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error("Empty response — try rephrasing.");
  return text.trim();
}
// Public entry point. Provider-aware, model fallback, transient auto-retry.
async function aiGenerate(prompt) {
  const key = aiKey();
  if (!key) throw new Error("no-key");
  const groq = aiProvider(key) === "groq";
  const provider = groq ? "groq" : "gemini";
  const models = groq
    ? ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  const call = groq ? _callGroq : _callGemini;
  let lastErr = null;
  for (let mi = 0; mi < models.length; mi++) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await call(key, models[mi], prompt); }
      catch (e) {
        lastErr = e;
        const st = e && e.status;
        if (st && !_aiTransient(st)) { throw new Error(_aiFriendly(provider, st, e.body) + (e.body ? " · " + String(e.body).slice(0, 140) : "")); }
        // transient: quick backoff, then retry same model once, then fall through to next model
        if (attempt === 0) await _sleep(700);
      }
    }
  }
  const st = lastErr && lastErr.status;
  throw new Error(_aiFriendly(provider, st || 0, lastErr && lastErr.body) + (lastErr && lastErr.body ? " · " + String(lastErr.body).slice(0, 140) : ""));
}
// Back-compat alias — all existing callers keep working.
async function geminiGenerate(prompt) { return aiGenerate(prompt); }
function openAiConnect(after) {
  const cur = (DB && DB.gemini_key) || "";
  const curLabel = cur ? (aiProvider(cur) === "groq" ? "a Groq key is connected" : "a Gemini key is connected") : "";
  modal("🔑 Connect AI (free)", `
    <div class="lf"><div class="lf-sec"><div class="lf-sec-body" style="font-size:13px;line-height:1.7">
      <p>Paste <b>one</b> free API key below — the Copilot detects which provider it is automatically. Pick whichever is easier for you:</p>
      <div style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:8px 0">
        <b>Option A · Groq</b> <span style="color:#16a34a;font-weight:600">— recommended, no credit card, no billing</span>
        <ol style="padding-left:20px;margin:6px 0 0">
          <li>Open <a href="https://console.groq.com/keys" target="_blank" rel="noopener"><b>console.groq.com/keys</b></a> → sign in (Google works).</li>
          <li><b>Create API Key</b> → <b>Copy</b> it (starts with <code>gsk_…</code>).</li>
        </ol>
      </div>
      <div style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:8px 0">
        <b>Option B · Google Gemini</b>
        <ol style="padding-left:20px;margin:6px 0 0">
          <li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"><b>aistudio.google.com/apikey</b></a> → <b>Create API key</b>.</li>
          <li>Choose <b>“Create API key in new project”</b> — a project <i>with</i> billing (your Firebase one) triggers a “prepayment credits” error.</li>
          <li><b>Copy</b> it (starts with <code>AIza…</code>).</li>
        </ol>
      </div>
      <input id="ai_key" type="password" class="search" style="width:100%;font-family:ui-monospace,monospace" placeholder="Paste your Groq (gsk_…) or Gemini (AIza…) key…" value="${esc(cur)}"/>
      <p class="muted" style="font-size:11px;margin-top:8px">${curLabel ? "Currently: <b>" + curLabel + "</b>. " : ""}Stored privately in your CRM account (only you can read it). Never put on your public website.</p>
    </div></div></div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button>${DB && DB.gemini_key ? `<button class="btn lightdanger" id="aiKeyClear">Remove key</button>` : ""}<button class="btn primary" id="aiKeySave">Save key</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  const clr = document.getElementById("aiKeyClear"); if (clr) clr.onclick = () => { delete DB.gemini_key; save(); toast("AI key removed"); closeModal(); };
  document.getElementById("aiKeySave").onclick = () => { const k = (fieldVal("ai_key") || "").trim(); if (!k) return toast("Paste your key first"); DB.gemini_key = k; save(); toast("AI connected ✓ · " + aiProviderLabel()); closeModal(); if (after) after(); };
}
// Build the prompt for a per-lead message draft.
// Pull REAL selling points for the shared project(s) from the website data layer
// (USPs, location, config, price, possession) + the CRM's own project notes, so the
// AI can write something tailored that actually makes the customer want the project —
// not a generic follow-up. Returns "" if nothing is known (AI then stays factual).
async function projectKnowledge(names) {
  names = (names || []).filter(Boolean);
  if (!names.length) return "";
  const nrm = (s) => String(s || "").trim().toLowerCase();
  let web = [];
  try { const S = WS(); if (S) web = await S.projects(); } catch (e) {}
  const blocks = names.map((name) => {
    const key = nrm(name);
    const wp = (web || []).find((p) => nrm(p.name) === key) || {};
    const cp = (DB.projects || []).find((p) => nrm(p.name) === key) || {};
    const price = wp.priceLabel || (wp.priceFromCr ? "₹" + wp.priceFromCr + " Cr onwards" : "") || cp.price_min || "";
    const usp = (wp.usp || []).slice(0, 3);
    const why = (wp.why || []).slice(0, 2);
    const facts = [
      (wp.location || cp.location) ? "Location: " + (wp.location || cp.location) : "",
      (wp.type || cp.type) ? "Type: " + (wp.type || cp.type) : "",
      wp.config ? "Configuration: " + wp.config : "",
      price ? "Price: " + price : "",
      wp.possession ? "Possession: " + wp.possession : "",
      (wp.tagline || wp.about || cp.notes) ? "Positioning: " + (wp.tagline || wp.about || cp.notes) : "",
      usp.length ? "Key USPs: " + usp.join("; ") : "",
      why.length ? "Why buy: " + why.join("; ") : "",
    ].filter(Boolean);
    return facts.length ? `▸ ${name}\n  ${facts.join("\n  ")}` : `▸ ${name}`;
  });
  return blocks.join("\n");
}
function leadDraftPrompt(l, recipient, channel, intent, projKnow) {
  const projArr = (l.projects_shared || []).filter(Boolean);
  const proj = projArr.join(", ");
  const units = l.units || {}, costing = l.costing || {};
  // Rich project detail so the message can be built AROUND the actual project(s).
  const projDetail = projArr.map((n) => n + (units[n] ? ` (unit ${units[n]})` : "") + (costing[n] ? ` — ${costing[n]}` : "")).join("; ");
  const facts = [
    `Customer name: ${l.customer_name || "the customer"}`,
    l.requirement ? `Requirement type: ${l.requirement}` : "",
    l.budget ? `Budget: ${l.budget}` : "",
    projDetail ? `Project(s) under discussion: ${projDetail}` : "",
    l.stage ? `Current stage: ${l.stage}` : "",
    l.rating ? `Lead rating (internal, do NOT mention): ${l.rating}` : "",
    l.customer_city ? `City: ${l.customer_city}` : "",
    l.customer_profession ? `Profession: ${l.customer_profession}` : "",
    l.source_name ? `Referring channel partner: ${l.source_name}${l.source_firm ? " (" + l.source_firm + ")" : ""}` : "",
    l.followup_at ? `Next follow-up: ${l.followup_at}${l.followup_kind ? " (" + l.followup_kind + ")" : ""}` : "",
  ].filter(Boolean).join("\n");
  // My private shorthand: the lead remark + my recent activity/journey notes. These are
  // informal, written fast, and just help me recognise the client and recall the chat.
  const notes = (DB.activities || [])
    .filter((a) => a.entity_type === "lead" && a.entity_id === l.id && String(a.remark || "").trim())
    .sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 4)
    .map((a) => `• ${a.kind || "Note"}: ${a.remark}`);
  const noteLines = [l.remark ? `• Remark: ${l.remark}` : ""].concat(notes).filter(Boolean).join("\n");
  const notesBlock = noteLines ? `\n\nMY PRIVATE SHORTHAND NOTES (informal, for my memory only — the recipient must NEVER see them as written). Read them, understand the substance of our past conversation, and reflect it in a polished, professional way. Do NOT quote them, expose slang/typos, or reveal internal tags:\n${noteLines}` : "";
  const knowBlock = projKnow ? `\n\nREAL PROJECT INTELLIGENCE (accurate facts about the project(s) — these are your selling ammunition). Pick the 1-2 points that best fit this customer's requirement "${l.requirement || "—"}" and budget "${l.budget || "—"}", and weave them in to genuinely spark interest. Use ONLY what's here — never invent amenities, prices, dates or claims:\n${projKnow}` : "";
  const who = recipient === "partner" ? "the channel partner who referred this client (a business peer)" : "the customer directly";
  const ch = channel === "email" ? "a short, professional email — begin with a 'Subject:' line" : "a warm, concise WhatsApp message (no subject line)";
  return `You are Ashish Sharma — a trusted BPTP luxury real-estate advisor in Gurugram; personal brand "Coffee & Deals". Write ${ch} to ${who}.
Purpose: ${intent}.
${projDetail ? `Build the message AROUND the specific project(s): ${projDetail}. Name the project so it reads tailored, not generic.` : ""}
GOAL: make the recipient genuinely interested in THIS project. Lead with one concrete, relevant hook from the project intelligence below (location edge, standout USP, configuration, price advantage or possession timing) that matches their need — not vague praise. Give them a clear, low-pressure reason to take the next step (a visit, a call, or a detailed cost sheet).
Use these real details accurately — never invent facts, prices or dates:
${facts}${knowBlock}${notesBlock}

Style: warm, professional, personal, concise, respectful of their time, never pushy or salesy — persuasive through genuine fit, not hype. Turn my rough notes into refined, professional phrasing. Keep it ready-to-send. Sign off simply as "Ashish". Output only the message text${channel === "email" ? " including the Subject: line" : ""}.`;
}
function openLeadDraft(leadId) {
  const l = leadById(leadId); if (!l) return;
  if (!aiReady()) return openAiConnect(() => openLeadDraft(leadId));
  const intents = ["Friendly follow-up to keep momentum", "Share project details & invite for a site visit", "Post site-visit check-in", "Gentle nudge during negotiation", "Re-engage a quiet / cold lead", "Update & thank the channel partner", "Send a warm festive / occasion greeting"];
  modal("✦ Draft a message · " + (esc(l.customer_name) || esc(l.lead_number)), `
    <div class="lf"><div class="lf-sec"><div class="lf-sec-body"><div class="form-grid">
      ${pillField("Send to", "ad_recipient", ["Customer", "Channel Partner"], "Customer", true)}
      ${pillField("Channel", "ad_channel", ["WhatsApp", "Email"], "WhatsApp", true)}
      <div class="field full"><label>What should it say?</label><select id="ad_intent">${intents.map((i) => `<option>${esc(i)}</option>`).join("")}</select></div>
    </div></div></div></div>
    <div style="padding:0 4px"><button class="btn primary" id="adGen" style="width:100%">✦ Generate draft</button><div id="adOut" class="ai-out" style="display:none;margin-top:14px"></div></div>`, true);
  const gen = async () => {
    const recip = fieldVal("ad_recipient") === "Channel Partner" ? "partner" : "customer";
    const channel = fieldVal("ad_channel") === "Email" ? "email" : "whatsapp";
    const intent = fieldVal("ad_intent");
    const out = document.getElementById("adOut"); out.style.display = ""; out.innerHTML = `<div class="ai-loading"><span class="ai-orb ai-orb-sm"></span> Drafting your message…</div>`;
    try {
      const pk = await projectKnowledge(l.projects_shared || []);
      const text = await geminiGenerate(leadDraftPrompt(l, recip, channel, intent, pk));
      out.innerHTML = `<textarea class="ai-textarea" id="adText" rows="8">${esc(text)}</textarea>
        <div class="ai-actions"><button class="btn primary sm" id="adCopy">📋 Copy</button><a class="btn outline sm" id="adWa" style="display:none" target="_blank" rel="noopener">💬 Open WhatsApp</a><button class="btn ghost sm" id="adRegen">↻ Regenerate</button></div>`;
      document.getElementById("adCopy").onclick = () => { try { navigator.clipboard.writeText(document.getElementById("adText").value); } catch (e) {} toast("Copied ✓"); };
      document.getElementById("adRegen").onclick = gen;
      const num = ((recip === "partner" ? l.source_mobile : l.customer_mobile) || "").replace(/\D/g, "");
      if (channel === "whatsapp" && num.length >= 10) { const wa = document.getElementById("adWa"); wa.style.display = ""; wa.href = "https://wa.me/" + (num.length === 10 ? "91" + num : num) + "?text=" + encodeURIComponent(document.getElementById("adText").value); }
    } catch (e) {
      const msg = (e && e.message) || String(e);
      out.innerHTML = `<div class="ai-err">${/no-key/.test(msg) ? "Connect your Gemini key first (AI Copilot → 🔑 AI key)." : "Couldn't generate: " + esc(msg)}</div>`;
    }
  };
  document.getElementById("adGen").onclick = gen;
}
// Compact snapshot of the CRM for the copilot's context.
function aiCrmContext() {
  const L = DB.leads, active = L.filter((l) => l.status === "Active");
  const lines = active.slice(0, 30).map((l) => `- ${l.customer_name || l.lead_number} | ${l.requirement || "?"} | budget ${l.budget || "?"} | stage ${l.stage || "?"} | rating ${l.rating || "?"} | project ${(l.projects_shared || []).join("/") || "?"} | source ${l.source_name || "-"} | followup ${l.followup_at || "none"} | remark "${(l.remark || "").slice(0, 140)}"`);
  const bk = bucketFollowups();
  return `CRM snapshot for ${today()}:\nTotals — leads ${L.length}, active ${active.length}, booked ${L.filter((l) => l.status === "Booked").length}. Follow-ups today ${bk.today.length}, missed ${bk.missed.length}. Brokers ${DB.brokers.length}, customers ${DB.customers.length}.\nActive leads:\n${lines.join("\n") || "none"}`;
}
function viewAssistant() {
  const connected = aiReady();
  const sugg = ["Which leads need my attention today?", "Summarise my active pipeline.", "Draft a WhatsApp follow-up for my newest Hot lead.", "List active leads that have no follow-up set.", "Write a message to re-engage cold leads."];
  return `<div class="ai-copilot">
    <div class="card pad ai-chat">
      <div class="ai-chat-head"><span class="ai-orb"></span><div><b>Coffee &amp; Deals AI</b><div class="muted" style="font-size:11px">${connected ? "Connected · " + esc(aiProviderLabel()) + " · reads your CRM" : "Not connected — add a free key to start"}</div></div><button class="btn ghost sm" id="aiKeyBtn" style="margin-left:auto">🔑 AI key</button></div>
      <div class="ai-messages" id="aiMessages"><div class="ai-msg ai">Hi Ashish 👋 I can read your CRM and help you <b>draft messages &amp; emails</b>, <b>summarise your pipeline</b>, and <b>plan your day</b>. ${connected ? "Ask me anything below, or tap a quick prompt." : "First tap <b>🔑 AI key</b> to connect (free, ~2 min)."}</div></div>
      <div class="ai-input"><input id="aiInput" placeholder="Ask about your leads, or say &quot;draft a follow-up for …&quot;" autocomplete="off"/><button class="btn primary" id="aiSend">Send ↑</button></div>
    </div>
    <div class="card pad ai-side">
      <div class="section-title">Quick prompts</div>
      ${sugg.map((q) => `<button class="ai-suggest" data-aiprompt="${esc(q)}">${esc(q)}</button>`).join("")}
      <p class="muted" style="font-size:11px;margin-top:14px;line-height:1.6">Runs on ${connected ? esc(aiProviderLabel()) : "Groq or Google Gemini"} using your CRM data. Your key is stored privately in your account — never on the website.</p>
    </div>
  </div>`;
}
let _aiBusy = false;
function bindAssistant() {
  const kb = document.getElementById("aiKeyBtn"); if (kb) kb.onclick = () => openAiConnect(() => go("assistant"));
  const send = document.getElementById("aiSend"), input = document.getElementById("aiInput");
  const fire = () => { const q = (input.value || "").trim(); if (q) { input.value = ""; sendAi(q); } };
  if (send) send.onclick = fire;
  if (input) input.onkeydown = (e) => { if (e.key === "Enter") fire(); };
  document.querySelectorAll("[data-aiprompt]").forEach((b) => (b.onclick = () => sendAi(b.getAttribute("data-aiprompt"))));
}
async function sendAi(q) {
  const ms = document.getElementById("aiMessages"); if (!ms) return;
  if (_aiBusy) return;
  if (!aiReady()) { openAiConnect(() => go("assistant")); return; }
  ms.insertAdjacentHTML("beforeend", `<div class="ai-msg me">${esc(q)}</div>`);
  ms.insertAdjacentHTML("beforeend", `<div class="ai-msg ai" id="aiThinking"><span class="ai-orb ai-orb-sm"></span> Thinking…</div>`);
  ms.scrollTop = ms.scrollHeight; _aiBusy = true;
  const prompt = `You are the AI copilot inside Ashish Sharma's real-estate CRM ("Coffee & Deals", BPTP Gurugram). Answer helpfully and concisely using ONLY the CRM data below. When asked to draft a message, make it warm, professional and ready to send, signed "Ashish". Use simple formatting.\n\n${aiCrmContext()}\n\nQuestion: ${q}`;
  try {
    const text = await geminiGenerate(prompt);
    const th = document.getElementById("aiThinking"); if (th) th.remove();
    ms.insertAdjacentHTML("beforeend", `<div class="ai-msg ai">${esc(text).replace(/\n/g, "<br>")}</div>`);
  } catch (e) {
    const th = document.getElementById("aiThinking"); if (th) th.remove();
    const msg = (e && e.message) || String(e);
    ms.insertAdjacentHTML("beforeend", `<div class="ai-msg ai ai-err">${/no-key/.test(msg) ? "Please connect your Gemini key (🔑 AI key)." : esc(msg)}</div>`);
  }
  _aiBusy = false; ms.scrollTop = ms.scrollHeight;
}
// Dashboard "morning intelligence" banner: CTA + AI-refined one-liner.
function bindDashBrief() {
  const cta = document.getElementById("aiBriefCta");
  if (cta) cta.onclick = () => {
    if (aiReady()) { go("assistant"); setTimeout(() => sendAi("Plan my day: which active leads need my attention today, and what's the single best next step for each? Keep it short."), 60); }
    else go("followups");
  };
}
let _dashBriefLoaded = false;
async function loadDashBrief() {
  const head = document.getElementById("aiBriefHead"), sub = document.getElementById("aiBriefSub");
  if (!head || !aiReady()) return;                 // no key → keep the data-driven fallback line
  if (_dashBriefLoaded) return; _dashBriefLoaded = true;
  head.classList.add("ai-brief-loading");
  const prompt = `You are the morning intelligence inside Ashish Sharma's real-estate CRM (Coffee & Deals, BPTP Gurugram). Using ONLY the data below, reply in EXACTLY two short lines, no labels, no markdown:
Line 1: a punchy one-sentence headline about today's pipeline (max 14 words).
Line 2: name up to 3 specific leads that need attention today and why, comma-separated (max 30 words). If nothing is urgent, suggest one useful action.

${aiCrmContext()}`;
  try {
    const text = await aiGenerate(prompt);
    const lines = text.split("\n").map((s) => s.replace(/^[-*•\d.]+\s*/, "").trim()).filter(Boolean);
    head.classList.remove("ai-brief-loading");
    if (lines[0]) head.textContent = lines[0];
    if (sub && lines[1]) sub.textContent = lines.slice(1).join(" ");
  } catch (e) {
    head.classList.remove("ai-brief-loading");
    _dashBriefLoaded = false;                       // allow a retry next time; keep fallback line as-is
  }
}

// Dashboard "Upcoming" follow-up filter: All / Tomorrow / This week (next 7 days).
function bindDashFollowups() {
  const chips = document.getElementById("fuUpChips"), list = document.getElementById("fuUpList"), cnt = document.getElementById("fuUpCount");
  if (!chips || !list) return;
  const up = bucketFollowups().upcoming;
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const iso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const tmrS = iso(new Date(d0.getTime() + 864e5)), wkEndS = iso(new Date(d0.getTime() + 7 * 864e5));
  const filt = (mode) => up.filter((f) => { const d = String(f.at).slice(0, 10); if (mode === "tomorrow") return d === tmrS; if (mode === "week") return d >= tmrS && d <= wkEndS; return true; });
  const render = (mode) => { const arr = filt(mode); if (cnt) cnt.textContent = arr.length; list.innerHTML = arr.length ? arr.slice(0, 6).map(fuItemSmall).join("") : `<div class="fu-none">None</div>`; };
  chips.querySelectorAll("[data-fuup]").forEach((b) => (b.onclick = () => { chips.querySelectorAll("[data-fuup]").forEach((x) => x.classList.remove("on")); b.classList.add("on"); render(b.getAttribute("data-fuup")); }));
}
function viewDash() {
  const L = DB.leads;
  const active_ = L.filter((l) => l.status === "Active").length;
  const booked = L.filter((l) => l.status === "Booked").length;
  const hot = L.filter((l) => l.rating === "Hot").length, warm = L.filter((l) => l.rating === "Warm").length, cold = L.filter((l) => l.rating === "Cold").length;
  const stages = STAGES.map((s) => [s, L.filter((l) => l.stage === s).length]);
  const grades = GRADES.map((g) => ["Gr " + g, DB.brokers.filter((b) => b.grade === g).length]);
  const liveBrokers = DB.brokers.filter((b) => b.connect === "Live").length;
  const activeBrokers = DB.brokers.filter((b) => leadCountForBroker(b.name) > 0).length;
  // Firm-level counts for the Broker tile: one firm = one entity. Live firm = has >=1 Live broker.
  const { totalFirms, liveFirms, liveFirmBrokers } = liveFirmStats();
  const bk = bucketFollowups();
  const acts = DB.activities.slice().sort((a, b) => b.id - a.id).slice(0, 10);
  const nowM = new Date().getMonth() + 1;
  const bday = DB.customers.filter((c) => c.dob && Number(String(c.dob).slice(5, 7)) === nowM).length;
  const anni = DB.customers.filter((c) => c.anniversary && Number(String(c.anniversary).slice(5, 7)) === nowM).length;
  const investors = DB.customers.filter((c) => c.category === "Investor").length;
  const endusers = DB.customers.filter((c) => c.category === "EndUser").length;
  const contactable = DB.customers.filter((c) => Number(c.contact_future ?? 1)).length;

  const stat = (l, v, color, hint, drill) =>
    `<div class="card pad stat tile-click" data-drill="${drill}"><div class="stat-label">${l}</div><div class="stat-value" style="color:${color}">${v}</div>${hint ? `<div class="stat-hint">${hint}</div>` : ""}<div class="stat-go">View ›</div></div>`;

  const fuMini = (title, arr, tone) => `
    <div class="fu-cat">
      <div class="fu-cat-head"><span class="fu-cat-title">${title}</span><span class="fu-count ${tone}">${arr.length}</span></div>
      ${arr.length ? arr.slice(0, 4).map(fuItemSmall).join("") : `<div class="fu-none">None</div>`}
    </div>`;

  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const dLong = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase();
  // Instant, data-driven headline so the banner is never empty; AI refines it after.
  const briefBits = [];
  if (bk.today.length) briefBits.push(`${bk.today.length} follow-up${bk.today.length === 1 ? "" : "s"} due today`);
  if (bk.missed.length) briefBits.push(`${bk.missed.length} missed`);
  if (hot) briefBits.push(`${hot} hot lead${hot === 1 ? "" : "s"}`);
  const briefFallback = active_ ? `You have ${active_} active ${active_ === 1 ? "enquiry" : "enquiries"} in play${briefBits.length ? " — " + briefBits.join(", ") + "." : "."}` : "No active enquiries yet — add a lead to get started.";

  return `
  <div class="ai-brief" id="aiBrief">
    <div class="ai-brief-orb"><span class="ai-orb"></span></div>
    <div class="ai-brief-body">
      <div class="ai-brief-eyebrow">✦ COFFEE &amp; DEALS AI <span class="ai-brief-date">· ${dLong}</span></div>
      <div class="ai-brief-greet">${greet}, Ashish</div>
      <div class="ai-brief-head" id="aiBriefHead">${esc(briefFallback)}</div>
      <div class="ai-brief-sub" id="aiBriefSub"></div>
    </div>
    <button class="ai-brief-cta" id="aiBriefCta">Review my day <span>→</span></button>
  </div>
  <div class="grid cols-4">
    ${stat("Active Enquiries", active_, "#4f46e5", L.length + " total · " + booked + " booked", "leads:active")}
    <div class="card pad stat tile-click" data-drill="brokers:active">
      <span class="stat-corner" title="Total brokers (headcount)">${DB.brokers.length} total</span>
      <div class="stat-label">Active vs Live Brokers</div>
      <div class="stat-value" style="color:#2563eb">${activeBrokers}<span class="stat-vs"> / ${liveBrokers} live</span></div>
      <div class="stat-hint">active (brought enquiry) vs live</div>
      <div class="stat-go">View ›</div>
    </div>
    <div class="card pad stat tile-click" data-drill="brokers:all">
      <span class="stat-corner" title="Brokers working in live firms">${liveFirmBrokers} broker${liveFirmBrokers === 1 ? "" : "s"}</span>
      <div class="stat-label">Broker Firms</div>
      <div class="stat-value" style="color:#0d9488">${liveFirms}</div>
      <div class="stat-hint">live · ${totalFirms} firm${totalFirms === 1 ? "" : "s"} total</div>
      <div class="stat-go">View ›</div>
    </div>
    ${stat("Customers", DB.customers.length, "#0f172a", DB.projects.length + " projects", "goto:customers")}
  </div>
  <div class="grid cols-4 mt-16">
    ${stat("New Digital Enquiries", `<span id="dashDigiCount">…</span>`, "#8a6d3b", "From website — untouched", "diginew")}
    ${stat("Booked", booked, "#059669", "Closed deals", "leads:booked")}
    ${stat("Missed Follow-ups", bk.missed.length, bk.missed.length ? "#dc2626" : "#059669", "Needs action", "goto:followups")}
    ${stat("Birthdays & Anniversaries", bday + anni, "#db2777", bday + " b'days · " + anni + " anniv this month", "occasion:all")}
  </div>
  <div class="grid cols-3 mt-24">
    <div class="card pad"><div class="section-title">Enquiries by Stage <span class="muted" style="font-weight:400">· click a bar</span></div>${barChart(stages, "#4f46e5", "data-stage")}</div>
    <div class="card pad rating-card"><div class="section-title">Lead Rating Split</div><div class="rating-body">${donut([{ name: "Hot", value: hot, color: "#ef4444" }, { name: "Warm", value: warm, color: "#f59e0b" }, { name: "Cold", value: cold, color: "#0ea5e9" }])}</div></div>
    <div class="card pad"><div class="section-title">Brokers by Grade</div>${barChart(grades, "#0ea5e9", "data-grade")}</div>
  </div>
  <div class="card pad mt-24">
    <div class="section-title" style="display:flex;justify-content:space-between;">Follow-ups at a glance <a class="link" data-nav="followups">Open full board ›</a></div>
    <div class="fu-cols">
      ${fuMini("Today", bk.today, "amber")}
      <div class="fu-cat">
        <div class="fu-cat-head"><span class="fu-cat-title">Upcoming</span><span class="fu-count blue" id="fuUpCount">${bk.upcoming.length}</span></div>
        <div class="fu-chips" id="fuUpChips">
          <button type="button" class="fu-chip on" data-fuup="all">All</button>
          <button type="button" class="fu-chip" data-fuup="tomorrow">Tomorrow</button>
          <button type="button" class="fu-chip" data-fuup="week">This week</button>
        </div>
        <div id="fuUpList">${bk.upcoming.length ? bk.upcoming.slice(0, 4).map(fuItemSmall).join("") : `<div class="fu-none">None</div>`}</div>
      </div>
      ${fuMini("Missed", bk.missed, "red")}
    </div>
  </div>
  <div class="grid dash-cal-row mt-24">
    <div class="card pad">
      <div class="section-title" style="display:flex;justify-content:space-between;">Calendar <a class="link" data-nav="calendar">Full ›</a></div>
      <div class="js-calwrap cal-mini">${calendarHtml()}</div>
      <div class="cal-hint muted">Click any date to add a lead, broker or fix a meeting.</div>
    </div>
    <div class="card pad">
      <div class="section-title">Recent Activity</div>
      <div class="act-scroll">
      ${acts.length ? acts.map((a) => {
        const r = recordLabel(a.entity_type, a.entity_id);
        return `<div class="act-row tile-click" data-openrec="${a.entity_type}:${a.entity_id}">
          <div class="act-dot"></div>
          <div class="act-body">
            <div class="act-line"><b>${esc(r.name)}</b>${r.tag ? ` <span class="mono">${esc(r.tag)}</span>` : ""} <span class="chip">${esc(a.kind || "Note")}</span></div>
            ${a.remark ? `<div class="act-remark">${esc(a.remark)}</div>` : ""}
            <div class="fu-meta">${a.entity_type === "lead" ? "Enquiry" : "Broker"} · ${fmtDate(a.activity_at || a.created_at)}</div>
          </div>
        </div>`; }).join("") : `<div class="empty">No activity logged yet.</div>`}
      </div>
    </div>
  </div>`;
}

function fuItemSmall(f) {
  return `<div class="fu-s tile-click" data-openrec="${f.kind}:${f.id}">
    <span class="fu-s-dot ${f.kind}"></span>
    <span class="fu-s-name">${esc(f.name)}</span>
    <span class="fu-s-time">${timeOf(f.at) || String(f.at).slice(0, 10)}</span>
  </div>`;
}

/* ---------- Follow-ups board ---------- */
function viewFollowups() {
  const bk = bucketFollowups();
  const col = (title, arr, tone, empty, groupByKind) => {
    let body;
    if (!arr.length) body = `<div class="empty" style="padding:24px 0">${empty}</div>`;
    else if (groupByKind) {
      const clients = arr.filter((f) => f.kind === "lead"), brokers = arr.filter((f) => f.kind === "broker");
      body = `
        <div class="fu-group-title">Client Follow-ups (${clients.length})</div>
        ${clients.length ? clients.map(fuItemFull).join("") : `<div class="fu-none">No client follow-ups today</div>`}
        <div class="fu-group-title" style="margin-top:14px">Broker Meetings (${brokers.length})</div>
        ${brokers.length ? brokers.map(fuItemFull).join("") : `<div class="fu-none">No broker meetings today</div>`}`;
    } else body = arr.map(fuItemFull).join("");
    return `<div class="card pad fu-column"><div class="fu-col-head"><span class="fu-cat-title">${title}</span><span class="fu-count ${tone}">${arr.length}</span></div>${body}</div>`;
  };
  const upBody = bk.upcoming.length ? bk.upcoming.map(fuItemFull).join("") : `<div class="empty" style="padding:24px 0">No upcoming follow-ups.</div>`;
  const upCol = `<div class="card pad fu-column">
    <div class="fu-col-head"><span class="fu-cat-title">Upcoming</span><span class="fu-count blue" id="fuBoardUpCount">${bk.upcoming.length}</span></div>
    <div class="fu-chips" id="fuBoardUpChips">
      <button type="button" class="fu-chip on" data-fubup="all">All</button>
      <button type="button" class="fu-chip" data-fubup="tomorrow">Tomorrow</button>
      <button type="button" class="fu-chip" data-fubup="week">This week</button>
      <button type="button" class="fu-chip" data-fubup="month">This month</button>
    </div>
    <div id="fuBoardUpList">${upBody}</div>
  </div>`;
  return `<div class="fu-board">
    ${col("Today", bk.today, "amber", "Nothing scheduled today.", true)}
    ${upCol}
    ${col("Missed / Overdue", bk.missed, "red", "Nothing overdue. Great job.")}
  </div>`;
}
// Upcoming filter on the full Follow-ups board: All / Tomorrow / This week / This month.
function bindFollowupsUpcoming() {
  const chips = document.getElementById("fuBoardUpChips"), list = document.getElementById("fuBoardUpList"), cnt = document.getElementById("fuBoardUpCount");
  if (!chips || !list) return;
  const up = bucketFollowups().upcoming;
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const iso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const tmrS = iso(new Date(d0.getTime() + 864e5)), wkEndS = iso(new Date(d0.getTime() + 7 * 864e5)), monEndS = iso(new Date(d0.getFullYear(), d0.getMonth() + 1, 0));
  const filt = (mode) => up.filter((f) => { const d = String(f.at).slice(0, 10); if (mode === "tomorrow") return d === tmrS; if (mode === "week") return d >= tmrS && d <= wkEndS; if (mode === "month") return d >= tmrS && d <= monEndS; return true; });
  const render = (mode) => { const arr = filt(mode); if (cnt) cnt.textContent = arr.length; list.innerHTML = arr.length ? arr.map(fuItemFull).join("") : `<div class="empty" style="padding:24px 0">No upcoming follow-ups in this range.</div>`; };
  chips.querySelectorAll("[data-fubup]").forEach((b) => (b.onclick = () => { chips.querySelectorAll("[data-fubup]").forEach((x) => x.classList.remove("on")); b.classList.add("on"); render(b.getAttribute("data-fubup")); }));
}
function fuItemFull(f) {
  return `<div class="fu-full">
    <div class="fu-full-top">
      <div class="fu-full-name tile-click" data-openrec="${f.kind}:${f.id}">${esc(f.name)}</div>
      <div class="fu-full-when">${fmtDate(f.at)}</div>
    </div>
    <div class="fu-full-label"><span class="fu-s-dot ${f.kind}"></span>${f.ftype ? `<span class="fu-type-chip">${esc(f.ftype)}</span> ` : ""}${esc(f.label)}${f.sub ? ` · <span class="muted">${esc(f.sub)}</span>` : ""}</div>
    <div class="fu-full-actions">
      <button class="btn ghost sm" data-fuupdate="${f.kind}:${f.id}">Log / Reschedule</button>
      <button class="btn danger sm" data-fucancel="${f.kind}:${f.id}">Cancel</button>
    </div>
  </div>`;
}

/* ---------- Calendar ---------- */
let calRef = new Date();
function viewCalendar() {
  return `<div class="card pad">
    <div class="cal-toolbar">
      <div class="rep-subhead" style="margin:0">Meetings &amp; follow-up schedule</div>
      <div class="cal-tools"><button class="btn outline sm" data-action="gcal-ics">⤓ Export to Google Calendar (.ics)</button></div>
    </div>
    <div class="js-calwrap" style="margin-top:10px">${calendarHtml()}</div>
  </div>`;
}
/* ---- Google Calendar helpers ---- */
function atToParts(s) { const [d, t] = String(s).split(" "); const [y, mo, da] = d.split("-").map(Number); const [hh, mm] = (t || "00:00").split(":").map(Number); return { y, mo, da, hh: hh || 0, mm: mm || 0 }; }
function fmtICS(dt) { const p = (n) => String(n).padStart(2, "0"); return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}00`; }
function gcalDates(atStr) { const P = atToParts(atStr); const s = new Date(P.y, P.mo - 1, P.da, P.hh, P.mm); const e = new Date(s.getTime() + 3600000); return `${fmtICS(s)}/${fmtICS(e)}`; }
function gcalUrl(title, atStr, details) { return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${gcalDates(atStr)}&details=${encodeURIComponent(details || "")}`; }
function icsEsc(s) { return String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, " "); }
function downloadICS() {
  const items = openFollowups();
  if (!items.length) return toast("No scheduled follow-ups to export");
  const evs = items.map((f, i) => { const P = atToParts(f.at); const s = new Date(P.y, P.mo - 1, P.da, P.hh, P.mm); const e = new Date(s.getTime() + 3600000);
    return ["BEGIN:VEVENT", `UID:rcrm-${f.kind}-${f.id}-${i}@realtycrm`, `DTSTAMP:${fmtICS(new Date())}`, `DTSTART:${fmtICS(s)}`, `DTEND:${fmtICS(e)}`, `SUMMARY:${icsEsc((f.kind === "broker" ? "Broker meeting: " : "Follow-up: ") + f.name)}`, `DESCRIPTION:${icsEsc(f.label + (f.sub ? " · " + f.sub : ""))}`, "END:VEVENT"].join("\r\n"); });
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RealtyCRM//EN", "CALSCALE:GREGORIAN", ...evs, "END:VCALENDAR"].join("\r\n");
  download(new Blob([ics], { type: "text/calendar" }), `realtycrm-calendar-${today()}.ics`);
  toast("Calendar downloaded — import it in Google Calendar (Settings → Import)");
}

/* ---- Google Calendar AUTO-sync (OAuth, optional) ----
   Paste your Google OAuth Web Client ID below to enable it (see GOOGLE_CALENDAR_SETUP.md).
   When enabled and connected, scheduling a meeting inserts it into your Google Calendar. */
const GCAL_CLIENT_ID = "387123468989-1gk4j0vrd5tbtr0rbcfv1b65uheqc4e1.apps.googleusercontent.com"; // Google OAuth Web Client ID (auto-sync to Realty Cafe calendar)
const GCAL_CALENDAR_ID = "e7a7860fc16abea9eb6ba3bc112188f20129f23696687e97c333d2073dd75f27@group.calendar.google.com"; // "Realty Cafe" calendar; use "primary" for your default calendar
let gcalToken = null, gcalTokenExp = 0, gcalTokenClient = null, gcalPending = null;
function gcalLibReady() { return !!(window.google && google.accounts && google.accounts.oauth2); }
function gcalEnabled() { return !!GCAL_CLIENT_ID; }
// Connection state is stored in the CLOUD (DB.gcal_connected) so it stays "connected"
// on every device you sign in from — not just the one where you first authorised.
// (localStorage is kept too as a fast local hint.)
function gcalConnected() { try { if (typeof DB !== "undefined" && DB && DB.gcal_connected) return true; return localStorage.getItem("rcrm_gcal") === "1"; } catch { return false; } }
function gcalSetConnected(v) {
  try { if (v) localStorage.setItem("rcrm_gcal", "1"); else localStorage.removeItem("rcrm_gcal"); } catch {}
  try { if (typeof DB !== "undefined" && DB) { if (v) DB.gcal_connected = 1; else delete DB.gcal_connected; save(); } } catch {}
}
function gcalInitClient() {
  if (gcalTokenClient || !gcalEnabled() || !gcalLibReady()) return;
  gcalTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/calendar.events",
    callback: (resp) => {
      if (resp && resp.access_token) {
        gcalToken = resp.access_token;
        gcalTokenExp = Date.now() + ((resp.expires_in ? resp.expires_in * 1000 : 3600000) - 60000);
        gcalSetConnected(true);
        try { updateStatusLights(); } catch (e) {}
        if (gcalPending) { const p = gcalPending; gcalPending = null; p(); }
        else toast("Google Calendar connected");
      }
    },
  });
}
function gcalConnect() {
  if (!gcalEnabled()) { toast("Add your Google OAuth Client ID in app.js — see GOOGLE_CALENDAR_SETUP.md"); return; }
  if (!gcalLibReady()) { toast("Google library still loading — try again in a moment"); return; }
  gcalInitClient(); gcalTokenClient.requestAccessToken({ prompt: "consent" });
}
// Run fn once we have a valid access token (prompts sign-in the first time).
function gcalRun(fn) {
  if (!gcalEnabled() || !gcalLibReady()) return;
  if (gcalToken && Date.now() < gcalTokenExp) { fn(); return; }
  gcalInitClient(); if (!gcalTokenClient) return;
  gcalPending = fn; gcalTokenClient.requestAccessToken({ prompt: gcalConnected() ? "" : "consent" });
}
function gcalEventBody(title, atStr, details) {
  const P = atToParts(atStr); const s = new Date(P.y, P.mo - 1, P.da, P.hh, P.mm); const e = new Date(s.getTime() + 3600000);
  return { summary: title, description: details || "", start: { dateTime: s.toISOString() }, end: { dateTime: e.toISOString() } };
}
// Create the event, or PATCH the existing one (edit/modify) — keeps one event per record.
async function gcalUpsertEvent(kind, live, title, desc) {
  if (!gcalToken || !live.followup_at) return;
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GCAL_CALENDAR_ID)}/events`;
  try {
    if (live.gcal_event_id) {
      const r = await fetch(`${base}/${encodeURIComponent(live.gcal_event_id)}`, {
        method: "PATCH", headers: { "Authorization": "Bearer " + gcalToken, "Content-Type": "application/json" },
        body: JSON.stringify(gcalEventBody(title, live.followup_at, desc)),
      });
      if (r.ok) toast("Google Calendar updated");
      else if (r.status === 404) { live.gcal_event_id = ""; save(); return gcalUpsertEvent(kind, live, title, desc); } // event was deleted → recreate
      else if (r.status === 401) gcalToken = null;
    } else {
      const r = await fetch(base, {
        method: "POST", headers: { "Authorization": "Bearer " + gcalToken, "Content-Type": "application/json" },
        body: JSON.stringify(gcalEventBody(title, live.followup_at, desc)),
      });
      if (r.ok) { const data = await r.json(); live.gcal_event_id = data.id; save(); toast("Added to Google Calendar"); }
      else if (r.status === 401) gcalToken = null;
    }
  } catch {}
}
// Remove the event (e.g. follow-up cancelled).
async function gcalDeleteEvent(live) {
  if (!gcalToken || !live.gcal_event_id) return;
  try {
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GCAL_CALENDAR_ID)}/events/${encodeURIComponent(live.gcal_event_id)}`, {
      method: "DELETE", headers: { "Authorization": "Bearer " + gcalToken },
    });
    if (r.ok || r.status === 404 || r.status === 410) { live.gcal_event_id = ""; save(); toast("Removed from Google Calendar"); }
    else if (r.status === 401) gcalToken = null;
  } catch {}
}
// One entry point used everywhere a follow-up is set, changed or cleared:
// add if new, edit/modify if it already has an event, delete if the follow-up is gone.
// First number out of a comma/slash-separated list.
function firstNum(s) { return (s || "").toString().split(/[,/]/)[0].trim(); }
// Build the calendar title + the phone number to dial, per record type.
//   Customer      -> "CL <name> <mobile>"
//   Broker/CP     -> "Br <name> <mobile> · <firm>"
//   Enquiry CP+CL -> "CP+CL <CP name> + <customer> <mobile>"
//   Enquiry CP    -> "CP <CP name> · <firm> <mobile>"
//   Enquiry CL    -> "CL <customer> <mobile>"
function formatGcal(kind, r) {
  if (kind === "broker") {
    const num = firstNum(r.mobiles || r.mobile);
    return { title: `Br ${r.name || ""}${num ? " " + num : ""}${r.firm ? " · " + r.firm : ""}`.trim(), num };
  }
  if (kind === "customer") {
    const num = firstNum(r.mobile1 || r.mobile);
    return { title: `CL ${r.name || ""}${num ? " " + num : ""}`.trim(), num };
  }
  // Lead — title + calendar notes formatted per enquiry type (Ashish's spec).
  const et = r.enquiry_type || "CL";
  const cust = r.customer_name || "", cmob = r.customer_mobile || "";
  const bname = r.source_name || "", bfirm = r.source_firm || "", bmob = r.source_mobile || "";
  const proj = (r.projects_shared || []).filter(Boolean).join(", ");
  const ln = (label, val) => (val ? `${label}: ${val}` : "");
  const pair = (a, b) => [a, b].filter(Boolean).join(" · ");
  if (et === "CP+CL") {
    const desc = [ln("Project", proj), ln("Broker Firm", bfirm), ln("Broker", pair(bname, bmob)), ln("Customer", pair(cust, cmob))].filter(Boolean).join("\n");
    return { title: `CP+CL ${bname}${cust ? " + " + cust : ""}`.trim(), num: cmob || bmob, desc };
  }
  if (et === "CP Details Only" || et === "CP") {
    const desc = ln("Mobile", bmob);
    return { title: `CP ${bname}${bfirm ? " · " + bfirm : ""}`.trim(), num: bmob, desc };
  }
  // CL (and default)
  const desc = [ln("Project", proj), ln("Customer", pair(cust, cmob))].filter(Boolean).join("\n");
  return { title: `CL ${cust}`.trim(), num: cmob, desc };
}
function gcalMaybeInsert(kind, row) {
  if (!row || !gcalEnabled() || !gcalConnected()) return;
  const live = kind === "broker" ? (brokerById(row.id) || row) : (kind === "customer" ? ((DB.customers.find((c) => c.id === row.id)) || row) : (leadById(row.id) || row));
  const f = formatGcal(kind, live);
  // Leads carry a per-type formatted note (f.desc). Brokers/customers keep the generic note.
  const desc = (f.desc != null) ? f.desc
    : [f.num ? "📞 " + f.num : "", live.requirement ? "Requirement: " + live.requirement : "", live.stage ? "Stage: " + live.stage : ""].filter(Boolean).join("\n");
  if (live.followup_at) gcalRun(() => gcalUpsertEvent(kind, live, f.title, desc));
  else if (live.gcal_event_id) gcalRun(() => gcalDeleteEvent(live));
}
function refreshCalendars() { document.querySelectorAll(".js-calwrap").forEach((el) => (el.innerHTML = calendarHtml())); }
function calendarHtml() {
  const y = calRef.getFullYear(), m = calRef.getMonth();
  const first = new Date(y, m, 1), start = first.getDay(), days = new Date(y, m + 1, 0).getDate();
  const map = {};
  openFollowups().forEach((f) => { const d = String(f.at).slice(0, 10); (map[d] = map[d] || { lead: 0, broker: 0 })[f.kind]++; });
  const t = today();
  let cells = "";
  for (let i = 0; i < start; i++) cells += `<div class="cal-cell empty-cell"></div>`;
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
    const info = map[ds];
    const dots = info ? `<div class="cal-dots">${info.lead ? `<span class="cal-dot lead"></span>` : ""}${info.broker ? `<span class="cal-dot broker"></span>` : ""}</div>` : "";
    cells += `<div class="cal-cell ${info ? "has" : ""} ${ds === t ? "istoday" : ""}" data-day="${ds}"><span class="cal-num">${d}</span>${dots}</div>`;
  }
  return `
    <div class="cal-head">
      <button class="btn outline sm" data-calprev>‹ Prev</button>
      <div class="cal-title">${MONTHS[m]} ${y}</div>
      <button class="btn outline sm" data-calnext>Next ›</button>
    </div>
    <div class="cal-grid cal-week">${WEEKDAYS.map((w) => `<div class="cal-wd">${w}</div>`).join("")}</div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-legend"><span><span class="cal-dot lead"></span> Client follow-up</span><span><span class="cal-dot broker"></span> Broker meeting</span><span class="muted">Click a highlighted date to see its schedule</span></div>`;
}
function openDaySchedule(ds) {
  const items = openFollowups().filter((f) => String(f.at).slice(0, 10) === ds).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const [y, m, d] = ds.split("-").map(Number);
  const title = `${d} ${MONTHS[m - 1]} ${y}`;
  const actions = `<div class="day-add">
    <button class="btn primary sm" data-daynew="lead:${ds}">+ New Enquiry</button>
    <button class="btn outline sm" data-daynew="broker:${ds}">+ New Broker</button>
    <button class="btn outline sm" data-dayfix="${ds}">+ Schedule existing</button>
  </div>`;
  const list = items.length ? `<div class="day-list">${items.map((f) => `
    <div class="day-item">
      <div class="day-time">${timeOf(f.at) || "—"}</div>
      <div class="day-main">
        <div class="fu-full-name tile-click" data-openrec="${f.kind}:${f.id}">${esc(f.name)}</div>
        <div class="fu-full-label"><span class="fu-s-dot ${f.kind}"></span>${f.ftype ? `<span class="fu-type-chip">${esc(f.ftype)}</span> ` : ""}${esc(f.label)}${f.sub ? ` · <span class="muted">${esc(f.sub)}</span>` : ""}</div>
      </div>
      <div class="day-actions">
        <a class="gcal-link" href="${gcalUrl((f.kind === "broker" ? "Broker meeting: " : "Follow-up: ") + f.name, f.at, f.label + (f.sub ? " · " + f.sub : ""))}" target="_blank" rel="noopener">＋ Google</a>
        <button class="btn ghost sm" data-fuupdate="${f.kind}:${f.id}">Log</button>
        <button class="btn danger sm" data-fucancel="${f.kind}:${f.id}" data-day="${ds}">Cancel</button>
      </div>
    </div>`).join("")}</div>` : `<div class="empty" style="padding:20px 0">No meetings on this date yet. Use the buttons above to add one.</div>`;
  modal("Schedule — " + title, actions + list);
}
function newLeadOn(ds) { openLeadForm({ lead_date: ds, followup_at: ds + " 10:00", source_type: "CP", stage: "Call", rating: "Warm", status: "Active" }); }
function newBrokerOn(ds) { openBrokerForm({ connect: "Live", followup_at: ds + " 10:00" }); }
function openScheduleForm(ds) {
  const leadOpts = DB.leads.map((l) => `<option value="${l.id}">${esc(l.customer_name || l.lead_number)}</option>`).join("");
  const brokerOpts = DB.brokers.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
  if (!DB.leads.length && !DB.brokers.length) { toast("Add a lead or broker first"); return; }
  modal("Schedule a meeting — " + ds, `
    <div class="form-grid">
      <div class="field"><label>Record Type</label><select id="sf_type"><option value="lead">Lead / Enquiry</option><option value="broker">Broker</option></select></div>
      <div class="field"><label>Select Record</label><select id="sf_rec">${leadOpts || `<option value="">No leads yet</option>`}</select></div>
      <div class="field"><label>Time</label><input id="sf_time" type="time" value="10:00" /></div>
      <div class="field"><label>Purpose / Remark</label><input id="sf_remark" type="text" placeholder="e.g. Site visit, price discussion" /></div>
    </div>
    <div class="modal-foot"><button class="btn outline" data-close2>Back</button><button class="btn primary" id="sfSave">Fix Meeting</button></div>`);
  const rec = document.getElementById("sf_rec");
  document.getElementById("sf_type").onchange = (e) => { rec.innerHTML = e.target.value === "lead" ? (leadOpts || `<option value="">No leads yet</option>`) : (brokerOpts || `<option value="">No brokers yet</option>`); };
  document.querySelector("[data-close2]").onclick = () => openDaySchedule(ds);
  document.getElementById("sfSave").onclick = () => {
    const type = document.getElementById("sf_type").value, id = Number(rec.value);
    if (!id) return toast("Select a record");
    const at = ds + " " + (fieldVal("sf_time") || "10:00");
    const row = type === "lead" ? leadById(id) : brokerById(id);
    row.followup_at = at; save();
    addActivity({ entity_type: type, entity_id: id, kind: type === "broker" ? "Meeting Scheduled" : "Follow-up Scheduled", remark: fieldVal("sf_remark") || ("Scheduled for " + fmtDate(at)), activity_at: now() });
    gcalMaybeInsert(type, row);
    toast("Meeting fixed to record"); go(active); openDaySchedule(ds);
  };
}

/* ---------- Enquiries ---------- */
function viewLeads() {
  return `
  <div class="card filters">
    <input type="text" class="search" id="lq" placeholder="Search name, mobile, lead #…" />
    <select id="lStatus"><option value="">All status</option>${STATUSES.map((s) => `<option>${s}</option>`).join("")}</select>
    <select id="lRating"><option value="">All ratings</option>${RATINGS.map((s) => `<option>${s}</option>`).join("")}</select>
    <button class="btn danger sm" id="lDel">🗑 Delete selected</button>
  </div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th style="width:34px"><input type="checkbox" class="bulk-all"></th>${["Lead #", "Customer", "Source / CP", "Requirement", "Budget", "Stage", "Rating", "Status", "Follow-up", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody id="leadRows"></tbody></table><div id="leadEmpty"></div></div></div>`;
}
function bulkDeleteLeads() {
  const ids = selectedBulk("leadRows").map(Number);
  if (!ids.length) return toast("Tick some rows first");
  if (!confirm(`Delete ${ids.length} selected enquiry(s)? This cannot be undone.`)) return;
  ids.forEach((id) => removeRow("leads", id));
  toast(`Deleted ${ids.length}`); leadRowsHtml();
}
function leadRowsHtml() {
  const q = (document.getElementById("lq")?.value || "").toLowerCase();
  const st = document.getElementById("lStatus")?.value || "", rt = document.getElementById("lRating")?.value || "";
  const rows = all("leads").filter((l) => (!st || l.status === st) && (!rt || l.rating === rt) && (!q || `${l.customer_name} ${l.customer_mobile} ${l.lead_number} ${l.source_name}`.toLowerCase().includes(q)));
  document.getElementById("leadEmpty").innerHTML = rows.length ? "" : `<div class="empty">No enquiries match. Click “+ New Enquiry” to add one.</div>`;
  document.getElementById("leadRows").innerHTML = rows.map(leadRow).join("");
  wireBulkAll("leadRows");
}
function leadRow(l) {
  return `<tr>
    <td><input type="checkbox" class="bulk" data-id="${l.id}"></td>
    <td class="mono nowrap">${esc(l.lead_number)}</td>
    <td><div class="rowlink" data-profile="lead:${l.id}" style="font-weight:600">${esc(l.customer_name) || "—"}</div><div class="fu-meta">${telLink(l.customer_mobile)}</div></td>
    <td>${cpCell(l)}</td>
    <td class="nowrap">${esc(l.requirement) || "—"}</td>
    <td class="nowrap">${esc(l.budget) || "—"}</td>
    <td class="nowrap">${esc(l.stage) || "—"}</td>
    <td>${badge(l.rating)}</td>
    <td>${badge(l.status)}</td>
    <td class="nowrap fu-meta">${fmtDate(l.followup_at)}</td>
    <td class="right nowrap">
      <button class="btn primary sm" data-profile="lead:${l.id}">View</button>
      <button class="btn outline sm" data-act="editlead" data-id="${l.id}">Edit</button>
      <button class="btn danger sm" data-act="dellead" data-id="${l.id}">Del</button>
    </td></tr>`;
}

function leadCountForBroker(name) {
  const n = (name || "").trim().toLowerCase();
  if (!n) return 0;
  return DB.leads.filter((l) => (l.source_name || "").trim().toLowerCase() === n).length;
}
// Unique firm names (non-empty), and the grade that belongs to a firm.
function uniqueFirms() { return [...new Set(DB.brokers.map((b) => (b.firm || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
// Firm-level dashboard counts. One firm = one entity (solo brokers with no firm are pooled
// as a single "— No firm —" group, matching the Brokers page tiles). A firm is "live" if any
// of its brokers is Live; liveFirmBrokers = headcount across those live firms.
function liveFirmStats() {
  const g = {}; DB.brokers.forEach((b) => { const k = (b.firm || "").trim() || "— No firm —"; (g[k] = g[k] || []).push(b); });
  const arr = Object.values(g);
  const live = arr.filter((x) => x.some((b) => b.connect === "Live"));
  return { totalFirms: arr.length, liveFirms: live.length, liveFirmBrokers: live.reduce((n, x) => n + x.length, 0) };
}
function firmGrade(firm) { const key = (firm || "").trim().toLowerCase(); const g = DB.brokers.filter((b) => (b.firm || "").trim().toLowerCase() === key).map((b) => b.grade).filter(Boolean).sort(); return g[0] || ""; }
function brokerSummaryChips(list, clickable) {
  const rows = list || DB.brokers, n90 = addDays(-90);
  const f = (val) => (clickable ? val : undefined);
  // Count by FIRM: one firm = one entity, no matter how many brokers it has.
  const firms = {};
  rows.forEach((b) => { const k = (b.firm || "").trim() || "— No firm —"; (firms[k] = firms[k] || []).push(b); });
  const arr = Object.values(firms);
  return [
    { v: arr.length, k: "Firms", c: "indigo", f: f("") },
    { v: arr.filter((g) => g.some((b) => b.connect === "Live")).length, k: "Live", c: "green", f: f("live") },
    { v: arr.filter((g) => g.length && g.every((b) => b.connect === "Terminate")).length, k: "Terminated", c: "gray", f: f("terminate") },
    { v: arr.filter((g) => g.some((b) => leadCountForBroker(b.name) > 0)).length, k: "Active · with client", c: "teal", f: f("active") },
    { v: arr.filter((g) => g.some((b) => (b.created_at || "").slice(0, 10) >= n90 && b.connect === "Live")).length, k: "New · 3 months", c: "amber", f: f("new3") },
  ];
}
let brokerGroupMode = "firm";   // "firm" = grouped by firm (default) | "list" = flat table
function viewBrokers() {
  return `
  <div id="brokerStats"></div>
  <div class="card filters">
    <div class="bgrp-seg">
      <button class="btn sm ${brokerGroupMode === "firm" ? "primary" : "outline"}" id="bGrpFirm">🏢 By Firm</button>
      <button class="btn sm ${brokerGroupMode === "list" ? "primary" : "outline"}" id="bGrpList">☰ All Brokers</button>
    </div>
    <input type="text" class="search" id="bq" placeholder="Search name, firm, city…" />
    <select id="bType">
      <option value="">All brokers</option>
      <option value="live">Live only</option>
      <option value="terminate">Terminated</option>
      <option value="active">Active (brought client)</option>
      <option value="new3">New · last 3 months</option>
    </select>
    <select id="bGrade"><option value="">All grades</option>${GRADES.map((g) => `<option>${g}</option>`).join("")}</select>
    <button class="btn danger sm" id="bDel">🗑 Delete selected</button>
    <button class="btn outline sm" id="bTpl">⌄ Template</button>
    <button class="btn outline sm" id="bImp">↥ Import</button>
    <button class="btn outline sm" id="bExp">⌄ Export</button>
  </div>
  <div class="card" id="brokerListWrap"><div class="table-wrap"><table>
    <thead><tr><th style="width:34px"><input type="checkbox" class="bulk-all"></th>${["Broker", "Firm", "Grade", "Team", "City / Sector", "Enquiries", "Connect", "Follow-up", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody id="brokerRows"></tbody></table><div id="brokerEmpty"></div></div></div>
  <div id="brokerFirmWrap"></div>`;
}
function brokerRowsHtml() {
  const q = (document.getElementById("bq")?.value || "").toLowerCase();
  const g = document.getElementById("bGrade")?.value || "";
  const type = document.getElementById("bType")?.value || "";
  const n90 = addDays(-90);
  const rows = all("brokers").filter((b) => {
    if (g && b.grade !== g) return false;
    if (type === "live" && b.connect !== "Live") return false;
    if (type === "terminate" && b.connect !== "Terminate") return false;
    if (type === "active" && leadCountForBroker(b.name) === 0) return false;
    if (type === "new3" && !((b.created_at || "").slice(0, 10) >= n90 && b.connect === "Live")) return false;
    if (q && !`${b.name} ${b.firm} ${b.mobiles} ${b.city} ${b.sector}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const stats = document.getElementById("brokerStats");
  if (stats) stats.innerHTML = drillStats(brokerSummaryChips(null, true));
  const listWrap = document.getElementById("brokerListWrap");
  const firmWrap = document.getElementById("brokerFirmWrap");
  if (brokerGroupMode === "firm") {
    if (listWrap) listWrap.style.display = "none";
    if (firmWrap) { firmWrap.style.display = ""; firmWrap.innerHTML = brokerFirmsHtml(rows); }
  } else {
    if (firmWrap) { firmWrap.style.display = "none"; firmWrap.innerHTML = ""; }
    if (listWrap) listWrap.style.display = "";
    const emptyEl = document.getElementById("brokerEmpty"); if (emptyEl) emptyEl.innerHTML = rows.length ? "" : `<div class="empty">No brokers match these filters.</div>`;
    const rowsEl = document.getElementById("brokerRows"); if (rowsEl) rowsEl.innerHTML = rows.map(brokerRow).join("");
    wireBulkAll("brokerRows");
  }
}
// Grouped-by-firm view: one card per unique firm, expandable to reveal that firm's
// brokers (employees) with tap-to-dial mobile. Firms with more brokers sort to the top.
function brokerFirmsHtml(rows) {
  if (!rows.length) return `<div class="card"><div class="empty">No brokers match these filters.</div></div>`;
  const groups = {};
  rows.forEach((b) => { const key = (b.firm || "").trim() || "— No firm —"; (groups[key] = groups[key] || []).push(b); });
  const names = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length || a.localeCompare(b));
  return names.map((firm) => {
    const list = groups[firm].slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const live = list.filter((x) => x.connect === "Live").length;
    const totalLeads = list.reduce((s, x) => s + leadCountForBroker(x.name), 0);
    const grade = firmGrade(firm);   // grade belongs to the firm, not the individual broker
    const emp = list.map((b) => {
      const cnt = leadCountForBroker(b.name);
      return `<div class="firm-emp">
        <div class="firm-emp-main">
          <span class="rowlink" data-profile="broker:${b.id}" style="font-weight:600">${esc(b.name)}</span>
          ${cnt ? `<span class="pill-active">Active · ${cnt}</span>` : ""}${b.connect === "Terminate" ? ` ${badge("Terminate")}` : ""}
        </div>
        <div class="firm-emp-side">
          <span class="firm-mob">${b.mobiles ? telLink(b.mobiles) : `<span class="muted">no mobile</span>`}</span>
          <button class="btn ghost sm" data-cp360="${esc(b.name)}" title="Full working report for this CP">📊 360</button>
          <button class="btn primary sm" data-profile="broker:${b.id}">View</button>
          <button class="btn outline sm" data-act="editbroker" data-id="${b.id}">Edit</button>
        </div>
      </div>`;
    }).join("");
    return `<details class="firm-card">
      <summary class="firm-head">
        <span class="firm-chev" aria-hidden="true">▸</span>
        <span class="firm-name">${esc(firm)}</span>
        ${grade ? `<span class="firm-grade">Grade ${badge(grade)}</span>` : ""}
        <span class="firm-badge">${list.length} broker${list.length > 1 ? "s" : ""}</span>
        <span class="firm-meta">${live} live${totalLeads ? ` · ${totalLeads} lead${totalLeads > 1 ? "s" : ""}` : ""}</span>
        <span class="firm-add-wrap">${firm !== "— No firm —" ? `<button class="btn ghost sm" data-firm360="${esc(firm)}" title="Full working report for this firm">📊 360 Report</button>` : ""}<button class="btn outline sm" data-addfirm="${esc(firm)}">+ Add broker</button></span>
      </summary>
      <div class="firm-body">${emp}</div>
    </details>`;
  }).join("");
}
function setBrokerGroup(mode) {
  brokerGroupMode = mode;
  const f = document.getElementById("bGrpFirm"), l = document.getElementById("bGrpList");
  if (f) f.className = "btn sm " + (mode === "firm" ? "primary" : "outline");
  if (l) l.className = "btn sm " + (mode === "list" ? "primary" : "outline");
  brokerRowsHtml();
}
/* ---- Brokers: template / import / export / bulk delete (matches the broker database) ---- */
const BROKER_COLS = ["Broker Name", "Firm / Company", "Mobile Numbers", "Grade", "Team Size", "City", "Sector", "Address", "Connect Status", "Remark"];
const BROKER_SAMPLE = [["Amit Sharma", "Amit Realty LLP", "98100 11111, 98100 22222", "A", "12", "Gurugram", "Sector 57", "SCO 21, Sector 57", "Live", "Empanelled Jan 2026"]];
function brokerTemplate() {
  try {
    if (typeof XLSX === "undefined") throw new Error("no xlsx");
    const ws = XLSX.utils.aoa_to_sheet([BROKER_COLS, ...BROKER_SAMPLE]);
    ws["!cols"] = BROKER_COLS.map((h) => ({ wch: Math.max(14, h.length + 4) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Brokers");
    XLSX.writeFile(wb, "realtycrm-brokers-template.xlsx");
  } catch (e) {
    const csv = BROKER_COLS.join(",") + "\n" + BROKER_SAMPLE.map((r) => r.map((s) => `"${s}"`).join(",")).join("\n") + "\n";
    const b = new Blob([csv], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "realtycrm-brokers-template.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  toast("Broker template downloaded");
}
function brokerExport() {
  const rows = DB.brokers.map((b) => [b.name || "", b.firm || "", b.mobiles || "", b.grade || "", b.team_size || "", b.city || "", b.sector || "", b.address || "", b.connect || "", b.remark || ""]);
  const csv = [BROKER_COLS].concat(rows).map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const b = new Blob([csv], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "realtycrm-brokers-" + today() + ".csv"; a.click(); URL.revokeObjectURL(a.href); toast("Brokers exported");
}
function rowToBroker(row) {
  const name = (row["Broker Name"] || row.name || row.Name || "").toString().trim();
  if (!name) return null;
  return {
    name,
    firm: (row["Firm / Company"] || row.firm || row.Firm || "").toString().trim(),
    mobiles: (row["Mobile Numbers"] || row.mobiles || row.Mobile || "").toString().trim(),
    grade: ((row["Grade"] || row.grade || "").toString().trim().toUpperCase().charAt(0)) || "B",
    team_size: (row["Team Size"] || row.team_size || "").toString().trim(),
    city: (row["City"] || row.city || "").toString().trim(),
    sector: (row["Sector"] || row.sector || "").toString().trim(),
    address: (row["Address"] || row.address || "").toString().trim(),
    connect: /term/i.test(row["Connect Status"] || row.connect || "") ? "Terminate" : "Live",
    remark: (row["Remark"] || row.remark || "").toString().trim()
  };
}
function brokerImport() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xlsx,.xls,.csv";
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return; const isCsv = /\.csv$/i.test(f.name);
    if (!isCsv && typeof XLSX === "undefined") { toast("Spreadsheet engine still loading — wait a second and try again."); return; }
    const r = new FileReader();
    r.onerror = () => toast("Could not read that file — please try again.");
    r.onload = (ev) => {
      try {
        let rows = [];
        if (!isCsv) { rows = readSheetRows(ev.target.result); }
        else rows = parseCSV(String(ev.target.result));
        if (!rows.length) return toast("That sheet has no data rows. Use the Template format.");
        const news = [], dups = [];
        rows.forEach((row) => {
          const rec = rowToBroker(row); if (!rec) return;
          const key = firstNum(rec.mobiles);
          const existing = key ? DB.brokers.find((b) => firstNum(b.mobiles) === key) : null;
          if (existing) dups.push({ old: existing, neu: rec }); else news.push(rec);
        });
        news.forEach((r) => upsert("brokers", r));       // new brokers added straight away
        if (dups.length) openBrokerDupReview(dups, news.length);
        else { toast(news.length ? `Imported ${news.length} new broker(s)` : "No new brokers to import"); brokerRowsHtml(); }
      } catch (e) { console.error("Broker import failed:", e); toast("Import failed: " + ((e && e.message) || String(e)) + " — use the Template format."); }
    };
    if (isCsv) r.readAsText(f); else r.readAsArrayBuffer(f);
  };
  inp.click();
}
// Duplicate review: same mobile already exists → show Old vs New and let the user
// choose to update (override the old) or keep the old (discard the new) — per row.
function openBrokerDupReview(dups, addedCount) {
  const flds = [["name", "Name"], ["firm", "Firm"], ["grade", "Grade"], ["team_size", "Team"], ["city", "City"], ["sector", "Sector"], ["connect", "Connect"], ["remark", "Remark"]];
  const body = dups.map((d, i) => {
    const rowsH = flds.map(([k, lbl]) => {
      const diff = (d.old[k] || "") !== (d.neu[k] || "");
      return `<tr${diff ? ' style="background:#fffbeb"' : ""}><td class="fu-meta" style="white-space:nowrap">${lbl}</td><td>${esc(d.old[k]) || "—"}</td><td>${esc(d.neu[k]) || "—"}</td></tr>`;
    }).join("");
    return `<div class="card pad" style="margin-bottom:12px">
      <div style="font-weight:600;margin-bottom:8px">📱 ${esc(firstNum(d.neu.mobiles) || d.neu.mobiles)} <span class="fu-meta">— matches existing broker</span></div>
      <div class="table-wrap"><table style="font-size:12px"><thead><tr><th></th><th>Old (in CRM)</th><th>New (from file)</th></tr></thead><tbody>${rowsH}</tbody></table></div>
      <div style="margin-top:10px;display:flex;gap:16px">
        <label style="cursor:pointer"><input type="radio" name="dup${i}" value="update" checked> Update (replace old with new)</label>
        <label style="cursor:pointer"><input type="radio" name="dup${i}" value="keep"> Keep old (discard new)</label>
      </div>
    </div>`;
  }).join("");
  modal(`Review ${dups.length} duplicate broker(s)`, `
    <div class="fu-meta" style="margin-bottom:10px">${addedCount} new broker(s) added. The ones below already exist (matched by mobile) — choose what to do with each:</div>
    <div style="margin-bottom:12px;display:flex;gap:8px"><button class="btn outline sm" id="dupAllUpd">Update all</button><button class="btn outline sm" id="dupAllKeep">Keep all old</button></div>
    ${body}
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="dupApply">Apply</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("dupAllUpd").onclick = () => dups.forEach((_, i) => { const r = document.querySelector(`input[name="dup${i}"][value="update"]`); if (r) r.checked = true; });
  document.getElementById("dupAllKeep").onclick = () => dups.forEach((_, i) => { const r = document.querySelector(`input[name="dup${i}"][value="keep"]`); if (r) r.checked = true; });
  document.getElementById("dupApply").onclick = () => {
    let upd = 0;
    dups.forEach((d, i) => {
      const v = (document.querySelector(`input[name="dup${i}"]:checked`) || {}).value;
      if (v === "update") { upsert("brokers", Object.assign({}, d.neu, { id: d.old.id })); upd++; }  // override old, keep same record id
    });
    closeModal(); toast(`Import done: ${addedCount} new · ${upd} updated · ${dups.length - upd} kept`); brokerRowsHtml();
  };
}
function bulkDeleteBrokers() {
  const ids = selectedBulk("brokerRows").map(Number);
  if (!ids.length) return toast("Tick some rows first");
  if (!confirm(`Delete ${ids.length} selected broker(s)? This cannot be undone.`)) return;
  ids.forEach((id) => removeRow("brokers", id));
  toast(`Deleted ${ids.length}`); brokerRowsHtml();
}
function brokerRow(b) {
  const cnt = leadCountForBroker(b.name);
  return `<tr>
    <td><input type="checkbox" class="bulk" data-id="${b.id}"></td>
    <td class="nowrap"><span class="rowlink" data-profile="broker:${b.id}" style="font-weight:600">${esc(b.name)}</span>${cnt ? ` <span class="pill-active">Active</span>` : ""}</td>
    <td class="nowrap">${esc(b.firm) || "—"}</td>
    <td>${badge(b.grade)}</td><td>${esc(b.team_size) || "—"}</td>
    <td class="nowrap">${[b.city, b.sector].filter(Boolean).map(esc).join(" · ") || "—"}</td>
    <td>${cnt ? `<button type="button" class="chip-budget chip-click" data-brokerleads="${b.id}">${cnt} lead${cnt > 1 ? "s" : ""}</button>` : `<span class="muted">—</span>`}</td>
    <td>${badge(b.connect)}</td>
    <td class="nowrap fu-meta">${fmtDate(b.followup_at)}</td>
    <td class="right nowrap">
      <button class="btn primary sm" data-profile="broker:${b.id}">View</button>
      <button class="btn outline sm" data-act="editbroker" data-id="${b.id}">Edit</button>
      <button class="btn danger sm" data-act="delbroker" data-id="${b.id}">Del</button>
    </td></tr>`;
}

/* ---- Customer identity & 360 linking ----
   Every customer has a stable unique id (nextId). We display it as C-####.
   A customer's enquiries/units are matched by mobile number (the natural key),
   so one person's many enquiries, projects and booked units roll up together. */
function mobKey(m) { return String(m == null ? "" : m).replace(/\D/g, "").slice(-10); }
function custMobKeys(c) { return [c.mobile1, c.mobile2, c.mobile3].map(mobKey).filter((x) => x.length >= 10); }
function custUid(c) { return "C-" + String(c && c.id || 0).padStart(4, "0"); }
function leadsForCustomer(c) {
  if (!c) return [];
  const keys = new Set(custMobKeys(c));
  let ls = keys.size ? DB.leads.filter((l) => keys.has(mobKey(l.customer_mobile))) : [];
  if (!ls.length && c.name) { const nk = c.name.trim().toLowerCase(); if (nk) ls = DB.leads.filter((l) => (l.customer_name || "").trim().toLowerCase() === nk); }
  return ls.slice().sort((a, b) => b.id - a.id);
}
function customerForLead(l) { const k = mobKey(l && l.customer_mobile); if (!k) return null; return DB.customers.find((c) => custMobKeys(c).includes(k)) || null; }
function siblingLeads(l) { const k = mobKey(l && l.customer_mobile); if (!k) return [l]; return DB.leads.filter((x) => mobKey(x.customer_mobile) === k).sort((a, b) => b.id - a.id); }

function openCustomer360(id) {
  const c = DB.customers.find((x) => x.id === id); if (!c) return;
  const ls = leadsForCustomer(c);
  const activeN = ls.filter((l) => l.status === "Active").length;
  const booked = ls.filter((l) => l.status === "Booked");
  const projs = uniqList(ls.flatMap((l) => l.projects_shared || []));
  const initials = esc((c.name || "?").slice(0, 1).toUpperCase());
  const enqRows = ls.length ? ls.map((l) => `
    <div class="c360-enq rowlink" data-profile="lead:${l.id}">
      <div class="c360-enq-main"><span class="mono">${esc(l.lead_number || ("#" + l.id))}</span> <span class="c360-req">${esc(l.requirement) || "—"}</span>${l.budget ? ` <span class="chip-budget">${esc(l.budget)}</span>` : ""}${(l.projects_shared || []).length ? ` <span class="fu-meta">${esc((l.projects_shared || []).join(", "))}</span>` : ""}</div>
      <div class="c360-enq-side">${badge(l.stage)} ${badge(l.status)}</div>
    </div>`).join("") : `<div class="muted" style="font-size:13px">No enquiries linked to this customer yet.</div>`;
  const bookedRows = booked.length ? booked.map((l) => {
    const items = (l.projects_shared || []).map((n) => `<div class="pf-proj"><span class="pf-proj-name">${esc(n)}${(l.units || {})[n] ? ` <span class="pf-unit">Unit ${esc((l.units || {})[n])}</span>` : ""}</span><span class="pf-proj-cost">${esc((l.costing || {})[n] || "—")}</span></div>`).join("") || `<div class="muted" style="font-size:12px">Project not specified</div>`;
    return `<div class="c360-booked"><div class="c360-booked-hd"><span class="mono">${esc(l.lead_number || ("#" + l.id))}</span> ${badge("Booked")}</div>${items}</div>`;
  }).join("") : `<div class="muted" style="font-size:13px">No booked units yet.</div>`;
  const body = `<div class="pf c360">
    <div class="pf-header lead">
      <div class="pf-avatar"${c.image_url ? ` data-lightimg="${esc(c.image_url)}" style="cursor:zoom-in"` : ""}>${c.image_url ? `<img src="${esc(c.image_url)}" alt="">` : initials}</div>
      <div class="pf-htext">
        <div class="pf-name">${esc(c.name || "Customer")}</div>
        <div class="pf-sub"><span class="c360-uid">${custUid(c)}</span>${c.mobile1 ? " · " + esc(c.mobile1) : ""}${c.city ? " · " + esc(c.city) : ""}</div>
        <div class="pf-pills">${c.category ? `<span class="pf-pill b-default">${esc(c.category)}</span>` : ""}${c.rating ? `<span class="pf-pill b-default">${stars(c.rating)}</span>` : ""}</div>
      </div>
      <div class="pf-actions"><button class="btn light sm" id="c360Edit">Edit</button></div>
    </div>
    <div class="pf-body">
      <div class="pf-hero">
        ${heroCard(IC.link, "Enquiries", ls.length, "indigo")}
        ${heroCard(IC.flag, "Active", activeN, "amber")}
        ${heroCard(IC.money, "Booked", booked.length, "green")}
        ${heroCard(IC.home, "Projects", projs.length, "teal")}
      </div>
      <div class="pf-section-title">All Enquiries <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">— every enquiry from this customer</span></div>
      <div class="c360-enqs">${enqRows}</div>
      <div class="pf-section-title">Projects Shared</div>
      <div class="pf-projs">${projs.length ? projs.map((n) => `<div class="pf-proj"><span class="pf-proj-name">${esc(n)}</span></div>`).join("") : `<div class="muted" style="font-size:13px">None yet.</div>`}</div>
      <div class="pf-section-title">Booked Units</div>
      ${bookedRows}
    </div>
  </div>`;
  modal("Customer 360", body, true);
  const eb = document.getElementById("c360Edit"); if (eb) eb.onclick = () => { closeModal(); openCustomerForm(c); };
}

function viewCustomers() {
  return `<div class="card filters">
    <input type="text" class="search" id="cq" placeholder="Search name, mobile, city, profession…" />
    <select id="cCat"><option value="">All categories</option>${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>
    <select id="cFut"><option value="">Contact: all</option><option value="1">Contact in future</option><option value="0">Do not contact</option></select>
    <select id="cRate"><option value="">All ratings</option>${["5", "4", "3", "2", "1"].map((r) => `<option value="${r}">${r}★ &amp; up</option>`).join("")}</select>
  </div><div id="custMeta" class="cust-meta"></div><div id="custGrid" class="cust-grid"></div><div id="custEmpty"></div>`;
}
function custRowsHtml() {
  const q = (document.getElementById("cq")?.value || "").toLowerCase();
  const cat = document.getElementById("cCat")?.value || "";
  const fut = document.getElementById("cFut")?.value || "";
  const rate = Number(document.getElementById("cRate")?.value || 0);
  const rows = all("customers").filter((c) =>
    (!q || `${c.name} ${c.mobile1} ${c.mobile2} ${c.mobile3} ${c.email} ${c.city} ${c.profession}`.toLowerCase().includes(q)) &&
    (!cat || c.category === cat) &&
    (!fut || String(c.contact_future ?? 1) === fut) &&
    (!rate || Number(c.rating || 0) >= rate));
  const meta = document.getElementById("custMeta");
  if (meta) meta.innerHTML = `Showing ${rows.length} of ${DB.customers.length} · ${rows.filter((c) => Number(c.contact_future ?? 1)).length} marked contact-in-future`;
  document.getElementById("custEmpty").innerHTML = rows.length ? "" : `<div class="empty">No customers match these filters.</div>`;
  document.getElementById("custGrid").innerHTML = rows.map((c) => `
    <div class="card pad">
      <div style="display:flex;gap:12px;">
        <div class="avatar"${c.image_url ? ` data-lightimg="${esc(c.image_url)}" style="cursor:zoom-in"` : ""}>${c.image_url ? `<img src="${esc(c.image_url)}" alt="">` : esc((c.name || "?").slice(0, 1).toUpperCase())}</div>
        <div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="rowlink" data-profile="customer:${c.id}" style="font-weight:600">${esc(c.name)}</span><span class="c360-uid">${custUid(c)}</span></div><div class="fu-meta">${esc(c.mobile1)}${c.city ? " · " + esc(c.city) : ""}</div>
          <div style="margin-top:5px;display:flex;gap:8px;align-items:center;">${c.category ? badge(c.category) : ""}${c.rating ? stars(c.rating) : ""}${(() => { const n = leadsForCustomer(c).length; return n ? `<span class="c360-enqpill">${n} enquir${n === 1 ? "y" : "ies"}</span>` : ""; })()}</div></div>
      </div>
      ${c.profession ? `<div style="margin-top:10px;" class="fu-meta">Profession: ${esc(c.profession)}</div>` : ""}
      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
        <span class="badge ${Number(c.contact_future ?? 1) ? "b-Live" : "b-Inactive"}">${Number(c.contact_future ?? 1) ? "Contact in future" : "Do not contact"}</span>
        <div><button class="btn primary sm" data-act="cust360" data-id="${c.id}">360 ›</button><button class="btn outline sm" data-act="editcust" data-id="${c.id}">Edit</button><button class="btn danger sm" data-act="delcust" data-id="${c.id}">Del</button></div>
      </div></div>`).join("");
}

function viewProjects() { return `<div id="projGrid" class="cust-grid"></div><div id="projEmpty"></div>`; }
function projRowsHtml() {
  const rows = all("projects");
  document.getElementById("projEmpty").innerHTML = rows.length ? "" : `<div class="empty">No projects yet. Add your first project so it appears in the enquiry project selector.</div>`;
  document.getElementById("projGrid").innerHTML = rows.map((p) => {
    const total = Number(p.total_units) || 0, avail = Number(p.available_units) || 0, sold = Math.max(0, total - avail), pct = total ? Math.round((sold / total) * 100) : 0;
    return `<div class="card pad">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><div style="font-weight:600">${esc(p.name)}</div><div class="fu-meta">${[p.type, p.location].filter(Boolean).map(esc).join(" · ")}</div></div>${badge(p.status || "Live")}</div>
      <div style="margin-top:10px;font-size:13px;color:#475569;">Price: <b>${[p.price_min, p.price_max].filter(Boolean).map(esc).join(" – ") || "—"}</b></div>
      ${total ? `<div style="margin-top:10px;"><div style="display:flex;justify-content:space-between;" class="fu-meta"><span>${avail} available</span><span>${sold}/${total} sold</span></div><div class="progress" style="margin-top:4px"><div style="width:${pct}%"></div></div></div>` : ""}
      ${p.notes ? `<div style="margin-top:8px;" class="fu-meta">${esc(p.notes)}</div>` : ""}
      <div style="margin-top:12px;text-align:right;"><button class="btn outline sm" data-act="editproj" data-id="${p.id}">Edit</button><button class="btn danger sm" data-act="delproj" data-id="${p.id}">Del</button></div>
    </div>`;
  }).join("");
}

/* ---------- Reports & Analysis (CEO view) ---------- */
let reportOpts = { from: "", to: "", gran: "month" };
let reportView = "overview";
let reportFilters = {};
let matchCriteria = { requirement: "", budgetMin: "", budgetMax: "", project: "", etype: "", unitId: "", unitText: "" };
// Inventory units for the Match Finder "Project / Unit no" finder (loaded from the shared website store).
let _mfUnits = [], _mfUnitsLoaded = false;
async function loadMfUnits() {
  if (_mfUnitsLoaded) return;
  const S = WS(); if (!S) return;
  try { _mfUnits = await S.inventory(); _mfUnitsLoaded = true; if (reportView === "match") renderReportBody(); } catch (e) {}
}
// True when a lead's budget band falls within the [minBand, maxBand] window (either end optional).
function budgetBandInRange(band, minBand, maxBand) {
  if (!minBand && !maxBand) return true;
  const bi = BUDGETS.indexOf(band); if (bi < 0) return false;
  const a = minBand ? BUDGETS.indexOf(minBand) : 0;
  const b = maxBand ? BUDGETS.indexOf(maxBand) : BUDGETS.length - 1;
  return bi >= Math.min(a, b) && bi <= Math.max(a, b);
}
// Fill each project row's unit-no datalist in the enquiry form from live inventory.
async function loadLeadFormUnits() {
  const dls = document.querySelectorAll("datalist[data-uproj]");
  if (!dls.length) return;
  const S = WS(); let units = _mfUnits;
  if ((!units || !units.length) && S) { try { units = await S.inventory(); _mfUnits = units; _mfUnitsLoaded = true; } catch (e) { units = []; } }
  units = units || [];
  dls.forEach((dl) => {
    const np = (dl.getAttribute("data-uproj") || "").toLowerCase();
    const opts = units.filter((u) => { const up = (u.project || "").toLowerCase(); return up && (up === np || up.includes(np) || np.includes(up)); })
      .map((u) => `<option value="${esc(u.unitNo)}">${esc([u.size, u.status, u.costingCr ? crLabel(u.costingCr) : ""].filter(Boolean).join(" · "))}</option>`).join("");
    dl.innerHTML = opts;
  });
}
// Map a unit's costing (in Cr) to the matching budget band.
function crToBudgetBand(cr) {
  const n = toCr(cr); if (!n) return "";
  if (n < 2) return "Below 2 Cr";
  if (n < 2.5) return "2-2.5 Cr";
  if (n < 3) return "2.5-3 Cr";
  if (n < 3.5) return "3-3.5 Cr";
  if (n < 4) return "3.5-4 Cr";
  if (n < 5) return "4-5 Cr";
  return "5 Cr+";
}
const RF_LABELS = { stage: "Stage", requirement: "Requirement", budget: "Budget", source_type: "Source type", source: "Source / CP", city: "City", category: "Category", profession: "Profession", grade: "Grade", rating: "Rating", status: "Status", etype: "Enquiry type", project: "Project" };
const REPORT_TABS = [["overview", "Overview"], ["brokers", "Channels / Brokers"], ["enquiries", "Enquiries"], ["sources", "Sources"], ["projects", "Projects"], ["customers", "Customers"], ["match", "Match Finder"]];
const GRANS = [["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"], ["quarter", "Quarterly"], ["half", "Half-yearly"], ["year", "Annually"]];

function pad2(n) { return String(n).padStart(2, "0"); }
function periodKey(ds, gran) {
  if (!ds) return "—";
  const p = ds.slice(0, 10).split("-").map(Number), y = p[0], m = p[1] || 1, d = p[2] || 1;
  if (gran === "day") return ds.slice(0, 10);
  if (gran === "month") return `${y}-${pad2(m)}`;
  if (gran === "quarter") return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  if (gran === "half") return `${y}-H${m <= 6 ? 1 : 2}`;
  if (gran === "year") return `${y}`;
  if (gran === "week") { const dt = new Date(y, m - 1, d), jan = new Date(y, 0, 1); const w = Math.ceil((((dt - jan) / 86400000) + jan.getDay() + 1) / 7); return `${y}-W${pad2(w)}`; }
  return ds.slice(0, 10);
}
function bucketCounts(items, dateFn, gran) {
  const m = {};
  items.forEach((it) => { const ds = dateFn(it); if (!ds) return; const k = periodKey(ds, gran); m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
function topEntries(arr, n) {
  const m = {}; arr.forEach((v) => { const s = (v || "").toString().trim(); if (s) m[s] = (m[s] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n || 8);
}
function uniqList(a) { return [...new Set(a)]; }
function dedupeByName(arr) { const seen = new Set(); return arr.filter((x) => { const k = (x.name || "").trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); }
function firmOf(cp) { const b = DB.brokers.find((x) => (x.name || "").trim().toLowerCase() === (cp || "").trim().toLowerCase()); return b ? (b.firm || "") : ""; }
function firmOfLead(l) { const cp = (l.source_name || "").trim(); return (l.source_firm || firmOf(cp) || cp || "").trim(); }

function filteredLeads() {
  const { from, to } = reportOpts;
  if (!from && !to) return DB.leads;
  return DB.leads.filter((l) => { const dt = l.lead_date || (l.created_at || "").slice(0, 10); if (from && dt < from) return false; if (to && dt > to) return false; return true; });
}
function reportLeads() {
  const f = reportFilters;
  return filteredLeads().filter((l) =>
    (!f.stage || l.stage === f.stage) && (!f.requirement || l.requirement === f.requirement) && (!f.budget || l.budget === f.budget) &&
    (!f.source_type || l.source_type === f.source_type) && (!f.source || (l.source_name || "") === f.source) &&
    (!f.city || (l.customer_city || "") === f.city) && (!f.category || (l.customer_category || "") === f.category) &&
    (!f.rating || l.rating === f.rating) && (!f.status || l.status === f.status) &&
    (!f.etype || l.enquiry_type === f.etype) && (!f.project || (l.projects_shared || []).includes(f.project)));
}
function reportBrokersSet() { const f = reportFilters; return DB.brokers.filter((b) => (!f.grade || b.grade === f.grade) && (!f.city || (b.city || "") === f.city)); }
function reportCustomersSet() { const f = reportFilters; return DB.customers.filter((c) => (!f.city || (c.city || "") === f.city) && (!f.profession || (c.profession || "") === f.profession) && (!f.category || (c.category || "") === f.category)); }

function renderReportBody() { const b = document.getElementById("reportBody"); if (b) { b.innerHTML = reportBodyHtml(); if (reportView === "match") bindMatch(); } }
function toggleReportFilter(raw) { const i = raw.indexOf(":"); const dim = raw.slice(0, i), val = raw.slice(i + 1); if (reportFilters[dim] === val) delete reportFilters[dim]; else reportFilters[dim] = val; renderReportBody(); }
function reportFilterBar() {
  const ks = Object.keys(reportFilters);
  if (!ks.length) return `<div class="rf-hint muted">Tip: click any bar, card or row-tag to cross-filter every visual on this report.</div>`;
  return `<div class="rf-bar"><span class="rf-bar-label">Cross-filters</span>${ks.map((k) => `<span class="rf-chip">${RF_LABELS[k] || k}: <b>${esc(reportFilters[k])}</b><button data-rfremove="${k}" aria-label="remove">×</button></span>`).join("")}<button class="btn ghost sm" data-rfclear>Clear all</button></div>`;
}

/* chart + layout helpers */
function repCard(v, label, sub, color) { return `<div class="rep-kpi d-${color}"><div class="rep-kpi-v">${v}</div><div class="rep-kpi-k">${label}</div>${sub ? `<div class="rep-kpi-s">${sub}</div>` : ""}</div>`; }
function repTile(v, label, sub, color, rf) {
  const dim = rf ? rf.split(":")[0] : "", val = rf ? rf.slice(rf.indexOf(":") + 1) : "";
  const active = rf && reportFilters[dim] === val ? " rf-active" : "";
  const cls = rf ? " tile-click rf-click" : "";
  const attr = rf ? ` data-rf="${rf}"` : "";
  return `<div class="rep-kpi d-${color}${cls}${active}"${attr}><div class="rep-kpi-v">${v}</div><div class="rep-kpi-k">${label}</div>${sub ? `<div class="rep-kpi-s">${sub}</div>` : ""}</div>`;
}
function repTileRaw(v, label, sub, color, attr, active) {
  return `<div class="rep-kpi d-${color} tile-click${active ? " rf-active" : ""}" ${attr}><div class="rep-kpi-v">${v}</div><div class="rep-kpi-k">${label}</div>${sub ? `<div class="rep-kpi-s">${sub}</div>` : ""}</div>`;
}
function cpCell(l) {
  const cp = (l.source_name || "").trim();
  if (!cp) return `<span class="muted">—</span>`;
  const bk = DB.brokers.find((b) => (b.name || "").trim().toLowerCase() === cp.toLowerCase());
  const firm = l.source_firm || (bk ? bk.firm : "");
  const sub = [firm ? esc(firm) : "", l.source_mobile ? telLink(l.source_mobile) : ""].filter(Boolean).join(" · ");
  const name = bk ? `<span class="rowlink" data-profile="broker:${bk.id}">${esc(cp)}</span>` : `<b>${esc(cp)}</b>`;
  return `${name}${sub ? `<div class="fu-meta">${sub}</div>` : ""}`;
}
function repLeadTable(L, limit) {
  return repTable(["Lead #", "Customer", "Source / CP", "Requirement", "Budget", "Stage", "Rating", "Status", ""],
    L.slice().sort((a, b) => b.id - a.id).slice(0, limit || 60).map((l) => [`<span class="mono">${esc(l.lead_number)}</span>`, `<span class="rowlink" data-profile="lead:${l.id}">${esc(l.customer_name) || "—"}</span><div class="fu-meta">${telLink(l.customer_mobile)}</div>`, cpCell(l), esc(l.requirement) || "—", `<span class="chip-budget">${esc(l.budget) || "—"}</span>`, esc(l.stage) || "—", badge(l.rating), badge(l.status), `<button class="btn drill-open sm" data-profile="lead:${l.id}">Open ›</button>`]),
    "No enquiries in this selection.");
}
function hbars(data, color, rf) {
  const mx = Math.max(1, ...data.map((d) => d[1]));
  if (!data.length) return `<div class="muted" style="font-size:13px;padding:8px 0">No data yet.</div>`;
  return `<div class="hbars">${data.map((d) => { const act = rf && reportFilters[rf] === d[0] ? " rf-active" : ""; const attr = rf ? ` data-rf="${rf}:${esc(d[0])}"` : ""; const cls = rf ? " rf-click" : ""; return `<div class="hbar-row${cls}${act}"${attr}><div class="hbar-label" title="${esc(d[0])}">${esc(d[0])}</div><div class="hbar-track"><div class="hbar-fill" style="width:${Math.round((d[1] / mx) * 100)}%;background:linear-gradient(90deg, ${color}cc, ${color})"></div></div><div class="hbar-val">${d[1]}</div></div>`; }).join("")}</div>`;
}
function repSection(num, title, color, inner) { return `<div class="card pad rep-section"><div class="rep-head"><span class="rep-badge d-${color}">${num}</span><h3>${title}</h3></div>${inner}</div>`; }
function tagchips(arr, cls) { return arr.length ? arr.map((t) => `<span class="tagchip ${cls || ""}">${esc(t)}</span>`).join(" ") : `<span class="muted">—</span>`; }
function repTable(headers, rows, empty) {
  if (!rows.length) return `<div class="muted" style="padding:14px 4px">${empty || "No records."}</div>`;
  return `<div class="table-wrap drill-table"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function repInsight(txt) { return `<div class="rep-insight"><span class="rep-insight-k">Key insight</span> ${txt}</div>`; }
function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function leadsOfBroker(name, set) { const n = (name || "").trim().toLowerCase(); return (set || reportLeads()).filter((l) => (l.source_name || "").trim().toLowerCase() === n); }

/* ---- OVERVIEW ---- */
function repOverview() {
  const L = reportLeads(), B = reportBrokersSet(), C = reportCustomersSet();
  const cnt = (a, k, v) => a.filter((x) => (x[k] || "") === v).length;
  const booked = cnt(L, "status", "Booked"), active = cnt(L, "status", "Active");
  const activeCh = B.filter((b) => leadsOfBroker(b.name, L).length).length;
  const noFilter = Object.keys(reportFilters).length === 0;
  const kpis = `<div class="rep-hero rep-hero-4">
    ${repTileRaw(L.length, "Total Enquiries", active + " active · show all", "indigo", `data-rfclear`, noFilter)}
    ${repTile(booked, "Booked", pct(booked, L.length) + "% conversion", "green", "status:Booked")}
    ${repTileRaw(activeCh + "/" + B.length, "Active Channels", "via channel partner", "teal", `data-rf="source_type:CP"`, reportFilters.source_type === "CP")}
    ${repTileRaw(C.length, "Customers", cnt(C, "category", "Investor") + " investors · open tab", "amber", `data-gotab="customers"`, false)}</div>`;
  const rat = `<div class="rep-subhead" style="margin-top:16px">Lead temperature <span class="rep-hint">· click a tile to see the leads below</span></div><div class="rep-hero rep-hero-sm rep-hero-3">
    ${repTile(cnt(L, "rating", "Hot"), "Hot", "priority", "red", "rating:Hot")}
    ${repTile(cnt(L, "rating", "Warm"), "Warm", "nurture", "amber", "rating:Warm")}
    ${repTile(cnt(L, "rating", "Cold"), "Cold", "long term", "blue", "rating:Cold")}</div>`;
  const stg = `<div class="rep-subhead" style="margin-top:16px">Pipeline stage <span class="rep-hint">· click a tile to see the leads below</span></div><div class="rep-hero rep-hero-5">
    ${STAGES.map((sn) => repTile(cnt(L, "stage", sn), sn, "", "indigo", "stage:" + sn)).join("")}</div>`;
  const projCP = DB.projects.map((p) => { const ls = L.filter((l) => (l.projects_shared || []).includes(p.name)); const firms = uniqList(ls.map((l) => firmOfLead(l)).filter(Boolean)); const top = topEntries(ls.map((l) => firmOfLead(l)), 1); return { name: p.name, n: ls.length, cps: firms.length, top: top[0] ? top[0][0] : "—" }; }).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  const projChip = (r, v) => `<button type="button" class="chip-open rf-click${reportFilters.project === r.name ? " rf-active" : ""}" data-rf="project:${esc(r.name)}">${v}</button>`;
  const projTable = repTable(["Project", "Enquiries", "Unique CP Firms", "Top CP Firm"], projCP.map((r) => [`<b>${esc(r.name)}</b>`, projChip(r, r.n), projChip(r, r.cps), esc(r.top)]), "No project-linked enquiries yet.");
  const sel = Object.keys(reportFilters);
  const tsHead = sel.length ? `<span class="rep-hint">· filtered by ${sel.map((k) => RF_LABELS[k] || k).join(", ")}</span>` : `<span class="rep-hint">· showing all — click any tile above to narrow</span>`;
  const inner = kpis + rat + stg +
    `<div class="rep-subhead" style="margin-top:18px">Project-wise Active CP <span class="rep-hint">· click a number to filter</span></div>` + projTable +
    `<div class="rep-subhead" style="margin-top:18px">Selected enquiries ${tsHead}</div>` + repLeadTable(L) +
    repInsight(`${pct(booked, L.length)}% conversion across ${L.length} enquiries; ${activeCh} of ${B.length} channels producing. Click any tile to drill into the exact leads.`);
  return repSection("00", "Executive Overview", "indigo", inner);
}

/* ---- CHANNELS / BROKERS ---- */
// Firm-grouped, expandable channel view for the report — mirrors the Brokers page.
// Each firm expands to its CPs; each CP expands to their enquiry details. Producing
// firms sort first. A 📊 360 button opens the full working report for firm or CP.
function repReportFirms(L, B) {
  const groups = {};
  B.forEach((b) => { const k = (b.firm || "").trim() || "— No firm —"; (groups[k] = groups[k] || []).push(b); });
  const firmLeadCount = (firm) => L.filter((l) => creditedFirm(l).toLowerCase() === firm.toLowerCase()).length;
  const names = Object.keys(groups).sort((a, b) => firmLeadCount(b) - firmLeadCount(a) || groups[b].length - groups[a].length || a.localeCompare(b));
  const cards = names.map((firm) => {
    const list = groups[firm].slice().sort((a, b) => leadsOfBroker(b.name, L).length - leadsOfBroker(a.name, L).length || (a.name || "").localeCompare(b.name || ""));
    const live = list.filter((x) => x.connect === "Live").length;
    const grade = firmGrade(firm);
    const fLeads = firmLeadCount(firm);
    const emp = list.map((b) => {
      const ls = leadsOfBroker(b.name, L).slice().sort((x, y) => y.id - x.id);
      const active = ls.filter((l) => l.status === "Active").length;
      const enq = ls.length ? ls.map((l) => `<div class="rep-emp-enq rowlink" data-profile="lead:${l.id}">${badge(l.status)} <b>${esc(l.customer_name) || esc(l.lead_number)}</b> <span class="fu-meta">${telLink(l.customer_mobile)}</span> · ${esc(l.requirement) || "—"}${l.budget ? ` <span class="chip-budget">${esc(l.budget)}</span>` : ""} · ${esc((l.projects_shared || []).join(", ")) || "—"} <span class="fu-meta">${esc(l.lead_date) || ""}</span></div>`).join("") : `<div class="rep-emp-empty">No enquiry brought in this period.</div>`;
      return `<details class="rep-emp"><summary class="rep-emp-head"><span class="firm-chev">▸</span><span class="rowlink" data-profile="broker:${b.id}">${esc(b.name)}</span> ${badge(b.connect)}${ls.length ? `<span class="rep-emp-count">${ls.length} enq${active ? ` · ${active} active` : ""}</span>` : `<span class="rep-emp-none">never brought</span>`}<span class="rep-emp-actions"><button type="button" class="btn ghost sm" data-cp360="${esc(b.name)}">📊 360</button></span></summary><div class="rep-emp-body">${enq}</div></details>`;
    }).join("");
    return `<details class="firm-card rep-firm-card"${fLeads ? " open" : ""}><summary class="firm-head"><span class="firm-chev">▸</span><span class="firm-name">${esc(firm)}</span>${grade ? `<span class="firm-grade">Grade ${badge(grade)}</span>` : ""}<span class="firm-badge">${list.length} broker${list.length > 1 ? "s" : ""}</span><span class="firm-meta">${live} live${fLeads ? ` · ${fLeads} enquir${fLeads === 1 ? "y" : "ies"}` : " · no enquiry"}</span><span class="firm-add-wrap">${firm !== "— No firm —" ? `<button type="button" class="btn ghost sm" data-firm360="${esc(firm)}">📊 360 Report</button>` : ""}</span></summary><div class="firm-body">${emp}</div></details>`;
  }).join("");
  return cards || `<div class="empty">No channels in this scope.</div>`;
}
function repBrokers() {
  const L = reportLeads(), B = dedupeByName(reportBrokersSet()), t = today(), wk = addDays(-7), mo = addDays(-30);
  const cnt = (a, k, v) => a.filter((x) => (x[k] || "") === v).length;
  const lastDate = (ls) => ls.map((l) => l.lead_date || (l.created_at || "").slice(0, 10)).filter(Boolean).sort().slice(-1)[0] || "";
  const monthsSince = (ds) => { if (!ds) return ""; return Math.max(0, Math.round((new Date(t) - new Date(ds)) / (86400000 * 30))); };
  const rows = B.map((b) => ({ b, ls: leadsOfBroker(b.name, L) }));
  const withEnq = rows.filter((x) => x.ls.length).sort((a, b) => b.ls.length - a.ls.length);
  const never = rows.filter((x) => !x.ls.length);
  const inactive = withEnq.filter((x) => x.b.connect === "Terminate" || monthsSince(lastDate(x.ls)) >= 3);
  const newToday = B.filter((b) => (b.created_at || "").slice(0, 10) === t).length;
  const newWeek = B.filter((b) => (b.created_at || "").slice(0, 10) >= wk).length;
  const newMonth = B.filter((b) => (b.created_at || "").slice(0, 10) >= mo).length;

  const kpis = `<div class="rep-hero rep-hero-sm">
    ${repCard(B.length, "Total Channels", "", "indigo")}
    ${repCard(cnt(B, "connect", "Live"), "Live", "", "green")}
    ${repCard(cnt(B, "connect", "Terminate"), "Terminated", "", "gray")}
    ${repCard(withEnq.length, "Active (with enquiry)", "", "teal")}</div>
    <div class="rep-hero rep-hero-sm" style="margin-top:12px">
    ${repCard(never.length, "Never brought enquiry", "", "red")}
    ${repCard(inactive.length, "Had enquiry · now idle", "3m+ / terminated", "amber")}
    ${repCard(newWeek, "New this week", newToday + " today", "blue")}
    ${repCard(newMonth, "New this month", "empanelled", "teal")}</div>`;

  const gradeDist = GRADES.map((g) => [g, cnt(B, "grade", g)]);
  const cityDist = topEntries(B.map((b) => b.city));
  const sectorDist = topEntries(B.map((b) => b.sector));
  const activityTs = bucketCounts(L.filter((l) => l.source_name), (l) => l.lead_date || (l.created_at || "").slice(0, 10), reportOpts.gran);
  const empanelTs = bucketCounts(B, (b) => (b.created_at || "").slice(0, 10), reportOpts.gran);
  const charts = `<div class="rep-grid2" style="margin-top:8px">
    <div><div class="rep-subhead">Channels by grade <span class="rep-hint">· click to filter</span></div>${barChart(gradeDist, "#0ea5e9", null, "grade")}</div>
    <div><div class="rep-subhead">Channel activity over time (${granLabel()})</div>${barChart(activityTs, "#10b981")}</div></div>
    <div class="rep-grid2" style="margin-top:16px">
    <div><div class="rep-subhead">By city <span class="rep-hint">· click to filter</span></div>${hbars(cityDist, "#4f46e5", "city")}</div>
    <div><div class="rep-subhead">By sector</div>${hbars(sectorDist, "#7c3aed")}</div></div>
    <div class="rep-grid2" style="margin-top:16px"><div><div class="rep-subhead">New empanelment over time (${granLabel()})</div>${barChart(empanelTs, "#f59e0b")}</div><div></div></div>`;

  const nm = (b) => `<span class="rowlink" data-profile="broker:${b.id}">${esc(b.name)}</span>`;
  const activeRows = withEnq.map((x) => { const bk = x.ls.filter((l) => l.status === "Booked").length, ac = x.ls.filter((l) => l.status === "Active").length, ic = x.ls.filter((l) => l.status === "Inactive").length; const projs = uniqList(x.ls.flatMap((l) => l.projects_shared || [])); const reqs = uniqList(x.ls.map((l) => l.requirement).filter(Boolean)); const last = lastDate(x.ls); return [`${nm(x.b)}<div class="fu-meta">${esc(x.b.firm || "")}</div>`, esc(x.b.city) || "—", esc(x.b.sector) || "—", badge(x.b.grade), badge(x.b.connect), `<button type="button" class="chip-budget chip-click" data-brokerleads="${x.b.id}">${x.ls.length}</button>`, bk || "—", ac || "—", ic || "—", tagchips(projs, "indigo"), tagchips(reqs, "purple"), `<span class="nowrap">${esc(last) || "—"}</span>`, `${monthsSince(last)} mo`]; });
  const activeTable = repTable(["Channel", "City", "Sector", "Grade", "Connect", "Leads", "Booked", "Active", "Inactive", "Projects", "Requirements", "Last enquiry", "Idle"], activeRows, "No channel has brought an enquiry in this scope.");

  const idleRows = inactive.map((x) => { const last = lastDate(x.ls); return [nm(x.b), badge(x.b.grade), `<button type="button" class="chip-budget chip-click" data-brokerleads="${x.b.id}">${x.ls.length}</button>`, esc(last) || "—", `${monthsSince(last)} mo`, badge(x.b.connect)]; });
  const idleTable = repTable(["CP", "Grade", "Leads", "Last enquiry", "Idle", "Connect"], idleRows, "No idle channels — all producers are recent.");

  const neverRows = never.map((x) => [nm(x.b), esc(x.b.firm) || "—", badge(x.b.grade), esc(x.b.city) || "—", (x.b.created_at || "").slice(0, 10) || "—"]);
  const neverTable = repTable(["CP", "Firm", "Grade", "City", "Empanelled"], neverRows, "Every channel has produced at least one enquiry.");

  const recent = B.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 10);
  const newRows = recent.map((b) => [nm(b), esc(b.firm) || "—", badge(b.grade), (b.created_at || "").slice(0, 16).replace("T", " "), periodKey((b.created_at || "").slice(0, 10), reportOpts.gran)]);
  const newTable = repTable(["CP", "Firm", "Grade", "Empanelled on", granLabel()], newRows, "No channels empanelled yet.");

  const inner = kpis + charts +
    `<div class="rep-subhead" style="margin-top:18px">Firms — expand for CPs &amp; their enquiries <span class="rep-hint">· producing firms first · 📊 360 for full report</span></div>` + repReportFirms(L, B) +
    `<div class="rep-subhead" style="margin-top:18px">Active channels — status-wise &amp; project-wise</div>` + activeTable +
    `<div class="rep-subhead" style="margin-top:18px">Had enquiry but now idle (3m+ or terminated)</div>` + idleTable +
    `<div class="rep-subhead" style="margin-top:18px">Channels who never brought an enquiry</div>` + neverTable +
    `<div class="rep-subhead" style="margin-top:18px">Newly empanelled channels</div>` + newTable +
    repInsight(`${withEnq.length} of ${B.length} channels are producing${withEnq.length ? `; top is <b>${esc(withEnq[0].b.name)}</b> with ${withEnq[0].ls.length} enquiry(s)` : ""}. <b>${never.length}</b> have never brought a lead and <b>${inactive.length}</b> have gone idle — prime for re-engagement.`);
  return repSection("B", "Channel / Broker Analysis", "teal", inner);
}

/* ---- ENQUIRIES ---- */
function repEnquiries() {
  const L = reportLeads();
  const cnt = (k, v) => L.filter((x) => (x[k] || "") === v).length;
  const kpis = `<div class="rep-hero rep-hero-sm">
    ${repCard(L.length, "Total Enquiries", "", "indigo")}
    ${repCard(cnt("status", "Active"), "Active", "", "green")}
    ${repCard(cnt("status", "Booked"), "Booked", pct(cnt("status", "Booked"), L.length) + "%", "blue")}
    ${repCard(cnt("rating", "Hot"), "Hot", "priority", "red")}</div>`;
  const byReq = REQUIREMENTS.map((r) => [r, cnt("requirement", r)]).filter((x) => x[1]);
  const byBud = BUDGETS.map((b) => [b, cnt("budget", b)]).filter((x) => x[1]);
  const byType = ENQUIRY_TYPES.map((e) => [e, cnt("enquiry_type", e)]).filter((x) => x[1]);
  const byStage = STAGES.map((s) => [s, cnt("stage", s)]);
  const byRating = RATINGS.map((r) => [r, cnt("rating", r)]).filter((x) => x[1]);
  const byStatus = STATUSES.map((s) => [s, cnt("status", s)]).filter((x) => x[1]);
  const ts = bucketCounts(L, (l) => l.lead_date || (l.created_at || "").slice(0, 10), reportOpts.gran);
  const inner = kpis +
    `<div class="rep-grid2" style="margin-top:16px"><div><div class="rep-subhead">Interest · requirement <span class="rep-hint">· click</span></div>${hbars(byReq, "#7c3aed", "requirement")}</div><div><div class="rep-subhead">Interest · budget band <span class="rep-hint">· click</span></div>${hbars(byBud, "#4f46e5", "budget")}</div></div>` +
    `<div class="rep-grid2" style="margin-top:16px"><div><div class="rep-subhead">Enquiry type <span class="rep-hint">· click</span></div>${hbars(byType, "#0ea5e9", "etype")}</div><div><div class="rep-subhead">Pipeline stage <span class="rep-hint">· click</span></div>${barChart(byStage, "#4f46e5", null, "stage")}</div></div>` +
    `<div class="rep-grid2" style="margin-top:16px"><div><div class="rep-subhead">Rating <span class="rep-hint">· click</span></div>${hbars(byRating, "#ef4444", "rating")}</div><div><div class="rep-subhead">Status <span class="rep-hint">· click</span></div>${hbars(byStatus, "#10b981", "status")}</div></div>` +
    `<div class="rep-grid2" style="margin-top:16px"><div><div class="rep-subhead">Enquiries over time (${granLabel()})</div>${barChart(ts, "#6366f1")}</div><div></div></div>` +
    repInsight(`Most sought: <b>${byReq.sort((a, b) => b[1] - a[1])[0] ? esc(byReq[0][0]) : "—"}</b>. Budget concentration and stage mix above update live with any filter.`);
  return repSection("E", "Enquiry Analysis · interest, budget, type &amp; pipeline", "indigo", inner);
}

/* ---- SOURCES ---- */
function repSources() {
  const L = reportLeads();
  const cp = L.filter((l) => l.source_type === "CP").length, ref = L.filter((l) => l.source_type === "Reference").length;
  const split = `<div class="rep-split" style="max-width:520px">
    <div class="rep-splitcard d-teal rf-click${reportFilters.source_type === "CP" ? " rf-active" : ""}" data-rf="source_type:CP"><div class="rep-splitv">${cp}</div><div class="rep-splitk">via Channel Partner</div></div>
    <div class="rep-splitcard d-amber rf-click${reportFilters.source_type === "Reference" ? " rf-active" : ""}" data-rf="source_type:Reference"><div class="rep-splitv">${ref}</div><div class="rep-splitk">via Reference</div></div></div>`;
  const srcMap = {}; L.forEach((l) => { const s = (l.source_name || "").trim(); if (s) (srcMap[s] = srcMap[s] || []).push(l); });
  const srcRows = Object.entries(srcMap).sort((a, b) => b[1].length - a[1].length).map(([name, ls]) => { const bk = ls.filter((l) => l.status === "Booked").length; return [`<button type="button" class="chip-open rf-click${reportFilters.source === name ? " rf-active" : ""}" data-rf="source:${esc(name)}">${esc(name)}</button>`, `<span class="chip-budget">${ls.length}</span>`, bk || "—", pct(bk, ls.length) + "%", ls[0] && ls[0].source_type ? badge(ls[0].source_type === "CP" ? "A" : "B").replace(/>A<|>B</, ">" + (ls[0].source_type) + "<") : "—"]; });
  const table = repTable(["Source / CP", "Enquiries", "Booked", "Conversion", "Type"], srcRows, "No sources recorded.");
  const top = Object.entries(srcMap).map(([n, ls]) => [n, ls.length]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const inner = `<div class="rep-subhead">Source of leads <span class="rep-hint">· click to filter</span></div>` + split +
    `<div class="rep-subhead" style="margin-top:16px">Top sources</div>${hbars(top, "#0ea5e9", "source")}` +
    `<div class="rep-subhead" style="margin-top:16px">Source performance &amp; conversion</div>` + table +
    repInsight(`${pct(cp, L.length)}% of enquiries come through channel partners${top.length ? `; strongest is <b>${esc(top[0][0])}</b> (${top[0][1]} enquiries)` : ""}.`);
  return repSection("S", "Source of Lead Analysis", "amber", inner);
}

/* ---- PROJECTS ---- */
function repProjects() {
  const L = reportLeads();
  const rows = DB.projects.map((p) => {
    const ls = L.filter((l) => (l.projects_shared || []).includes(p.name));
    const bk = ls.filter((l) => l.status === "Booked").length;
    const custs = uniqList(ls.map((l) => l.customer_name).filter(Boolean));
    const reqs = topEntries(ls.map((l) => l.requirement), 1);
    const total = Number(p.total_units) || 0, avail = Number(p.available_units) || 0;
    return { p, n: ls.length, bk, custs: custs.length, topReq: reqs[0] ? reqs[0][0] : "—", avail, total };
  }).sort((a, b) => b.n - a.n);
  const bar = rows.map((r) => [r.p.name, r.n]);
  const table = repTable(["Project", "Type", "Location", "Price range", "Availability", "Enquiries", "Booked", "Interested", "Top requirement"],
    rows.map((r) => [`<b>${esc(r.p.name)}</b>`, esc(r.p.type) || "—", esc(r.p.location) || "—", [r.p.price_min, r.p.price_max].filter(Boolean).map(esc).join(" – ") || "—", r.total ? `${r.avail}/${r.total}` : "—", `<button type="button" class="chip-open rf-click${reportFilters.project === r.p.name ? " rf-active" : ""}" data-rf="project:${esc(r.p.name)}">${r.n}</button>`, r.bk || "—", r.custs, esc(r.topReq)]), "No projects yet.");
  const inner = `<div class="rep-subhead">Enquiries per project <span class="rep-hint">· click a bar/number to filter</span></div>${barChart(bar, "#4f46e5", null, "project")}` +
    `<div class="rep-subhead" style="margin-top:18px">Active channel partners by project <span class="rep-hint">· unique CPs · click a CP for status breakdown</span></div>` + DB.projects.map((p) => projectCard(p, L)).join("") +
    repInsight(`${rows.length ? `<b>${esc(rows[0].p.name)}</b> draws the most interest (${rows[0].n} enquiries, ${rows[0].custs} customers)` : "Add projects to see demand"}.`);
  return repSection("P", "Project Analysis", "purple", inner);
}
function projectCard(p, L) {
  const ls = L.filter((l) => (l.projects_shared || []).includes(p.name));
  const map = {};
  ls.forEach((l) => { const f = firmOfLead(l); if (f) (map[f] = map[f] || []).push(l); });
  const firms = Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  const total = Number(p.total_units) || 0, avail = Number(p.available_units) || 0;
  const rowsHtml = firms.map(([firm, arr]) => {
    const active = arr.filter((l) => l.status === "Active").length, booked = arr.filter((l) => l.status === "Booked").length, inactive = arr.filter((l) => l.status === "Inactive").length;
    const cpNames = uniqList(arr.map((l) => (l.source_name || "").trim()).filter(Boolean)).join(" · ") || "—";
    return `<tr class="projcp-row" data-projcp="${esc(p.name)}||${esc(firm)}">
      <td><b>${esc(firm)}</b></td>
      <td>${esc(cpNames)}</td>
      <td><span class="chip-budget">${arr.length}</span></td>
      <td><span class="mini-stat g">${active}A</span> <span class="mini-stat b">${booked}B</span> <span class="mini-stat n">${inactive}I</span></td>
      <td class="right"><button class="btn drill-open sm" data-projcp="${esc(p.name)}||${esc(firm)}">Details ›</button></td>
    </tr>`;
  }).join("");
  const body = firms.length
    ? `<table class="projcp-table"><thead><tr><th>Firm / Company</th><th>CP Name(s)</th><th>Leads</th><th>Status (A/B/I)</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table>`
    : `<div class="muted" style="font-size:13px;padding:8px 2px">No channel-sourced enquiries yet.</div>`;
  return `<div class="proj-card"><div class="proj-card-head"><div class="proj-card-name"><b>${esc(p.name)}</b> <span class="muted">${[p.type, p.location].filter(Boolean).map(esc).join(" · ")}</span></div><div class="proj-card-meta">${ls.length} enquir${ls.length === 1 ? "y" : "ies"} · ${firms.length} unique CP firm${firms.length === 1 ? "" : "s"}${total ? ` · ${avail}/${total} available` : ""}</div></div>${body}</div>`;
}
function openProjectCP(project, firm) {
  const rows = DB.leads.filter((l) => (l.projects_shared || []).includes(project) && firmOfLead(l) === firm);
  const chips = [
    { v: rows.length, k: "Total leads", c: "indigo" },
    { v: rows.filter((l) => l.status === "Active").length, k: "Active", c: "green" },
    { v: rows.filter((l) => l.status === "Booked").length, k: "Booked", c: "blue" },
    { v: rows.filter((l) => l.status === "Inactive").length, k: "Inactive", c: "gray" },
  ];
  const table = rows.length ? `<div class="table-wrap drill-table"><table><thead><tr>${["Lead #", "Customer", "Budget", "Requirement", "Stage", "Rating", "Status", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.slice().sort((a, b) => b.id - a.id).map((l) => `<tr>
    <td class="mono nowrap">${esc(l.lead_number)}</td>
    <td><div style="font-weight:600">${esc(l.customer_name) || "—"}</div><div class="fu-meta">${telLink(l.customer_mobile)}</div></td>
    <td><span class="chip-budget">${esc(l.budget) || "—"}</span></td><td>${esc(l.requirement) || "—"}</td><td>${esc(l.stage) || "—"}</td><td>${badge(l.rating)}</td><td>${badge(l.status)}</td>
    <td class="right"><button class="btn drill-open sm" data-profile="lead:${l.id}">Open ›</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No leads.</div>`;
  modal(`${firm} — ${project}`, drillStats(chips) + table, true);
}

/* ---- CUSTOMERS ---- */
function repCustomers() {
  const C = reportCustomersSet();
  const cnt = (k, v) => C.filter((x) => (x[k] || "") === v).length;
  const contactable = C.filter((c) => Number(c.contact_future ?? 1)).length;
  const kpis = `<div class="rep-hero rep-hero-sm">
    ${repCard(C.length, "Total Customers", "", "indigo")}
    ${repCard(cnt("category", "Investor"), "Investors", pct(cnt("category", "Investor"), C.length) + "%", "green")}
    ${repCard(cnt("category", "EndUser"), "End-users", pct(cnt("category", "EndUser"), C.length) + "%", "blue")}
    ${repCard(contactable, "Contact in future", "", "teal")}</div>`;
  const cityD = topEntries(C.map((c) => c.city)), profD = topEntries(C.map((c) => c.profession));
  const ratingD = [5, 4, 3, 2, 1].map((r) => [r + "★", C.filter((c) => Number(c.rating) === r).length]).filter((x) => x[1]);
  const nowM = new Date().getMonth() + 1;
  const bdays = C.filter((c) => c.dob && Number(c.dob.slice(5, 7)) === nowM).map((c) => [esc(c.name), esc(c.dob), esc(c.mobile1) || "—"]);
  const annis = C.filter((c) => c.anniversary && Number(c.anniversary.slice(5, 7)) === nowM).map((c) => [esc(c.name), esc(c.anniversary), esc(c.mobile1) || "—"]);
  const inner = kpis +
    `<div class="rep-grid2" style="margin-top:16px"><div><div class="rep-subhead">Top locations <span class="rep-hint">· click</span></div>${hbars(cityD, "#4f46e5", "city")}</div><div><div class="rep-subhead">Top professions <span class="rep-hint">· click</span></div>${hbars(profD, "#0ea5e9", "profession")}</div></div>` +
    `<div class="rep-grid2" style="margin-top:16px"><div><div class="rep-subhead">Customer quality (rating)</div>${hbars(ratingD, "#f59e0b")}</div><div><div class="rep-subhead">This month — birthdays</div>${repTable(["Name", "DOB", "Mobile"], bdays, "No birthdays this month.")}</div></div>` +
    `<div class="rep-grid2" style="margin-top:16px"><div><div class="rep-subhead">This month — anniversaries</div>${repTable(["Name", "Anniversary", "Mobile"], annis, "No anniversaries this month.")}</div><div></div></div>` +
    (() => {
      const repeat = C.map((c) => ({ c, n: leadsForCustomer(c).length })).filter((x) => x.n > 1).sort((a, b) => b.n - a.n);
      const rows = repeat.map((x) => [`<span class="c360-uid">${custUid(x.c)}</span>`, `<span class="rowlink" data-profile="customer:${x.c.id}">${esc(x.c.name)}</span><div class="fu-meta">${esc(x.c.mobile1) || "—"}</div>`, `<span class="chip-budget">${x.n}</span>`, esc(uniqList(leadsForCustomer(x.c).flatMap((l) => l.projects_shared || [])).join(", ")) || "—", leadsForCustomer(x.c).filter((l) => l.status === "Booked").length || "—"]);
      return `<div class="rep-subhead" style="margin-top:18px">Repeat customers — multiple enquiries <span class="rep-hint">· click a name for the 360 view</span></div>${repTable(["Customer ID", "Customer", "Enquiries", "Projects", "Booked"], rows, "No customer has more than one enquiry yet.")}`;
    })() +
    repInsight(`Base skews ${cnt("category", "Investor") >= cnt("category", "EndUser") ? "toward investors" : "toward end-users"}. <b>${contactable}</b> flagged contact-in-future${bdays.length ? `, and <b>${bdays.length}</b> have a birthday this month — a natural touchpoint` : ""}.`);
  return repSection("C", "Customer Analysis", "amber", inner);
}

/* ---- MATCH FINDER ---- */
function repMatch() {
  const m = matchCriteria;
  const projNames = DB.projects.map((p) => p.name);
  const unit = m.unitId ? _mfUnits.find((u) => String(u.id) === String(m.unitId)) : null;
  const sel = (id, k, opts, cur, ph) => `<label class="mf-field"><span>${ph}</span><select id="${id}" data-k="${k}"><option value="">Any</option>${opts.map((o) => `<option ${cur === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  const budSel = (id, k, cur, ph) => `<label class="mf-field"><span>${ph}</span><select id="${id}" data-k="${k}"><option value="">Any</option>${BUDGETS.map((o) => `<option ${cur === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  const unitOptions = _mfUnits.map((u) => `<option value="${esc(u.project + " · " + u.unitNo)}"></option>`).join("");
  const controls = `<div class="mf-controls">
    ${sel("rmReq", "requirement", REQUIREMENTS, m.requirement, "Requirement")}
    ${budSel("rmBudMin", "budgetMin", m.budgetMin, "Budget from")}
    ${budSel("rmBudMax", "budgetMax", m.budgetMax, "Budget to")}
    ${sel("rmProj", "project", projNames, m.project, "Project")}
    ${sel("rmType", "etype", ENQUIRY_TYPES, m.etype, "Enquiry type")}
    <label class="mf-field mf-unit"><span>Project / Unit no</span><input id="rmUnit" list="rmUnitList" placeholder="${_mfUnits.length ? "Type project or unit no…" : "Loading units…"}" value="${esc(m.unitText || "")}"/><datalist id="rmUnitList">${unitOptions}</datalist></label>
    <button class="btn ghost sm" id="rmClear" type="button">Reset</button>
  </div>`;
  // Budget range → BUDGETS index window. Either handle may be blank (open-ended).
  const rangeActive = !!(m.budgetMin || m.budgetMax);
  let lo = 0, hi = BUDGETS.length - 1;
  if (rangeActive) {
    const a = m.budgetMin ? BUDGETS.indexOf(m.budgetMin) : 0;
    const b = m.budgetMax ? BUDGETS.indexOf(m.budgetMax) : BUDGETS.length - 1;
    lo = Math.min(a, b); hi = Math.max(a, b);
  }
  const matches = DB.leads.filter((l) => {
    if (m.requirement && l.requirement !== m.requirement) return false;
    if (!budgetBandInRange(l.budget, m.budgetMin, m.budgetMax)) return false;
    if (m.project && !(l.projects_shared || []).includes(m.project)) return false;
    if (m.etype && l.enquiry_type !== m.etype) return false;
    return true;
  });
  const custs = uniqList(matches.map((l) => (l.customer_name || "") + "|" + (l.customer_mobile || ""))).filter((x) => x.replace("|", ""));
  const rows = matches.slice().sort((a, b) => b.id - a.id).map((l) => [`<span class="rowlink" data-profile="lead:${l.id}">${esc(l.customer_name) || l.lead_number}</span><div class="fu-meta">${telLink(l.customer_mobile)}</div>`, esc(l.requirement) || "—", `<span class="chip-budget">${esc(l.budget) || "—"}</span>`, esc(l.enquiry_type) || "—", tagchips(l.projects_shared || [], "indigo"), esc(l.stage) || "—", badge(l.rating), badge(l.status), cpCell(l), `<button class="btn drill-open sm" data-profile="lead:${l.id}">Open ›</button>`]);
  const table = repTable(["Customer", "Requirement", "Budget", "Type", "Projects shared", "Stage", "Rating", "Status", "Source/CP", ""], rows, "No enquiries match these criteria yet.");
  const summary = `<div class="rep-hero rep-hero-sm">${repCard(matches.length, "Matching Enquiries", "", "indigo")}${repCard(custs.length, "Interested Customers", "", "teal")}${repCard(matches.filter((l) => l.status === "Active").length, "Still Active", "", "green")}${repCard(matches.filter((l) => l.status === "Booked").length, "Already Booked", "", "gray")}</div>`;
  const rangeLabel = rangeActive ? ` · budget ${esc(BUDGETS[lo])} → ${esc(BUDGETS[hi])}` : "";
  const unitCard = unit ? `<div class="mf-unitcard">🏠 <b>${esc(unit.project)}</b> · Unit <b>${esc(unit.unitNo)}</b>${unit.size ? " · " + esc(unit.size) : ""}${unit.desc ? " · " + esc(unit.desc) : ""} · ${unitStatusTag(unit.status)} · ${crLabel(unit.costingCr)} <span class="fu-meta">matches budget band <b>${esc(crToBudgetBand(unit.costingCr)) || "—"}</b>${rangeLabel}</span></div>` : "";
  const inner = `<p class="mf-help">Pick any combination of requirement, a budget <b>range</b> (from / to bands), project and enquiry type — or find directly by <b>Project / Unit no</b> when a specific unit becomes available — to instantly surface the CP+CL / CL enquiries and customers that match.</p>` + controls + unitCard + summary + `<div class="rep-subhead" style="margin-top:16px">Matching enquiries &amp; interested customers</div>` + table;
  return repSection("M", "Match Finder", "green", inner);
}
function bindMatch() {
  loadMfUnits();
  ["rmReq", "rmBudMin", "rmBudMax", "rmProj", "rmType"].forEach((id) => { const el = document.getElementById(id); if (el) el.onchange = () => { matchCriteria[el.getAttribute("data-k")] = el.value; renderReportBody(); }; });
  const u = document.getElementById("rmUnit");
  if (u) u.onchange = () => {
    const v = u.value.trim();
    matchCriteria.unitText = v;
    const found = _mfUnits.find((x) => (x.project + " · " + x.unitNo).toLowerCase() === v.toLowerCase());
    if (found) { matchCriteria.unitId = String(found.id); matchCriteria.project = found.project; const band = crToBudgetBand(found.costingCr); if (band) { matchCriteria.budgetMin = band; matchCriteria.budgetMax = band; } }
    else { matchCriteria.unitId = ""; }
    renderReportBody();
  };
  const c = document.getElementById("rmClear"); if (c) c.onclick = () => { matchCriteria = { requirement: "", budgetMin: "", budgetMax: "", project: "", etype: "", unitId: "", unitText: "" }; renderReportBody(); };
}

/* ---- shell ---- */
function granLabel() { const g = GRANS.find((x) => x[0] === reportOpts.gran); return g ? g[1].toLowerCase() : "monthly"; }
function reportBanner() {
  const d = new Date(), genOn = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const range = (reportOpts.from || reportOpts.to) ? ` · Period ${reportOpts.from || "start"} → ${reportOpts.to || "today"}` : "";
  const tab = (REPORT_TABS.find((t) => t[0] === reportView) || ["", "Report"])[1];
  return `<div class="rep-banner"><div><div class="rep-title">${esc(tab)}</div><div class="rep-subtitle">Generated ${genOn}${range} · RealtyCRM</div></div><div class="rep-logo">Realty<span>CRM</span></div></div>`;
}
function reportBodyHtml() {
  const body = reportView === "brokers" ? repBrokers() : reportView === "enquiries" ? repEnquiries() : reportView === "sources" ? repSources() : reportView === "projects" ? repProjects() : reportView === "customers" ? repCustomers() : reportView === "match" ? repMatch() : repOverview();
  return `${reportBanner()}${reportView === "match" ? "" : reportFilterBar()}${body}`;
}
function reportTabs() { return `<div class="rep-tabs">${REPORT_TABS.map(([k, l]) => `<button type="button" class="rep-tab${reportView === k ? " active" : ""}" data-rtab="${k}">${l}</button>`).join("")}</div>`; }
function reportControls() {
  return `<div class="card pad rep-controls"><div class="rep-ctrl-row">
    <div class="rep-ctrl-group"><span class="rep-ctrl-title">Period</span><label>From <input type="date" id="rFrom" value="${reportOpts.from}"/></label><label>To <input type="date" id="rTo" value="${reportOpts.to}"/></label><button class="btn ghost sm" id="rClear">Clear</button></div>
    <div class="rep-ctrl-group"><span class="rep-ctrl-title">Granularity</span><select id="rGran">${GRANS.map(([v, l]) => `<option value="${v}" ${reportOpts.gran === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="rep-ctrl-group rep-ctrl-actions"><button class="btn outline sm" id="rExcel">Export Excel</button><button class="btn primary sm" id="rPrint">Print / PDF</button></div>
  </div></div>`;
}
// ---- AI Report Builder (quick + deep dive) ----
// Tiny, safe Markdown → HTML for the AI output (headings, bold, lists, paragraphs).
function mdToHtml(md) {
  const e2 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t) => e2(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`(.+?)`/g, "<code>$1</code>");
  let html = "", inUl = false, inOl = false;
  const closeLists = () => { if (inUl) { html += "</ul>"; inUl = false; } if (inOl) { html += "</ol>"; inOl = false; } };
  String(md || "").split("\n").forEach((raw) => {
    const t = raw.trim(); if (!t) { closeLists(); return; }
    let m;
    if ((m = t.match(/^(#{1,6})\s+(.*)/))) { closeLists(); const lvl = Math.min(m[1].length + 2, 6); html += `<h${lvl} class="air-h">${inline(m[2])}</h${lvl}>`; return; }
    if ((m = t.match(/^[-*•]\s+(.*)/))) { if (!inUl) { closeLists(); html += "<ul>"; inUl = true; } html += `<li>${inline(m[1])}</li>`; return; }
    if ((m = t.match(/^\d+[.)]\s+(.*)/))) { if (!inOl) { closeLists(); html += "<ol>"; inOl = true; } html += `<li>${inline(m[1])}</li>`; return; }
    closeLists(); html += `<p>${inline(t)}</p>`;
  });
  closeLists(); return html;
}
// Compact, factual snapshot of the currently-filtered report dataset for the AI.
function aiReportContext() {
  const L = reportLeads(), Bk = reportBrokersSet(), Cu = reportCustomersSet();
  const n = L.length, booked = L.filter((l) => l.status === "Booked").length, activeN = L.filter((l) => l.status === "Active").length, inactive = L.filter((l) => l.status === "Inactive").length;
  const conv = n ? Math.round((booked / n) * 100) : 0;
  const dist = (arr, keys, f) => keys.map((k) => `${k}:${arr.filter((x) => f(x) === k).length}`).join(", ");
  const projCount = {}; L.forEach((l) => (l.projects_shared || []).forEach((p) => (projCount[p] = (projCount[p] || 0) + 1)));
  const topProj = Object.entries(projCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, c]) => `${p} (${c})`).join(", ") || "none";
  const cpCount = {}; L.forEach((l) => { if (l.source_type === "CP" && l.source_name) cpCount[l.source_name] = (cpCount[l.source_name] || 0) + 1; });
  const topCP = Object.entries(cpCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, c]) => `${p} (${c})`).join(", ") || "none";
  const period = (reportOpts.from || reportOpts.to) ? `${reportOpts.from || "start"} to ${reportOpts.to || "today"}` : "all time";
  const sample = L.slice(0, 30).map((l) => `- ${l.customer_name || l.lead_number} | ${l.requirement || "?"} | ${l.budget || "?"} | ${l.stage || "?"}/${l.status || "?"} | ${l.rating || "?"} | proj ${(l.projects_shared || []).join("/") || "-"} | ${l.source_type || "-"}:${l.source_name || "-"} | "${(l.remark || "").slice(0, 80)}"`).join("\n");
  return `Period: ${period}
Totals: ${n} enquiries · ${activeN} active · ${booked} booked · ${inactive} inactive · conversion ${conv}%
By stage: ${dist(L, STAGES, (l) => l.stage)}
By requirement: ${dist(L, REQUIREMENTS, (l) => l.requirement)}
By budget: ${dist(L, BUDGETS, (l) => l.budget)}
By source: ${dist(L, ["CP", "CL", "Reference"], (l) => l.source_type)}
By rating: ${dist(L, RATINGS, (l) => l.rating)}
Top projects (by shares): ${topProj}
Top channel partners (by leads): ${topCP}
Brokers: ${Bk.length} total · ${Bk.filter((b) => b.connect === "Live").length} live · ${Bk.filter((b) => leadCountForBroker(b.name) > 0).length} active (brought a client)
Customers: ${Cu.length} total · ${Cu.filter((c) => c.category === "Investor").length} investors · ${Cu.filter((c) => c.category === "EndUser").length} end-users
Enquiry sample (up to 30):
${sample}`;
}
let _aiRepBusy = false;
async function buildAiReport(mode) {
  const out = document.getElementById("aiReportOut"); if (!out) return;
  if (!aiReady()) { openAiConnect(() => buildAiReport(mode)); return; }
  if (_aiRepBusy) return; _aiRepBusy = true;
  const focus = (document.getElementById("aiReportFocus")?.value || "").trim();
  out.style.display = ""; out.innerHTML = `<div class="air-loading"><span class="ai-orb ai-orb-sm"></span> ${mode === "deep" ? "Analysing your pipeline in depth…" : "Building your quick report…"}</div>`;
  const shape = mode === "deep"
    ? `Write a DEEP-DIVE executive report. Use these ## section headings in order: Executive Summary; Pipeline Health; Channel & Source Performance; Project Demand; Customer Mix; Risks & Bottlenecks; Recommended Actions (as a numbered, specific list). Quote the real numbers, surface trends and anomalies, and be candid and analytical.`
    : `Write a QUICK report: a 3-4 sentence **Executive Summary**, then a short "## Key Numbers" bullet list, then "## Top 3 Actions" as a numbered list. Keep it tight and scannable.`;
  const prompt = `You are a sharp real-estate sales analyst for Ashish Sharma (Coffee & Deals, BPTP Gurugram). Analyse the CRM data below and produce a professional, decision-ready report in Markdown (## headings, **bold**, bullet and numbered lists). Base every claim ONLY on the data provided; if something can't be known from it, say so. Be specific with numbers and names — no vague filler.${focus ? `\n\nThe user specifically wants this report to focus on: ${focus}` : ""}\n\n${shape}\n\nDATA:\n${aiReportContext()}`;
  try {
    const text = await aiGenerate(prompt);
    out.innerHTML = `<div class="air-doc"><div class="air-dochead"><span class="ai-orb ai-orb-sm"></span><b>AI ${mode === "deep" ? "Deep-Dive" : "Quick"} Report</b><span class="air-when">${now()}</span><span class="air-tools"><button class="btn ghost sm" id="aiRepCopy">📋 Copy</button><button class="btn ghost sm" id="aiRepPrint">🖨 Print</button></span></div><div class="air-body">${mdToHtml(text)}</div></div>`;
    const cp = document.getElementById("aiRepCopy"); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(text); } catch (e) {} toast("Report copied ✓"); };
    const pr = document.getElementById("aiRepPrint"); if (pr) pr.onclick = () => window.print();
  } catch (e) {
    const msg = (e && e.message) || String(e);
    out.innerHTML = `<div class="ai-err">${/no-key/.test(msg) ? "Connect an AI key first (🔑 AI key on the AI Copilot page)." : esc(msg)}</div>`;
  }
  _aiRepBusy = false;
}
function aiReportCard() {
  return `<div class="card pad air-card">
    <div class="air-head"><span class="ai-orb"></span><div class="air-head-t"><b>AI Report Builder</b><div class="muted" style="font-size:11px">Turn the numbers below into a written, professional report</div></div>
      <div class="air-actions"><button type="button" class="btn outline sm" id="aiRepQuick">⚡ Quick report</button><button type="button" class="btn primary sm" id="aiRepDeep">🔬 Deep dive</button></div></div>
    <input id="aiReportFocus" class="search air-focus" autocomplete="off" placeholder="Optional focus, e.g. “why aren’t my hot leads converting?” or “Amstoria demand vs Downtown”" />
    <div id="aiReportOut" class="air-out" style="display:none"></div>
  </div>`;
}
function viewReports() { return `${aiReportCard()}${reportControls()}${reportTabs()}<div id="reportBody">${reportBodyHtml()}</div>`; }

/* ============================ ANALYTICS & GOALS ============================ */
function monthKey(d) { d = d || new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function monthLabel(mk) { return MONTHS[Number(mk.slice(5, 7)) - 1].slice(0, 3) + " " + mk.slice(0, 4); }
function getGoals() {
  const g = DB.goals || {};
  return { month: g.month || monthKey(), enquiries: Number(g.enquiries) || 0, visits: Number(g.visits) || 0, bookings: Number(g.bookings) || 0 };
}
// Compute the productivity picture from the raw leads/activities.
function analyticsData() {
  const L = DB.leads || [];
  const mk = (s) => String(s || "").slice(0, 7);
  const now_ = new Date();
  const curM = monthKey(now_);
  const prevD = new Date(now_.getFullYear(), now_.getMonth() - 1, 1), prevM = monthKey(prevD);
  const advanced = (l) => ["SVD", "Negotiation", "VDNB"].includes(l.stage) || l.status === "Booked";
  const inM = (l, m) => mk(l.lead_date) === m;
  const monthStats = (m) => ({ enq: L.filter((l) => inM(l, m)).length, visits: L.filter((l) => inM(l, m) && advanced(l)).length, booked: L.filter((l) => inM(l, m) && l.status === "Booked").length });
  const cur = monthStats(curM), prv = monthStats(prevM);
  const series = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(now_.getFullYear(), now_.getMonth() - i, 1); const m = monthKey(d); series.push({ m, label: MONTHS[d.getMonth()].slice(0, 3), enq: L.filter((l) => inM(l, m)).length, booked: L.filter((l) => inM(l, m) && l.status === "Booked").length }); }
  const total = L.length, booked = L.filter((l) => l.status === "Booked").length, active = L.filter((l) => l.status === "Active").length;
  const conv = total ? Math.round((booked / total) * 100) : 0;
  const bk = bucketFollowups();
  const doneCount = (DB.activities || []).filter((a) => /follow|meeting|call|visit/i.test(a.kind || "")).length;
  const adherence = (bk.today.length + bk.missed.length) ? Math.round((bk.today.length / (bk.today.length + bk.missed.length)) * 100) : 100;
  return { curM, prevM, cur, prv, series, total, booked, active, conv, bk, doneCount, adherence };
}
// Grouped 6-month bar chart: enquiries vs bookings.
function analyticsTrendSvg(series) {
  const W = 580, H = 210, pad = 30, n = series.length || 1;
  const mx = Math.max(1, ...series.map((s) => Math.max(s.enq, s.booked)));
  const bw = (W - pad * 2) / n, bar = Math.max(8, bw * 0.26);
  let g = "";
  for (let i = 1; i <= 4; i++) { const y = H - pad - (i / 4) * (H - pad * 2); g += `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" class="an-grid"/>`; }
  let bars = "";
  series.forEach((s, i) => {
    const x = pad + i * bw + bw / 2;
    const eh = (s.enq / mx) * (H - pad * 2), bh = (s.booked / mx) * (H - pad * 2);
    bars += `<rect x="${x - bar - 3}" y="${H - pad - eh}" width="${bar}" height="${eh}" rx="3" fill="url(#gEnq)"><title>${s.label}: ${s.enq} enquiries</title></rect>`;
    bars += `<rect x="${x + 3}" y="${H - pad - bh}" width="${bar}" height="${bh}" rx="3" fill="url(#gBook)"><title>${s.label}: ${s.booked} booked</title></rect>`;
    bars += `<text x="${x}" y="${H - pad + 16}" text-anchor="middle" class="an-axis">${s.label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="an-trend" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="gEnq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#4f46e5"/></linearGradient>
    <linearGradient id="gBook" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#059669"/></linearGradient></defs>
    ${g}${bars}
  </svg>`;
}
function viewAnalytics() {
  const a = analyticsData(), goals = getGoals();
  const kpi = (label, val, sub, cls) => `<div class="an-kpi ${cls}"><div class="an-kpi-k">${label}</div><div class="an-kpi-v">${val}</div><div class="an-kpi-s">${sub}</div></div>`;
  const delta = (c, p) => { if (!p) return c > 0 ? `<span class="an-up">▲ new</span>` : `<span class="an-flat">—</span>`; const d = Math.round(((c - p) / p) * 100); return d > 0 ? `<span class="an-up">▲ ${d}%</span>` : d < 0 ? `<span class="an-down">▼ ${Math.abs(d)}%</span>` : `<span class="an-flat">no change</span>`; };
  const goalRow = (label, target, actual, color) => {
    const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
    const badge = target > 0 ? (actual >= target ? `<span class="an-badge ok">On target ✓</span>` : `<span class="an-badge">${target - actual} to go</span>`) : `<span class="an-badge muted">No target</span>`;
    return `<div class="an-goal"><div class="an-goal-top"><span class="an-goal-name">${label}</span><span class="an-goal-val"><b>${actual}</b> / ${target || "—"} ${badge}</span></div><div class="an-goal-track"><div class="an-goal-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
  };
  const cmpRow = (label, c, p) => `<tr><td>${label}</td><td class="an-num">${c}</td><td class="an-num">${p}</td><td>${delta(c, p)}</td></tr>`;
  return `
  <div class="an-intro card pad">
    <div><div class="an-intro-t">Productivity &amp; Goals</div><div class="muted" style="font-size:12px">Track your month, compare trends, set targets — then let AI build a roadmap to hit them.</div></div>
    <div class="an-intro-actions"><button class="btn outline sm" id="anGoalsBtn">🎯 Set goals</button><button class="btn primary sm" id="anRoadBtn">✦ Build my roadmap</button></div>
  </div>

  <div class="an-kpis">
    ${kpi("Total Enquiries", a.total, `${a.active} active now`, "k-indigo")}
    ${kpi("Conversion", a.conv + "%", `${a.booked} booked all-time`, "k-green")}
    ${kpi("This Month", a.cur.enq, `${a.cur.booked} booked · ${a.cur.visits} site visits`, "k-violet")}
    ${kpi("Follow-up Health", a.adherence + "%", `${a.bk.missed.length} missed · ${a.bk.today.length} due today`, a.bk.missed.length ? "k-amber" : "k-teal")}
  </div>

  <div class="an-grid2">
    <div class="card pad">
      <div class="section-title">Goals — ${monthLabel(goals.month)}</div>
      ${goalRow("New Enquiries", goals.enquiries, a.cur.enq, "linear-gradient(90deg,#6366f1,#8b5cf6)")}
      ${goalRow("Site Visits", goals.visits, a.cur.visits, "linear-gradient(90deg,#f59e0b,#f97316)")}
      ${goalRow("Bookings", goals.bookings, a.cur.booked, "linear-gradient(90deg,#34d399,#059669)")}
      <button class="btn light sm" id="anGoalsBtn2" style="margin-top:6px">Edit targets</button>
    </div>
    <div class="card pad">
      <div class="section-title">This month vs last</div>
      <table class="an-cmp"><thead><tr><th>Metric</th><th class="an-num">${MONTHS[Number(a.curM.slice(5, 7)) - 1].slice(0, 3)}</th><th class="an-num">${MONTHS[Number(a.prevM.slice(5, 7)) - 1].slice(0, 3)}</th><th>Change</th></tr></thead>
      <tbody>${cmpRow("Enquiries", a.cur.enq, a.prv.enq)}${cmpRow("Site visits", a.cur.visits, a.prv.visits)}${cmpRow("Bookings", a.cur.booked, a.prv.booked)}</tbody></table>
    </div>
  </div>

  <div class="card pad">
    <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">6-Month Trend <span class="an-legend"><span class="an-lg an-lg-e"></span>Enquiries <span class="an-lg an-lg-b"></span>Bookings</span></div>
    ${analyticsTrendSvg(a.series)}
  </div>

  <div class="card pad air-card" style="margin-top:16px">
    <div class="air-head"><span class="ai-orb"></span><div class="air-head-t"><b>AI Roadmap</b><div class="muted" style="font-size:11px">A week-by-week plan to hit this month's targets, built from your live data</div></div>
      <div class="air-actions"><button type="button" class="btn primary sm" id="anRoadBtn2">✦ Build my roadmap</button></div></div>
    <input id="anRoadFocus" class="search air-focus" autocomplete="off" placeholder="Optional focus, e.g. “convert more site visits” or “re-activate cold investors”" />
    <div id="anRoadmapOut" class="air-out" style="display:none"></div>
  </div>`;
}
function openGoalsForm() {
  const g = getGoals();
  modal("🎯 Set monthly goals", `
    <div class="lf"><div class="lf-sec"><div class="lf-sec-head lf-green">${IC.target}<span>Targets for ${monthLabel(monthKey())}</span></div>
    <div class="lf-sec-body"><div class="form-grid">
      ${field("New Enquiries", "g_enq", g.enquiries, "number")}
      ${field("Site Visits", "g_vis", g.visits, "number")}
      ${field("Bookings", "g_book", g.bookings, "number")}
    </div><p class="muted" style="font-size:11px;margin-top:8px">Progress is measured against enquiries dated in the current month.</p></div></div></div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="gSave">Save goals</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("gSave").onclick = () => {
    DB.goals = { month: monthKey(), enquiries: Number(fieldVal("g_enq")) || 0, visits: Number(fieldVal("g_vis")) || 0, bookings: Number(fieldVal("g_book")) || 0 };
    save(); closeModal(); toast("Goals saved ✓"); if (active === "analytics") go("analytics");
  };
}
let _anRoadBusy = false;
async function buildAnalyticsRoadmap() {
  const out = document.getElementById("anRoadmapOut"); if (!out) return;
  if (!aiReady()) { openAiConnect(() => buildAnalyticsRoadmap()); return; }
  if (_anRoadBusy) return; _anRoadBusy = true;
  const a = analyticsData(), g = getGoals();
  const focus = (document.getElementById("anRoadFocus")?.value || "").trim();
  out.style.display = ""; out.innerHTML = `<div class="air-loading"><span class="ai-orb ai-orb-sm"></span> Building your roadmap…</div>`;
  const gap = (t, actual) => t > 0 ? `${actual}/${t} (${Math.max(0, t - actual)} to go)` : `${actual} (no target set)`;
  const ctx = `Month: ${monthLabel(g.month)}
Targets vs actual so far this month:
- New enquiries: ${gap(g.enquiries, a.cur.enq)}
- Site visits: ${gap(g.visits, a.cur.visits)}
- Bookings: ${gap(g.bookings, a.cur.booked)}
Overall: ${a.total} total enquiries, ${a.active} active, ${a.booked} booked, conversion ${a.conv}%.
Momentum: this month ${a.cur.enq} enquiries / ${a.cur.booked} booked vs last month ${a.prv.enq} / ${a.prv.booked}.
Follow-ups: ${a.bk.today.length} due today, ${a.bk.missed.length} missed, ${a.bk.upcoming.length} upcoming.
${aiReportContext()}`;
  const prompt = `You are a sales performance coach for Ashish Sharma (Coffee & Deals, BPTP luxury real-estate, Gurugram). Using ONLY the data below, build a practical, professional ROADMAP to hit this month's targets. Reply in Markdown with these ## sections: Where You Stand (2-3 sentences with the key gaps); This Week's Focus (3-5 specific, prioritised actions); Weekly Plan to Month-End (a short week-by-week list); Levers & Risks (what will make or break the target); Stretch Goal (one realistic stretch if things go well). Be specific with numbers and reference real projects/segments from the data. No fluff.${focus ? `\n\nExtra focus from the user: ${focus}` : ""}\n\nDATA:\n${ctx}`;
  try {
    const text = await aiGenerate(prompt);
    out.innerHTML = `<div class="air-doc"><div class="air-dochead"><span class="ai-orb ai-orb-sm"></span><b>Your Roadmap</b><span class="air-when">${now()}</span><span class="air-tools"><button class="btn ghost sm" id="anRoadCopy">📋 Copy</button><button class="btn ghost sm" id="anRoadPrint">🖨 Print</button></span></div><div class="air-body">${mdToHtml(text)}</div></div>`;
    const cp = document.getElementById("anRoadCopy"); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(text); } catch (e) {} toast("Roadmap copied ✓"); };
    const pr = document.getElementById("anRoadPrint"); if (pr) pr.onclick = () => window.print();
  } catch (e) {
    const msg = (e && e.message) || String(e);
    out.innerHTML = `<div class="ai-err">${/no-key/.test(msg) ? "Connect an AI key first (🔑 AI key on the AI Copilot page)." : esc(msg)}</div>`;
  }
  _anRoadBusy = false;
}
function bindAnalytics() {
  const g1 = document.getElementById("anGoalsBtn"), g2 = document.getElementById("anGoalsBtn2");
  if (g1) g1.onclick = openGoalsForm; if (g2) g2.onclick = openGoalsForm;
  const r1 = document.getElementById("anRoadBtn"), r2 = document.getElementById("anRoadBtn2");
  if (r1) r1.onclick = buildAnalyticsRoadmap; if (r2) r2.onclick = buildAnalyticsRoadmap;
}
function bindReports() {
  const rr = () => renderReportBody();
  const bindIn = (id, key) => { const el = document.getElementById(id); if (el) el.addEventListener("input", () => { reportOpts[key] = el.value; rr(); }); };
  bindIn("rFrom", "from"); bindIn("rTo", "to"); bindIn("rGran", "gran");
  const clr = document.getElementById("rClear"); if (clr) clr.onclick = () => { reportOpts.from = ""; reportOpts.to = ""; go("reports"); };
  const pr = document.getElementById("rPrint"); if (pr) pr.onclick = () => { if (typeof window !== "undefined") window.print(); };
  const ex = document.getElementById("rExcel"); if (ex) ex.onclick = exportExcel;
  document.querySelectorAll("[data-rtab]").forEach((b) => (b.onclick = () => { reportView = b.getAttribute("data-rtab"); go("reports"); }));
  const aq = document.getElementById("aiRepQuick"); if (aq) aq.onclick = () => buildAiReport("quick");
  const ad = document.getElementById("aiRepDeep"); if (ad) ad.onclick = () => buildAiReport("deep");
  if (reportView === "match") bindMatch();
}
function download(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
function xmlEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c])); }
function xlsRow(cells) { return `<Row>${cells.map((v) => { const s = v == null ? "" : String(v); const num = s !== "" && /^-?\d+(\.\d+)?$/.test(s); return `<Cell><Data ss:Type="${num ? "Number" : "String"}">${xmlEsc(s)}</Data></Cell>`; }).join("")}</Row>`; }
function xlsSheet(name, headers, rows) { return `<Worksheet ss:Name="${xmlEsc(name).slice(0, 31)}"><Table>${xlsRow(headers)}${rows.map(xlsRow).join("")}</Table></Worksheet>`; }
function exportExcel() {
  const L = reportLeads(), Bk = reportBrokersSet(), Cu = reportCustomersSet();
  const conv = L.length ? Math.round((L.filter((l) => l.status === "Booked").length / L.length) * 100) : 0;
  const activeF = Object.entries(reportFilters).map(([k, v]) => `${RF_LABELS[k] || k}=${v}`).join(", ") || "(none)";
  const sheets = [];
  sheets.push(xlsSheet("Summary", ["Metric", "Value"], [
    ["Report generated", now()], ["View", reportView], ["Period from", reportOpts.from || "(all)"], ["Period to", reportOpts.to || "(all)"], ["Granularity", reportOpts.gran], ["Active cross-filters", activeF],
    ["Total enquiries", L.length], ["Active enquiries", L.filter((l) => l.status === "Active").length], ["Booked", L.filter((l) => l.status === "Booked").length], ["Conversion %", conv],
    ["Leads via Channel Partner", L.filter((l) => l.source_type === "CP").length], ["Leads via Reference", L.filter((l) => l.source_type === "Reference").length],
    ["Total brokers", Bk.length], ["Live brokers", Bk.filter((b) => b.connect === "Live").length], ["Terminated brokers", Bk.filter((b) => b.connect === "Terminate").length],
    ["Active brokers (with client)", Bk.filter((b) => leadCountForBroker(b.name) > 0).length],
    ["Total customers", Cu.length], ["Investors", Cu.filter((c) => c.category === "Investor").length], ["End-users", Cu.filter((c) => c.category === "EndUser").length], ["Total projects", DB.projects.length],
  ]));
  sheets.push(xlsSheet("Enquiries", ["Lead #", "Date", "Type", "Requirement", "Budget", "Source Type", "Source/CP", "Source Mobile", "Customer", "Cust Mobile", "City", "Category", "Stage", "Rating", "Status", "Next Follow-up", "Projects Shared", "Remark"],
    L.map((l) => [l.lead_number, l.lead_date, l.enquiry_type, l.requirement, l.budget, l.source_type, l.source_name, l.source_mobile, l.customer_name, l.customer_mobile, l.customer_city, l.customer_category, l.stage, l.rating, l.status, l.followup_at, (l.projects_shared || []).join("; "), l.remark])));
  sheets.push(xlsSheet("Brokers", ["Name", "Firm", "Mobiles", "Grade", "Team", "City", "Sector", "Connect", "Leads Brought", "Next Follow-up", "Empanelled"],
    Bk.map((b) => [b.name, b.firm, b.mobiles, b.grade, b.team_size, b.city, b.sector, b.connect, leadCountForBroker(b.name), b.followup_at, (b.created_at || "").slice(0, 10)])));
  sheets.push(xlsSheet("Customers", ["Name", "Mobile 1", "Mobile 2", "Mobile 3", "Email", "City", "State", "Category", "Profession", "Rating", "Contact in Future", "Added"],
    Cu.map((c) => [c.name, c.mobile1, c.mobile2, c.mobile3, c.email, c.city, c.state, c.category, c.profession, c.rating, Number(c.contact_future ?? 1) ? "Yes" : "No", (c.created_at || "").slice(0, 10)])));
  sheets.push(xlsSheet("Projects", ["Name", "Type", "Location", "Price From", "Price To", "Total Units", "Available", "Status"],
    DB.projects.map((p) => [p.name, p.type, p.location, p.price_min, p.price_max, p.total_units, p.available_units, p.status])));
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets.join("")}</Workbook>`;
  download(new Blob([xml], { type: "application/vnd.ms-excel" }), `realtycrm-report-${today()}.xls`);
  toast("Excel file downloaded");
}

/* ---------- Drill-down lists ---------- */
function openDrill(spec) {
  const [type, val] = spec.split(":");
  if (type === "goto") return go(val);
  if (type === "diginew") { digiFilter = "new"; return go("digital"); }
  if (type === "rating") return listLeads(`${val} Leads`, DB.leads.filter((l) => l.rating === val));
  if (type === "stage") return listLeads(`Stage: ${val}`, DB.leads.filter((l) => l.stage === val));
  if (type === "grade") { const g = val.replace("Gr ", ""); return listBrokers(`Grade ${g} Brokers`, DB.brokers.filter((b) => b.grade === g)); }
  if (type === "occasion") return listOccasion(val);
  if (type === "leads") {
    if (val === "all") return listLeads("All Enquiries", DB.leads);
    if (val === "booked") return listLeads("Booked Deals", DB.leads.filter((l) => l.status === "Booked"));
    if (val === "active") return listLeads("Active Enquiries", DB.leads.filter((l) => l.status === "Active"));
  }
  if (type === "brokers") {
    if (val === "active") return listBrokers("Active Brokers (with enquiry)", DB.brokers.filter((b) => leadCountForBroker(b.name) > 0));
    return listBrokers(val === "live" ? "Live Brokers" : "All Brokers", val === "live" ? DB.brokers.filter((b) => b.connect === "Live") : DB.brokers);
  }
  if (type === "customers") return listCustomers("All Customers", DB.customers);
}
function drillStats(chips) {
  return `<div class="drill-stats">${chips.map((c) => `<div class="dstat d-${c.c}${c.f !== undefined ? " dstat-click" : ""}"${c.f !== undefined ? ` data-chip="${c.f}"` : ""}><div class="dstat-v">${c.v}</div><div class="dstat-k">${c.k}</div></div>`).join("")}</div>`;
}
function miniAvatar(name, cls) { return `<span class="mini-avatar ${cls || ""}">${esc((name || "?").slice(0, 1).toUpperCase())}</span>`; }

function listLeads(title, rows) {
  const chips = [
    { v: rows.length, k: "Total", c: "indigo" },
    { v: rows.filter((r) => r.status === "Active").length, k: "Active", c: "green" },
    { v: rows.filter((r) => r.status === "Booked").length, k: "Booked", c: "blue" },
    { v: rows.filter((r) => r.rating === "Hot").length, k: "Hot", c: "red" },
  ];
  const body = rows.length ? `<div class="table-wrap drill-table"><table><thead><tr>${["Lead #", "Customer", "Req.", "Budget", "Stage", "Rating", "Status", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.slice().sort((a, b) => b.id - a.id).map((l) => `<tr>
    <td class="mono nowrap">${esc(l.lead_number)}</td>
    <td><div class="cust-cell">${miniAvatar(l.customer_name)}<div><div class="cust-nm">${esc(l.customer_name) || "—"}</div><div class="fu-meta">${telLink(l.customer_mobile)}</div></div></div></td>
    <td>${esc(l.requirement) || "—"}</td>
    <td class="nowrap">${l.budget ? `<span class="chip-budget">${esc(l.budget)}</span>` : "—"}</td>
    <td>${esc(l.stage) || "—"}</td><td>${badge(l.rating)}</td><td>${badge(l.status)}</td>
    <td class="right"><button class="btn drill-open sm" data-profile="lead:${l.id}">Open ›</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No records.</div>`;
  modal(title, drillStats(chips) + body, true);
}
function listBrokers(title, rows) {
  const chips = brokerSummaryChips(rows);
  const body = rows.length ? `<div class="table-wrap drill-table"><table><thead><tr>${["Broker", "Firm", "Grade", "Team", "City", "Enquiries", "Connect", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.slice().sort((a, b) => b.id - a.id).map((b) => { const cnt = leadCountForBroker(b.name); return `<tr>
    <td><div class="cust-cell">${miniAvatar(b.name, "amber")}<div class="cust-nm">${esc(b.name)}${cnt ? ` <span class="pill-active">Active</span>` : ""}</div></div></td>
    <td>${esc(b.firm) || "—"}</td><td>${badge(b.grade)}</td><td>${esc(b.team_size) || "—"}</td><td>${esc(b.city) || "—"}</td><td>${cnt ? `<button type="button" class="chip-budget chip-click" data-brokerleads="${b.id}">${cnt}</button>` : `<span class="muted">—</span>`}</td><td>${badge(b.connect)}</td>
    <td class="right"><button class="btn drill-open sm" data-profile="broker:${b.id}">Open ›</button></td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">No records.</div>`;
  modal(title, drillStats(chips) + body, true);
}
function listOccasion(kind) {
  const nowM = new Date().getMonth() + 1, monthName = MONTHS[nowM - 1];
  const build = (c, type, field) => ({ c, type, day: Number(String(c[field]).slice(8, 10)) });
  let items = [];
  if (kind === "birthday" || kind === "all") items = items.concat(DB.customers.filter((c) => c.dob && Number(String(c.dob).slice(5, 7)) === nowM).map((c) => build(c, "Birthday", "dob")));
  if (kind === "anniversary" || kind === "all") items = items.concat(DB.customers.filter((c) => c.anniversary && Number(String(c.anniversary).slice(5, 7)) === nowM).map((c) => build(c, "Anniversary", "anniversary")));
  items.sort((a, b) => a.day - b.day);
  const title = kind === "all" ? "Birthdays & Anniversaries this month" : kind === "birthday" ? "Birthdays this month" : "Anniversaries this month";
  const chips = [{ v: items.length, k: "Occasions", c: "red" }, { v: items.filter((i) => Number(i.c.contact_future ?? 1)).length, k: "Contactable", c: "green" }];
  const occBadge = (t) => t === "Birthday" ? `<span class="badge b-Hot">Birthday</span>` : `<span class="badge b-Booked">Anniversary</span>`;
  const contactBadge = (c) => Number(c.contact_future ?? 1) ? `<span class="badge b-Live">Yes</span>` : `<span class="badge b-Inactive">No</span>`;
  const body = items.length ? `<div class="table-wrap drill-table"><table><thead><tr>${["Name", "Number", "Occasion", "City", "Category", "Rating", "Contactable", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${items.map((i) => `<tr>
    <td><div class="cust-cell">${miniAvatar(i.c.name)}<div class="cust-nm">${esc(i.c.name)}</div></div></td>
    <td>${esc(i.c.mobile1) || "—"}</td>
    <td>${occBadge(i.type)} <span class="fu-meta">${i.day} ${monthName}</span></td>
    <td>${esc(i.c.city) || "—"}</td>
    <td>${i.c.category ? badge(i.c.category) : "—"}</td>
    <td>${i.c.rating ? stars(i.c.rating) : "—"}</td>
    <td>${contactBadge(i.c)}</td>
    <td class="right"><button class="btn drill-open sm" data-act="editcust" data-id="${i.c.id}">Open ›</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No birthdays or anniversaries this month.</div>`;
  modal(title, drillStats(chips) + body, true);
}
function listCustomers(title, rows) {
  const chips = [
    { v: rows.length, k: "Total", c: "indigo" },
    { v: rows.filter((c) => c.category === "Investor").length, k: "Investors", c: "green" },
    { v: rows.filter((c) => c.category === "EndUser").length, k: "End-users", c: "blue" },
  ];
  const body = rows.length ? `<div class="table-wrap drill-table"><table><thead><tr>${["Name", "Mobile", "City", "Category", "Profession", "Rating", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.slice().sort((a, b) => b.id - a.id).map((c) => `<tr>
    <td><div class="cust-cell">${miniAvatar(c.name)}<div class="cust-nm">${esc(c.name)}</div></div></td>
    <td>${esc(c.mobile1) || "—"}</td><td>${esc(c.city) || "—"}</td><td>${c.category ? badge(c.category) : "—"}</td><td>${esc(c.profession) || "—"}</td><td>${c.rating ? stars(c.rating) : "—"}</td>
    <td class="right"><button class="btn drill-open sm" data-act="editcust" data-id="${c.id}">Open ›</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No records.</div>`;
  modal(title, drillStats(chips) + body, true);
}

/* ---------- View bindings ---------- */
function bindView(k) {
  if (k === "leads") { leadRowsHtml(); ["lq", "lStatus", "lRating"].forEach((id) => document.getElementById(id).addEventListener("input", leadRowsHtml)); const ld = document.getElementById("lDel"); if (ld) ld.onclick = bulkDeleteLeads; }
  if (k === "pipeline") { bindPipeline(); }
  if (k === "assistant") { bindAssistant(); }
  if (k === "dash") { updateDashDigi(); bindDashBrief(); loadDashBrief(); bindDashFollowups(); }
  if (k === "brokers") { brokerRowsHtml(); ["bq", "bType", "bGrade"].forEach((id) => { const el = document.getElementById(id); if (el) el.addEventListener("input", brokerRowsHtml); }); const w = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; }; w("bDel", bulkDeleteBrokers); w("bTpl", brokerTemplate); w("bImp", brokerImport); w("bExp", brokerExport); w("bGrpFirm", () => setBrokerGroup("firm")); w("bGrpList", () => setBrokerGroup("list")); }
  if (k === "customers") { custRowsHtml(); ["cq", "cCat", "cFut", "cRate"].forEach((id) => { const el = document.getElementById(id); if (el) el.addEventListener("input", custRowsHtml); }); }
  if (k === "projects") { populateProjectsWeb(); }
  if (k === "digital") { populateDigital(); }
  if (k === "inventory") { populateInventory(); }
  if (k === "testimonials") { populateTestimonials(); }
  if (k === "reports") { bindReports(); }
  if (k === "followups") { bindFollowupsUpcoming(); }
  if (k === "analytics") { bindAnalytics(); }
}

/* ---------- Modal ---------- */
function modal(title, bodyHtml, wide) {
  const host = document.getElementById("modalHost");
  host.innerHTML = `<div class="overlay"><div class="modal ${wide ? "wide" : "narrow"}"><div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" data-close>&times;</button></div><div class="modal-body">${bodyHtml}</div></div></div>`;
  host.querySelector(".overlay").addEventListener("mousedown", (e) => { if (e.target.classList.contains("overlay")) closeModal(); });
  host.querySelector("[data-close]").onclick = closeModal;
}
function closeModal() { document.getElementById("modalHost").innerHTML = ""; }
function fieldVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function field(label, id, value, type = "text", opts) {
  if (opts) return `<div class="field${type === "full" ? " full" : ""}"><label>${label}</label><select id="${id}"><option value="">Select…</option>${opts.map((o) => `<option ${String(value) === String(o) ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
  if (type === "textarea") return `<div class="field full"><label>${label}</label><textarea id="${id}" rows="2">${esc(value || "")}</textarea></div>`;
  const full = type === "full";
  return `<div class="field${full ? " full" : ""}"><label>${label}</label><input id="${id}" type="${full ? "text" : type}" value="${esc(value || "")}" /></div>`;
}
function pillField(label, id, opts, cur, full) {
  return `<div class="field${full ? " full" : ""}"><label>${label}</label><input type="hidden" id="${id}" value="${esc(cur || "")}"/><div class="pillset">${opts.map((o) => `<button type="button" class="pill${String(cur) === String(o) ? " on" : ""}" data-pill="${id}::${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`;
}
// Like pillField, but colours specific options (e.g. Booked=green, Inactive=red, Active=amber).
function pillFieldColored(label, id, opts, cur, colorMap, full) {
  return `<div class="field${full ? " full" : ""}"><label>${label}</label><input type="hidden" id="${id}" value="${esc(cur || "")}"/><div class="pillset">${opts.map((o) => `<button type="button" class="pill pill-c ${colorMap[o] || ""}${String(cur) === String(o) ? " on" : ""}" data-pill="${id}::${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`;
}
const STATUS_PILL_COLORS = { Booked: "pc-green", Inactive: "pc-red", Active: "pc-amber" };
function starField(label, id, cur) {
  const n = Number(cur) || 0;
  return `<div class="field"><label>${label}</label><input type="hidden" id="${id}" value="${n || ""}"/><div class="starset">${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="starbtn${i <= n ? " on" : ""}" data-star="${id}::${i}">★</button>`).join("")}<button type="button" class="star-clear" data-star="${id}::0">clear</button></div></div>`;
}
// Photo field: upload → auto-compress → preview thumb (click to enlarge). Value (a data URL
// or a remote URL) is kept in a hidden input so existing save handlers read it unchanged.
function imageField(label, id, url) {
  const has = !!url;
  return `<div class="field full img-field"><label>${label}</label>
    <div class="img-row">
      <div class="img-thumb${has ? "" : " empty"}" data-lightbox="${id}">${has ? `<img src="${esc(url)}" alt="">` : `<span>No photo</span>`}</div>
      <div class="img-actions">
        <input type="hidden" id="${id}" value="${esc(url || "")}"/>
        <label class="btn outline sm img-pick">📷 Upload photo<input type="file" accept="image/*" data-imgfor="${id}" hidden></label>
        <button type="button" class="btn ghost sm" data-imgclear="${id}">Remove</button>
        <div class="img-hint muted">Auto-compressed to save space. Click the photo to view it larger.</div>
      </div>
    </div></div>`;
}
// Downscale + JPEG-compress a chosen image to a small data URL (targets ~120KB so the
// cloud document stays well under Firestore's 1MB limit even with many photos).
function compressImage(file, cb) {
  const MAXDIM = 512, BUDGET = 120 * 1024;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let w = img.width || 1, h = img.height || 1;
      const scale = Math.min(1, MAXDIM / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
      let out;
      try {
        const cvs = document.createElement("canvas"); cvs.width = w; cvs.height = h;
        cvs.getContext("2d").drawImage(img, 0, 0, w, h);
        let q = 0.8; out = cvs.toDataURL("image/jpeg", q);
        while (out.length > BUDGET * 1.37 && q > 0.4) { q -= 0.1; out = cvs.toDataURL("image/jpeg", q); }
      } catch (e) { out = reader.result; }
      cb(out);
    };
    img.onerror = () => cb(reader.result);
    img.src = reader.result;
  };
  reader.onerror = () => cb("");
  reader.readAsDataURL(file);
}
function setImageValue(id, url) {
  const hid = document.getElementById(id); if (hid) hid.value = url || "";
  const thumb = document.querySelector(`[data-lightbox="${id}"]`);
  if (thumb) { thumb.classList.toggle("empty", !url); thumb.innerHTML = url ? `<img alt="">` : `<span>No photo</span>`; if (url) thumb.querySelector("img").src = url; }
}
function openLightbox(src) {
  if (!src) return;
  const div = document.createElement("div");
  div.className = "lightbox-overlay";
  div.innerHTML = `<button class="lightbox-close" aria-label="Close">&times;</button><img alt="">`;
  div.querySelector("img").src = src;
  div.addEventListener("click", () => div.remove());
  document.body.appendChild(div);
}

/* ============================================================
   AI VOICE CALLING (ElevenLabs) — safe by design.
   SAFE MODE (default): logs who WOULD be called, never dials.
   Every call passes callGuard() with several independent limits
   so nobody is ever bombarded. Real dialing happens only via the
   Firebase Function after you connect ElevenLabs + Twilio.
   ============================================================ */
const CALL_TRIGGERS = { manual: "Manual", enquiry: "Thanks Call (new lead)", visit: "Site-visit Call", reminder: "Reminder Call (CP)" };
function callSettings() {
  const d = DB.call_settings || {};
  return {
    liveMode: !!d.liveMode,                                   // false = SAFE MODE (never dials)
    paused: d.paused != null ? !!d.paused : false,            // global kill switch
    autoEnabled: d.autoEnabled != null ? !!d.autoEnabled : true,     // master switch for ALL automatic calls
    manualEnabled: d.manualEnabled != null ? !!d.manualEnabled : true, // master switch for the manual call button
    triggers: Object.assign({ manual: true, enquiry: true, visit: true, reminder: true }, d.triggers || {}),
    perDayMax: d.perDayMax || 1,                              // max calls per person per day
    cooldownH: d.cooldownH || 20,                             // min hours between calls to one number
    winStart: d.winStart != null ? d.winStart : 9,            // calling window start (IST hour)
    winEnd: d.winEnd != null ? d.winEnd : 20,                 // calling window end (IST hour, exclusive)
    globalDailyCap: d.globalDailyCap || 100,                  // safety valve across ALL numbers
  };
}
function saveCallSettings(patch) { DB.call_settings = Object.assign({}, DB.call_settings || {}, patch); save(); }
function callLog() { if (!DB.calls) DB.calls = []; return DB.calls; }
function callDnc() { if (!DB.call_dnc) DB.call_dnc = []; return DB.call_dnc; }
function callDigits(s) { return String(s || "").replace(/\D/g, ""); }
function istNow() { const n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + 5.5 * 3600000); }
function callGreeting() { const h = istNow().getHours(); return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening"; }
// Facts pulled from a lead for the AI call (passed to ElevenLabs as dynamic variables).
function callVars(lead) {
  const project = (lead.projects_shared || []).filter(Boolean)[0] || "";
  const cust = lead.customer_name || "";
  const fdate = lead.followup_at ? String(lead.followup_at).slice(0, 10) : "";
  return { customer_name: cust, broker_name: lead.source_name || "", project, meeting_time: lead.followup_at || "", followup_kind: lead.followup_kind || "", followup_date: fdate, greeting: callGreeting(), client_ref: cust || "your client" };
}
// The exact sentence the agent speaks first, per trigger (agent's First message = {{message}}).
// Automatic-call scripts reuse the same polished wording as the manual call types,
// so an auto Thank-you sounds identical to a manual Thanks Call, etc.
function callMessage(trigger, party, v) {
  if (trigger === "enquiry") return manualCallMessage("cust_thanks", v);
  if (trigger === "reminder") return manualCallMessage(party === "broker" ? "cp_reminder" : "cust_reminder", v);
  if (trigger === "visit") return `Hi ${v.customer_name || "there"}, this is Ashiesh Sharma. Delighted that your site visit to ${v.project || "the project"} is set for ${v.meeting_time || "the scheduled time"}. I will personally be there to show you around and assist you. Looking forward to hosting you.`;
  return `Hi ${v.customer_name || "there"}, this is Ashiesh Sharma. I wanted to personally connect regarding ${v.project || "your requirement"}. Whenever convenient, I would be glad to help you take the next step. Thank you for your time.`;
}
// The gatekeeper — returns {ok:true} only if EVERY safety check passes.
function callGuard(o) {
  const s = callSettings(), num = callDigits(o.number), lead = o.leadId ? leadById(o.leadId) : null;
  if (s.paused) return { ok: false, reason: "Calling is paused (kill switch is ON)" };
  if (o.trigger === "manual" && !s.manualEnabled) return { ok: false, reason: "Manual calls are turned off" };
  if (o.trigger !== "manual" && !s.autoEnabled) return { ok: false, reason: "Automatic calls are turned off" };
  if (!s.triggers[o.trigger]) return { ok: false, reason: `${CALL_TRIGGERS[o.trigger] || o.trigger} calls are turned off` };
  if (num.length < 10) return { ok: false, reason: "No valid 10-digit mobile number" };
  if (callDnc().some((d) => callDigits(d) === num)) return { ok: false, reason: "Number is on the Do-Not-Call list" };
  if (o.party === "broker") { const b = DB.brokers.find((x) => callDigits(x.mobiles).includes(num)) || (lead && DB.brokers.find((x) => (x.name || "").toLowerCase() === (lead.source_name || "").toLowerCase())); if (b && b.connect !== "Live") return { ok: false, reason: "Channel partner is not Active (terminated)" }; }
  if (o.party === "customer") { const c = DB.customers.find((x) => [x.mobile1, x.mobile2, x.mobile3].some((m) => callDigits(m) === num)) || (lead && DB.customers.find((x) => (x.name || "").toLowerCase() === (lead.customer_name || "").toLowerCase())); if (c && Number(c.contact_future != null ? c.contact_future : 1) === 0) return { ok: false, reason: "Customer is marked Do-not-contact" }; }
  if (o.trigger !== "manual" && lead) {
    if (lead.status !== "Active") return { ok: false, reason: "Lead is not Active" };
    if (o.party === "customer" && !lead.call_customer) return { ok: false, reason: "Auto-call to customer is OFF for this lead" };
    if (o.party === "broker" && !lead.call_broker) return { ok: false, reason: "Auto-call to CP is OFF for this lead" };
  }
  const h = istNow().getHours();
  if (h < s.winStart || h >= s.winEnd) return { ok: false, reason: `Outside calling hours (${s.winStart}:00–${s.winEnd}:00 IST)` };
  if (o.trigger !== "manual" && o.leadId && callLog().some((c) => c.leadId === o.leadId && c.trigger === o.trigger && c.status !== "skipped")) return { ok: false, reason: "Already called for this " + (CALL_TRIGGERS[o.trigger] || o.trigger) };
  const t = today();
  const madeToday = callLog().filter((c) => callDigits(c.number) === num && c.status !== "skipped" && String(c.ts).slice(0, 10) === t).length;
  if (madeToday >= s.perDayMax) return { ok: false, reason: `Daily limit reached for this number (${s.perDayMax}/day)` };
  const last = callLog().filter((c) => callDigits(c.number) === num && c.status !== "skipped").sort((a, b) => (b.ts_ms || 0) - (a.ts_ms || 0))[0];
  if (last && (Date.now() - (last.ts_ms || 0)) < s.cooldownH * 3600000) return { ok: false, reason: `Cooldown — this number was called under ${s.cooldownH}h ago` };
  if (callLog().filter((c) => c.status !== "skipped" && String(c.ts).slice(0, 10) === t).length >= s.globalDailyCap) return { ok: false, reason: "Global daily safety cap reached" };
  return { ok: true };
}
function requestCall(o) {
  const s = callSettings(), g = callGuard(o);
  const e = { id: "CALL-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: now(), ts_ms: Date.now(), party: o.party, name: o.name || "", number: callDigits(o.number), leadId: o.leadId || "", trigger: o.trigger, mode: s.liveMode ? "live" : "safe", customer_name: o.customer_name || "", broker_name: o.broker_name || "", project: o.project || "", meeting_time: o.meeting_time || "", greeting: o.greeting || "", client_ref: o.client_ref || "", message: o.message || "" };
  if (!g.ok) { e.status = "skipped"; e.reason = g.reason; callLog().unshift(e); save(); return { ok: false, reason: g.reason }; }
  if (s.liveMode) { e.status = "queued"; e.reason = "Queued for ElevenLabs"; callLog().unshift(e); save(); try { if (typeof window !== "undefined" && window.RCRM_FB && RCRM_FB.enqueueCall) RCRM_FB.enqueueCall(e); } catch (x) {} return { ok: true, live: true }; }
  e.status = "logged"; e.reason = "Safe Mode — no real call was made"; callLog().unshift(e); save();
  return { ok: true, live: false };
}
// Fire an auto trigger for a lead (called on save). All guards apply; skips are logged quietly.
function autoCallForLead(lead, trigger) {
  if (!lead) return; const s = callSettings(); if (!s.triggers[trigger]) return;
  const v = callVars(lead);
  if (lead.call_customer && lead.customer_mobile) requestCall(Object.assign({ party: "customer", number: lead.customer_mobile, name: lead.customer_name, leadId: lead.id, trigger, message: callMessage(trigger, "customer", v) }, v));
  if (lead.call_broker && lead.source_mobile) requestCall(Object.assign({ party: "broker", number: lead.source_mobile, name: lead.source_name, leadId: lead.id, trigger, message: callMessage(trigger, "broker", v) }, v));
}
// The pre-written spoken scripts for a manual call, by chosen type.
function manualCallMessage(kind, v) {
  const name = v.customer_name || "there", cp = v.broker_name || "there";
  const project = v.project || "the project";
  const stage = v.followup_kind || "our upcoming discussion";
  const date = v.followup_date || "the scheduled date";
  switch (kind) {
    case "cust_thanks": return `Hi ${name}, this is Ashiesh Sharma. Thank you so much for showing interest in ${project}. I really appreciate it, and I will personally make sure you get the right information and assistance regarding the project. I look forward to connecting with you soon. Have a wonderful day.`;
    case "cust_feedback": return `Hi ${name}, this is Ashiesh Sharma. I just wanted to personally check in and understand how your experience has been so far. I would really value your feedback — about the project, the information shared with you, or anything you would like us to improve. Your feedback is genuinely important to me. Thank you, and I look forward to speaking with you again.`;
    case "cust_reminder": return `Hi ${name}, this is Ashiesh Sharma. Just a quick and friendly reminder regarding our scheduled ${stage} on ${date}. I am looking forward to connecting with you and taking the discussion ahead. Thank you, and I will speak with you soon.`;
    case "cp_reminder": return `Hi ${cp}, this is Ashiesh Sharma. Just a quick reminder, with thanks, regarding our scheduled ${stage} on ${date} with ${v.client_ref || "your client"} for ${project}. I really appreciate your support and coordination. Let us make this opportunity work together and create a great experience for the customer. Looking forward to the discussion. Thank you, and speak with you soon.`;
    case "cp_thanks": return `Hi ${cp}, this is Ashiesh Sharma. Thank you for your continued support and coordination — I truly value our association. Let us keep creating great experiences for our customers together. Looking forward to working closely. Thank you.`;
    default: return `Hi ${name}, this is Ashiesh Sharma. I wanted to personally connect regarding ${project}. Whenever convenient, I would be glad to help you take the next step. Thank you for your time.`;
  }
}
// Manual call button → first ask WHICH type of call, then place it with that script.
function manualCall(leadId, party) {
  const l = leadById(leadId); if (!l) return;
  const number = party === "customer" ? l.customer_mobile : l.source_mobile;
  const name = party === "customer" ? l.customer_name : l.source_name;
  if (!callDigits(number)) return toast("No mobile number on file for this " + (party === "customer" ? "customer" : "CP"));
  const opts = party === "customer"
    ? [["cust_thanks", "🙏 Thanks Call", "First-time lead — thank them for their interest"], ["cust_feedback", "💬 Feedback Call", "Check in and ask how their experience has been"], ["cust_reminder", "⏰ Reminder Call", "Remind about the next scheduled follow-up"]]
    : [["cp_reminder", "⏰ Reminder Call", "Remind the CP about today's meeting with the client"], ["cp_thanks", "🤝 Thank-you Call", "Thank the CP for their support & coordination"]];
  modal("📞 Choose call type · " + (esc(name) || esc(callDigits(number))), `
    <div class="cc-choose">${opts.map(([k, lbl, sub]) => `<button type="button" class="cc-choice" data-callkind="${k}"><span class="cc-choice-t">${lbl}</span><span class="cc-choice-s">${sub}</span></button>`).join("")}</div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button></div>`, false);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.querySelectorAll("[data-callkind]").forEach((b) => b.onclick = () => { closeModal(); placeManualCall(leadId, party, b.getAttribute("data-callkind")); });
}
function placeManualCall(leadId, party, kind) {
  const l = leadById(leadId); if (!l) return;
  const number = party === "customer" ? l.customer_mobile : l.source_mobile;
  const name = party === "customer" ? l.customer_name : l.source_name;
  const s = callSettings(), v = callVars(l);
  const who = (name || (party === "customer" ? "customer" : "channel partner")) + " · " + callDigits(number);
  if (!confirm(`${s.liveMode ? "Place an AI voice call" : "Log a test call (SAFE MODE — no real call is made)"} to ${who}?`)) return;
  const r = requestCall(Object.assign({ party, number, name, leadId, trigger: "manual", message: manualCallMessage(kind, v) }, v));
  if (r.ok) toast(s.liveMode ? "📞 Call queued" : "✓ Safe Mode: logged (no real call made)");
  else toast("Not called — " + r.reason);
}
function openCallCenter() {
  const s = callSettings();
  const log = callLog().slice(0, 80);
  const tgl = (key, label) => `<label class="cc-toggle"><input type="checkbox" data-cctrig="${key}" ${s.triggers[key] ? "checked" : ""}/><span>${label}</span></label>`;
  const rows = log.length ? log.map((c) => `<tr>
      <td class="cc-when">${esc(String(c.ts).slice(5))}</td>
      <td>${esc(c.name || "—")}<div class="cc-num">${esc(c.number)}</div></td>
      <td>${c.party === "customer" ? "Customer" : "CP"}</td>
      <td>${esc(CALL_TRIGGERS[c.trigger] || c.trigger)}</td>
      <td><span class="cc-st cc-st-${c.status}">${esc(c.status)}</span>${c.reason ? `<div class="cc-reason">${esc(c.reason)}</div>` : ""}</td>
    </tr>`).join("") : `<tr><td colspan="5" class="muted" style="padding:18px">No calls logged yet.</td></tr>`;
  modal("📞 Call Center", `
    <div class="cc">
      <div class="cc-mode ${s.liveMode ? "live" : "safe"}">
        <div><b>${s.liveMode ? "● LIVE — real AI calls are ON" : "● SAFE MODE — no real calls are made"}</b>
        <div class="muted" style="font-size:11.5px;margin-top:2px">${s.liveMode ? "Calls go out through ElevenLabs. All safety limits still apply." : "Everything is logged so you can verify it, but nothing dials. Connect ElevenLabs (see the setup guide) before going live."}</div></div>
        <label class="cc-switch"><input type="checkbox" id="ccLive" ${s.liveMode ? "checked" : ""}/><span>Go live</span></label>
      </div>

      <div class="cc-row cc-masters">
        <label class="cc-master ${s.autoEnabled ? "on" : ""}"><input type="checkbox" id="ccAuto" ${s.autoEnabled ? "checked" : ""}/><span>🤖 Enable Automatic Calls</span></label>
        <label class="cc-master ${s.manualEnabled ? "on" : ""}"><input type="checkbox" id="ccManual" ${s.manualEnabled ? "checked" : ""}/><span>👆 Enable Manual Calls</span></label>
        <label class="cc-toggle cc-kill"><input type="checkbox" id="ccPause" ${s.paused ? "checked" : ""}/><span>⛔ Pause ALL (kill switch)</span></label>
      </div>

      <div class="cc-grid">
        <div class="cc-card${s.autoEnabled ? "" : " cc-dim"}">
          <div class="cc-h">Automatic call types <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">(only when Automatic is on)</span></div>
          ${tgl("enquiry", "Thanks Call (new lead)")}${tgl("visit", "Site-visit Call")}${tgl("reminder", "Reminder Call (CP)")}
        </div>
        <div class="cc-card">
          <div class="cc-h">Anti-bombard limits</div>
          <label class="cc-lim">Max calls per person / day <input type="number" min="1" max="5" id="ccPerDay" value="${s.perDayMax}"/></label>
          <label class="cc-lim">Cooldown between calls (hours) <input type="number" min="1" max="72" id="ccCool" value="${s.cooldownH}"/></label>
          <label class="cc-lim">Calling window (IST) <span><input type="number" min="0" max="23" id="ccWinS" value="${s.winStart}"/>–<input type="number" min="0" max="24" id="ccWinE" value="${s.winEnd}"/></span></label>
        </div>
        <div class="cc-card">
          <div class="cc-h">Do-Not-Call list</div>
          <div class="cc-dnc">${callDnc().length ? callDnc().map((d) => `<span class="cc-dnc-chip">${esc(callDigits(d))}<button data-dncdel="${esc(callDigits(d))}">×</button></span>`).join("") : `<span class="muted" style="font-size:12px">Empty</span>`}</div>
          <div class="cc-dnc-add"><input id="ccDncNum" placeholder="Add a number to block" inputmode="tel"/><button class="btn light sm" id="ccDncAdd">Block</button></div>
        </div>
      </div>

      <div class="cc-h" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <span>Call history <span class="muted" style="font-weight:400">— every attempt, including why one was skipped</span></span>
        <a class="btn light sm" href="https://elevenlabs.io/app/conversational-ai/history" target="_blank" rel="noopener">🎧 Recordings &amp; transcripts ↗</a>
      </div>
      <div class="cc-logwrap"><table class="cc-log"><thead><tr><th>When</th><th>Who</th><th>Party</th><th>Trigger</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <div class="modal-foot"><button class="btn outline" data-close2>Close</button><button class="btn danger" id="ccClear">Clear history</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  const live = document.getElementById("ccLive");
  live.onchange = () => { if (live.checked && !confirm("Turn ON live calling? Real AI calls will start going out (all limits still apply). Only do this after connecting ElevenLabs.")) { live.checked = false; return; } saveCallSettings({ liveMode: live.checked }); openCallCenter(); };
  document.getElementById("ccPause").onchange = (e) => { saveCallSettings({ paused: e.target.checked }); toast(e.target.checked ? "All calls paused" : "Calls resumed"); };
  document.getElementById("ccAuto").onchange = (e) => { saveCallSettings({ autoEnabled: e.target.checked }); toast("Automatic calls " + (e.target.checked ? "ON" : "OFF")); openCallCenter(); };
  document.getElementById("ccManual").onchange = (e) => { saveCallSettings({ manualEnabled: e.target.checked }); toast("Manual calls " + (e.target.checked ? "ON" : "OFF")); };
  document.querySelectorAll("[data-cctrig]").forEach((cb) => cb.onchange = () => { const tr = Object.assign({}, callSettings().triggers); tr[cb.getAttribute("data-cctrig")] = cb.checked; saveCallSettings({ triggers: tr }); });
  const numSet = (id, key, lo, hi) => { const el = document.getElementById(id); if (el) el.onchange = () => { let v = Math.max(lo, Math.min(hi, Number(el.value) || lo)); el.value = v; saveCallSettings({ [key]: v }); }; };
  numSet("ccPerDay", "perDayMax", 1, 5); numSet("ccCool", "cooldownH", 1, 72); numSet("ccWinS", "winStart", 0, 23); numSet("ccWinE", "winEnd", 1, 24);
  const add = document.getElementById("ccDncAdd"); if (add) add.onclick = () => { const n = callDigits(document.getElementById("ccDncNum").value); if (n.length < 10) return toast("Enter a valid number"); if (!callDnc().some((d) => callDigits(d) === n)) callDnc().push(n); save(); openCallCenter(); };
  document.querySelectorAll("[data-dncdel]").forEach((b) => b.onclick = () => { const n = b.getAttribute("data-dncdel"); DB.call_dnc = callDnc().filter((d) => callDigits(d) !== n); save(); openCallCenter(); });
  document.getElementById("ccClear").onclick = () => { if (confirm("Clear the whole call history? (Settings and limits are kept.)")) { DB.calls = []; save(); openCallCenter(); } };
}

/* ---------- Lead form ---------- */
function openLeadForm(existing) {
  const l = existing || { lead_date: today(), source_type: "CP", stage: "Call", rating: "Warm", status: "Active" };
  const sel = {};
  (l.projects_shared || []).forEach((n) => (sel[n] = (l.costing || {})[n] || ""));
  const units0 = l.units || {};
  const projRows = DB.projects.length
    ? DB.projects.map((p, i) => {
        const on = p.name in sel;
        return `<div class="proj-row"><label><input type="checkbox" data-proj="${esc(p.name)}" ${on ? "checked" : ""}/> <span>${esc(p.name)} <span class="muted">${esc(p.type || "")}</span></span></label>
          <div class="proj-inputs" data-projinputs="${esc(p.name)}" style="${on ? "" : "display:none"}">
            <input type="text" class="proj-unit" data-unit="${esc(p.name)}" list="ulist_${i}" placeholder="Unit no(s) — pick or type, e.g. A-101, B-202" value="${esc(units0[p.name] || "")}"/>
            <input type="text" class="proj-cost" data-cost="${esc(p.name)}" placeholder="Costing e.g. 3.7 Cr" value="${esc(sel[p.name] || "")}"/>
            <datalist id="ulist_${i}" data-uproj="${esc(p.name)}"></datalist>
          </div></div>`;
      }).join("")
    : `<div class="muted" style="font-size:13px">Add projects in the Projects module to select them here.</div>`;
  modal(existing && existing.id ? "Edit Enquiry" : "New Enquiry", `
    <div class="lf">
      <div class="lf-sec">
        <div class="lf-sec-head lf-indigo">${IC.clip}<span>Enquiry</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${field("Lead Date", "f_lead_date", l.lead_date, "date")}
          ${pillField("Enquiry Type", "f_enquiry_type", ENQUIRY_TYPES, l.enquiry_type, true)}
          ${pillField("Requirement", "f_requirement", REQUIREMENTS, l.requirement, true)}
          ${pillField("Budget", "f_budget", BUDGETS, l.budget, true)}
        </div></div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-teal">${IC.link}<span>Source</span><span class="fs-hint">pick a CP to auto-fill, or type a new name to create one</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${pillField("Source Type", "f_source_type", ["CP", "CL", "Reference"], l.source_type, true)}
          <div class="field"><label>Source / CP Name</label><input id="f_source_name" list="cpList" autocomplete="off" value="${esc(l.source_name || "")}" placeholder="Type or pick a CP" /><datalist id="cpList">${DB.brokers.map((b) => `<option value="${esc(b.name)}">${esc(b.firm || "")}</option>`).join("")}</datalist></div>
          <div class="field"><label>Source Mobile</label><input id="f_source_mobile" list="cpMobList" autocomplete="off" inputmode="tel" value="${esc(l.source_mobile || "")}" placeholder="Type or pick a number" /><datalist id="cpMobList">${DB.brokers.filter((b) => b.mobiles).map((b) => `<option value="${esc(String(b.mobiles).split(",")[0].trim())}">${esc(b.name)}${b.firm ? " · " + esc(b.firm) : ""}</option>`).join("")}</datalist></div>
          <div class="field"><label>CP Firm</label><input id="f_source_firm" list="cpFirmList" autocomplete="off" value="${esc(l.source_firm || "")}" placeholder="Type or pick a firm" /><datalist id="cpFirmList">${uniqueFirms().map((fm) => `<option value="${esc(fm)}"></option>`).join("")}</datalist></div>
        </div></div>
      </div>
      <div class="lf-sec" id="lf-customer-sec">
        <div class="lf-sec-head lf-amber">${IC.user}<span>Customer Details</span><span class="fs-hint">auto-fills from your customer list, or creates a new record on save</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          <div class="field"><label>Name</label><input id="f_customer_name" list="custList" autocomplete="off" value="${esc(l.customer_name || "")}" placeholder="Type or pick a customer" /><datalist id="custList">${DB.customers.map((c) => `<option value="${esc(c.name)}"></option>`).join("")}</datalist></div>
          ${field("Mobile", "f_customer_mobile", l.customer_mobile)}
          ${field("Email", "f_customer_email", l.customer_email)}${field("City", "f_customer_city", l.customer_city)}
          ${field("Profession", "f_customer_profession", l.customer_profession)}${pillField("Category", "f_customer_category", CATEGORIES, l.customer_category, true)}
        </div></div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-purple">${IC.building}<span>Projects Shared &amp; Costing</span></div>
        <div class="lf-sec-body">${projRows}</div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-green">${IC.target}<span>Tracking</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${pillField("Lead Stage", "f_stage", STAGES, l.stage, true)}
          ${pillField("Lead Rating", "f_rating", RATINGS, l.rating, true)}
          ${pillFieldColored("Lead Status", "f_status", STATUSES, l.status, STATUS_PILL_COLORS, true)}
          ${field("Next Follow-up", "f_followup", l.followup_at ? l.followup_at.replace(" ", "T").slice(0, 16) : "", "datetime-local")}
          ${field("Follow-up Type", "f_followup_kind", l.followup_kind || "", "", SCHEDULE_TYPES)}
          ${field("Remark", "f_remark", l.remark, "textarea")}
        </div></div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-indigo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8 9.6a16 16 0 006 6l1.2-1.1a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z"/></svg><span>AI Voice Calling</span><span class="fs-hint">Safe Mode — nothing dials until you enable it in Settings → Call Center</span></div>
        <div class="lf-sec-body">
          <label class="call-toggle"><input type="checkbox" id="f_call_customer" ${l.call_customer ? "checked" : ""}/><span>Auto-call this <b>customer</b> — thank-you &amp; reminders</span></label>
          <label class="call-toggle"><input type="checkbox" id="f_call_broker" ${l.call_broker ? "checked" : ""}/><span>Auto-call this <b>channel partner</b> — thank-you &amp; reminders</span></label>
          <p class="muted" style="font-size:11px;margin-top:8px">Only ever calls Active CPs and contact-in-future customers · max 1 call/person/day · 9 AM–8 PM only.</p>
        </div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="saveLead">Save Enquiry</button></div>`, true);
  document.querySelectorAll("[data-proj]").forEach((cb) => cb.addEventListener("change", (e) => { const name = e.target.getAttribute("data-proj"); const box = document.querySelector(`[data-projinputs="${CSS.escape(name)}"]`); if (box) box.style.display = e.target.checked ? "" : "none"; }));
  loadLeadFormUnits();
  // ---- Smart CP autofill: match by Name, Mobile, or Firm and cross-fill the rest.
  // Matching is EXACT (case-insensitive) so typing a brand-new CP that merely resembles
  // an existing one never overwrites — you only get filled when you pick/enter a real match.
  const cpName = document.getElementById("f_source_name"),
        cpMob = document.getElementById("f_source_mobile"),
        cpFirm = document.getElementById("f_source_firm");
  const brNorm = (s) => String(s || "").trim().toLowerCase();
  const brDigits = (s) => String(s || "").replace(/\D/g, "");
  const brFirstMob = (b) => (b && b.mobiles) ? String(b.mobiles).split(",")[0].trim() : "";
  const brokerByName = (v) => { const k = brNorm(v); return k ? DB.brokers.find((b) => brNorm(b.name) === k) : null; };
  const brokerByMobile = (v) => { const d = brDigits(v); if (d.length < 6) return null; return DB.brokers.find((b) => String(b.mobiles || "").split(",").some((m) => brDigits(m) === d)) || null; };
  const brokersByFirm = (v) => { const k = brNorm(v); return k ? DB.brokers.filter((b) => brNorm(b.firm) === k) : []; };
  const setV = (el, v) => { if (el && v != null) el.value = v; };
  let _lastCp = "";
  const fillFrom = (b, via) => {
    if (!b) return;
    if (via !== "name") setV(cpName, b.name || "");
    if (via !== "firm") setV(cpFirm, b.firm || "");
    if (via !== "mobile") setV(cpMob, brFirstMob(b));
    if (_lastCp !== b.name) { toast("Auto-filled CP: " + b.name); _lastCp = b.name; }
  };
  const wire = (el, finder, via) => { if (!el) return; const h = () => { const b = finder(el.value); if (b) fillFrom(b, via); }; el.addEventListener("change", h); el.addEventListener("input", h); };
  wire(cpName, brokerByName, "name");
  wire(cpMob, brokerByMobile, "mobile");
  if (cpFirm) { const h = () => { const list = brokersByFirm(cpFirm.value); if (list.length === 1) fillFrom(list[0], "firm"); }; cpFirm.addEventListener("change", h); cpFirm.addEventListener("input", h); }
  const custIn = document.getElementById("f_customer_name");
  if (custIn) custIn.addEventListener("change", () => {
    const c = DB.customers.find((x) => (x.name || "").trim().toLowerCase() === custIn.value.trim().toLowerCase());
    if (c) {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
      set("f_customer_mobile", c.mobile1); set("f_customer_email", c.email); set("f_customer_city", c.city);
      set("f_customer_category", c.category); set("f_customer_profession", c.profession);
      const rt = document.getElementById("f_customer_rating"); if (rt) rt.value = c.rating || "";
      toast("Auto-filled from customer: " + c.name);
    }
  });
  const custMob = document.getElementById("f_customer_mobile");
  if (custMob) custMob.addEventListener("change", () => {
    const digits = (custMob.value || "").replace(/\D/g, "");
    if (digits.length < 6) return;
    const c = DB.customers.find((x) => [x.mobile1, x.mobile2, x.mobile3].some((m) => m && String(m).replace(/\D/g, "") === digits));
    if (c && confirm(`Existing customer record found for this number:\n\n${c.name}${c.city ? " · " + c.city : ""}${c.category ? " · " + c.category : ""}\n\nAuto-fill their details?`)) {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
      set("f_customer_name", c.name); set("f_customer_email", c.email); set("f_customer_city", c.city);
      set("f_customer_category", c.category); set("f_customer_profession", c.profession);
      toast("Filled from existing customer: " + c.name);
    }
  });
  const etSel = document.getElementById("f_enquiry_type"), custSec = document.getElementById("lf-customer-sec");
  const toggleCust = () => { if (custSec) custSec.style.display = etSel.value === "CP Details Only" ? "none" : ""; };
  if (etSel) etSel.addEventListener("change", toggleCust);
  toggleCust();
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("saveLead").onclick = () => {
    const projects_shared = [], costing = {}, units = {};
    document.querySelectorAll("[data-proj]:checked").forEach((cb) => { const name = cb.getAttribute("data-proj"); projects_shared.push(name); const c = document.querySelector(`[data-cost="${CSS.escape(name)}"]`); if (c && c.value.trim()) costing[name] = c.value.trim(); const u = document.querySelector(`[data-unit="${CSS.escape(name)}"]`); if (u && u.value.trim()) units[name] = u.value.trim(); });
    const et = fieldVal("f_enquiry_type"), custOn = et !== "CP Details Only";
    let _stage = fieldVal("f_stage"); const _status = fieldVal("f_status");
    // Site visit done (SVD) + marked Inactive → auto-move to VDNB (visit done, not booked).
    if (_status === "Inactive" && _stage === "SVD") _stage = "VDNB";
    const savedLead = upsert("leads", {
      id: l.id, lead_number: l.lead_number || "LD-" + Date.now().toString(36).toUpperCase(), web_src: l.web_src, web_synced_ts: l.web_synced_ts,
      lead_date: fieldVal("f_lead_date"), enquiry_type: et, requirement: fieldVal("f_requirement"), budget: fieldVal("f_budget"),
      source_type: fieldVal("f_source_type"), source_name: fieldVal("f_source_name"), source_mobile: fieldVal("f_source_mobile"), source_firm: fieldVal("f_source_firm"),
      customer_name: custOn ? fieldVal("f_customer_name") : "", customer_mobile: custOn ? fieldVal("f_customer_mobile") : "", customer_email: custOn ? fieldVal("f_customer_email") : "",
      customer_city: custOn ? fieldVal("f_customer_city") : "", customer_category: custOn ? fieldVal("f_customer_category") : "", customer_profession: custOn ? fieldVal("f_customer_profession") : "",
      projects_shared, costing, units, stage: _stage, rating: fieldVal("f_rating"), status: _status,
      followup_at: fieldVal("f_followup") ? fieldVal("f_followup").replace("T", " ") : "", followup_kind: fieldVal("f_followup_kind"), remark: fieldVal("f_remark"),
      call_customer: !!(document.getElementById("f_call_customer") || {}).checked, call_broker: !!(document.getElementById("f_call_broker") || {}).checked,
      level: Math.max(Number(l.level) || 1, stageLevel(_stage)),   // journey ratchets forward, never back
    });
    // AI voice-calling triggers — only for ACTIVE leads, only where you toggled the
    // party on, and each fires ONCE per lead (the guard dedupes). Reminders are handled
    // separately by the scheduled backend at 10 AM.
    if (savedLead.status === "Active") {
      autoCallForLead(savedLead, "enquiry");
      if (_stage === "SVD") autoCallForLead(savedLead, "visit");
    }
    const extras = [];
    const st = fieldVal("f_source_type"), sn = fieldVal("f_source_name");
    if (st === "CP" && sn && !DB.brokers.some((b) => (b.name || "").trim().toLowerCase() === sn.trim().toLowerCase())) {
      upsert("brokers", { name: sn, mobiles: fieldVal("f_source_mobile"), firm: fieldVal("f_source_firm"), connect: "Live" });
      extras.push("CP '" + sn + "' added to Brokers");
    }
    const cn = fieldVal("f_customer_name"), cnDigits = fieldVal("f_customer_mobile").replace(/\D/g, "");
    const custExists = DB.customers.some((c) => (c.name || "").trim().toLowerCase() === cn.trim().toLowerCase() || (cnDigits && [c.mobile1, c.mobile2, c.mobile3].some((m) => m && String(m).replace(/\D/g, "") === cnDigits)));
    if (custOn && cn && !custExists) {
      upsert("customers", { name: cn, mobile1: fieldVal("f_customer_mobile"), email: fieldVal("f_customer_email"), city: fieldVal("f_customer_city"), category: fieldVal("f_customer_category"), profession: fieldVal("f_customer_profession"), contact_future: 1 });
      extras.push("customer '" + cn + "' added");
    }
    gcalMaybeInsert("lead", savedLead);
    closeModal(); toast("Enquiry saved" + (extras.length ? " · " + extras.join(" · ") : "")); go(active === "dash" || active === "followups" || active === "calendar" ? active : "leads");
  };
}

/* ---------- Broker form ---------- */
function openBrokerForm(existing) {
  const b = existing || { connect: "Live" };
  modal(existing && existing.id ? "Edit Broker" : "Empanel Broker", `
    <div class="lf">
      <div class="lf-sec">
        <div class="lf-sec-head lf-indigo">${IC.user}<span>Broker Details</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${field("Broker Name", "b_name", b.name)}
          <div class="field"><label>Firm / Company</label><input id="b_firm" list="firmList" autocomplete="off" placeholder="Type to search or add new…" value="${esc(b.firm || "")}" /><datalist id="firmList">${uniqueFirms().map((fm) => `<option value="${esc(fm)}"></option>`).join("")}</datalist></div>
          ${field("Mobile Numbers", "b_mobiles", b.mobiles, "full")}
          ${field("Team Size", "b_team", b.team_size, "number")}${pillField("Grade (firm-level)", "b_grade", GRADES, b.grade || firmGrade(b.firm), true)}
          ${imageField("Broker Photo", "b_image", b.image_url)}
        </div></div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-teal">${IC.home}<span>Location</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${field("City", "b_city", b.city)}${field("Sector", "b_sector", b.sector)}
          ${field("Address", "b_address", b.address, "full")}
        </div></div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-green">${IC.target}<span>Engagement</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${pillField("Connect Status", "b_connect", CONNECT, b.connect, true)}${field("Next Follow-up", "b_followup", b.followup_at ? b.followup_at.replace(" ", "T").slice(0, 16) : "", "datetime-local")}
          ${field("Remark", "b_remark", b.remark, "textarea")}
        </div></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="saveBroker">Save Broker</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  // When an existing firm is picked, auto-fill that firm's grade.
  const firmInp = document.getElementById("b_firm");
  if (firmInp) firmInp.addEventListener("change", () => {
    const g = firmGrade(firmInp.value); if (!g) return;
    const gh = document.getElementById("b_grade"); if (gh) gh.value = g;
    document.querySelectorAll('[data-pill^="b_grade::"]').forEach((btn) => btn.classList.toggle("on", btn.getAttribute("data-pill") === "b_grade::" + g));
  });
  document.getElementById("saveBroker").onclick = () => {
    const name = fieldVal("b_name"); if (!name) return toast("Broker name is required");
    const firm = fieldVal("b_firm"), grade = fieldVal("b_grade");
    const savedBroker = upsert("brokers", { id: b.id, name, firm, mobiles: fieldVal("b_mobiles"), grade, team_size: fieldVal("b_team"), city: fieldVal("b_city"), sector: fieldVal("b_sector"), address: fieldVal("b_address"), connect: fieldVal("b_connect"), followup_at: fieldVal("b_followup") ? fieldVal("b_followup").replace("T", " ") : "", remark: fieldVal("b_remark"), image_url: fieldVal("b_image") });
    // Grade is a firm property: keep every broker of this firm on the same grade.
    if (firm && grade) { const key = firm.trim().toLowerCase(); DB.brokers.forEach((x) => { if ((x.firm || "").trim().toLowerCase() === key) x.grade = grade; }); save(); }
    gcalMaybeInsert("broker", savedBroker);
    closeModal(); toast("Broker saved"); go(active === "brokers" ? "brokers" : active);
  };
}

/* ---------- Customer form ---------- */
function openCustomerForm(existing) {
  const c = existing || { contact_future: 1 };
  modal(existing ? "Edit Customer" : "Add Customer", `
    <div class="lf">
      <div class="lf-sec">
        <div class="lf-sec-head lf-indigo">${IC.user}<span>Identity</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${field("Name", "c_name", c.name)}${field("Email", "c_email", c.email)}
          ${field("Mobile 1", "c_mobile1", c.mobile1)}${field("Mobile 2", "c_mobile2", c.mobile2)}
          ${field("Mobile 3", "c_mobile3", c.mobile3)}
          ${pillField("Category", "c_category", CATEGORIES, c.category, true)}
        </div></div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-teal">${IC.home}<span>Location</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${field("City", "c_city", c.city)}${field("State", "c_state", c.state)}
          ${field("Address", "c_address", c.address, "full")}
        </div></div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-amber">${IC.star}<span>Personal & Value</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${field("Date of Birth", "c_dob", c.dob, "date")}${field("Anniversary", "c_anniv", c.anniversary, "date")}
          ${field("Profession", "c_prof", c.profession)}${starField("Rating", "c_rating", c.rating)}
        </div></div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-green">${IC.target}<span>Preferences</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${pillField("Contact in Future", "c_future", ["Yes", "No"], String(c.contact_future ?? 1) === "1" ? "Yes" : "No", true)}
          ${imageField("Customer Photo", "c_image", c.image_url)}
          ${field("Remark", "c_remark", c.remark, "textarea")}
        </div></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="saveCust">Save Customer</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("saveCust").onclick = () => {
    const name = fieldVal("c_name"); if (!name) return toast("Customer name is required");
    upsert("customers", { id: c.id, name, category: fieldVal("c_category"), mobile1: fieldVal("c_mobile1"), mobile2: fieldVal("c_mobile2"), mobile3: fieldVal("c_mobile3"), email: fieldVal("c_email"), city: fieldVal("c_city"), state: fieldVal("c_state"), address: fieldVal("c_address"), dob: fieldVal("c_dob"), anniversary: fieldVal("c_anniv"), profession: fieldVal("c_prof"), rating: fieldVal("c_rating"), contact_future: fieldVal("c_future") === "No" ? 0 : 1, image_url: fieldVal("c_image"), remark: fieldVal("c_remark") });
    closeModal(); toast("Customer saved"); go(active === "customers" ? "customers" : active);
  };
}

/* ---------- Project form ---------- */
function openProjectForm(existing) {
  const p = existing || { status: "Live" };
  modal(existing ? "Edit Project" : "Add Project", `
    <div class="lf">
      <div class="lf-sec">
        <div class="lf-sec-head lf-indigo">${IC.building}<span>Project</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${field("Project Name", "p_name", p.name, "full")}${field("Type", "p_type", p.type, "", PROJ_TYPES)}
          ${field("Location / Sector", "p_loc", p.location)}${field("Status", "p_status", p.status, "", PROJ_STATUS)}
        </div></div>
      </div>
      <div class="lf-sec">
        <div class="lf-sec-head lf-amber">${IC.money}<span>Pricing & Inventory</span></div>
        <div class="lf-sec-body"><div class="form-grid">
          ${field("Price From", "p_min", p.price_min)}${field("Price To", "p_max", p.price_max)}
          ${field("Total Units", "p_total", p.total_units, "number")}${field("Available Units", "p_avail", p.available_units, "number")}
          ${field("Notes", "p_notes", p.notes, "textarea")}
        </div></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="saveProj">Save Project</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("saveProj").onclick = () => {
    const name = fieldVal("p_name"); if (!name) return toast("Project name is required");
    upsert("projects", { id: p.id, name, type: fieldVal("p_type"), location: fieldVal("p_loc"), price_min: fieldVal("p_min"), price_max: fieldVal("p_max"), total_units: fieldVal("p_total"), available_units: fieldVal("p_avail"), status: fieldVal("p_status"), notes: fieldVal("p_notes") });
    closeModal(); toast("Project saved"); go(active === "projects" ? "projects" : active);
  };
}

/* ---------- Activity trail ---------- */
function openActivity(entity, id) {
  const row = entity === "lead" ? leadById(id) : brokerById(id);
  const kinds = entity === "lead" ? ["Call", "F2F", "SVD", "Negotiation", "VDNB", "Note"] : ["Call", "Meeting", "Note"];
  const label = row.customer_name || row.name || row.lead_number || "";
  const nowLocal = new Date(); const nl = `${nowLocal.getFullYear()}-${pad(nowLocal.getMonth() + 1)}-${pad(nowLocal.getDate())}T${pad(nowLocal.getHours())}:${pad(nowLocal.getMinutes())}`;
  modal("Activity Trail — " + label, `
    <div class="card pad" style="background:#f8fafc;margin-bottom:16px;">
      <div class="form-grid">
        ${field("Activity Done", "a_kind", "Call", "", kinds)}${field("Date & Time", "a_when", nl, "datetime-local")}
        ${field("Remark", "a_remark", "", "textarea")}
      </div>
      <div class="pf-sched">
        <div class="pf-sched-title">📅 Set Next Follow-up</div>
        <div class="form-grid">
          ${field("Schedule Type", "a_nextkind", "Call", "", SCHEDULE_TYPES)}
          ${field("Date & Time", "a_followup", row.followup_at ? row.followup_at.replace(" ", "T").slice(0, 16) : "", "datetime-local")}
        </div>
      </div>
      <div style="text-align:right;margin-top:10px;"><button class="btn primary" id="addAct">Add to Trail</button></div>
    </div>
    <ol class="timeline" id="trail"></ol>`);
  renderTrail(entity, id);
  const aRemarkEl = document.getElementById("a_remark");
  if (aRemarkEl) aRemarkEl.addEventListener("input", () => aRemarkEl.classList.remove("needfill"));
  document.getElementById("addAct").onclick = () => {
    const remark = fieldVal("a_remark");
    if (!remark) { if (aRemarkEl) { aRemarkEl.classList.add("needfill"); aRemarkEl.focus(); } return toast("Add a remark to log this activity"); }
    const fu = fieldVal("a_followup");
    addActivity({ entity_type: entity, entity_id: id, kind: fieldVal("a_kind"), remark, activity_at: (fieldVal("a_when") || nl).replace("T", " "), next_kind: fu ? fieldVal("a_nextkind") : "", next_at: fu ? fu.replace("T", " ") : "" });
    row.followup_at = fu ? fu.replace("T", " ") : ""; save();
    gcalMaybeInsert(entity, row);
    document.getElementById("a_remark").value = ""; renderTrail(entity, id); toast("Activity added");
  };
}
function renderTrail(entity, id) {
  const items = activitiesFor(entity, id);
  document.getElementById("trail").innerHTML = items.length
    ? items.map((a) => `<li><div style="font-weight:500">${esc(a.kind)}</div><div class="fu-meta">${fmtDate(a.activity_at || a.created_at)}</div>${a.remark ? `<div style="margin-top:2px;color:#475569">${esc(a.remark)}</div>` : ""}${(a.next_kind || a.next_at) ? `<div class="pf-jnext" style="margin-top:4px">📅 Next: <b>${esc(a.next_kind || "Follow-up")}</b> · ${fmtDate(a.next_at)}</div>` : ""}</li>`).join("")
    : `<li style="list-style:none;margin-left:-6px"><div class="empty" style="padding:16px 0">No activity yet.</div></li>`;
}

/* ---------- Record profiles (full detail + journey) ---------- */
function nowLocalStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function pfCell(label, val) { return `<div class="pf-cell"><div class="pf-k">${label}</div><div class="pf-v">${val || "—"}</div></div>`; }
const SVGI = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  money: SVGI('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h1"/>'),
  home: SVGI('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  flag: SVGI('<path d="M5 21V4h10l-1 4h6l-2 6H7"/>'),
  clock: SVGI('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>'),
  star: SVGI('<path d="M12 3l2.6 6.2 6.4.5-4.9 4 1.5 6.3-5.6-3.4-5.6 3.4 1.5-6.3-4.9-4 6.4-.5z"/>'),
  team: SVGI('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M17 8a3 3 0 010 6"/>'),
  link: SVGI('<path d="M9 15l6-6M10 7l1-1a4 4 0 016 6l-1 1M14 17l-1 1a4 4 0 01-6-6l1-1"/>'),
  user: SVGI('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
  clip: SVGI('<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4h6v3H9zM8 11h8M8 15h5"/>'),
  building: SVGI('<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/>'),
  target: SVGI('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
};
function heroCard(icon, label, value, color, sub) {
  return `<div class="pf-hero-card h-${color}"><div class="pf-hc-ic">${icon}</div><div class="pf-hc-k">${label}</div><div class="pf-hc-v">${value}</div>${sub ? `<div class="pf-hc-sub">${sub}</div>` : ""}</div>`;
}
// One-tap pill row for the lead profile (Stage / Rating / Status), updates + saves instantly.
function pfQuickRow(label, field, opts, cur, leadId, colors) {
  return `<div class="pf-quick-row"><span class="pf-quick-label">${label}</span><div class="pf-quick-pills">${opts.map((o) => `<button type="button" class="qpill ${colors && colors[o] ? colors[o] : ""}${String(cur) === String(o) ? " on" : ""}" data-leadquick="${leadId}::${field}::${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`;
}
function iRow(label, val) { return `<div class="pf-ir"><span class="pf-ir-k">${label}</span><span class="pf-ir-v">${val || "—"}</span></div>`; }
function journeyHtml(entity, id, emptyMsg) {
  const acts = activitiesFor(entity, id);
  if (!acts.length) return `<li class="pf-jempty">${emptyMsg}</li>`;
  return acts.map((a) => {
    const cancelled = /Cancelled/i.test(a.kind || "");
    const next = (a.next_kind || a.next_at) ? `<div class="pf-jnext">📅 Next: <b>${esc(a.next_kind || "Follow-up")}</b> · ${fmtDate(a.next_at)}</div>` : "";
    return `<li class="pf-jitem${cancelled ? " cancelled" : ""}"><div class="pf-jkind">${esc(a.kind || "Note")}</div><div class="pf-jtime">${fmtDate(a.activity_at || a.created_at)}</div>${a.remark ? `<div class="pf-jremark">${esc(a.remark)}</div>` : ""}${next}</li>`;
  }).join("");
}
function logBox(prefix, current) {
  const kinds = prefix === "pl" ? ["Call", "F2F", "SVD", "Negotiation", "VDNB", "Note"] : ["Call", "Meeting", "Site Visit", "Note"];
  return `<div class="pf-log">
    <div class="form-grid">
      ${field("Activity Done", prefix + "_kind", "Call", "", kinds)}
      ${field("Date & Time", prefix + "_when", nowLocalStr(), "datetime-local")}
      ${field("Remark", prefix + "_remark", "", "textarea")}
    </div>
    <div class="pf-sched">
      <div class="pf-sched-title">📅 Set Next Follow-up</div>
      <div class="form-grid">
        ${field("Schedule Type", prefix + "_nextkind", "Call", "", SCHEDULE_TYPES)}
        ${field("Date & Time", prefix + "_follow", current ? current.replace(" ", "T").slice(0, 16) : "", "datetime-local")}
      </div>
    </div>
    <div style="text-align:right;margin-top:8px"><button class="btn primary sm" id="${prefix}Log">Add to Journey</button></div>
  </div>`;
}

/* ---------- Lead journey timeline (ratchets forward; click to change) ---------- */
const LEAD_LEVELS = [
  { n: 1, label: "New Enquiry", stage: "" },
  { n: 2, label: "Call", stage: "Call" },
  { n: 3, label: "F2F", stage: "F2F" },
  { n: 4, label: "Site Visit", stage: "SVD" },
  { n: 5, label: "Negotiation", stage: "Negotiation" },
];
function stageLevel(stage) { return ({ "": 1, Call: 2, F2F: 3, SVD: 4, VDNB: 4, Negotiation: 5 })[stage || ""] || 1; }
// Highest level ever reached — never regresses even if the current stage is set lower.
function leadLevel(l) { return Math.max(Number(l.level) || 1, stageLevel(l.stage)); }
function leadTerminal(l) { return l.status === "Booked" ? "Booked" : l.status === "Inactive" ? "Lost" : ""; }
function leadTimeline(l, id) {
  const cur = leadLevel(l), term = leadTerminal(l);
  const nodes = LEAD_LEVELS.map((lv) => {
    const state = lv.n < cur ? "done" : lv.n === cur ? "current" : "todo";
    return `<button type="button" class="tl-node tl-${state}" data-tllevel="${id}::${lv.n}" title="Move to ${esc(lv.label)}"><span class="tl-dot">${lv.n < cur ? "✓" : lv.n}</span><span class="tl-label">${esc(lv.label)}</span></button>`;
  }).join("");
  const termNode = term ? `<div class="tl-node tl-term tl-${term.toLowerCase()}" title="Set from Status"><span class="tl-dot">${term === "Booked" ? "★" : "✕"}</span><span class="tl-label">${term}</span></div>` : "";
  return `<div class="pf-timeline-card">
    <div class="pf-quick-head">📍 Lead Journey <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">— where the lead is now · tap a stage to move it (it never slips backward on its own; Booked/Lost come from Status)</span></div>
    <div class="tl-track">${nodes}${termNode}</div>
  </div>`;
}
function openLeadProfile(id) {
  const l = leadById(id); if (!l) return;
  const projects = l.projects_shared || [], costing = l.costing || {};
  const initials = esc((l.customer_name || l.lead_number || "?").slice(0, 1).toUpperCase());
  const pill = (t, cls) => `<span class="pf-pill ${cls}">${esc(t)}</span>`;
  const units = l.units || {};
  const projChips = projects.length ? projects.map((n) => `<div class="pf-proj"><span class="pf-proj-name">${esc(n)}${units[n] ? ` <span class="pf-unit">Unit ${esc(units[n])}</span>` : ""}</span><span class="pf-proj-cost">${esc(costing[n] || "—")}</span></div>`).join("") : `<div class="muted" style="font-size:13px">No projects shared yet.</div>`;
  const body = `<div class="pf">
    <div class="pf-header lead">
      <div class="pf-avatar">${initials}</div>
      <div class="pf-htext">
        <div class="pf-name">${esc(l.customer_name || "Unnamed Lead")}</div>
        <div class="pf-sub">${esc(l.lead_number)}${l.customer_mobile ? " · " + esc(l.customer_mobile) : ""}${(() => { const c = customerForLead(l); const sib = siblingLeads(l).length; return (sib > 1) ? ` · <span class="c360-uid">${c ? custUid(c) : ""}</span>` : ""; })()}</div>
        <div class="pf-pills">${l.rating ? pill(l.rating, "b-" + l.rating) : ""}${l.status ? pill(l.status, "b-" + l.status) : ""}${l.stage ? pill(l.stage, "b-default") : ""}${l.customer_category ? pill(l.customer_category, "b-default") : ""}${(() => { const c = customerForLead(l); const sib = siblingLeads(l).length; return (c && sib > 1) ? `<button type="button" class="pf-pill c360-link" data-profile="customer:${c.id}">👥 ${sib} enquiries — View 360</button>` : ""; })()}</div>
      </div>
      <div class="pf-actions">
        <button class="btn light sm" id="pfDraft">✦ Draft message</button>
        ${callDigits(l.customer_mobile) ? `<button class="btn light sm" id="pfCallCust">📞 Call customer</button>` : ""}
        ${callDigits(l.source_mobile) ? `<button class="btn light sm" id="pfCallCp">📞 Call CP</button>` : ""}
        <button class="btn light sm" id="pfEdit">Edit</button>
        ${l.followup_at ? `<button class="btn lightdanger sm" id="pfCancel">Cancel follow-up</button>` : ""}
      </div>
    </div>
    <div class="pf-body">
      <div class="pf-hero">
        ${heroCard(IC.money, "Budget", esc(l.budget) || "—", "indigo")}
        ${(() => {
          const pj = (l.projects_shared || []).filter(Boolean);
          const head = pj.length ? esc(pj[0]) + (pj.length > 1 ? ` <span class="pf-hc-more">+${pj.length - 1}</span>` : "") : (esc(l.requirement) || "—");
          const sub = pj.length ? (esc(l.requirement) || "") : "";
          return heroCard(IC.home, "Requirement", head, "teal", sub);
        })()}
        ${(() => { const lbl = (LEAD_LEVELS[leadLevel(l) - 1] || {}).label || "New Enquiry"; return heroCard(IC.flag, "Qualified Stage", esc(lbl), "amber"); })()}
        ${heroCard(IC.clock, "Next Follow-up", l.followup_at ? (esc(l.followup_kind) || "Follow-up") : "None planned", l.followup_at ? "rose" : "green", l.followup_at ? esc(fmtDate(l.followup_at)) : "")}
      </div>
      ${leadTimeline(l, id)}
      <div class="pf-quick-card">
        <div class="pf-quick-head">⚡ Quick Update <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">— one tap to change &amp; save</span></div>
        ${pfQuickRow("Stage", "stage", STAGES, l.stage, id, null)}
        ${pfQuickRow("Rating", "rating", RATINGS, l.rating, id, { Hot: "q-red", Warm: "q-amber", Cold: "q-blue" })}
        ${pfQuickRow("Status", "status", STATUSES, l.status, id, { Active: "q-amber", Inactive: "q-red", Booked: "q-green" })}
      </div>
      <div class="pf-quick-card">
        <div class="pf-quick-head">📞 Automatic Calls <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">— OFF by default; turn on to auto-call this lead (Active leads only)</span></div>
        <div class="pf-quick-row"><span class="pf-quick-label">Customer</span><div class="pf-quick-pills">
          <button type="button" class="qpill ${l.call_customer ? "q-green on" : ""}" data-callauto="${id}::customer::1">On</button>
          <button type="button" class="qpill ${!l.call_customer ? "q-red on" : ""}" data-callauto="${id}::customer::0">Off</button>
        </div></div>
        <div class="pf-quick-row"><span class="pf-quick-label">Channel Partner</span><div class="pf-quick-pills">
          <button type="button" class="qpill ${l.call_broker ? "q-green on" : ""}" data-callauto="${id}::broker::1">On</button>
          <button type="button" class="qpill ${!l.call_broker ? "q-red on" : ""}" data-callauto="${id}::broker::0">Off</button>
        </div></div>
      </div>
      <div class="pf-two">
        <div class="pf-info-card accent-indigo">
          <div class="pf-ic-title">${IC.user} Customer</div>
          ${iRow("Mobile", esc(l.customer_mobile))}
          ${iRow("Email", esc(l.customer_email))}
          ${iRow("City", esc(l.customer_city))}
          ${iRow("Category", esc(l.customer_category))}
          ${iRow("Profession", esc(l.customer_profession))}
        </div>
        <div class="pf-info-card accent-teal">
          <div class="pf-ic-title">${IC.link} Source & Enquiry</div>
          ${iRow("Enquiry Type", esc(l.enquiry_type))}
          ${iRow("Source Type", esc(l.source_type))}
          ${iRow("Source / CP", esc(l.source_name))}
          ${iRow("Source Mobile", esc(l.source_mobile))}
          ${iRow("CP Firm", esc(l.source_firm))}
          ${iRow("Lead Date", esc(l.lead_date))}
        </div>
      </div>
      ${l.remark ? `<div class="pf-remark"><div class="pf-k">Remark</div>${esc(l.remark)}</div>` : ""}
      <div class="pf-section-title">Projects Shared &amp; Costing</div>
      <div class="pf-projs">${projChips}</div>
      <div class="pf-section-title">Journey &amp; Activity <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">— log every touchpoint here</span></div>
      ${logBox("pl", l.followup_at)}
      <ol class="pf-journey">${journeyHtml("lead", id, "No activity yet — log the first touchpoint above.")}</ol>
    </div>
  </div>`;
  modal("Lead Profile", body, true);
  document.getElementById("pfEdit").onclick = () => { closeModal(); openLeadForm(l); };
  const pfd = document.getElementById("pfDraft"); if (pfd) pfd.onclick = () => openLeadDraft(id);
  const pfcc = document.getElementById("pfCallCust"); if (pfcc) pfcc.onclick = () => manualCall(id, "customer");
  const pfcp = document.getElementById("pfCallCp"); if (pfcp) pfcp.onclick = () => manualCall(id, "broker");
  document.querySelectorAll("[data-callauto]").forEach((b) => b.onclick = () => {
    const [lid, party, val] = b.getAttribute("data-callauto").split("::"); const L = leadById(Number(lid)); if (!L) return;
    if (party === "customer") L.call_customer = val === "1"; else L.call_broker = val === "1";
    save(); toast("Auto-calls " + (val === "1" ? "ON" : "OFF") + " for " + (party === "customer" ? "customer" : "CP")); openLeadProfile(Number(lid));
  });
  const cb = document.getElementById("pfCancel");
  if (cb) cb.onclick = () => { if (!confirm("Cancel this follow-up? It will be logged in the record and removed from the follow-up list.")) return; addActivity({ entity_type: "lead", entity_id: id, kind: "Follow-up Cancelled", remark: "Scheduled " + fmtDate(l.followup_at) + " was cancelled.", activity_at: now() }); l.followup_at = ""; save(); gcalMaybeInsert("lead", l); go(active); openLeadProfile(id); toast("Cancelled and logged"); };
  const plRemarkEl = document.getElementById("pl_remark");
  if (plRemarkEl) plRemarkEl.addEventListener("input", () => plRemarkEl.classList.remove("needfill"));
  document.getElementById("plLog").onclick = () => {
    const r = fieldVal("pl_remark");
    if (!r) { if (plRemarkEl) { plRemarkEl.classList.add("needfill"); plRemarkEl.focus(); } return toast("Add a remark to log this activity"); }
    const fu = fieldVal("pl_follow");
    addActivity({ entity_type: "lead", entity_id: id, kind: fieldVal("pl_kind"), remark: r, activity_at: (fieldVal("pl_when") || nowLocalStr()).replace("T", " "), next_kind: fu ? fieldVal("pl_nextkind") : "", next_at: fu ? fu.replace("T", " ") : "" });
    l.followup_at = fu ? fu.replace("T", " ") : ""; l.followup_kind = fu ? fieldVal("pl_nextkind") : "";   // keep the tile's type in sync with the new follow-up
    save(); gcalMaybeInsert("lead", l); go(active); openLeadProfile(id); toast("Journey updated");
  };
}

function openBrokerProfile(id) {
  const b = brokerById(id); if (!b) return;
  const initials = esc((b.name || "?").slice(0, 1).toUpperCase());
  const pill = (t, cls) => `<span class="pf-pill ${cls}">${esc(t)}</span>`;
  const body = `<div class="pf">
    <div class="pf-header broker">
      <div class="pf-avatar"${b.image_url ? ` data-lightimg="${esc(b.image_url)}" style="cursor:zoom-in"` : ""}>${b.image_url ? `<img src="${esc(b.image_url)}" alt="">` : initials}</div>
      <div class="pf-htext">
        <div class="pf-name">${esc(b.name)}</div>
        <div class="pf-sub">${esc(b.firm || "")}${b.mobiles ? " · " + esc(b.mobiles) : ""}</div>
        <div class="pf-pills">${b.grade ? pill("Grade " + b.grade, "b-" + b.grade) : ""}${b.connect ? pill(b.connect, "b-" + b.connect) : ""}${b.team_size ? pill(b.team_size + " team", "b-default") : ""}</div>
      </div>
      <div class="pf-actions">
        <button class="btn light sm" data-cp360="${esc(b.name)}">📊 360 Report</button>
        <button class="btn light sm" id="pfEditB">Edit</button>
        ${b.followup_at ? `<button class="btn lightdanger sm" id="pfCancelB">Cancel meeting</button>` : ""}
      </div>
    </div>
    <div class="pf-body">
      <div class="pf-hero">
        ${heroCard(IC.star, "Grade", b.grade ? "Grade " + esc(b.grade) : "—", "indigo")}
        ${heroCard(IC.team, "Team Size", esc(b.team_size) || "—", "teal")}
        ${heroCard(IC.link, "Connect", esc(b.connect) || "—", b.connect === "Live" ? "green" : "amber")}
        ${heroCard(IC.clock, "Next Meeting", b.followup_at ? fmtDate(b.followup_at) : "Not set", b.followup_at ? "rose" : "green")}
      </div>
      <div class="pf-two">
        <div class="pf-info-card accent-indigo">
          <div class="pf-ic-title">${IC.user} Contact</div>
          ${iRow("Firm", esc(b.firm))}
          ${iRow("Mobiles", esc(b.mobiles))}
          ${iRow("Enquiries brought", String(leadCountForBroker(b.name)))}
        </div>
        <div class="pf-info-card accent-teal">
          <div class="pf-ic-title">${IC.home} Location</div>
          ${iRow("City", esc(b.city))}
          ${iRow("Sector", esc(b.sector))}
          ${iRow("Address", esc(b.address))}
        </div>
      </div>
      ${b.remark ? `<div class="pf-remark"><div class="pf-k">Remark</div>${esc(b.remark)}</div>` : ""}
      <div class="pf-section-title">Journey &amp; Activity</div>
      ${logBox("pb", b.followup_at)}
      <ol class="pf-journey">${journeyHtml("broker", id, "No activity yet — log the first meeting above.")}</ol>
    </div>
  </div>`;
  modal("Broker Profile", body, true);
  document.getElementById("pfEditB").onclick = () => { closeModal(); openBrokerForm(b); };
  const cb = document.getElementById("pfCancelB");
  if (cb) cb.onclick = () => { if (!confirm("Cancel this meeting? It will be logged in the record and removed from the follow-up list.")) return; addActivity({ entity_type: "broker", entity_id: id, kind: "Meeting Cancelled", remark: "Scheduled " + fmtDate(b.followup_at) + " was cancelled.", activity_at: now() }); b.followup_at = ""; save(); gcalMaybeInsert("broker", b); go(active); openBrokerProfile(id); toast("Cancelled and logged"); };
  const pbRemarkEl = document.getElementById("pb_remark");
  if (pbRemarkEl) pbRemarkEl.addEventListener("input", () => pbRemarkEl.classList.remove("needfill"));
  document.getElementById("pbLog").onclick = () => {
    const r = fieldVal("pb_remark");
    if (!r) { if (pbRemarkEl) { pbRemarkEl.classList.add("needfill"); pbRemarkEl.focus(); } return toast("Add a remark to log this activity"); }
    const fu = fieldVal("pb_follow");
    addActivity({ entity_type: "broker", entity_id: id, kind: fieldVal("pb_kind"), remark: r, activity_at: (fieldVal("pb_when") || nowLocalStr()).replace("T", " "), next_kind: fu ? fieldVal("pb_nextkind") : "", next_at: fu ? fu.replace("T", " ") : "" });
    b.followup_at = fu ? fu.replace("T", " ") : ""; b.followup_kind = fu ? fieldVal("pb_nextkind") : ""; save(); gcalMaybeInsert("broker", b); go(active); openBrokerProfile(id); toast("Journey updated");
  };
}
/* ---- Firm / CP 360 working report ----
   Shows, for a firm or an individual CP, every enquiry / project / customer they brought,
   filterable by date range. Enquiries are grouped (firm→by CP, CP→by credited firm) in
   expandable sections. Enquiries credited to a CP who has since MOVED to a different company
   are highlighted so old work under a former employer is easy to recognise. */
let f360 = { firm: "", cp: "", from: "", to: "" };
function creditedFirm(l) { return (l.source_firm || "").trim() || firmOf((l.source_name || "").trim()) || ""; }
function currentFirmOfCP(name) { const b = DB.brokers.find((x) => (x.name || "").trim().toLowerCase() === (name || "").trim().toLowerCase()); return b ? (b.firm || "").trim() : ""; }
function firmEmployees(firm) { const k = (firm || "").trim().toLowerCase(); return DB.brokers.filter((b) => (b.firm || "").trim().toLowerCase() === k); }
// A credit is "moved" when the CP was credited under one firm but now works at another.
function leadMoved(l, viewingFirm) {
  const cur = currentFirmOfCP(l.source_name);
  const credited = (l.source_firm || "").trim() || viewingFirm || firmOf((l.source_name || "").trim());
  return !!(cur && credited && cur.toLowerCase() !== credited.toLowerCase());
}
function f360Leads() {
  const f = f360;
  return DB.leads.filter((l) => {
    if (f.firm && creditedFirm(l).toLowerCase() !== f.firm.toLowerCase()) return false;
    if (f.cp && (l.source_name || "").trim().toLowerCase() !== f.cp.toLowerCase()) return false;
    const dt = l.lead_date || (l.created_at || "").slice(0, 10);
    if (f.from && dt < f.from) return false;
    if (f.to && dt > f.to) return false;
    return true;
  }).sort((a, b) => b.id - a.id);
}
function openFirm360(firm) { f360 = { firm: firm || "", cp: "", from: "", to: "" }; modal("📊 Firm 360 · " + firm, firm360Shell(), true); wireF360(); }
function openCP360(cp) { f360 = { firm: "", cp: cp || "", from: "", to: "" }; modal("📊 CP 360 · " + cp, firm360Shell(), true); wireF360(); }
function firm360Shell() {
  const f = f360;
  const curFirm = f.firm || currentFirmOfCP(f.cp);
  const grade = curFirm ? firmGrade(curFirm) : "";
  const sub = f.firm
    ? `${firmEmployees(f.firm).length} CP${firmEmployees(f.firm).length === 1 ? "" : "s"} empanelled${grade ? " · Grade " + grade : ""}`
    : `Current firm: ${currentFirmOfCP(f.cp) || "—"}${grade ? " · Grade " + grade : ""}`;
  return `<div class="f360">
    <div class="f360-sub">${esc(sub)}</div>
    <div class="f360-controls">
      <span class="f360-ctl-label">Period</span>
      <label>From <input type="date" id="f360From" value="${f.from}"></label>
      <label>To <input type="date" id="f360To" value="${f.to}"></label>
      <button class="btn ghost sm" id="f360Reset">All time (till today)</button>
      <button class="btn outline sm" id="f360Print">🖨 Print</button>
    </div>
    <div id="f360inner">${firm360Inner()}</div>
  </div>`;
}
function firm360Inner() {
  const f = f360, isFirm = !!f.firm;
  const ls = f360Leads();
  const custs = uniqList(ls.map((l) => (l.customer_name || "") + "|" + mobKey(l.customer_mobile)).filter((x) => x.replace("|", "")));
  const projs = uniqList(ls.flatMap((l) => l.projects_shared || []));
  const booked = ls.filter((l) => l.status === "Booked");
  const moved = ls.filter((l) => isFirm ? leadMoved(l, f.firm) : leadMoved(l, creditedFirm(l)));
  const hero = `<div class="pf-hero">
    ${heroCard(IC.link, "Enquiries", ls.length, "indigo")}
    ${heroCard(IC.building, "Projects", projs.length, "teal")}
    ${heroCard(IC.user, "Customers", custs.length, "amber")}
    ${heroCard(IC.money, "Booked", booked.length, "green")}
  </div>`;
  const rangeNote = `<div class="f360-range">${(f.from || f.to) ? `Showing ${f.from || "start"} → ${f.to || "today"}` : "All time · till today"} · <b>${ls.length}</b> enquiries</div>`;
  const movedNote = moved.length ? `<div class="f360-moved-note">⚠️ <b>${moved.length}</b> enquir${moved.length === 1 ? "y is" : "ies are"} credited to a CP who has since moved to a different company — highlighted below.</div>` : "";
  let groups;
  if (isFirm) {
    const m = {}; ls.forEach((l) => { const k = (l.source_name || "— Unknown CP —").trim(); (m[k] = m[k] || []).push(l); });
    groups = Object.entries(m).sort((a, b) => b[1].length - a[1].length).map(([cp, leads]) => {
      const cur = currentFirmOfCP(cp); const movedAway = !!(cur && cur.toLowerCase() !== f.firm.toLowerCase());
      return { label: `<span class="f360-g-name">${esc(cp)}</span>${movedAway ? `<span class="f360-moved-badge">moved → ${esc(cur)}</span>` : ""}`, leads };
    });
  } else {
    const cur = currentFirmOfCP(f.cp);
    const m = {}; ls.forEach((l) => { const k = creditedFirm(l) || "— No firm —"; (m[k] = m[k] || []).push(l); });
    groups = Object.entries(m).sort((a, b) => b[1].length - a[1].length).map(([firm, leads]) => {
      const movedAway = !!(cur && firm !== "— No firm —" && cur.toLowerCase() !== firm.toLowerCase());
      return { label: `<span class="f360-g-name">${esc(firm)}</span>${movedAway ? `<span class="f360-moved-badge">former firm · now ${esc(cur)}</span>` : `<span class="f360-cur-badge">current</span>`}`, leads };
    });
  }
  const groupsHtml = groups.map((g, i) => `<details class="f360-group"${i === 0 ? " open" : ""}>
      <summary class="f360-g-head"><span class="firm-chev">▸</span>${g.label}<span class="f360-g-count">${g.leads.length} enquir${g.leads.length === 1 ? "y" : "ies"}</span></summary>
      ${f360Table(g.leads, isFirm)}
    </details>`).join("");
  return hero + rangeNote + movedNote + `<div class="pf-section-title">${isFirm ? "By CP (employee)" : "By firm (credited)"} — tap to expand</div>` + (groups.length ? groupsHtml : `<div class="empty">No enquiries in this period.</div>`);
}
function f360Table(leads, isFirm) {
  const rows = leads.map((l) => {
    const mv = isFirm ? leadMoved(l, f360.firm) : leadMoved(l, creditedFirm(l));
    const who = isFirm ? esc(l.source_name || "—") : esc(creditedFirm(l) || "—");
    const projs = (l.projects_shared || []).map((n) => esc(n) + ((l.units || {})[n] ? " (" + esc((l.units || {})[n]) + ")" : "")).join(", ") || "—";
    return `<tr class="f360-row rowlink${mv ? " f360-moved-row" : ""}" data-profile="lead:${l.id}">
      <td><span class="f360-cp-chip">${who}</span></td>
      <td><b>${esc(l.customer_name) || esc(l.lead_number)}</b><div class="fu-meta">${telLink(l.customer_mobile)}</div></td>
      <td class="fu-meta">${projs}</td>
      <td class="nowrap">${l.budget ? `<span class="chip-budget">${esc(l.budget)}</span>` : "—"}</td>
      <td class="nowrap">${esc(l.lead_date) || "—"}</td>
      <td>${badge(l.stage)}</td>
      <td>${badge(l.status)}</td>
    </tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="f360-table"><thead><tr>${[isFirm ? "CP (employee)" : "Firm (credited)", "Customer", "Projects (unit)", "Budget", "Date", "Stage", "Status"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function wireF360() {
  const from = document.getElementById("f360From"), to = document.getElementById("f360To");
  const rerender = () => { const inner = document.getElementById("f360inner"); if (inner) inner.innerHTML = firm360Inner(); };
  if (from) from.onchange = () => { f360.from = from.value; rerender(); };
  if (to) to.onchange = () => { f360.to = to.value; rerender(); };
  const rst = document.getElementById("f360Reset"); if (rst) rst.onclick = () => { f360.from = ""; f360.to = ""; if (from) from.value = ""; if (to) to.value = ""; rerender(); };
  const pr = document.getElementById("f360Print"); if (pr) pr.onclick = () => window.print();
}
function openProfile(spec) { const [t, id] = spec.split(":"); return t === "lead" ? openLeadProfile(Number(id)) : t === "customer" ? openCustomer360(Number(id)) : openBrokerProfile(Number(id)); }

/* ---------- Global click handling ---------- */
document.addEventListener("click", (e) => {
  const pill = e.target.closest("[data-pill]"); if (pill) { const raw = pill.getAttribute("data-pill"), sep = raw.indexOf("::"); const fid = raw.slice(0, sep), val = raw.slice(sep + 2); const inp = document.getElementById(fid); if (inp) { inp.value = val; inp.dispatchEvent(new Event("change")); } const set = pill.parentElement; if (set) set.querySelectorAll(".pill").forEach((b) => b.classList.toggle("on", b === pill)); return; }
  const star = e.target.closest("[data-star]"); if (star) { const raw = star.getAttribute("data-star"), sep = raw.indexOf("::"); const fid = raw.slice(0, sep), val = Number(raw.slice(sep + 2)); const inp = document.getElementById(fid); if (inp) inp.value = val || ""; const set = star.parentElement; if (set) set.querySelectorAll(".starbtn").forEach((b, i) => b.classList.toggle("on", i < val)); return; }
  const nav = e.target.closest("[data-nav]"); if (nav) { document.body.classList.remove("nav-open"); return go(nav.getAttribute("data-nav")); }
  const rfEl = e.target.closest("[data-rf]"); if (rfEl) return toggleReportFilter(rfEl.getAttribute("data-rf"));
  const rfrm = e.target.closest("[data-rfremove]"); if (rfrm) { delete reportFilters[rfrm.getAttribute("data-rfremove")]; return renderReportBody(); }
  if (e.target.closest("[data-rfclear]")) { reportFilters = {}; return renderReportBody(); }
  const gotab = e.target.closest("[data-gotab]"); if (gotab) { reportView = gotab.getAttribute("data-gotab"); return go("reports"); }
  const pcp = e.target.closest("[data-projcp]"); if (pcp) { const parts = pcp.getAttribute("data-projcp").split("||"); return openProjectCP(parts[0], parts[1]); }
  const drill = e.target.closest("[data-drill]"); if (drill) return openDrill(drill.getAttribute("data-drill"));
  const bl = e.target.closest("[data-brokerleads]"); if (bl) { const b = brokerById(Number(bl.getAttribute("data-brokerleads"))); if (b) listLeads("Enquiries via " + b.name, DB.leads.filter((l) => (l.source_name || "").trim().toLowerCase() === (b.name || "").trim().toLowerCase())); return; }
  const chip = e.target.closest("[data-chip]"); if (chip) { const t = document.getElementById("bType"); if (t) { t.value = chip.getAttribute("data-chip"); brokerRowsHtml(); } return; }
  const addfirm = e.target.closest("[data-addfirm]"); if (addfirm) { e.preventDefault(); const fm = addfirm.getAttribute("data-addfirm"); return openBrokerForm({ connect: "Live", firm: fm === "— No firm —" ? "" : fm }); }
  const firm360 = e.target.closest("[data-firm360]"); if (firm360) { e.preventDefault(); return openFirm360(firm360.getAttribute("data-firm360")); }
  const cp360 = e.target.closest("[data-cp360]"); if (cp360) { e.preventDefault(); return openCP360(cp360.getAttribute("data-cp360")); }
  const stage = e.target.closest("[data-stage]"); if (stage) return openDrill("stage:" + stage.getAttribute("data-stage"));
  const grade = e.target.closest("[data-grade]"); if (grade) return openDrill("grade:" + grade.getAttribute("data-grade"));
  const tll = e.target.closest("[data-tllevel]"); if (tll) {
    const p = tll.getAttribute("data-tllevel").split("::"); const id = Number(p[0]), n = Number(p[1]);
    const l = leadById(id); if (!l) return; const lv = LEAD_LEVELS[n - 1]; if (!lv) return;
    if (leadLevel(l) === n && l.stage === lv.stage) return;
    if (!confirm(`Move ${l.customer_name || l.lead_number} to “${lv.label}”?`)) return;
    l.level = n; l.stage = lv.stage;
    addActivity({ entity_type: "lead", entity_id: id, kind: "Journey moved", remark: "Stage → " + lv.label, activity_at: now() });
    save(); gcalMaybeInsert("lead", l); toast("Moved to " + lv.label);
    go(active); openLeadProfile(id);
    return;
  }
  const lq = e.target.closest("[data-leadquick]"); if (lq) {
    const parts = lq.getAttribute("data-leadquick").split("::"); const id = Number(parts[0]), field = parts[1], val = parts[2];
    const l = leadById(id); if (!l) return;
    if (l[field] === val) return;   // already set
    l[field] = val;
    if (field === "stage") l.level = Math.max(Number(l.level) || 1, stageLevel(val));   // ratchet the journey forward
    if (l.status === "Inactive" && l.stage === "SVD") l.stage = "VDNB";   // site visit done + inactive → VDNB
    addActivity({ entity_type: "lead", entity_id: id, kind: field.charAt(0).toUpperCase() + field.slice(1) + " updated", remark: field + " → " + val, activity_at: now() });
    save(); gcalMaybeInsert("lead", l); toast("Updated · " + field + " → " + val);
    go(active); openLeadProfile(id);
    return;
  }
  const prof = e.target.closest("[data-profile]"); if (prof) return openProfile(prof.getAttribute("data-profile"));
  const openrec = e.target.closest("[data-openrec]"); if (openrec) return openProfile(openrec.getAttribute("data-openrec"));
  const fuu = e.target.closest("[data-fuupdate]"); if (fuu) return openProfile(fuu.getAttribute("data-fuupdate"));
  const fuc = e.target.closest("[data-fucancel]"); if (fuc) { const [t, id] = fuc.getAttribute("data-fucancel").split(":"); return cancelFollowup(t, Number(id), fuc.getAttribute("data-day")); }
  const dnew = e.target.closest("[data-daynew]"); if (dnew) { const [t, ds] = dnew.getAttribute("data-daynew").split(":"); return t === "lead" ? newLeadOn(ds) : newBrokerOn(ds); }
  const dfix = e.target.closest("[data-dayfix]"); if (dfix) return openScheduleForm(dfix.getAttribute("data-dayfix"));
  const day = e.target.closest("[data-day]"); if (day && !e.target.closest("[data-fucancel]")) return openDaySchedule(day.getAttribute("data-day"));
  if (e.target.closest("[data-calprev]")) { calRef = new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1); refreshCalendars(); return; }
  if (e.target.closest("[data-calnext]")) { calRef = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1); refreshCalendars(); return; }
  const btn = e.target.closest("[data-act]");
  if (btn) {
    const id = Number(btn.getAttribute("data-id")), act = btn.getAttribute("data-act");
    if (act === "activity") return openActivity(btn.getAttribute("data-ent"), id);
    if (act === "editlead") { closeModal(); return openLeadForm(leadById(id)); }
    if (act === "dellead") return confirmDel("leads", id);
    if (act === "editbroker") { closeModal(); return openBrokerForm(brokerById(id)); }
    if (act === "delbroker") return confirmDel("brokers", id);
    if (act === "cust360") return openCustomer360(id);
    if (act === "editcust") { closeModal(); return openCustomerForm(DB.customers.find((x) => x.id === id)); }
    if (act === "delcust") return confirmDel("customers", id);
    if (act === "editproj") { closeModal(); return openProjectForm(DB.projects.find((x) => x.id === id)); }
    if (act === "delproj") return confirmDel("projects", id);
  }
  const imgc = e.target.closest("[data-imgclear]"); if (imgc) { setImageValue(imgc.getAttribute("data-imgclear"), ""); return; }
  const lb = e.target.closest("[data-lightbox]"); if (lb) { const el = document.getElementById(lb.getAttribute("data-lightbox")); if (el && el.value) return openLightbox(el.value); return; }
  const li = e.target.closest("[data-lightimg]"); if (li) { const src = li.getAttribute("data-lightimg"); if (src) return openLightbox(src); }
  const side = e.target.closest("[data-action]"); if (side) return sideAction(side.getAttribute("data-action"));
});
// Photo pickers: compress on choose, then update the hidden value + preview.
document.addEventListener("change", (e) => {
  const f = e.target.closest("[data-imgfor]");
  if (f && f.files && f.files[0]) {
    const id = f.getAttribute("data-imgfor");
    toast("Compressing photo…");
    compressImage(f.files[0], (dataUrl) => { setImageValue(id, dataUrl); if (dataUrl) toast("Photo added ✓"); });
    f.value = "";
  }
});
function confirmDel(entity, id) { if (confirm("Delete this record? This cannot be undone.")) { removeRow(entity, id); toast("Deleted"); closeModal(); go(active); } }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ---------- Sidebar actions ---------- */
function sideAction(a) {
  if (a === "export") { const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `realtycrm-backup-${today()}.json`; link.click(); URL.revokeObjectURL(url); toast("Backup downloaded"); }
  if (a === "import") document.getElementById("importFile").click();
  if (a === "gcal-ics") downloadICS();
  if (a === "gcal-connect") gcalConnect();
  if (a === "seed") { if (confirm("Load a set of sample records? This adds to your current data.")) { seed(); go(active); toast("Sample data loaded"); } }
  if (a === "reset") { if (confirm("Delete ALL data permanently? Export a backup first if unsure.")) { DB = emptyDB(); save(); go("dash"); toast("All data cleared"); } }
  if (a === "logout") {
    if (CLOUD) { try { localStorage.removeItem(KEY); } catch {} DB = emptyDB(); CLOUD.signOut(); toast("Signed out"); }
    else { try { sessionStorage.removeItem(SESSION_KEY); } catch {} renderLogin("local"); toast("Signed out"); }
  }
  if (a === "changepw") openChangePassword();
  if (a === "callcenter") openCallCenter();
}
// Change the password you use to sign in to the CRM on the website.
function openChangePassword() {
  const email = (CLOUD && typeof CLOUD.currentEmail === "function" && CLOUD.currentEmail()) || "";
  modal("🔒 Change website login password", `
    <div class="lf"><div class="lf-sec"><div class="lf-sec-body">
      <p class="muted" style="font-size:12px;line-height:1.6;margin-bottom:12px">This changes the password for your CRM login${email ? ` (<b>${esc(email)}</b>)` : ""} on <b>coffeeanddeals.in</b>. You'll use the new password next time you sign in.</p>
      <div class="form-grid">
        <div class="field full"><label>Current password</label><input id="cp_cur" type="password" autocomplete="current-password" placeholder="Enter current password"/></div>
        <div class="field full"><label>New password</label><input id="cp_new" type="password" autocomplete="new-password" placeholder="At least 6 characters"/></div>
        <div class="field full"><label>Confirm new password</label><input id="cp_new2" type="password" autocomplete="new-password" placeholder="Re-type new password"/></div>
      </div>
    </div></div></div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="cpSave">Update password</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("cpSave").onclick = async () => {
    const cur = fieldVal("cp_cur"), np = fieldVal("cp_new"), np2 = fieldVal("cp_new2");
    if (!cur) return toast("Enter your current password");
    if (np.length < 6) return toast("New password too short (min 6)");
    if (np !== np2) return toast("New passwords don't match");
    const btn = document.getElementById("cpSave"); btn.disabled = true; btn.textContent = "Updating…";
    try {
      if (CLOUD) {
        try { await CLOUD.reauth(cur); }
        catch (e) { btn.disabled = false; btn.textContent = "Update password"; return toast("Current password is incorrect"); }
        await CLOUD.changePassword(np);
      } else {
        const ok = await verifyLogin(getAuth().user, cur);
        if (!ok) { btn.disabled = false; btn.textContent = "Update password"; return toast("Current password is incorrect"); }
        await setPassword(getAuth().user, np);
      }
      closeModal(); toast("Password changed ✓");
    } catch (e) {
      btn.disabled = false; btn.textContent = "Update password";
      const code = (e && e.code) || "";
      toast(code === "auth/weak-password" ? "Password too weak — try a longer one" : code === "auth/network-request-failed" ? "Network error — check your connection" : "Could not change password");
    }
  };
}
document.getElementById("importFile").addEventListener("change", (e) => {
  const f = e.target.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { try { const data = JSON.parse(r.result); if (!data.leads) throw 0; DB = Object.assign(emptyDB(), data); save(); go("dash"); toast("Backup restored"); } catch { toast("Could not read that file"); } };
  r.readAsText(f); e.target.value = "";
});

/* ---------- Sample data ---------- */
function seed() {
  upsert("projects", { name: "Skyline Heights", type: "H-rise", location: "Sector 65", price_min: "2.5 Cr", price_max: "4 Cr", total_units: 120, available_units: 34, status: "Live", notes: "Premium towers, ready to move." });
  upsert("projects", { name: "Green Meadows", type: "Plot", location: "Sector 84", price_min: "3 Cr", price_max: "6 Cr", total_units: 60, available_units: 8, status: "Live" });
  upsert("projects", { name: "Urban Nest", type: "Floor", location: "Sector 57", price_min: "1.8 Cr", price_max: "3 Cr", total_units: 80, available_units: 0, status: "Sold Out" });
  upsert("customers", { name: "Rakesh Mehta", mobile1: "98110 42000", city: "Gurugram", category: "Investor", rating: "5", profession: "CA", contact_future: 1 });
  upsert("customers", { name: "Dr. Anjali Rao", mobile1: "99992 71000", city: "Delhi", category: "EndUser", rating: "4", profession: "Doctor", contact_future: 1 });
  const b1 = upsert("brokers", { name: "Amit Realtors", firm: "Amit Realty LLP", mobiles: "98100 11111, 98100 22222", grade: "A", team_size: 12, city: "Gurugram", sector: "57", connect: "Live", followup_at: today() + " 11:00" });
  upsert("brokers", { name: "Home Bridge", firm: "HB Consultants", mobiles: "98200 33333", grade: "B", team_size: 5, city: "Delhi", sector: "Dwarka", connect: "Live", followup_at: addDays(2) + " 15:00" });
  const l1 = upsert("leads", { lead_number: "LD-SAMPLE1", lead_date: today(), enquiry_type: "CP+CL", requirement: "H-rise", budget: "3-3.5 Cr", source_type: "CP", source_name: "Amit Realtors", customer_name: "Rakesh Mehta", customer_mobile: "98110 42000", customer_city: "Gurugram", customer_category: "Investor", projects_shared: ["Skyline Heights", "Green Meadows"], costing: { "Skyline Heights": "3.4 Cr", "Green Meadows": "3.9 Cr" }, stage: "SVD", rating: "Hot", status: "Active", followup_at: today() + " 16:30", remark: "Site visit done, wants corner unit." });
  upsert("leads", { lead_number: "LD-SAMPLE2", lead_date: today(), enquiry_type: "CL", requirement: "Floor", budget: "2.5-3 Cr", source_type: "Reference", source_name: "Existing client", customer_name: "Dr. Anjali Rao", customer_mobile: "99992 71000", customer_city: "Delhi", customer_category: "EndUser", stage: "F2F", rating: "Warm", status: "Active", followup_at: addDays(-1) + " 12:00", remark: "Missed call yesterday, retry." });
  upsert("leads", { lead_number: "LD-SAMPLE3", lead_date: today(), enquiry_type: "CP+CL", requirement: "Plot", budget: "5 Cr+", source_type: "CP", source_name: "Home Bridge", customer_name: "Suresh Kumar", customer_mobile: "98730 55000", customer_city: "Noida", customer_category: "Investor", stage: "Negotiation", rating: "Hot", status: "Active", followup_at: addDays(1) + " 10:30", remark: "Final price discussion." });
  addActivity({ entity_type: "lead", entity_id: l1.id, kind: "SVD", remark: "Showed Skyline Heights tower B, 14th floor.", activity_at: now() });
  addActivity({ entity_type: "broker", entity_id: b1.id, kind: "Call", remark: "Confirmed empanelment terms.", activity_at: now() });
}

/* ---------- Authentication (client-side gate) ----------
   NOTE: A static site cannot enforce real security in the browser. This gate
   keeps casual users out and hashes the password (never stored in plain text),
   but anyone with the file can read the local data. For production-grade auth,
   move to Firebase Authentication + Firestore security rules (see FIREBASE_SETUP.md). */
const AUTH_KEY = "realtycrm_auth";
const SESSION_KEY = "realtycrm_session";
let loginFails = 0, lockUntil = 0;

async function sha256(str) {
  try {
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) { /* fall through */ }
  let h = 5381; for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h |= 0; }
  return "f" + (h >>> 0).toString(16);
}
function getAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; } }
async function setPassword(user, password) { const salt = Math.random().toString(36).slice(2) + Date.now().toString(36); const hash = await sha256(salt + password); localStorage.setItem(AUTH_KEY, JSON.stringify({ user, salt, hash })); }
async function ensureAuthSetup() { const a = getAuth(); if (!a || !a.hash) await setPassword("admin", "admin123"); }
function isAuthed() { try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; } }
async function verifyLogin(user, password) { const a = getAuth(); if (!a) return false; const hash = await sha256(a.salt + password); return String(user).trim().toLowerCase() === String(a.user).toLowerCase() && hash === a.hash; }

function renderLoading(msg) {
  document.body.classList.add("locked");
  const g = document.getElementById("authGate"); g.hidden = false;
  g.innerHTML = `<div class="auth-wrap"><div class="auth-card" style="text-align:center">
    <div class="auth-brand">Realty<span>CRM</span></div>
    <div class="auth-sub">Coffee &amp; Deals — Powered by Ashish Sharma</div>
    <div style="margin-top:20px;color:rgba(255,255,255,.85);font-size:14px">${esc(msg)}</div></div></div>`;
}
function renderLogin(mode, msg) {
  const cloud = mode === "cloud";
  document.body.classList.add("locked");
  const g = document.getElementById("authGate"); g.hidden = false;
  g.innerHTML = `<div class="auth-wrap"><div class="auth-card">
    <div class="auth-brand">Realty<span>CRM</span></div>
    <div class="auth-sub">Coffee &amp; Deals — Powered by Ashish Sharma</div>
    <form id="authForm" class="auth-form" autocomplete="off">
      <label>${cloud ? "Email" : "Username"}<input id="authUser" type="${cloud ? "email" : "text"}" autocomplete="username" value="${cloud ? "" : "admin"}" placeholder="${cloud ? "you@example.com" : ""}" /></label>
      <label>Password<input id="authPass" type="password" autocomplete="current-password" placeholder="Enter password" /></label>
      <div id="authErr" class="auth-err">${esc(msg || "")}</div>
      <button type="submit" class="btn primary" id="authBtn" style="width:100%">Sign in</button>
    </form>
  </div></div>`;
  const form = document.getElementById("authForm");
  const err = (m) => { document.getElementById("authErr").textContent = m || ""; };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = document.getElementById("authUser").value, p = document.getElementById("authPass").value;
    if (cloud) {
      const btn = document.getElementById("authBtn"); btn.disabled = true; btn.textContent = "Signing in…"; err("");
      try { await CLOUD.signIn(u.trim(), p); /* onAuth loads data + boots */ }
      catch (ex) {
        btn.disabled = false; btn.textContent = "Sign in";
        const c = (ex && ex.code) || "";
        err(/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c) ? "Invalid email or password." :
          c === "auth/unauthorized-domain" ? "This domain isn't authorized. Add it in Firebase → Authentication → Settings → Authorized domains." :
          c === "auth/network-request-failed" ? "Network error — check your connection." :
          c === "auth/too-many-requests" ? "Too many attempts. Try again later." :
          (ex && ex.message) || "Sign-in failed.");
      }
      return;
    }
    if (Date.now() < lockUntil) { err(`Too many attempts. Wait ${Math.ceil((lockUntil - Date.now()) / 1000)}s.`); return; }
    const ok = await verifyLogin(u, p);
    if (ok) { loginFails = 0; try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {} bootApp(); }
    else { loginFails++; if (loginFails >= 5) { lockUntil = Date.now() + 30000; err("Too many attempts. Locked for 30 seconds."); } else err(`Invalid username or password. (${5 - loginFails} attempts left)`); }
  });
  setTimeout(() => { const f = document.getElementById(cloud ? "authUser" : "authPass"); if (f) f.focus(); }, 40);
}
function startCloudMode(FB) {
  CLOUD = FB;
  renderLoading("Connecting…");
  FB.onAuth(async (user) => {
    if (user) {
      if (_cloudBooted) return;       // already loaded once — don't reload/overwrite on token refresh
      renderLoading("Loading your data…");
      try {
        const state = await FB.loadState();
        // Consider the cloud "has data" if ANY entity type is present — not just leads.
        const nonEmpty = (o) => !!(o && ((o.leads && o.leads.length) || (o.brokers && o.brokers.length) || (o.customers && o.customers.length) || (o.projects && o.projects.length) || (o.activities && o.activities.length)));
        if (nonEmpty(state)) {
          DB = Object.assign(emptyDB(), state);                 // cloud has data → use it
        } else {
          let local = null; try { local = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
          if (nonEmpty(local)) {
            DB = Object.assign(emptyDB(), local);
            await FB.saveState(DB).catch(() => {});             // one-time upload of existing local data
          } else {
            // Genuinely empty everywhere — DO NOT overwrite the cloud with a blank doc.
            DB = state ? Object.assign(emptyDB(), state) : emptyDB();
          }
        }
        // Security: never keep a local copy of cloud data (nothing readable without login).
        try { localStorage.removeItem(KEY); } catch {}
        try { await importWebEnquiries(); } catch (e) {}
        _cloudBooted = true;
        bootApp();
        startCloudWatch();
      } catch (e) {
        renderLogin("cloud", "Signed in, but couldn't reach Firestore. Create the database and publish the rules, then reload.");
      }
    } else {
      _cloudBooted = false;
      DB = emptyDB();
      renderLogin("cloud");
    }
  });
}
// Live auto-sync is DISABLED on purpose. Automatically overwriting this device's
// data with another client's copy of the single shared document is race-prone and
// was causing records to disappear. Cross-device sync now happens safely on page
// load (your data is read when you sign in / refresh). To see changes made on
// another device, just refresh the page — your in-progress data is never clobbered.
let _cloudWatch = null;
function startCloudWatch() { /* disabled — see note above */ }
function bootApp() {
  document.body.classList.remove("locked");
  const g = document.getElementById("authGate"); if (g) { g.hidden = true; g.innerHTML = ""; }
  (async () => { try { await migrateWebCatalogToCloud(); } catch (e) {} try { await syncWebProjects(); } catch (e) {} })();
  updateStatusLights();
  wireRefreshBtn();
  renderNav();
  go("dash");
}
// Global Refresh — pull the freshest cloud state, website enquiries and inventory,
// then re-render whatever view is open. Works in local mode too (just re-renders).
let _refreshing = false;
function wireRefreshBtn() {
  const btn = document.getElementById("refreshBtn");
  if (btn && !btn._wired) { btn._wired = 1; btn.onclick = refreshAll; }
  const nt = document.getElementById("navToggle");
  if (nt && !nt._wired) { nt._wired = 1; nt.onclick = () => document.body.classList.toggle("nav-open"); }
  const bd = document.querySelector(".nav-backdrop");
  if (bd && !bd._wired) { bd._wired = 1; bd.onclick = () => document.body.classList.remove("nav-open"); }
}
async function refreshAll() {
  if (_refreshing) return;
  _refreshing = true;
  const btn = document.getElementById("refreshBtn");
  if (btn) { btn.classList.add("spinning"); btn.disabled = true; }
  try {
    if (CLOUD && typeof CLOUD.loadState === "function") {
      const state = await CLOUD.loadState();
      const nonEmpty = (o) => !!(o && ((o.leads && o.leads.length) || (o.brokers && o.brokers.length) || (o.customers && o.customers.length) || (o.projects && o.projects.length) || (o.activities && o.activities.length)));
      if (nonEmpty(state)) DB = Object.assign(emptyDB(), state);
      try { await importWebEnquiries(); } catch (e) {}
    }
    _inv = []; _proj = []; _mfUnits = []; _mfUnitsLoaded = false;   // force website inventory / projects / match-units to reload
    updateStatusLights();
    go(active);
    toast("Refreshed ✓");
  } catch (e) {
    toast("⚠️ Refresh failed — check your connection");
  } finally {
    _refreshing = false;
    if (btn) { btn.classList.remove("spinning"); btn.disabled = false; }
  }
}
// Sidebar status lights: cloud (green when signed-in cloud + online) and Google Calendar.
function updateStatusLights() {
  const online = navigator.onLine !== false;
  const sm = document.getElementById("sideMode"), sd = document.getElementById("sideDot");
  if (sm) sm.textContent = CLOUD ? (online ? "Cloud · synced" : "Offline · will sync") : "Local · this device";
  if (sd) sd.classList.toggle("cloud", !!CLOUD && online);
  const gon = (typeof gcalEnabled === "function" && gcalEnabled() && typeof gcalConnected === "function" && gcalConnected());
  const gs = document.getElementById("gcalStatus"), gd = document.getElementById("gcalDot");
  if (gs) gs.textContent = gon ? "Calendar · connected" : "Calendar off";
  if (gd) gd.classList.toggle("cloud", !!gon);
}
if (typeof window !== "undefined") { window.addEventListener("online", function () { try { updateStatusLights(); } catch (e) {} }); window.addEventListener("offline", function () { try { updateStatusLights(); } catch (e) {} }); }

/* ---------- Boot ---------- */
function whenFB(cb) {
  if (window.RCRM_FB) return cb(window.RCRM_FB);
  let done = false; const fin = () => { if (!done) { done = true; cb(window.RCRM_FB || null); } };
  window.addEventListener("rcrm-fb-ready", fin, { once: true });
  setTimeout(fin, 6000);
}
whenFB((FB) => {
  if (FB) startCloudMode(FB);
  else ensureAuthSetup().then(() => {
    // Local test mode: show a populated demo on first run so you can click around.
    if (!DB.leads.length && !DB.brokers.length && !DB.projects.length) { try { seed(); } catch (e) {} }
    if (isAuthed()) bootApp(); else renderLogin("local");
  }).catch(() => bootApp());
});

/* ==========================================================================
   WEBSITE ↔ CRM INTEGRATION
   Digital Enquiry, Inventory and Project sync — all powered by the shared
   website data layer (window.Store from ../js/data.js). Runs in local mode
   for VS Code testing; the same Store points at the shared Firebase project
   when the website is switched to cloud mode.
   ========================================================================== */
function WS() { return (typeof window !== "undefined" && window.Store) ? window.Store : null; }

/* ---- formatters ---- */
function fmtDT(ts) { if (!ts) return "—"; try { return new Date(ts).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return "—"; } }
function inrGroup(n) { n = Number(n); if (!n || isNaN(n)) return ""; const s = Math.round(n).toString(); const last3 = s.slice(-3), rest = s.slice(0, -3); return (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last3; }
// Normalise a costing value to Crores. Values are stored either already in Cr (e.g. 8.58)
// or as a full rupee amount (e.g. 85800000). Anything >= 1000 is clearly rupees (no unit
// costs 1000+ Cr), so convert it: 1 Cr = 10,000,000.
function toCr(v) { v = Number(v); if (!v || isNaN(v)) return 0; return v >= 1000 ? v / 1e7 : v; }
function crLabel(v) { const cr = toCr(v); if (!cr) return "—"; return "₹" + (Number.isInteger(cr) ? cr : Number(cr.toFixed(2))) + " Cr"; }

/* ---- website enquiry helpers (mirror admin.html) ---- */
function webInterests(e) { let its = e.interests; if (!its || !its.length) { if (e.project) return [{ project: e.project, units: (e.unit && e.unit !== "(inventory view)") ? [e.unit] : [], lastTs: e.ts }]; return []; } return its; }
function webInterestSummary(e) { const its = webInterests(e); if (!its.length) return "—"; return its.map((it) => `<b>${esc(it.project)}</b>: ${esc(it.units && it.units.length ? it.units.join(", ") : "viewed")}`).join("<br>"); }
function webInterestText(e) { return webInterests(e).map((it) => it.project + " " + (it.units || []).join(" ")).join(" "); }

/* ====================== DIGITAL ENQUIRY ====================== */
let _webEnq = [];
let digiFilter = "new"; // "new" | "transferred" | "all"
function digiLinkedLead(e) { return DB.leads.find((l) => l.web_src === e.id); }
function digiIsTransferred(e) { return !!digiLinkedLead(e); }
// True when the visitor did something NEW (viewed another project/unit) after transfer.
function digiHasNewActivity(e) { const l = digiLinkedLead(e); return !!(l && l.web_synced_ts && (e.ts || 0) > l.web_synced_ts); }
function digiStatusOf(e) { return (digiIsTransferred(e) || e.digiStatus === "Process") ? "Process" : "New"; }
function digiStatusTag(s) {
  const c = s === "Process" ? ["#a15c00", "#faf0dd"] : ["#127a3e", "#e7f5ec"];
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;color:${c[0]};background:${c[1]}">${esc(s)}</span>`;
}
function digiNewActivityTag() {
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;color:#b3261e;background:#fbe9e7">⚡ Transferred · New</span>`;
}
async function loadWebEnquiries() {
  const S = WS();
  if (typeof CLOUD !== "undefined" && CLOUD && typeof CLOUD.loadEnquiries === "function") {
    try { return (await CLOUD.loadEnquiries()).map((d) => Object.assign({}, d, { id: d._id || d.code || d.id })); } catch (e) { return []; }
  }
  if (S) { try { return await S.enquiries(); } catch (e) { return []; } }
  return null;
}
function viewDigital() {
  const opt = (v, label) => `<option value="${v}" ${digiFilter === v ? "selected" : ""}>${label}</option>`;
  return `
  <div class="card filters">
    <input type="text" class="search" id="dq" placeholder="Search name, mobile, lead code, project…" />
    <select id="dFilter">${opt("new", "New (to work on)")}${opt("transferred", "Transferred")}${opt("all", "All")}</select>
    <button class="btn danger sm" id="dDel">🗑 Delete selected</button>
    <button class="btn outline sm" id="dTransferAll">↧ Transfer all new</button>
    <button class="btn outline sm" id="dExport">⌄ Export CSV</button>
    <button class="btn outline sm" id="dRefresh">⟳ Refresh</button>
  </div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th style="width:34px"><input type="checkbox" class="bulk-all"></th>${["Lead Code", "Name", "Mobile", "Interested in (projects · units)", "Last seen", "Status", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody id="digRows"></tbody></table><div id="digEmpty"></div></div></div>`;
}
async function populateDigital() {
  const body = document.getElementById("digRows"); if (!body) return;
  const all = await loadWebEnquiries();
  if (all === null) { document.getElementById("digEmpty").innerHTML = `<div class="empty">Website data layer not loaded.</div>`; return; }
  _webEnq = all;
  const q = (document.getElementById("dq") ? document.getElementById("dq").value : "").toLowerCase();
  const rows = _webEnq.filter((e) => {
    const t = digiIsTransferred(e);
    const fresh = digiHasNewActivity(e);
    // "New" view hides transferred — UNLESS the visitor is back looking at something new.
    if (digiFilter === "new" && t && !fresh) return false;
    if (digiFilter === "transferred" && !t) return false;
    return !q || `${e.user || ""} ${e.mobile || ""} ${e.code || ""} ${webInterestText(e)}`.toLowerCase().includes(q);
  });
  document.getElementById("digEmpty").innerHTML = rows.length ? "" : `<div class="empty">No enquiries in this view.${digiFilter === "new" ? " New website enquiries will appear here." : ""}</div>`;
  body.innerHTML = rows.map((e) => {
    const transferred = digiIsTransferred(e);
    const fresh = digiHasNewActivity(e);
    const agent = e.agent && e.agent.isAgent ? `<div class="fu-meta">🏢 ${esc(e.agent.firm || "Agent")}${e.agent.designation ? " · " + esc(e.agent.designation) : ""}</div>` : "";
    const statusCell = fresh ? digiNewActivityTag() : digiStatusTag(digiStatusOf(e));
    const actionMid = fresh
      ? `<button class="btn primary sm" data-dupd="${esc(String(e.id))}">↻ Update CRM</button>`
      : (transferred ? `<button class="btn outline sm" disabled>✓ In CRM</button>` : `<button class="btn primary sm" data-xfer="${esc(String(e.id))}">→ Transfer</button>`);
    return `<tr${fresh ? ' style="background:#fff7ed"' : ""}>
      <td><input type="checkbox" class="bulk" data-id="${esc(String(e.id))}"></td>
      <td class="mono nowrap"><b>${esc(e.code || "—")}</b></td>
      <td>${esc(e.user) || "—"}${e.status === "Unverified" ? ` <span class="digi-unverified">⚠ Unverified</span>` : (e.status === "Verified" ? ` <span class="digi-verified">✓ Verified</span>` : "")}${agent}</td>
      <td class="nowrap">${telLink(e.mobile)}</td>
      <td style="max-width:300px">${webInterestSummary(e)}</td>
      <td class="nowrap fu-meta">${fmtDT(e.ts)}</td>
      <td>${statusCell}${e.agent && e.agent.isAgent ? " " + badge("Agent") : ""}</td>
      <td class="right nowrap">
        <button class="btn outline sm" data-dedit="${esc(String(e.id))}">Edit</button>
        ${actionMid}
        <button class="btn danger sm" data-ddel="${esc(String(e.id))}">Delete</button>
      </td>
    </tr>`;
  }).join("");
  wireBulkAll("digRows");
  body.querySelectorAll("[data-xfer]").forEach((b) => (b.onclick = () => transferEnquiry(b.getAttribute("data-xfer"))));
  body.querySelectorAll("[data-dupd]").forEach((b) => (b.onclick = () => updateLeadFromDigital(b.getAttribute("data-dupd"))));
  body.querySelectorAll("[data-dedit]").forEach((b) => (b.onclick = () => openDigitalForm(_webEnq.find((e) => String(e.id) === b.getAttribute("data-dedit")))));
  body.querySelectorAll("[data-ddel]").forEach((b) => (b.onclick = () => deleteDigital(b.getAttribute("data-ddel"))));
  const dq = document.getElementById("dq"); if (dq && !dq._wired) { dq._wired = 1; dq.addEventListener("input", populateDigital); }
  const df = document.getElementById("dFilter"); if (df && !df._wired) { df._wired = 1; df.addEventListener("change", () => { digiFilter = df.value; populateDigital(); }); }
  const del = document.getElementById("dDel"); if (del) del.onclick = bulkDeleteDigital;
  const ex = document.getElementById("dExport"); if (ex) ex.onclick = exportDigitalCSV;
  const rf = document.getElementById("dRefresh"); if (rf) rf.onclick = populateDigital;
  const ta = document.getElementById("dTransferAll"); if (ta) ta.onclick = transferAllNew;
}
// Dashboard tile: count of NEW (untouched, not transferred) website enquiries.
async function updateDashDigi() {
  const el = document.getElementById("dashDigiCount"); if (!el) return;
  const all = await loadWebEnquiries();
  if (!all) { el.textContent = "0"; return; }
  const n = all.filter((e) => digiStatusOf(e) === "New").length;
  el.textContent = String(n);
}
// Visitor came back and viewed something new after transfer — fold that into the
// existing CRM lead (merge projects, refresh requirement, log it) and re-acknowledge.
function updateLeadFromDigital(webId) {
  const e = _webEnq.find((x) => String(x.id) === String(webId)); if (!e) return;
  const l = digiLinkedLead(e); if (!l) return toast("Linked CRM lead not found");
  const fresh = enquiryToLead(e);
  const merged = uniqList([...(l.projects_shared || []), ...(fresh.projects_shared || [])]);
  const note = "↻ New website activity " + fmtDT(e.ts) + (fresh.projects_shared.length ? " · now viewing: " + fresh.projects_shared.join(", ") : "");
  upsert("leads", {
    id: l.id,
    projects_shared: merged,
    requirement: fresh.requirement || l.requirement,
    remark: (l.remark ? l.remark + "\n" : "") + note,
    web_synced_ts: e.ts || Date.now()      // acknowledge — hides again until the NEXT new activity
  });
  toast("CRM lead updated with the new project/unit"); populateDigital();
}
async function deleteDigital(id) {
  const S = WS(); if (!S) return;
  if (!confirm("Delete this digital enquiry? This removes the website record.")) return;
  try { await S.deleteEnquiry(id); } catch (e) {}
  toast("Digital enquiry deleted"); populateDigital();
}
async function bulkDeleteDigital() {
  const S = WS(); if (!S) return;
  const ids = selectedBulk("digRows");
  if (!ids.length) return toast("Tick some rows first");
  if (!confirm(`Delete ${ids.length} selected digital enquiry(s)? This removes the website records.`)) return;
  for (const id of ids) { try { await S.deleteEnquiry(id); } catch (e) {} }
  toast(`Deleted ${ids.length}`); populateDigital();
}
function openDigitalForm(e) {
  if (!e) return; const S = WS(); if (!S) return toast("Website data layer not loaded");
  const isAgent = !!(e.agent && e.agent.isAgent);
  modal("Edit Digital Enquiry — " + (e.code || ""), `
    <div class="lf"><div class="lf-sec"><div class="lf-sec-body">
      <div class="form-grid">
        ${field("Name", "de_name", e.user, "full")}
        ${field("Mobile", "de_mobile", e.mobile)}
        ${field("Status", "de_status", digiStatusOf(e), "", ["New", "Process"])}
        ${field("Channel Partner firm", "de_firm", isAgent ? e.agent.firm : "")}
        ${field("CP designation", "de_desig", isAgent ? e.agent.designation : "")}
      </div>
      <div class="fu-meta" style="margin-top:8px">Interested in: ${webInterestSummary(e) || "—"}</div>
    </div></div></div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="de_save">Save</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("de_save").onclick = async () => {
    const firm = fieldVal("de_firm"), desig = fieldVal("de_desig");
    const patch = {
      user: fieldVal("de_name"),
      mobile: fieldVal("de_mobile"),
      digiStatus: fieldVal("de_status") || "Process",     // any edit marks it Process
      agent: firm ? { isAgent: true, firm, designation: desig } : null
    };
    try { await S.updateEnquiry(e.id, patch); } catch (x) {}
    closeModal(); toast("Saved"); populateDigital();
  };
}
// Map a website project name to a CRM requirement type (Plot / Floor / H-rise).
function reqTypeOf(name) {
  const p = DB.projects.find((x) => (x.name || "").trim().toLowerCase() === (name || "").trim().toLowerCase());
  const t = (p && p.type) || "";
  if (/high|rise/i.test(t)) return "H-rise";
  if (/plot/i.test(t)) return "Plot";
  if (/floor/i.test(t)) return "Floor";
  return t ? "Other" : "";
}
function enquiryToLead(e, invUnits) {
  const its = webInterests(e);
  const projects = uniqList(its.map((i) => i.project).filter(Boolean));
  const isAgent = !!(e.agent && e.agent.isAgent);
  const created = e.createdTs ? new Date(e.createdTs) : (e.ts ? new Date(e.ts) : new Date());
  // Requirement = the kind of home they looked at (Plot / Floor / H-rise / Other).
  // The enquiry form's Requirement is a single choice, so use the primary type.
  const types = uniqList(projects.map(reqTypeOf).filter(Boolean));
  const requirement = types[0] || "";
  // Units the visitor looked at, per project → prefill unit no(s) + costing from inventory.
  const units = {}, costing = {};
  const inv = invUnits || _mfUnits || [];
  its.forEach((i) => {
    if (!i.project) return;
    if (i.units && i.units.length) {
      units[i.project] = i.units.join(", ");
      // Costing: if a single unit is known, pull its ₹ (Cr) from live inventory.
      const first = i.units[0];
      const u = inv.find((x) => (x.project || "").toLowerCase() === i.project.toLowerCase() && String(x.unitNo).toLowerCase() === String(first).toLowerCase());
      if (u && u.costingCr) costing[i.project] = toCr(u.costingCr) + " Cr";
    }
  });
  const unitsStr = its.filter((i) => i.units && i.units.length).map((i) => `${i.project} (${i.units.join(", ")})`).join("; ");
  const remark = [
    "From Digital Enquiry " + (e.code || ""),
    unitsStr ? "Interested: " + unitsStr : (projects.length ? "Interested: " + projects.join(", ") : ""),
    requirement ? "Requirement: " + requirement : "",
    isAgent ? "CP: " + (e.agent.firm || "") + (e.agent.designation ? " (" + e.agent.designation + ")" : "") : ""
  ].filter(Boolean).join(" · ");
  return {
    lead_number: "DIGI-" + (e.code || String(e.id)),
    customer_name: e.user || "", customer_mobile: e.mobile || "",
    enquiry_type: isAgent ? "CP+CL" : "CL",          // customer capture → CL
    source_type: isAgent ? "CP" : "CL",              // CP (channel partner) or CL (direct client)
    source_name: isAgent ? (e.agent.firm || "") : "",
    source_firm: isAgent ? (e.agent.firm || "") : "",
    requirement, budget: "", stage: "Call", status: "Active", rating: "Warm",
    projects_shared: projects, units, costing,
    remark,
    lead_date: isNaN(created) ? today() : created.toISOString().slice(0, 10),
    web_src: e.id,
    web_synced_ts: e.ts || Date.now()      // last website activity captured at transfer
  };
}
// Ensure a customer record exists for a transferred lead (matched by mobile or name).
function ensureCustomerFromLead(lead) {
  const name = (lead.customer_name || "").trim(); if (!name) return;
  const digits = (lead.customer_mobile || "").replace(/\D/g, "");
  const exists = DB.customers.some((c) => (c.name || "").trim().toLowerCase() === name.toLowerCase()
    || (digits && [c.mobile1, c.mobile2, c.mobile3].some((m) => m && String(m).replace(/\D/g, "") === digits)));
  if (!exists) upsert("customers", { name, mobile1: lead.customer_mobile || "", category: "EndUser", contact_future: 1 });
}
// Transfer opens a PRE-FILLED New Enquiry so you can review and save. We load live
// inventory first so unit no(s) and costing prefill correctly.
async function transferEnquiry(webId) {
  const e = _webEnq.find((x) => String(x.id) === String(webId)); if (!e) return toast("Enquiry not found");
  if (DB.leads.some((l) => l.web_src === e.id)) return toast("Already in CRM");
  let inv = _mfUnits; const S = WS();
  if ((!inv || !inv.length) && S) { try { inv = await S.inventory(); _mfUnits = inv; _mfUnitsLoaded = true; } catch (x) { inv = []; } }
  openLeadForm(enquiryToLead(e, inv));   // saving the form also creates the customer record
}
async function transferAllNew() {
  const inCrm = new Set(DB.leads.map((l) => l.web_src).filter(Boolean));
  const fresh = _webEnq.filter((e) => !inCrm.has(e.id) && !e.transferred);
  if (!fresh.length) return toast("No new enquiries to transfer");
  if (!confirm("Transfer " + fresh.length + " new website enquiry(s) into CRM Enquiries?")) return;
  const S = WS();
  let inv = _mfUnits; if ((!inv || !inv.length) && S) { try { inv = await S.inventory(); _mfUnits = inv; _mfUnitsLoaded = true; } catch (x) { inv = []; } }
  fresh.forEach((e) => { const lead = enquiryToLead(e, inv); upsert("leads", lead); ensureCustomerFromLead(lead); if (S) { try { S.updateEnquiry(e.id, { transferred: true, transferredTs: Date.now() }); } catch (x) {} } });
  toast(fresh.length + " transferred to CRM"); populateDigital();
}
function exportDigitalCSV() {
  const head = ["Lead Code", "Name", "Mobile", "Agent", "Firm", "Interested in", "Last seen", "Status"];
  const rows = _webEnq.map((e) => [e.code || "", e.user || "", e.mobile || "", e.agent && e.agent.isAgent ? "Yes" : "No", (e.agent && e.agent.firm) || "", webInterests(e).map((i) => i.project + (i.units && i.units.length ? " (" + i.units.join("/") + ")" : "")).join("; "), e.ts ? new Date(e.ts).toLocaleString() : "", e.status || "Open"]);
  const csv = [head].concat(rows).map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const b = new Blob([csv], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "digital-enquiries-" + today() + ".csv"; a.click(); URL.revokeObjectURL(a.href); toast("Exported");
}


/* ============================================================
   PROJECTS & INVENTORY — exact port of admin.html, backed by the
   shared website data layer (window.Store). Duplicate-safe bulk
   Import (merge on Project Name / Project+Unit), Export, Excel
   Template (SheetJS), Search, Delete selected, Add/Edit/Delete.
   ============================================================ */
const PROJ_CAT = ["Ready to Move", "Under Construction"];
const PROJ_TYPE = ["Plot", "Floor", "High-rise"];
const UNIT_STATUS = ["Available", "Hold", "Sold"];

function truncate(s, n) { s = s || ""; return s.length > n ? s.slice(0, n) + "…" : s; }
function catTag(c) {
  const rtm = /ready/i.test(c || "");
  const col = rtm ? "#127a3e" : "#a15c00", bg = rtm ? "#e7f5ec" : "#faf0dd";
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;color:${col};background:${bg}">${esc(c || "—")}</span>`;
}
function unitStatusTag(s) {
  s = s || "Available";
  const map = { available: ["#127a3e", "#e7f5ec"], hold: ["#a15c00", "#faf0dd"], sold: ["#b3261e", "#fbe9e7"] };
  const c = map[s.toLowerCase()] || ["#475569", "#eef2f6"];
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;color:${c[0]};background:${c[1]}">${esc(s)}</span>`;
}

/* ---- bulk selection helpers ---- */
function selectedBulk(tableId) { const t = document.getElementById(tableId); return t ? [...t.querySelectorAll(".bulk:checked")].map((c) => c.getAttribute("data-id")) : []; }
function wireBulkAll(tableId) { const tb = document.getElementById(tableId); if (!tb) return; const table = tb.closest("table"); if (!table) return; const all = table.querySelector(".bulk-all"); if (all) all.onchange = () => tb.querySelectorAll(".bulk").forEach((c) => (c.checked = all.checked)); }
async function bulkDeleteStore(tableId, delFn, label, after) {
  const ids = selectedBulk(tableId);
  if (!ids.length) return toast("Tick some rows first");
  if (!confirm(`Delete ${ids.length} selected ${label}? This cannot be undone.`)) return;
  let okc = 0, failc = 0, lastErr = "";
  for (const id of ids) { try { await delFn(id); okc++; } catch (e) { failc++; lastErr = (e && (e.code || e.message)) || String(e); } }
  toast(failc ? `Deleted ${okc}, ${failc} failed${lastErr ? " · " + lastErr : ""}` : `Deleted ${okc} ${label}`);
  if (after) after();
}

/* ---- Excel/CSV template · import · export (shared) ---- */
const SHEET_COLS = {
  projects: ["Project Name", "Location", "Category", "Type", "Payment Plan", "Starting Price (Cr)", "Configuration", "Possession", "Image URL", "Description"],
  inventory: ["Project Name", "Unit No", "Size", "Unit description", "Status", "BSP", "Costing"]
};
const SHEET_SAMPLE = {
  projects: [["BPTP New Project", "Sector XX, Dwarka Expressway, Gurugram", "Under Construction", "High-rise", "10:90 CLP", "3.5", "3 & 4 BHK", "Est. 2028", "assets/newproject.jpg", "Short marketing description here."]],
  inventory: [["BPTP Amstoria", "A-104", "2400 sq.ft", "3 BHK ground floor, park facing", "Available", "21500", "5.16"]]
};
function sheetTemplate(target) {
  const headers = SHEET_COLS[target], samples = SHEET_SAMPLE[target];
  try {
    if (typeof XLSX === "undefined") throw new Error("no xlsx");
    const ws = XLSX.utils.aoa_to_sheet([headers, ...samples]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, target === "inventory" ? "Inventory" : "Projects");
    XLSX.writeFile(wb, "coffeeanddeals-" + target + "-template.xlsx");
  } catch (e) {
    const csv = headers.join(",") + "\n" + samples.map((r) => r.map((s) => `"${s}"`).join(",")).join("\n") + "\n";
    const b = new Blob([csv], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "coffeeanddeals-" + target + "-template.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  toast("Template downloaded");
}
function sheetExport(target, list) {
  const headers = SHEET_COLS[target];
  const rows = target === "projects"
    ? list.map((p) => [p.name, p.location, p.category, p.type, p.paymentPlan, p.priceFromCr, p.config, p.possession, p.image, p.description || p.about])
    : list.map((u) => [u.project, u.unitNo, u.size, u.desc, u.status, u.bsp || "", u.costingCr]);
  const csv = [headers].concat(rows).map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const b = new Blob([csv], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "coffeeanddeals-" + target + ".csv"; a.click(); URL.revokeObjectURL(a.href); toast("Exported");
}
function sheetImport(target, after) {
  const S = WS(); if (!S) return toast("Website data layer not loaded");
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xlsx,.xls,.csv";
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const isCsv = /\.csv$/i.test(f.name);
    if (!isCsv && typeof XLSX === "undefined") { toast("Spreadsheet engine still loading — wait a second and try Import again."); return; }
    const r = new FileReader();
    r.onerror = () => toast("Could not read that file — please try again.");
    r.onload = async (ev) => {
      try {
        let rows = [];
        if (!isCsv) {
          rows = readSheetRows(ev.target.result);
        } else {
          rows = parseCSV(String(ev.target.result));
        }
        if (!rows.length) { toast("That sheet has no data rows. Download the Template and fill it in."); return; }
        const rep = target === "projects" ? await S.bulkUpsertProjects(rows) : await S.bulkUpsertInventory(rows);
        if (rep.added === 0 && rep.merged === 0) {
          toast("Nothing imported — column headers don't match. Use the Template (Project Name, Unit No, Size, Status, Costing…).");
        } else {
          toast(`Imported: ${rep.added} new · ${rep.merged} merged · ${rep.skipped} skipped`);
        }
        if (after) after();
      } catch (e) { console.error("Import failed:", e); toast("Import failed: " + ((e && e.message) || String(e)) + " — check the Template format."); }
    };
    if (isCsv) r.readAsText(f); else r.readAsArrayBuffer(f);
  };
  inp.click();
}
// Parse an .xlsx/.xls ArrayBuffer into row objects, trying several strategies so it
// works across browsers and file variants. Throws a clear message if truly unreadable.
function readSheetRows(buf) {
  if (typeof XLSX === "undefined") throw new Error("spreadsheet engine not loaded — refresh and retry");
  let wb = null, lastErr = null;
  const tries = [
    () => XLSX.read(new Uint8Array(buf), { type: "array" }),
    () => XLSX.read(buf, { type: "array" }),
    () => XLSX.read(buf, { type: "buffer" }),
  ];
  for (const t of tries) { try { const w = t(); if (w && w.SheetNames && w.SheetNames.length) { wb = w; break; } } catch (e) { lastErr = e; } }
  if (!wb) throw (lastErr || new Error("file is not a readable .xlsx/.xls — re-save it as Excel or CSV"));
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("the first sheet is empty");
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}
function parseCSV(text) {
  const lines = String(text).replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  if (!lines.length) return [];
  const parseLine = (line) => { const out = []; let cur = "", inq = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (inq) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inq = false; } else cur += c; } else { if (c === '"') inq = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; } } out.push(cur); return out; };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((ln) => { const cells = parseLine(ln); const o = {}; headers.forEach((h, i) => (o[h] = (cells[i] || "").trim())); return o; });
}

/* ====================== PROJECTS (admin-style) ====================== */
let _proj = [];
function viewProjectsWeb() {
  return `
  <div class="card filters">
    <input type="text" class="search" id="pq" placeholder="Search projects…" />
    <button class="btn danger sm" id="pDel">🗑 Delete selected</button>
    <button class="btn outline sm" id="pTpl">⌄ Template</button>
    <button class="btn outline sm" id="pImp">↥ Import</button>
    <button class="btn outline sm" id="pExp">⌄ Export</button>
  </div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th style="width:34px"><input type="checkbox" class="bulk-all"></th>${["Project Name", "Location", "Category", "Featured", "Description", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody id="projRows"></tbody></table><div id="projEmpty"></div></div></div>`;
}
async function populateProjectsWeb() {
  const S = WS(); const body = document.getElementById("projRows"); if (!body) return;
  if (!S) { document.getElementById("projEmpty").innerHTML = `<div class="empty">Website data layer not loaded.</div>`; return; }
  try { _proj = await S.projects(); } catch (e) { _proj = []; }
  const q = (document.getElementById("pq") ? document.getElementById("pq").value : "").toLowerCase();
  const rows = _proj.filter((p) => !q || `${p.name || ""} ${p.location || ""} ${p.category || ""} ${p.type || ""}`.toLowerCase().includes(q));
  document.getElementById("projEmpty").innerHTML = rows.length ? "" : `<div class="empty">No projects. Add one or Import a sheet.</div>`;
  body.innerHTML = rows.map((p) => `<tr>
      <td><input type="checkbox" class="bulk" data-id="${esc(String(p.id))}"></td>
      <td><b>${p.featured ? "⭐ " : ""}${esc(p.name) || "—"}</b></td>
      <td class="nowrap">${esc(p.location) || "—"}</td>
      <td>${catTag(p.category)}</td>
      <td class="nowrap">
        <button class="btn ${p.featured ? "primary" : "outline"} sm" data-feat="${esc(String(p.id))}">${p.featured ? "★ Main" : "☆ Main"}</button>
        <button class="btn ${p.featured2 ? "primary" : "outline"} sm" data-feat2="${esc(String(p.id))}">${p.featured2 ? "★ 2nd" : "☆ 2nd"}</button>
      </td>
      <td class="fu-meta" style="max-width:240px">${esc(truncate(p.description || p.about, 60))}</td>
      <td class="right nowrap"><button class="btn outline sm" data-pedit="${esc(String(p.id))}">Edit</button><button class="btn danger sm" data-pdel="${esc(String(p.id))}">Delete</button></td>
    </tr>`).join("");
  wireBulkAll("projRows");
  body.querySelectorAll("[data-pedit]").forEach((b) => (b.onclick = () => openWebProjectForm(_proj.find((p) => String(p.id) === b.getAttribute("data-pedit")))));
  body.querySelectorAll("[data-pdel]").forEach((b) => (b.onclick = () => deleteWebProject(b.getAttribute("data-pdel"))));
  body.querySelectorAll("[data-feat]").forEach((b) => (b.onclick = () => toggleFeatured(b.getAttribute("data-feat"), "featured")));
  body.querySelectorAll("[data-feat2]").forEach((b) => (b.onclick = () => toggleFeatured(b.getAttribute("data-feat2"), "featured2")));
  const pq = document.getElementById("pq"); if (pq && !pq._wired) { pq._wired = 1; pq.addEventListener("input", populateProjectsWeb); }
  const del = document.getElementById("pDel"); if (del) del.onclick = () => bulkDeleteStore("projRows", (id) => S.deleteProject(id), "projects", () => { populateProjectsWeb(); syncWebProjects(); });
  const tpl = document.getElementById("pTpl"); if (tpl) tpl.onclick = () => sheetTemplate("projects");
  const imp = document.getElementById("pImp"); if (imp) imp.onclick = () => sheetImport("projects", () => { populateProjectsWeb(); syncWebProjects(); });
  const exp = document.getElementById("pExp"); if (exp) exp.onclick = () => sheetExport("projects", _proj);
  syncWebProjects();
}
async function toggleFeatured(id, key) {
  const S = WS(); if (!S) return;
  const cur = _proj.find((p) => String(p.id) === String(id)); if (!cur) return;
  const will = !cur[key];
  const patch = { id: cur.id }; patch[key] = will;
  if (will) patch[key === "featured" ? "featured2" : "featured"] = false;
  await S.saveProject(patch);
  if (will) { for (const o of _proj) { if (String(o.id) !== String(id) && o[key]) await S.saveProject({ id: o.id, [key]: false }); } }
  toast(will ? (key === "featured" ? "Set as main Featured." : "Set as 2nd Featured.") : "Removed from Featured.");
  populateProjectsWeb();
}
async function deleteWebProject(id) {
  const S = WS(); if (!S) return;
  if (!confirm("Delete this project? Its inventory units will also be removed.")) return;
  await S.deleteProject(id); toast("Project deleted"); populateProjectsWeb(); syncWebProjects();
}
function openWebProjectForm(existing) {
  const S = WS(); if (!S) return toast("Website data layer not loaded");
  const e = existing || {};
  const chk = (id, on, label) => `<label class="field full" style="flex-direction:row;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="${id}" ${on ? "checked" : ""} style="width:auto"><span>${label}</span></label>`;
  modal(existing ? "Edit Project" : "Add Project", `
    <div class="lf"><div class="lf-sec"><div class="lf-sec-body"><div class="form-grid">
      ${field("Project Name", "dp_name", e.name, "full")}
      ${field("Location", "dp_loc", e.location, "full")}
      ${field("Category", "dp_cat", e.category, "", PROJ_CAT)}
      ${field("Type", "dp_type", e.type, "", PROJ_TYPE)}
      ${field("Payment Plan", "dp_pay", e.paymentPlan)}
      ${field("Starting Price (₹ Cr)", "dp_price", e.priceFromCr, "number")}
      ${field("Configuration", "dp_config", e.config)}
      ${field("Possession", "dp_poss", e.possession)}
      ${field("Image URL (assets/… or https://…)", "dp_img", e.image, "full")}
      ${field("Description", "dp_desc", e.description || e.about, "textarea")}
      ${chk("dp_feat", e.featured, "⭐ Show as <b>Featured Project</b> (main, top of Projects)")}
      ${chk("dp_feat2", e.featured2, "★ Show as <b>2nd Featured</b> (secondary highlighted card)")}
    </div></div></div></div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="dp_save">Save Project</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("dp_save").onclick = async () => {
    const name = fieldVal("dp_name"); if (!name) return toast("Project name is required");
    const featured = document.getElementById("dp_feat").checked;
    const featured2 = document.getElementById("dp_feat2").checked && !featured;
    const rec = { id: e.id, name, location: fieldVal("dp_loc"), category: fieldVal("dp_cat"), type: fieldVal("dp_type"), paymentPlan: fieldVal("dp_pay"), priceFromCr: parseFloat(fieldVal("dp_price")) || 0, config: fieldVal("dp_config"), possession: fieldVal("dp_poss"), image: fieldVal("dp_img"), featured, featured2, description: fieldVal("dp_desc"), about: fieldVal("dp_desc") };
    await S.saveProject(rec);
    if (featured) { for (const o of _proj) { if (o.id !== rec.id && o.featured) await S.saveProject({ id: o.id, featured: false }); } }
    if (featured2) { for (const o of _proj) { if (o.id !== rec.id && o.featured2) await S.saveProject({ id: o.id, featured2: false }); } }
    closeModal(); toast("Project saved"); populateProjectsWeb(); syncWebProjects();
  };
}

/* ====================== INVENTORY (admin-style) ====================== */
let _inv = [];
function viewInventory() {
  return `
  <div class="card filters">
    <input type="text" class="search" id="iq" placeholder="Search project, unit, size…" />
    <select id="iProj"><option value="">All projects</option></select>
    <button class="btn danger sm" id="iDel">🗑 Delete selected</button>
    <button class="btn outline sm" id="iTpl">⌄ Template</button>
    <button class="btn outline sm" id="iImp">↥ Import</button>
    <button class="btn outline sm" id="iExp">⌄ Export</button>
  </div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th style="width:34px"><input type="checkbox" class="bulk-all"></th>${["Project", "Unit No", "Size", "Description", "Status", "BSP", "Costing", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody id="invRows"></tbody></table><div id="invEmpty"></div></div></div>`;
}
async function populateInventory() {
  const S = WS(); const body = document.getElementById("invRows"); if (!body) return;
  if (!S) { document.getElementById("invEmpty").innerHTML = `<div class="empty">Website data layer not loaded.</div>`; return; }
  try { _inv = await S.inventory(); } catch (e) { _inv = []; }
  const projSel = document.getElementById("iProj");
  if (projSel && projSel.options.length <= 1) {
    const names = uniqList(_inv.map((u) => u.project).filter(Boolean)).sort();
    projSel.insertAdjacentHTML("beforeend", names.map((n) => `<option>${esc(n)}</option>`).join(""));
  }
  const q = (document.getElementById("iq") ? document.getElementById("iq").value : "").toLowerCase();
  const pf = document.getElementById("iProj") ? document.getElementById("iProj").value : "";
  const rows = _inv.filter((u) => (!pf || u.project === pf) && (!q || `${u.project || ""} ${u.unitNo || ""} ${u.size || ""} ${u.desc || ""}`.toLowerCase().includes(q)));
  document.getElementById("invEmpty").innerHTML = rows.length ? "" : `<div class="empty">No units match. Click “+ Add Unit” or Import a sheet.</div>`;
  body.innerHTML = rows.map((u) => `<tr>
      <td><input type="checkbox" class="bulk" data-id="${esc(String(u.id))}"></td>
      <td>${esc(u.project) || "—"}</td>
      <td class="mono nowrap"><b>${esc(u.unitNo) || "—"}</b></td>
      <td class="nowrap">${esc(u.size) || "—"}</td>
      <td class="fu-meta" style="max-width:220px">${esc(truncate(u.desc, 50))}</td>
      <td>${unitStatusTag(u.status)}</td>
      <td class="nowrap">${u.bsp ? "₹" + Number(u.bsp).toLocaleString("en-IN") : "—"}</td>
      <td class="nowrap">${crLabel(u.costingCr)}</td>
      <td class="right nowrap"><button class="btn outline sm" data-uedit="${esc(String(u.id))}">Edit</button><button class="btn danger sm" data-udel="${esc(String(u.id))}">Delete</button></td>
    </tr>`).join("");
  wireBulkAll("invRows");
  body.querySelectorAll("[data-uedit]").forEach((b) => (b.onclick = () => openUnitForm(_inv.find((u) => String(u.id) === b.getAttribute("data-uedit")))));
  body.querySelectorAll("[data-udel]").forEach((b) => (b.onclick = () => deleteUnit(b.getAttribute("data-udel"))));
  const iq = document.getElementById("iq"); if (iq && !iq._wired) { iq._wired = 1; iq.addEventListener("input", populateInventory); }
  if (projSel && !projSel._wired) { projSel._wired = 1; projSel.addEventListener("change", populateInventory); }
  const del = document.getElementById("iDel"); if (del) del.onclick = () => bulkDeleteStore("invRows", (id) => S.deleteUnit(id), "units", populateInventory);
  const tpl = document.getElementById("iTpl"); if (tpl) tpl.onclick = () => sheetTemplate("inventory");
  const imp = document.getElementById("iImp"); if (imp) imp.onclick = () => sheetImport("inventory", populateInventory);
  const exp = document.getElementById("iExp"); if (exp) exp.onclick = () => sheetExport("inventory", _inv);
}
function openUnitForm(existing) {
  const S = WS(); if (!S) return toast("Website data layer not loaded");
  const u = existing || { status: "Available" };
  const projNames = uniqList(_inv.map((x) => x.project).filter(Boolean).concat((_proj || []).map((p) => p.name))).sort();
  modal(existing ? "Edit Unit" : "Add Unit", `
    <div class="lf"><div class="lf-sec"><div class="lf-sec-body"><div class="form-grid">
      ${field("Project", "u_proj", u.project, "", projNames.length ? projNames : undefined)}
      ${field("Unit No", "u_unit", u.unitNo)}
      ${field("Size", "u_size", u.size)}
      ${field("Status", "u_status", u.status, "", UNIT_STATUS)}
      ${field("BSP (₹ / sq.ft)", "u_bsp", u.bsp, "number")}
      ${field("Costing (in ₹ Cr, e.g. 8.58)", "u_cost", toCr(u.costingCr) || "", "number")}
      ${field("Unit description", "u_desc", u.desc, "textarea")}
    </div></div></div></div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="saveUnit">Save Unit</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("saveUnit").onclick = async () => {
    const project = fieldVal("u_proj"), unitNo = fieldVal("u_unit");
    if (!project || !unitNo) return toast("Project and Unit No are required");
    const rec = { project, unitNo, size: fieldVal("u_size"), desc: fieldVal("u_desc"), status: fieldVal("u_status") || "Available", bsp: Number(fieldVal("u_bsp")) || 0, costingCr: Number(fieldVal("u_cost")) || 0 };
    if (u.id) rec.id = u.id;
    try { await S.saveUnit(rec); } catch (e) {}
    closeModal(); toast("Unit saved"); populateInventory();
  };
}
async function deleteUnit(id) {
  const S = WS(); if (!S) return;
  if (!confirm("Delete this unit?")) return;
  try {
    await S.deleteUnit(id);
    const still = (await S.inventory()).some((u) => String(u.id) === String(id));
    toast(still ? "⚠️ Couldn't delete — it came back. Are you signed in as admin?" : "Unit deleted");
  } catch (e) { toast("⚠️ Delete failed: " + ((e && (e.code || e.message)) || String(e))); }
  populateInventory();
}

/* ====================== TESTIMONIALS ====================== */
let _testi = [];
function testiStatusTag(approved) {
  const c = approved ? ["#127a3e", "#e7f5ec"] : ["#a15c00", "#faf0dd"];
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;color:${c[0]};background:${c[1]}">${approved ? "Published" : "Pending"}</span>`;
}
function viewTestimonials() {
  return `
  <div class="card filters">
    <input type="text" class="search" id="tq" placeholder="Search name, role, review…" />
    <button class="btn danger sm" id="tDel">🗑 Delete selected</button>
    <button class="btn outline sm" id="tExp">⌄ Export</button>
  </div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th style="width:34px"><input type="checkbox" class="bulk-all"></th>${["Name", "Role", "Rating", "Review", "Status", ""].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody id="testiRows"></tbody></table><div id="testiEmpty"></div></div></div>`;
}
async function populateTestimonials() {
  const S = WS(); const body = document.getElementById("testiRows"); if (!body) return;
  if (!S) { document.getElementById("testiEmpty").innerHTML = `<div class="empty">Website data layer not loaded.</div>`; return; }
  try { _testi = await S.testimonials(true); } catch (e) { _testi = []; }
  // Full contact details live in the admin-only `testimonial_contacts` collection —
  // merge them in for the admin view (the public site only ever sees masked hints).
  let _contacts = {};
  try { if (typeof S.testimonialContacts === "function") { (await S.testimonialContacts()).forEach((c) => { _contacts[String(c.id)] = c; }); } } catch (e) {}
  _testi.forEach((t) => { const c = _contacts[String(t.id)]; if (c) { t.mobile = t.mobile || c.mobile; t.email = t.email || c.email; t.who = t.who || c.who; } });
  // Pending first (need your attention), then published.
  _testi.sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1));
  const q = (document.getElementById("tq") ? document.getElementById("tq").value : "").toLowerCase();
  const rows = _testi.filter((t) => !q || `${t.name || ""} ${t.role || ""} ${t.text || ""}`.toLowerCase().includes(q));
  document.getElementById("testiEmpty").innerHTML = rows.length ? "" : `<div class="empty">No testimonials yet. Add one, or they arrive when visitors submit a review on your site.</div>`;
  body.innerHTML = rows.map((t) => `<tr>
      <td><input type="checkbox" class="bulk" data-id="${esc(String(t.id))}"></td>
      <td><b>${esc(t.name) || "—"}</b>${t.who ? ` <span class="badge b-default">${esc(t.who)}</span>` : ""}${(t.mobile || t.email) ? `<div class="fu-meta">${[t.mobile, t.email].filter(Boolean).map(esc).join(" · ")}</div>` : ""}</td>
      <td class="nowrap">${esc(t.role) || "—"}</td>
      <td class="nowrap" style="color:#b3762f">${"★".repeat(Number(t.rating) || 5)}</td>
      <td class="fu-meta" style="max-width:300px">${esc(truncate(t.text, 100))}</td>
      <td>${testiStatusTag(!!t.approved)}</td>
      <td class="right nowrap">
        <button class="btn ${t.approved ? "outline" : "primary"} sm" data-tappr="${esc(String(t.id))}">${t.approved ? "Unpublish" : "Approve"}</button>
        <button class="btn danger sm" data-tdel="${esc(String(t.id))}">Delete</button>
      </td>
    </tr>`).join("");
  wireBulkAll("testiRows");
  body.querySelectorAll("[data-tappr]").forEach((b) => (b.onclick = () => toggleTestimonial(b.getAttribute("data-tappr"))));
  body.querySelectorAll("[data-tdel]").forEach((b) => (b.onclick = () => deleteTesti(b.getAttribute("data-tdel"))));
  const tq = document.getElementById("tq"); if (tq && !tq._wired) { tq._wired = 1; tq.addEventListener("input", populateTestimonials); }
  const del = document.getElementById("tDel"); if (del) del.onclick = () => bulkDeleteStore("testiRows", (id) => S.deleteTestimonial(id), "testimonials", populateTestimonials);
  const exp = document.getElementById("tExp"); if (exp) exp.onclick = exportTestimonials;
}
async function toggleTestimonial(id) {
  const S = WS(); if (!S) return;
  const t = _testi.find((x) => String(x.id) === String(id)); if (!t) return;
  try { await S.setTestimonialApproved(t.id, !t.approved); } catch (e) {}
  toast(t.approved ? "Unpublished from site" : "Published to your website"); populateTestimonials();
}
async function deleteTesti(id) {
  const S = WS(); if (!S) return;
  if (!confirm("Delete this testimonial?")) return;
  try {
    await S.deleteTestimonial(id);
    const still = (await S.testimonials(true)).some((t) => String(t.id) === String(id));
    toast(still ? "⚠️ Couldn't delete — it came back. Are you signed in as admin?" : "Testimonial deleted");
  } catch (e) { toast("⚠️ Delete failed: " + ((e && (e.code || e.message)) || String(e))); }
  populateTestimonials();
}
function openTestimonialForm() {
  const S = WS(); if (!S) return toast("Website data layer not loaded");
  modal("Add Testimonial", `
    <div class="lf"><div class="lf-sec"><div class="lf-sec-body"><div class="form-grid">
      ${field("Customer name", "t_name", "", "full")}
      ${field("Role / location (e.g. NRI Buyer, Dubai)", "t_role", "", "full")}
      ${field("Rating (1–5)", "t_rating", "5", "number")}
      ${field("Review", "t_text", "", "textarea")}
      <label class="field full" style="flex-direction:row;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="t_pub" checked style="width:auto"><span>Publish to website now (untick to keep as pending)</span></label>
    </div></div></div></div>
    <div class="modal-foot"><button class="btn outline" data-close2>Cancel</button><button class="btn primary" id="t_save">Save</button></div>`, true);
  document.querySelector("[data-close2]").onclick = closeModal;
  document.getElementById("t_save").onclick = async () => {
    const name = fieldVal("t_name"); if (!name) return toast("Name is required");
    const text = fieldVal("t_text"); if (!text) return toast("Review text is required");
    let rating = Number(fieldVal("t_rating")) || 5; rating = Math.max(1, Math.min(5, rating));
    const publish = document.getElementById("t_pub").checked;
    try {
      const created = await S.addTestimonial({ name, role: fieldVal("t_role"), rating, text });
      if (publish && created && created.id) await S.setTestimonialApproved(created.id, true);
    } catch (e) {}
    closeModal(); toast("Testimonial saved"); populateTestimonials();
  };
}
function exportTestimonials() {
  const head = ["Name", "Role", "Rating", "Review", "Published"];
  const rows = _testi.map((t) => [t.name || "", t.role || "", t.rating || "", t.text || "", t.approved ? "Yes" : "No"]);
  const csv = [head].concat(rows).map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const b = new Blob([csv], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "coffeeanddeals-testimonials.csv"; a.click(); URL.revokeObjectURL(a.href); toast("Exported");
}

/* ====================== ONE-TIME: local catalog → cloud ====================== */
// The catalog (projects/inventory/testimonials) used to live only in this browser.
// The first time an admin opens the cloud CRM, upload it to Firestore so every
// device — and the public website — reads the same data. Runs once (skips if the
// cloud already has projects). Preserves your real/imported data.
async function migrateWebCatalogToCloud() {
  const S = WS(); if (!S || S.mode !== "firebase") return;
  const fb = S.firebase; if (!fb || typeof fb.projectsRaw !== "function") return;
  let raw = []; try { raw = await fb.projectsRaw(); } catch (e) { return; }
  if (raw && raw.length) return; // cloud genuinely has the catalog — nothing to do
  let local = null; try { local = JSON.parse(localStorage.getItem("cnd_db_v2") || "null"); } catch (e) {}
  // Fall back to the built-in BPTP catalogue if this device has no local data.
  const projects = (local && local.projects && local.projects.length) ? local.projects : (typeof SEED_PROJECTS !== "undefined" ? SEED_PROJECTS : []);
  const inventory = (local && local.inventory && local.inventory.length) ? local.inventory : (typeof SEED_INVENTORY !== "undefined" ? SEED_INVENTORY : []);
  const testimonials = (local && local.testimonials && local.testimonials.length) ? local.testimonials : (typeof SEED_TESTIMONIALS !== "undefined" ? SEED_TESTIMONIALS : []);
  const partners = (local && local.partners && local.partners.length) ? local.partners : [];
  if (!projects.length && !inventory.length) return;
  let n = 0;
  for (const p of projects) { try { await S.saveProject(p); n++; } catch (e) {} }
  for (const u of inventory) { try { await S.saveUnit(u); } catch (e) {} }
  for (const t of testimonials) { try { const nt = await S.addTestimonial({ ...t }); if (t.approved && nt && nt.id) await S.setTestimonialApproved(nt.id, true); } catch (e) {} }
  for (const pr of partners) { try { await S.savePartner(pr); } catch (e) {} }
  if (n) toast("Catalog uploaded to the cloud ☁ — now shared across devices & site");
}

/* ====================== PROJECT SYNC (internal mirror) ====================== */
// Mirror the website's project NAMES into the CRM's own project list so the
// lead form dropdown and reports reference the same real projects.
async function syncWebProjects() {
  const S = WS(); if (!S) return;
  let webp = []; try { webp = await S.projects(); } catch (e) { return; }
  if (!webp || !webp.length) return;
  const have = new Set(DB.projects.map((p) => (p.name || "").trim().toLowerCase()));
  const SAMPLE = new Set(["skyline heights", "green meadows", "urban nest"]);
  let changed = false;
  const before = DB.projects.length;
  DB.projects = DB.projects.filter((p) => !SAMPLE.has((p.name || "").trim().toLowerCase()) || DB.leads.some((l) => (l.projects_shared || []).includes(p.name)));
  if (DB.projects.length !== before) changed = true;
  webp.forEach((wp) => {
    const key = (wp.name || "").trim().toLowerCase(); if (!key || have.has(key)) return;
    DB.projects.push({ id: nextId(), name: wp.name, type: wp.type || "", location: wp.location || "", price_min: wp.priceLabel || (wp.priceFromCr ? "₹" + wp.priceFromCr + " Cr" : ""), price_max: "", status: /sold/i.test(wp.category || "") ? "Sold Out" : "Live", notes: wp.config || wp.tagline || "", created_at: now() });
    have.add(key); changed = true;
  });
  if (changed) save();
}
