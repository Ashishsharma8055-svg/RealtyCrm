/* admin.js — Coffee & Deals CRM */
(function () {
  const cfg = window.APP_CONFIG, brand = cfg.brand;
  const isFirebase = Store.mode === "firebase";
  let importTarget = null;

  document.addEventListener("DOMContentLoaded", () => { paintGate(); wireGate(); });

  function paintGate() {
    document.getElementById("gateHead").innerHTML = `${mugSVG}<h2>Coffee &amp; Deals CRM</h2><p>Admin access · ${isFirebase ? "Firebase secured" : "Local demo mode"}</p>`;
    document.getElementById("gateFirebase").style.display = isFirebase ? "block" : "none";
    document.getElementById("gateLocal").style.display = isFirebase ? "none" : "block";
  }
  function wireGate() {
    document.getElementById("btnLocalLogin").addEventListener("click", () => { const code = document.getElementById("adCode").value; if (code === cfg.demoAdminPass) enterCRM({ email: "local-admin" }); else toast("Incorrect passcode.", "err"); });
    document.getElementById("adCode").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("btnLocalLogin").click(); });
    document.getElementById("btnFbLogin").addEventListener("click", async () => {
      const email = document.getElementById("adEmail").value.trim(), pass = document.getElementById("adPass").value;
      try { const fb = await Store.firebase.ensure(); const cred = await fb.authM.signInWithEmailAndPassword(fb.auth, email, pass); enterCRM({ email: cred.user.email, uid: cred.user.uid }); }
      catch (e) { console.error(e); toast("Sign-in failed. Check credentials.", "err"); }
    });
  }
  async function enterCRM(user) {
    document.getElementById("gate").style.display = "none";
    document.getElementById("shell").style.display = "grid";
    document.getElementById("sideBrand").innerHTML = `${mugSVG}<span style="font-size:1.05rem">Coffee &amp; Deals<small>Admin CRM</small></span>`;
    document.getElementById("whoami").textContent = "Signed in: " + (user.email || "admin");
    const pill = document.getElementById("modePill"); pill.textContent = isFirebase ? "● Firebase backend" : "● Local demo data"; pill.className = "mode-pill " + (isFirebase ? "firebase" : "local");
    document.getElementById("btnLogout").addEventListener("click", async () => { if (isFirebase) { try { const fb = await Store.firebase.ensure(); await fb.authM.signOut(fb.auth); } catch (e) {} } location.reload(); });
    document.getElementById("btnRefresh").addEventListener("click", async () => { await refreshAll(); toast("Data refreshed.", "ok"); });
    let autoTimer = null;
    document.getElementById("autoRefresh").addEventListener("change", (e) => {
      if (e.target.checked) { autoTimer = setInterval(() => refreshAll(), 20000); toast("Auto-refresh on (every 20s).", "ok"); }
      else { clearInterval(autoTimer); autoTimer = null; }
    });
    wireNav(); wireProjects(); wireInventory(); wireEnquiries(); wirePartners(); wireTestimonials(); wireImport();
    wireCustomers(); wireWorkplan(); wireFunnel();
    await refreshAll(); showView("dash");
  }
  function wireNav() {
    document.querySelectorAll("#sideNav a").forEach(a => a.addEventListener("click", () => showView(a.dataset.view)));
    document.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => showView(b.dataset.goto)));
  }
  const TITLES = { dash: "Dashboard", customers: "Customer Management", analytics: "Pipeline Analytics", funnel: "Sales Funnel & Forecast", workplan: "Work Plan", projects: "Projects", inventory: "Inventory", enquiries: "Enquiry Records", partners: "Channel Partners", testimonials: "Testimonials" };
  function showView(v) {
    document.querySelectorAll("#sideNav a").forEach(a => a.classList.toggle("active", a.dataset.view === v));
    document.querySelectorAll(".view").forEach(s => s.classList.toggle("active", s.id === "v-" + v));
    document.getElementById("viewTitle").textContent = TITLES[v] || v;
  }

  const STAGES = ["New", "Contacted", "Qualified", "Site Visit", "Negotiation", "Booked", "Lost"];
  const STAGE_PROB = { "New": .1, "Contacted": .2, "Qualified": .35, "Site Visit": .55, "Negotiation": .75, "Booked": 1, "Lost": 0 };
  const SOURCES = ["Website", "Channel Partner", "Referral", "Walk-in", "Social", "Other"];
  const SRC_WEIGHT = { "Referral": 10, "Channel Partner": 8, "Website": 7, "Walk-in": 6, "Social": 4, "Other": 2 };
  const OWNERS = ["Ashish", "Priya", "Rahul", "Sana"];
  function scoreLead(c) {
    if (c.stage === "Lost") return { score: 0, tier: "Cold" };
    let s = (STAGE_PROB[c.stage] || 0) * 40;                 // stage: up to 40
    const val = +c.value || +c.budget || 0;                  // deal size (₹ Cr): up to 25
    s += Math.min(val / 10, 1) * 25;
    s += Math.min(((c.activities || []).length) / 5, 1) * 15; // engagement: up to 15
    s += SRC_WEIGHT[c.source] || 3;                          // source: up to 10
    const days = (Date.now() - (c.lastTs || c.createdTs || 0)) / 86400000;
    s += Math.max(0, 10 - days);                             // recency: up to 10 (fresh <10d)
    const score = Math.max(0, Math.min(100, Math.round(s)));
    return { score, tier: score >= 70 ? "Hot" : score >= 45 ? "Warm" : "Cold" };
  }
  function scoreBadge(c) { const { score, tier } = scoreLead(c); return `<span class="score-badge sc-${tier}" title="Lead score">${score}<i>${tier}</i></span>`; }
  let PROJECTS = [], INVENTORY = [], ENQ = [], PARTNERS = [], TESTI = [], CUSTOMERS = [], TASKS = [], TARGETS = {};
  let boardMode = false;
  const fmtDate = ts => ts ? new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "";
  async function refreshAll() {
    [PROJECTS, INVENTORY, ENQ, PARTNERS, TESTI, CUSTOMERS, TASKS, TARGETS] = await Promise.all([Store.projects(), Store.inventory(), Store.enquiries(), Store.partners(), Store.testimonials(true), Store.customers(), Store.tasks(), Store.targets()]);
    document.getElementById("bProjects").textContent = PROJECTS.length; document.getElementById("bInventory").textContent = INVENTORY.length;
    document.getElementById("bEnq").textContent = ENQ.length; document.getElementById("bCP").textContent = PARTNERS.length; document.getElementById("bTesti").textContent = TESTI.length;
    document.getElementById("bCust").textContent = CUSTOMERS.length; document.getElementById("bTask").textContent = TASKS.filter(t => !t.done).length;
    renderDash(); renderProjects(); renderInventory(); renderEnquiries(); renderPartners(); renderTestimonials(); fillProjectFilter();
    renderCustomers(); renderWorkplan(); renderFunnel(); renderAnalytics();
  }
  function renderDash() {
    const avail = INVENTORY.filter(u => u.status === "Available").length, openEnq = ENQ.filter(e => e.status === "Open").length, pending = TESTI.filter(t => !t.approved).length;
    const openLeads = CUSTOMERS.filter(c => c.stage !== "Booked" && c.stage !== "Lost").length;
    const pipeVal = CUSTOMERS.filter(c => c.stage !== "Booked" && c.stage !== "Lost").reduce((s, c) => s + (+c.value || 0), 0);
    const st = new Date(); st.setHours(0, 0, 0, 0); const st0 = st.getTime();
    const dueToday = TASKS.filter(t => !t.done && t.due && t.due >= st0 && t.due < st0 + 86400000).length;
    const overdue = TASKS.filter(t => !t.done && t.due && t.due < st0).length;
    document.getElementById("dashCards").innerHTML = `${card("Open Leads", openLeads, "pipeline " + crLabel(pipeVal))}${card("Available Units", avail, "of " + INVENTORY.length)}${card("Open Enquiries", openEnq, "web leads")}${card("Tasks Due Today", dueToday, overdue + " overdue")}`;
    const rows = ENQ.slice(0, 6);
    document.getElementById("dashEnq").innerHTML = rows.length ? `<thead><tr><th>Lead Code</th><th>Name</th><th>Mobile</th><th>Interested in</th><th>Last seen</th><th>Status</th></tr></thead><tbody>${rows.map(e => `<tr><td><b>${esc(e.code || "—")}</b></td><td>${esc(e.user)}</td><td>${esc(e.mobile)}</td><td style="max-width:240px">${interestSummary(e)}</td><td class="muted" style="white-space:nowrap">${fmtDT(e.ts)}</td><td><span class="tag ${esc(e.status)}">${esc(e.status)}</span></td></tr>`).join("")}</tbody>` : `<tr><td class="empty">No enquiries yet.</td></tr>`;
    if (pending) toastOnce("pending", pending + " testimonial(s) awaiting your review.");
  }
  function card(k, n, sub) { return `<div class="mcard"><div class="k">${k}</div><div class="n">${n} <small>${sub}</small></div></div>`; }

  function wireProjects() { document.getElementById("pAdd").addEventListener("click", () => editProject(null)); document.getElementById("pImport").addEventListener("click", () => openImport("projects")); document.getElementById("pSearch").addEventListener("input", renderProjects); document.getElementById("pBulkDel").addEventListener("click", () => bulkDelete("pTable", id => Store.deleteProject(id), "projects")); document.getElementById("pExport").addEventListener("click", exportProjects); document.getElementById("pTemplate").addEventListener("click", () => downloadTemplate("projects")); }
  function renderProjects() {
    const q = norm(document.getElementById("pSearch").value);
    const list = PROJECTS.filter(p => !q || norm(p.name + p.location).includes(q));
    document.getElementById("pTable").innerHTML = list.length ? `<thead><tr>${chkTh}<th>Project Name</th><th>Location</th><th>Category</th><th>Featured</th><th>Description</th><th></th></tr></thead><tbody>${list.map(p => `<tr>${chkTd(p.id)}<td><b>${p.featured ? "⭐ " : ""}${esc(p.name)}</b></td><td>${esc(p.location)}</td><td><span class="tag ${p.category === "Ready to Move" ? "RTM" : "UC"}">${esc(p.category)}</span></td><td style="white-space:nowrap"><button class="mini" data-feat="${esc(p.id)}" style="${p.featured ? "border-color:var(--accent-2);color:var(--accent-2)" : ""}">${p.featured ? "★ Main" : "☆ Main"}</button> <button class="mini" data-feat2="${esc(p.id)}" style="${p.featured2 ? "border-color:#b3762f;color:#b3762f" : ""}">${p.featured2 ? "★ 2nd" : "☆ 2nd"}</button></td><td style="max-width:220px" class="muted">${esc(truncate(p.description || p.about, 60))}</td><td style="white-space:nowrap"><button class="mini" data-edit="${esc(p.id)}">Edit</button> <button class="mini del" data-del="${esc(p.id)}">Delete</button></td></tr>`).join("")}</tbody>` : `<tr><td class="empty">No projects. Add one or import a sheet.</td></tr>`;
    wireSelectAll("pTable");
    bind("pTable", "[data-edit]", id => editProject(PROJECTS.find(p => p.id === id)));
    bind("pTable", "[data-del]", async id => { if (confirm("Delete this project?")) { await Store.deleteProject(id); await refreshAll(); toast("Project deleted.", "ok"); } });
    bind("pTable", "[data-feat]", async id => {
      const cur = PROJECTS.find(p => p.id === id); const willFeature = !cur.featured;
      await Store.saveProject({ id, featured: willFeature, ...(willFeature ? { featured2: false } : {}) });
      if (willFeature) { for (const o of PROJECTS) { if (o.id !== id && o.featured) await Store.saveProject({ id: o.id, featured: false }); } }
      await refreshAll(); toast(willFeature ? "Set as main Featured Project (top)." : "Removed from Featured.", "ok");
    });
    bind("pTable", "[data-feat2]", async id => {
      const cur = PROJECTS.find(p => p.id === id); const will = !cur.featured2;
      await Store.saveProject({ id, featured2: will, ...(will ? { featured: false } : {}) });
      if (will) { for (const o of PROJECTS) { if (o.id !== id && o.featured2) await Store.saveProject({ id: o.id, featured2: false }); } }
      await refreshAll(); toast(will ? "Set as 2nd Featured." : "Removed from 2nd Featured.", "ok");
    });
  }
  function editProject(p) {
    const e = p || {};
    openDrawer(p ? "Edit Project" : "Add Project", `${fld("Project Name", "dp_name", e.name)}${fld("Location", "dp_loc", e.location)}${sel("Category", "dp_cat", ["Ready to Move", "Under Construction"], e.category)}${sel("Type", "dp_type", ["Plot", "Floor", "High-rise"], e.type)}${fld("Payment Plan", "dp_pay", e.paymentPlan)}${fld("Starting Price (₹ Cr)", "dp_price", e.priceFromCr, "number")}${fld("Configuration", "dp_config", e.config)}${fld("Possession", "dp_poss", e.possession)}${fld("Image URL (assets/... or https://...)", "dp_img", e.image)}${area("Description", "dp_desc", e.description || e.about)}<label class="field" style="flex-direction:row;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="dp_feat" ${e.featured ? "checked" : ""} style="width:auto"><span>⭐ Show as <b>Featured Project</b> (main, top of Projects)</span></label><label class="field" style="flex-direction:row;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="dp_feat2" ${e.featured2 ? "checked" : ""} style="width:auto"><span>★ Show as <b>2nd Featured</b> (secondary highlighted card)</span></label><button class="btn btn-gold btn-block" id="dp_save">Save Project</button>`);
    document.getElementById("dp_save").addEventListener("click", async () => {
      const name = val("dp_name"); if (!name) { toast("Project name is required.", "err"); return; }
      const featured = document.getElementById("dp_feat").checked;
      const featured2 = document.getElementById("dp_feat2").checked && !featured; // a project is main OR 2nd, not both
      const rec = { id: e.id, name, location: val("dp_loc"), category: val("dp_cat"), type: val("dp_type"), paymentPlan: val("dp_pay"), priceFromCr: parseFloat(val("dp_price")) || 0, config: val("dp_config"), possession: val("dp_poss"), image: val("dp_img"), featured, featured2, description: val("dp_desc"), about: val("dp_desc") };
      rec.priceLabel = rec.priceFromCr ? crLabel(rec.priceFromCr) + " onwards" : "";
      if (!rec.id) rec.id = norm(name).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (!e.why) rec.why = ["Prime location with strong connectivity.", "Trusted BPTP build quality.", "Attractive entry with upside potential."];
      if (!e.usp) rec.usp = ["Premium specifications", "Well-planned amenities", "RERA-registered BPTP development"];
      if (!e.roi) rec.roi = { entryPriceCr: rec.priceFromCr || 3, apprRate: 12, rentalYield: 3, holdYears: 5 };
      await Store.saveProject(rec);
      if (featured) { for (const o of PROJECTS) { if (o.id !== rec.id && o.featured) await Store.saveProject({ id: o.id, featured: false }); } }
      if (featured2) { for (const o of PROJECTS) { if (o.id !== rec.id && o.featured2) await Store.saveProject({ id: o.id, featured2: false }); } }
      closeDrawer(); await refreshAll(); toast("Project saved.", "ok");
    });
  }

  function wireInventory() { document.getElementById("iAdd").addEventListener("click", () => editUnit(null)); document.getElementById("iImport").addEventListener("click", () => openImport("inventory")); document.getElementById("iSearch").addEventListener("input", renderInventory); document.getElementById("iProjectFilter").addEventListener("change", renderInventory); document.getElementById("iBulkDel").addEventListener("click", () => bulkDelete("iTable", id => Store.deleteUnit(id), "units")); document.getElementById("iExport").addEventListener("click", exportInventory); document.getElementById("iTemplate").addEventListener("click", () => downloadTemplate("inventory")); }
  function fillProjectFilter() { const sel = document.getElementById("iProjectFilter"), cur = sel.value; sel.innerHTML = `<option value="">All projects</option>` + PROJECTS.map(p => `<option>${esc(p.name)}</option>`).join(""); sel.value = cur; }
  function renderInventory() {
    const q = norm(document.getElementById("iSearch").value), pf = document.getElementById("iProjectFilter").value;
    const list = INVENTORY.filter(u => (!pf || u.project === pf) && (!q || norm(u.project + u.unitNo + u.desc).includes(q)));
    document.getElementById("iTable").innerHTML = list.length ? `<thead><tr>${chkTh}<th>Project</th><th>Unit No</th><th>Size</th><th>Description</th><th>Status</th><th>BSP</th><th>Costing</th><th></th></tr></thead><tbody>${list.map(u => `<tr>${chkTd(u.id)}<td>${esc(u.project)}</td><td><b>${esc(u.unitNo)}</b></td><td>${esc(u.size)}</td><td style="max-width:200px" class="muted">${esc(truncate(u.desc, 50))}</td><td><span class="tag ${esc(u.status)}">${esc(u.status)}</span></td><td>${u.bsp ? "₹" + Number(u.bsp).toLocaleString("en-IN") : "—"}</td><td>${crLabel(u.costingCr)}</td><td style="white-space:nowrap"><button class="mini" data-edit="${esc(u.id)}">Edit</button> <button class="mini del" data-del="${esc(u.id)}">Delete</button></td></tr>`).join("")}</tbody>` : `<tr><td class="empty">No units. Add one or import a sheet.</td></tr>`;
    wireSelectAll("iTable");
    bind("iTable", "[data-edit]", id => editUnit(INVENTORY.find(u => u.id === id)));
    bind("iTable", "[data-del]", async id => { if (confirm("Delete this unit?")) { await Store.deleteUnit(id); await refreshAll(); toast("Unit deleted.", "ok"); } });
  }
  function editUnit(u) {
    const e = u || {};
    openDrawer(u ? "Edit Unit" : "Add Unit", `${selProjects("Project Name", "du_proj", e.project)}${fld("Unit No", "du_unit", e.unitNo)}${fld("Size", "du_size", e.size)}${area("Unit Description", "du_desc", e.desc)}${sel("Status", "du_status", ["Available", "Hold", "Sold"], e.status)}${fld("BSP (₹ per sq.ft)", "du_bsp", e.bsp, "number")}${fld("Costing (₹ Cr)", "du_cost", e.costingCr, "number")}<button class="btn btn-gold btn-block" id="du_save">Save Unit</button>`);
    document.getElementById("du_save").addEventListener("click", async () => {
      const project = val("du_proj"), unitNo = val("du_unit"); if (!project || !unitNo) { toast("Project and Unit No are required.", "err"); return; }
      await Store.saveUnit({ id: e.id, project, unitNo, size: val("du_size"), desc: val("du_desc"), status: val("du_status"), bsp: parseFloat(val("du_bsp")) || 0, costingCr: parseFloat(val("du_cost")) || 0 });
      closeDrawer(); await refreshAll(); toast("Unit saved.", "ok");
    });
  }

  function wireEnquiries() { document.getElementById("eSearch").addEventListener("input", renderEnquiries); document.getElementById("eExport").addEventListener("click", exportEnquiries); document.getElementById("eBulkDel").addEventListener("click", () => bulkDelete("eTable", id => Store.deleteEnquiry(id), "enquiries")); }
  function renderEnquiries() {
    const q = norm(document.getElementById("eSearch").value);
    const list = ENQ.filter(e => !q || norm((e.code || "") + e.user + e.mobile + interestText(e)).includes(q));
    document.getElementById("eTable").innerHTML = list.length ? `<thead><tr>${chkTh}<th>Lead Code</th><th>Name</th><th>Mobile</th><th>Interested in (projects · units)</th><th>Last seen</th><th>Status</th><th></th></tr></thead><tbody>${list.map(e => `<tr>${chkTd(e.id)}<td><b>${esc(e.code || "—")}</b></td><td>${esc(e.user)}${e.agent && e.agent.isAgent ? `<div class="agent-line">🏢 ${esc(e.agent.firm || "Agent")}${e.agent.designation ? " · " + esc(e.agent.designation) : ""}</div>` : ""}</td><td>${esc(e.mobile)}</td><td style="max-width:300px">${interestSummary(e)}</td><td class="muted" style="white-space:nowrap">${fmtDT(e.ts)}</td><td><span class="tag ${esc(e.status)}">${esc(e.status)}</span>${e.agent && e.agent.isAgent ? ` <span class="tag agent-tag">Agent</span>` : ""}</td><td style="white-space:nowrap"><button class="mini" data-conv="${esc(e.id)}" style="border-color:var(--accent-2);color:var(--accent-2)">→ Customer</button> <button class="mini" data-toggle="${esc(e.id)}">${e.status === "Open" ? "Close" : "Reopen"}</button> <button class="mini del" data-del="${esc(e.id)}">Delete</button></td></tr>`).join("")}</tbody>` : `<tr><td class="empty">No enquiries yet. A record appears when a visitor unlocks live inventory.</td></tr>`;
    wireSelectAll("eTable");
    bind("eTable", "[data-conv]", async id => {
      const e = ENQ.find(x => x.id === id); if (!e) return;
      const proj = (leadInterests(e)[0] || {}).project || "";
      const isAgent = !!(e.agent && e.agent.isAgent);
      const agentNote = isAgent ? "Real-estate agent · " + (e.agent.firm || "") + (e.agent.designation ? " (" + e.agent.designation + ")" : "") : "";
      const existing = CUSTOMERS.find(c => mob10(c.mobile) && mob10(c.mobile) === mob10(e.mobile));
      if (existing) {
        const patch = { id: existing.id, lastTs: Date.now() };
        if (!existing.project && proj) patch.project = proj;
        if (isAgent) patch.source = "Channel Partner";
        await Store.saveCustomer(patch);
        await addActivity(existing.id, isAgent ? "Note" : "Web", (isAgent ? agentNote + " · " : "") + "Linked web enquiry " + (e.code || "") + (proj ? " · " + proj : ""));
        await Store.updateEnquiry(id, { status: "Closed" });
        await refreshAll(); toast("Linked to existing customer " + (existing.code || existing.name) + ".", "ok"); showView("customers"); openCustomer(existing.id); return;
      }
      await Store.saveCustomer({ name: e.user, mobile: e.mobile, source: isAgent ? "Channel Partner" : "Website", project: proj, stage: "New", owner: "Ashish", value: 0, notes: (isAgent ? agentNote + "\n" : "") + "Converted from web enquiry " + (e.code || ""), createdTs: Date.now(), lastTs: Date.now() });
      await Store.updateEnquiry(id, { status: "Closed" });
      await refreshAll(); toast(isAgent ? "Added as Channel Partner lead. 🏢" : "Added to Customers. ☕", "ok"); showView("customers");
      const nc = CUSTOMERS.find(c => mob10(c.mobile) === mob10(e.mobile)); if (nc) openCustomer(nc.id);
    });
    bind("eTable", "[data-toggle]", async id => { const e = ENQ.find(x => x.id === id); await Store.updateEnquiry(id, { status: e.status === "Open" ? "Closed" : "Open" }); await refreshAll(); });
    bind("eTable", "[data-del]", async id => { if (confirm("Delete this enquiry?")) { await Store.deleteEnquiry(id); await refreshAll(); } });
  }
  function exportEnquiries() {
    const flat = e => leadInterests(e).map(it => it.project + (it.units && it.units.length ? " (" + it.units.join("; ") + ")" : " (viewed)")).join(" | ");
    const rows = [["Lead Code", "Name", "Mobile", "Agent?", "Firm", "Designation", "Interested In (projects · units)", "First Seen", "Last Seen", "Status"]]
      .concat(ENQ.map(e => [e.code || "", e.user, e.mobile, e.agent && e.agent.isAgent ? "Yes" : "No", (e.agent && e.agent.firm) || "", (e.agent && e.agent.designation) || "", flat(e), e.createdTs ? new Date(e.createdTs).toLocaleString() : "", new Date(e.ts || Date.now()).toLocaleString(), e.status]));
    dl(rows.map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n"), "coffeeanddeals-leads.csv", "text/csv"); toast("Leads exported.", "ok");
  }
  function toCSV(headers, rows) { return [headers].concat(rows).map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n"); }
  function exportProjects() { dl(toCSV(["Project Name","Location","Category","Payment Plan","Starting Price (Cr)","Configuration","Possession","Image","Description"], PROJECTS.map(p => [p.name,p.location,p.category,p.paymentPlan,p.priceFromCr,p.config,p.possession,p.image,p.description||p.about])), "coffeeanddeals-projects.csv", "text/csv"); toast("Projects exported.", "ok"); }
  function exportInventory() { dl(toCSV(["Project Name","Unit No","Size","Unit description","Status","BSP","Costing"], INVENTORY.map(u => [u.project,u.unitNo,u.size,u.desc,u.status,u.bsp||"",u.costingCr])), "coffeeanddeals-inventory.csv", "text/csv"); toast("Inventory exported.", "ok"); }
  function exportPartners() { dl(toCSV(["Name","Mobile","Company Name","City","Team Size","Status"], PARTNERS.map(p => [p.name,p.mobile,p.company,p.city,p.teamSize,p.status])), "coffeeanddeals-partners.csv", "text/csv"); toast("Partners exported.", "ok"); }
  function exportTestimonials() { dl(toCSV(["Name","Role","Rating","Review","Published"], TESTI.map(t => [t.name,t.role,t.rating,t.text,t.approved?"Yes":"No"])), "coffeeanddeals-testimonials.csv", "text/csv"); toast("Testimonials exported.", "ok"); }

  function wirePartners() { document.getElementById("cAdd").addEventListener("click", () => editPartner(null)); document.getElementById("cImport").addEventListener("click", () => openImport("partners")); document.getElementById("cSearch").addEventListener("input", renderPartners); document.getElementById("cBulkDel").addEventListener("click", () => bulkDelete("cTable", id => Store.deletePartner(id), "partners")); document.getElementById("cExport").addEventListener("click", exportPartners); }
  function renderPartners() {
    const q = norm(document.getElementById("cSearch").value);
    const list = PARTNERS.filter(p => !q || norm(p.name + p.company + p.city + p.mobile).includes(q));
    document.getElementById("cTable").innerHTML = list.length ? `<thead><tr>${chkTh}<th>Name</th><th>Mobile</th><th>Company</th><th>City</th><th>Team Size</th><th>Status</th><th></th></tr></thead><tbody>${list.map(p => `<tr>${chkTd(p.id)}<td><b>${esc(p.name)}</b></td><td>${esc(p.mobile)}</td><td>${esc(p.company)}</td><td>${esc(p.city)}</td><td>${esc(p.teamSize)}</td><td><span class="tag ${esc(p.status)}">${esc(p.status)}</span></td><td style="white-space:nowrap"><button class="mini" data-edit="${esc(p.id)}">Edit</button> <button class="mini del" data-del="${esc(p.id)}">Delete</button></td></tr>`).join("")}</tbody>` : `<tr><td class="empty">No channel partners yet.</td></tr>`;
    wireSelectAll("cTable");
    bind("cTable", "[data-edit]", id => editPartner(PARTNERS.find(p => p.id === id)));
    bind("cTable", "[data-del]", async id => { if (confirm("Delete this partner?")) { await Store.deletePartner(id); await refreshAll(); } });
  }
  function editPartner(p) {
    const e = p || {};
    openDrawer(p ? "Edit Partner" : "Add Partner", `${fld("Name", "dc_name", e.name)}${fld("Mobile", "dc_mob", e.mobile)}${fld("Company Name", "dc_comp", e.company)}${fld("City", "dc_city", e.city)}${fld("Team Size", "dc_team", e.teamSize, "number")}${sel("Status", "dc_status", ["Active", "Inactive"], e.status)}<button class="btn btn-gold btn-block" id="dc_save">Save Partner</button>`);
    document.getElementById("dc_save").addEventListener("click", async () => { const name = val("dc_name"); if (!name) { toast("Name is required.", "err"); return; } await Store.savePartner({ id: e.id, name, mobile: val("dc_mob"), company: val("dc_comp"), city: val("dc_city"), teamSize: parseInt(val("dc_team")) || 0, status: val("dc_status") }); closeDrawer(); await refreshAll(); toast("Partner saved.", "ok"); });
  }

  function wireTestimonials() { document.getElementById("tBulkDel").addEventListener("click", () => bulkDelete("tTable", id => Store.deleteTestimonial(id), "testimonials")); document.getElementById("tExport").addEventListener("click", exportTestimonials); }
  function renderTestimonials() {
    const list = TESTI.slice().sort((a, b) => (a.approved === b.approved) ? 0 : a.approved ? 1 : -1);
    document.getElementById("tTable").innerHTML = list.length ? `<thead><tr>${chkTh}<th>Name</th><th>Role</th><th>Rating</th><th>Review</th><th>Status</th><th></th></tr></thead><tbody>${list.map(t => `<tr>${chkTd(t.id)}<td><b>${esc(t.name)}</b></td><td>${esc(t.role || "")}</td><td style="color:var(--accent-2)">${"★".repeat(t.rating || 5)}</td><td style="max-width:280px" class="muted">${esc(truncate(t.text, 90))}</td><td><span class="tag ${t.approved ? "Active" : "Hold"}">${t.approved ? "Published" : "Pending"}</span></td><td style="white-space:nowrap"><button class="mini" data-approve="${esc(t.id)}">${t.approved ? "Unpublish" : "Approve"}</button> <button class="mini del" data-del="${esc(t.id)}">Delete</button></td></tr>`).join("")}</tbody>` : `<tr><td class="empty">No testimonials yet.</td></tr>`;
    wireSelectAll("tTable");
    bind("tTable", "[data-approve]", async id => { const t = TESTI.find(x => x.id === id); await Store.setTestimonialApproved(id, !t.approved); await refreshAll(); toast(t.approved ? "Unpublished." : "Published to site.", "ok"); });
    bind("tTable", "[data-del]", async id => { if (confirm("Delete this testimonial?")) { await Store.deleteTestimonial(id); await refreshAll(); toast("Deleted.", "ok"); } });
  }

  /* ===================== CUSTOMER MANAGEMENT ===================== */
  function wireCustomers() {
    document.getElementById("custAdd").addEventListener("click", () => editCustomer(null));
    document.getElementById("custSearch").addEventListener("input", renderCustomers);
    document.getElementById("custStageFilter").addEventListener("change", renderCustomers);
    document.getElementById("custExport").addEventListener("click", exportCustomers);
    document.getElementById("custBulkDel").addEventListener("click", () => bulkDelete("custTable", id => Store.deleteCustomer(id), "customers"));
    document.getElementById("custViewToggle").addEventListener("click", () => { boardMode = !boardMode; document.getElementById("custViewToggle").textContent = boardMode ? "▤ Table view" : "▦ Board view"; renderCustomers(); });
    document.getElementById("custAssign").addEventListener("click", autoAssign);
    const sf = document.getElementById("custStageFilter"); if (sf.options.length <= 1) STAGES.forEach(s => sf.add(new Option(s, s)));
  }
  async function autoAssign() {
    const open = CUSTOMERS.filter(c => c.stage !== "Booked" && c.stage !== "Lost");
    const unassigned = open.filter(c => !c.owner || !OWNERS.includes(c.owner));
    if (!unassigned.length) { toast("All open leads already have an owner.", "ok"); return; }
    if (!confirm("Auto-assign " + unassigned.length + " unassigned lead(s) across the team (" + OWNERS.join(", ") + ") — highest-scoring leads first, balanced round-robin?")) return;
    // sort hottest first so top talent-neutral round-robin still spreads strong leads evenly
    unassigned.sort((a, b) => scoreLead(b).score - scoreLead(a).score);
    // seed rotation from current workload so it stays balanced
    const load = {}; OWNERS.forEach(o => load[o] = open.filter(c => c.owner === o).length);
    for (const c of unassigned) {
      const owner = OWNERS.slice().sort((x, y) => load[x] - load[y])[0];
      load[owner]++;
      await Store.saveCustomer({ id: c.id, owner, lastTs: Date.now() });
      await addActivity(c.id, "Note", "Auto-assigned to " + owner);
    }
    await refreshAll(); toast("Assigned " + unassigned.length + " lead(s) across the team.", "ok");
  }
  function renderCustomers() {
    const q = norm(document.getElementById("custSearch").value), sf = document.getElementById("custStageFilter").value;
    const list = CUSTOMERS.filter(c => (!sf || c.stage === sf) && (!q || norm((c.code || "") + c.name + c.mobile + (c.project || "") + (c.source || "")).includes(q))).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
    const open = CUSTOMERS.filter(c => c.stage !== "Booked" && c.stage !== "Lost");
    const pipeVal = open.reduce((s, c) => s + (+c.value || 0), 0), booked = CUSTOMERS.filter(c => c.stage === "Booked").reduce((s, c) => s + (+c.value || 0), 0);
    document.getElementById("custKpis").innerHTML = `${card("Total Customers", CUSTOMERS.length, "")}${card("Open Leads", open.length, "in pipeline")}${card("Pipeline Value", crLabel(pipeVal), "")}${card("Booked Value", crLabel(booked), "won")}`;
    const tableWrap = document.getElementById("custTableWrap"), board = document.getElementById("custBoard");
    if (boardMode) { tableWrap.style.display = "none"; board.style.display = "block"; renderBoard(list); return; }
    tableWrap.style.display = "block"; board.style.display = "none";
    document.getElementById("custTable").innerHTML = list.length ? `<thead><tr>${chkTh}<th>Score</th><th>Code</th><th>Name</th><th>Mobile</th><th>Source</th><th>Owner</th><th>Interested Project</th><th>Value</th><th>Stage</th><th>Next Follow-up</th><th></th></tr></thead><tbody>${list.map(c => `<tr class="cust-row" data-open-row="${esc(c.id)}">${chkTd(c.id)}<td>${scoreBadge(c)}</td><td><b>${esc(c.code || "—")}</b></td><td><a href="#" class="cust-link" data-open="${esc(c.id)}">${esc(c.name)}</a></td><td>${esc(c.mobile)}</td><td>${esc(c.source || "")}</td><td>${esc(c.owner || "—")}</td><td>${esc(c.project || "")}</td><td>${c.value ? crLabel(c.value) : "—"}</td><td><select class="stageSel" data-id="${esc(c.id)}">${STAGES.map(s => `<option ${s === c.stage ? "selected" : ""}>${s}</option>`).join("")}</select></td><td class="muted" style="white-space:nowrap">${c.nextFollowUp ? fmtDT(c.nextFollowUp) : "—"}</td><td style="white-space:nowrap"><button class="mini" data-open="${esc(c.id)}">Open</button> <button class="mini" data-edit="${esc(c.id)}">Edit</button> <button class="mini del" data-del="${esc(c.id)}">Delete</button></td></tr>`).join("")}</tbody>` : `<tr><td class="empty">No customers yet. Add one, or convert a web enquiry into a customer.</td></tr>`;
    wireSelectAll("custTable");
    document.getElementById("custTable").querySelectorAll(".stageSel").forEach(s => s.addEventListener("change", async () => { await Store.saveCustomer({ id: s.dataset.id, stage: s.value, lastTs: Date.now() }); await addActivity(s.dataset.id, "Stage", "Stage moved to " + s.value); await refreshAll(); toast("Stage updated.", "ok"); }));
    document.getElementById("custTable").querySelectorAll("tr.cust-row").forEach(tr => tr.addEventListener("click", e => { if (e.target.closest("input,select,button,a,label")) return; openCustomer(tr.dataset.openRow); }));
    bind("custTable", "[data-open]", id => openCustomer(id));
    bind("custTable", "[data-edit]", id => editCustomer(CUSTOMERS.find(c => c.id === id)));
    bind("custTable", "[data-del]", async id => { if (confirm("Delete this customer?")) { await Store.deleteCustomer(id); await refreshAll(); toast("Customer deleted.", "ok"); } });
  }
  function renderBoard(list) {
    const cols = STAGES.map(st => {
      const items = list.filter(c => c.stage === st);
      const val = items.reduce((s, c) => s + (+c.value || 0), 0);
      return `<div class="kb-col"><div class="kb-head kb-${st.replace(/\s/g, "")}"><span class="kb-title">${st}</span><span class="kb-count">${items.length}</span></div><div class="kb-val">${crLabel(val)}</div><div class="kb-list" data-stage="${esc(st)}">${items.map(c => `<div class="kb-card" draggable="true" data-id="${esc(c.id)}"><div class="kb-cardtop"><div class="kb-name">${esc(c.name)}</div>${scoreBadge(c)}</div><div class="kb-proj">${esc(c.project || "—")}</div><div class="kb-foot"><span class="kb-value">${c.value ? crLabel(c.value) : "—"}</span>${c.nextFollowUp ? `<span class="kb-follow">⏰ ${fmtDate(c.nextFollowUp)}</span>` : ""}</div></div>`).join("") || `<div class="kb-empty">No leads</div>`}</div></div>`;
    }).join("");
    document.getElementById("custBoard").innerHTML = `<div class="kb-board">${cols}</div>`;
    const wrap = document.getElementById("custBoard");
    wrap.querySelectorAll(".kb-card").forEach(card => {
      card.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", card.dataset.id); card.classList.add("dragging"); });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("click", () => openCustomer(card.dataset.id));
    });
    wrap.querySelectorAll(".kb-list").forEach(col => {
      col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("kb-over"); });
      col.addEventListener("dragleave", () => col.classList.remove("kb-over"));
      col.addEventListener("drop", async e => {
        e.preventDefault(); col.classList.remove("kb-over");
        const id = e.dataTransfer.getData("text/plain"), stage = col.dataset.stage;
        const c = CUSTOMERS.find(x => x.id === id); if (!c || c.stage === stage) return;
        await Store.saveCustomer({ id, stage, lastTs: Date.now() });
        await addActivity(id, "Stage", "Stage moved to " + stage);
        await refreshAll(); toast("Moved to " + stage + ".", "ok");
      });
    });
  }
  function editCustomer(c) {
    const e = c || {}, projOpts = ["", ...PROJECTS.map(p => p.name)];
    openDrawer(c ? "Edit Customer" : "Add Customer", `${fld("Name", "dcu_name", e.name)}${fld("Mobile", "dcu_mob", e.mobile)}${fld("Email (optional)", "dcu_email", e.email)}${sel("Source", "dcu_src", SOURCES, e.source)}${sel("Interested Project", "dcu_proj", projOpts, e.project)}${fld("Budget (₹ Cr)", "dcu_budget", e.budget, "number")}${fld("Deal Value (₹ Cr)", "dcu_value", e.value, "number")}${sel("Stage", "dcu_stage", STAGES, e.stage || "New")}${fld("Owner", "dcu_owner", e.owner || "Ashish")}${fld("Next Follow-up (date)", "dcu_follow", e.nextFollowUp ? new Date(e.nextFollowUp).toISOString().slice(0, 10) : "", "date")}${area("Notes", "dcu_notes", e.notes)}<button class="btn btn-gold btn-block" id="dcu_save">Save Customer</button>`);
    document.getElementById("dcu_save").addEventListener("click", async () => {
      const name = val("dcu_name"); if (!name) { toast("Name is required.", "err"); return; }
      const follow = val("dcu_follow") ? new Date(val("dcu_follow")).getTime() : null;
      await Store.saveCustomer({ id: e.id, name, mobile: val("dcu_mob"), email: val("dcu_email"), source: val("dcu_src"), project: val("dcu_proj"), budget: parseFloat(val("dcu_budget")) || 0, value: parseFloat(val("dcu_value")) || 0, stage: val("dcu_stage"), owner: val("dcu_owner"), nextFollowUp: follow, notes: val("dcu_notes"), lastTs: Date.now() });
      closeDrawer(); await refreshAll(); toast("Customer saved.", "ok");
    });
  }
  function exportCustomers() { dl(toCSV(["Code", "Name", "Mobile", "Email", "Source", "Project", "Budget(Cr)", "Value(Cr)", "Stage", "Owner", "Next Follow-up", "Notes"], CUSTOMERS.map(c => [c.code, c.name, c.mobile, c.email, c.source, c.project, c.budget, c.value, c.stage, c.owner, c.nextFollowUp ? new Date(c.nextFollowUp).toLocaleDateString() : "", c.notes])), "coffeeanddeals-customers.csv", "text/csv"); toast("Customers exported.", "ok"); }

  /* ===================== PIPELINE ANALYTICS ===================== */
  function renderAnalytics() {
    const kpi = document.getElementById("anKpis"); if (!kpi) return;
    const total = CUSTOMERS.length;
    const booked = CUSTOMERS.filter(c => c.stage === "Booked"), lost = CUSTOMERS.filter(c => c.stage === "Lost");
    const open = CUSTOMERS.filter(c => c.stage !== "Booked" && c.stage !== "Lost");
    const winRate = (booked.length + lost.length) ? Math.round(booked.length / (booked.length + lost.length) * 100) : 0;
    const pipeVal = open.reduce((s, c) => s + (+c.value || 0), 0), wonVal = booked.reduce((s, c) => s + (+c.value || 0), 0);
    const avgScore = open.length ? Math.round(open.reduce((s, c) => s + scoreLead(c).score, 0) / open.length) : 0;
    kpi.innerHTML = `${card("Win Rate", winRate + "%", booked.length + " won / " + lost.length + " lost")}${card("Open Pipeline", crLabel(pipeVal), open.length + " leads")}${card("Won Value", crLabel(wonVal), "closed")}${card("Avg Lead Score", avgScore, "open leads")}`;
    // lead sources
    const bySrc = {};
    CUSTOMERS.forEach(c => { const s = c.source || "Other"; (bySrc[s] = bySrc[s] || { n: 0, val: 0 }); bySrc[s].n++; bySrc[s].val += (+c.value || 0); });
    const srcMax = Math.max(1, ...Object.values(bySrc).map(v => v.n));
    document.getElementById("anSource").innerHTML = Object.keys(bySrc).sort((a, b) => bySrc[b].n - bySrc[a].n).map(s => `<div class="fn-row"><div class="fn-label">${esc(s)}</div><div class="fn-bar-wrap"><div class="fn-bar" style="width:${Math.round(bySrc[s].n / srcMax * 100)}%">${bySrc[s].n}</div></div><div class="fn-val">${crLabel(bySrc[s].val)}</div></div>`).join("") || `<p class="empty">No leads yet.</p>`;
    // stage share
    const sc = STAGES.map(st => ({ st, n: CUSTOMERS.filter(c => c.stage === st).length }));
    const stMax = Math.max(1, ...sc.map(x => x.n));
    document.getElementById("anConv").innerHTML = sc.map(x => `<div class="fn-row"><div class="fn-label">${x.st}</div><div class="fn-bar-wrap"><div class="fn-bar" style="width:${Math.round(x.n / stMax * 100)}%">${x.n}</div></div><div class="fn-val">${total ? Math.round(x.n / total * 100) : 0}%</div></div>`).join("");
    // team performance
    const owners = [...new Set(CUSTOMERS.map(c => c.owner).filter(Boolean))];
    document.getElementById("anOwner").innerHTML = owners.length ? `<thead><tr><th>Owner</th><th>Open</th><th>Pipeline</th><th>Booked</th><th>Won Value</th><th>Win rate</th></tr></thead><tbody>${owners.map(o => {
      const mine = CUSTOMERS.filter(c => c.owner === o), op = mine.filter(c => c.stage !== "Booked" && c.stage !== "Lost"), bk = mine.filter(c => c.stage === "Booked"), ls = mine.filter(c => c.stage === "Lost");
      const wr = (bk.length + ls.length) ? Math.round(bk.length / (bk.length + ls.length) * 100) : 0;
      return `<tr><td><b>${esc(o)}</b></td><td>${op.length}</td><td>${crLabel(op.reduce((s, c) => s + (+c.value || 0), 0))}</td><td>${bk.length}</td><td>${crLabel(bk.reduce((s, c) => s + (+c.value || 0), 0))}</td><td>${wr}%</td></tr>`;
    }).join("")}</tbody>` : `<tr><td class="empty">No owners assigned yet. Use ⚡ Auto-assign.</td></tr>`;
    // aging leads
    const now = Date.now();
    const aging = open.filter(c => (now - (c.lastTs || c.createdTs || now)) > 14 * 86400000 || (c.nextFollowUp && c.nextFollowUp < now)).sort((a, b) => (a.lastTs || 0) - (b.lastTs || 0));
    document.getElementById("anAging").innerHTML = aging.length ? aging.map(c => {
      const days = Math.floor((now - (c.lastTs || c.createdTs || now)) / 86400000), overdue = c.nextFollowUp && c.nextFollowUp < now;
      return `<div class="an-age" data-open="${esc(c.id)}"><div><b>${esc(c.name)}</b> <span class="tag Hold">${esc(c.stage)}</span></div><div class="an-age-r">${overdue ? `<span class="an-overdue">follow-up overdue</span>` : `<span class="muted">idle ${days}d</span>`} ${scoreBadge(c)}</div></div>`;
    }).join("") : `<p class="empty">No stale leads — pipeline is fresh. ☕</p>`;
    document.getElementById("anAging").querySelectorAll(".an-age").forEach(el => el.addEventListener("click", () => openCustomer(el.dataset.open)));
  }

  /* ===================== CUSTOMER 360° PROFILE ===================== */
  const TL_CLS = { Call: "tl-call", Note: "tl-note", Stage: "tl-stage", Web: "tl-web", Created: "tl-created", "Task": "tl-task", "Task ✓": "tl-done" };
  function openCustomer(id) {
   try {
    const c = CUSTOMERS.find(x => x.id === id); if (!c) { toast("Customer not found.", "err"); return; }
    const sc = scoreLead(c);
    const enq = ENQ.find(e => mob10(e.mobile) && mob10(e.mobile) === mob10(c.mobile));
    const custTasks = TASKS.filter(t => norm(t.customer) === norm(c.name)).sort((a, b) => (a.due || 0) - (b.due || 0));
    const openTasks = custTasks.filter(t => !t.done);
    const prob = Math.round((STAGE_PROB[c.stage] || 0) * 100);
    // build merged timeline
    const tl = [];
    (c.activities || []).forEach(a => tl.push({ ts: a.ts, type: a.type, text: a.text }));
    custTasks.forEach(t => tl.push({ ts: t.due || t.ts || Date.now(), type: t.done ? "Task ✓" : "Task", text: t.title + (t.type ? " · " + t.type : "") }));
    if (c.createdTs) tl.push({ ts: c.createdTs, type: "Created", text: "Lead created" + (c.source ? " · " + c.source : "") });
    if (enq) leadInterests(enq).forEach(it => tl.push({ ts: enq.ts || enq.createdTs || Date.now(), type: "Web", text: "Viewed " + it.project + (it.units && it.units.length ? " · " + it.units.join(", ") : "") }));
    tl.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const tlHtml = tl.length ? tl.map(x => `<div class="cd-tl"><span class="cd-dot ${TL_CLS[x.type] || ""}"></span><div class="cd-tl-b"><div class="cd-tl-top"><b>${esc(x.type)}</b><span>${x.ts ? fmtDT(x.ts) : ""}</span></div><p>${esc(x.text || "")}</p></div></div>`).join("") : `<p class="cd-muted">No activity logged yet. Use the quick actions above to log a call, note or task.</p>`;
    const enqHtml = enq ? `<div class="cd-linked"><div class="cd-linked-h">🔗 Linked web enquiry · <b>${esc(enq.code || "—")}</b> <span class="tag ${esc(enq.status)}">${esc(enq.status)}</span></div><div class="cd-interest">${interestSummary(enq)}</div></div>` : `<p class="cd-muted">No matching website enquiry found for this mobile.</p>`;
    const tasksHtml = custTasks.length ? custTasks.map(t => `<div class="cd-task ${t.done ? "done" : ""}"><span>${t.done ? "✓" : "○"}</span><b>${esc(t.title)}</b><small>${t.due ? fmtDate(t.due) : "no date"}${t.type ? " · " + esc(t.type) : ""}</small></div>`).join("") : `<p class="cd-muted">No tasks linked. Add a follow-up below.</p>`;
    const wrap = document.createElement("div");
    wrap.className = "cd-wrap";
    wrap.innerHTML = `<div class="cd-ov"></div><aside class="cd-panel">
      <div class="cd-top">
        <div><div class="cd-code">${esc(c.code || "LEAD")}</div><h2 class="cd-name">${esc(c.name)}</h2><div class="cd-sub">${esc(c.mobile || "")}${c.email ? " · " + esc(c.email) : ""}</div></div>
        <button class="cd-x" id="cdClose">✕</button>
      </div>
      <div class="cd-snap">
        <div class="cd-chip cd-stagechip"><label>Stage</label><select id="cdStage" class="stageSel">${STAGES.map(s => `<option ${s === c.stage ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="cd-chip"><label>Lead score</label><b><span class="score-badge sc-${sc.tier}">${sc.score}<i>${sc.tier}</i></span></b></div>
        <div class="cd-chip"><label>Win prob.</label><b>${prob}%</b></div>
        <div class="cd-chip"><label>Deal value</label><b>${c.value ? crLabel(c.value) : "—"}</b></div>
        <div class="cd-chip"><label>Source</label><b>${esc(c.source || "—")}</b></div>
        <div class="cd-chip"><label>Owner</label><b>${esc(c.owner || "—")}</b></div>
        <div class="cd-chip"><label>Next follow-up</label><b>${c.nextFollowUp ? fmtDate(c.nextFollowUp) : "—"}</b></div>
      </div>
      <div class="cd-actions">
        <button class="cd-act" id="cdCall">📞 Log Call</button>
        <button class="cd-act" id="cdNote">📝 Add Note</button>
        <button class="cd-act" id="cdTask">➕ Add Task</button>
        <button class="cd-act" id="cdEdit">✎ Edit</button>
      </div>
      <div class="cd-body">
        <div class="cd-sec"><h4>Interested project</h4><p class="cd-proj">${esc(c.project || "Not specified")}</p>${enqHtml}</div>
        <div class="cd-sec"><h4>Open tasks <span class="cd-badge">${openTasks.length}</span></h4>${tasksHtml}</div>
        <div class="cd-sec"><h4>Activity timeline</h4><div class="cd-tl-wrap">${tlHtml}</div></div>
        ${c.notes ? `<div class="cd-sec"><h4>Notes</h4><p class="cd-notes">${esc(c.notes)}</p></div>` : ""}
      </div>
    </aside>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("open"));
    const close = () => { wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 300); };
    const rerender = async () => { await refreshAll(); wrap.remove(); openCustomer(id); };
    wrap.querySelector(".cd-ov").addEventListener("click", close);
    wrap.querySelector("#cdClose").addEventListener("click", close);
    wrap.querySelector("#cdStage").addEventListener("change", async e => { await Store.saveCustomer({ id, stage: e.target.value, lastTs: Date.now() }); await addActivity(id, "Stage", "Stage moved to " + e.target.value); await rerender(); toast("Stage updated.", "ok"); });
    wrap.querySelector("#cdCall").addEventListener("click", async () => { const t = prompt("Call summary / outcome:"); if (t == null) return; await addActivity(id, "Call", t || "Call logged"); await rerender(); toast("Call logged.", "ok"); });
    wrap.querySelector("#cdNote").addEventListener("click", async () => { const t = prompt("Note:"); if (t == null || !t.trim()) return; await addActivity(id, "Note", t.trim()); await rerender(); toast("Note added.", "ok"); });
    wrap.querySelector("#cdTask").addEventListener("click", () => { close(); editTask({ customer: c.name }); });
    wrap.querySelector("#cdEdit").addEventListener("click", () => { close(); editCustomer(c); });
   } catch (e) { console.error(e); toast("Could not open profile: " + e.message, "err"); }
  }

  /* ===================== WORK PLAN ===================== */
  function wireWorkplan() { document.getElementById("taskAdd").addEventListener("click", () => editTask(null)); }
  function taskRow(t) {
    const pr = t.priority === "High" ? "Inactive" : t.priority === "Low" ? "Active" : "Hold";
    return `<div class="wp-task ${t.done ? "done" : ""}"><input type="checkbox" class="taskChk" data-id="${esc(t.id)}" ${t.done ? "checked" : ""}><div class="wp-main"><b>${esc(t.title)}</b><span>${esc(t.type || "")}${t.customer ? " · " + esc(t.customer) : ""}${t.due ? " · due " + fmtDT(t.due) : ""}</span></div><span class="tag ${pr}">${esc(t.priority || "Medium")}</span><button class="mini" data-tedit="${esc(t.id)}">Edit</button> <button class="mini del" data-tdel="${esc(t.id)}">✕</button></div>`;
  }
  function renderWorkplan() {
    const st = new Date(); st.setHours(0, 0, 0, 0); const s0 = st.getTime(), e0 = s0 + 86400000;
    const openT = TASKS.filter(t => !t.done);
    const overdue = openT.filter(t => t.due && t.due < s0).sort((a, b) => a.due - b.due);
    const today = openT.filter(t => t.due && t.due >= s0 && t.due < e0).sort((a, b) => a.due - b.due);
    const upcoming = openT.filter(t => !t.due || t.due >= e0).sort((a, b) => (a.due || 0) - (b.due || 0));
    const done = TASKS.filter(t => t.done).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 10);
    document.getElementById("taskKpis").innerHTML = `${card("Open Tasks", openT.length, "")}${card("Overdue", overdue.length, "need action")}${card("Due Today", today.length, "")}${card("Completed", TASKS.filter(t => t.done).length, "")}`;
    const grp = (title, arr, cls) => arr.length ? `<div class="wp-group"><h4 class="wp-h ${cls || ""}">${title} <span>${arr.length}</span></h4>${arr.map(taskRow).join("")}</div>` : "";
    const body = document.getElementById("workplanBody");
    body.innerHTML = (overdue.length || today.length || upcoming.length || done.length) ? grp("⚠ Overdue", overdue, "od") + grp("● Today", today, "td") + grp("Upcoming", upcoming, "") + grp("Completed", done, "dn") : `<p class="empty">No tasks yet. Add your first follow-up.</p>`;
    body.querySelectorAll(".taskChk").forEach(c => c.addEventListener("change", async () => { await Store.saveTask({ id: c.dataset.id, done: c.checked }); await refreshAll(); }));
    body.querySelectorAll("[data-tedit]").forEach(b => b.addEventListener("click", () => editTask(TASKS.find(t => t.id === b.dataset.tedit))));
    body.querySelectorAll("[data-tdel]").forEach(b => b.addEventListener("click", async () => { if (confirm("Delete this task?")) { await Store.deleteTask(b.dataset.tdel); await refreshAll(); } }));
  }
  function editTask(t) {
    const e = t || {}, custOpts = ["", ...CUSTOMERS.map(c => c.name)];
    openDrawer(t ? "Edit Task" : "Add Task", `${fld("Task", "dtk_title", e.title)}${sel("Type", "dtk_type", ["Call", "Site Visit", "Follow-up", "Meeting", "Payment", "Other"], e.type || "Call")}${sel("Customer (optional)", "dtk_cust", custOpts, e.customer)}${fld("Due date", "dtk_due", e.due ? new Date(e.due).toISOString().slice(0, 10) : "", "date")}${sel("Priority", "dtk_pri", ["High", "Medium", "Low"], e.priority || "Medium")}<button class="btn btn-gold btn-block" id="dtk_save">Save Task</button>`);
    document.getElementById("dtk_save").addEventListener("click", async () => {
      const title = val("dtk_title"); if (!title) { toast("Task title is required.", "err"); return; }
      const due = val("dtk_due") ? new Date(val("dtk_due")).getTime() : null;
      await Store.saveTask({ id: e.id, title, type: val("dtk_type"), customer: val("dtk_cust"), due, priority: val("dtk_pri"), done: e.done || false });
      closeDrawer(); await refreshAll(); toast("Task saved.", "ok");
    });
  }

  /* ===================== SALES FUNNEL & FORECAST ===================== */
  function wireFunnel() { document.getElementById("targetSave").addEventListener("click", async () => { const t = parseFloat(document.getElementById("targetInput").value) || 0; await Store.saveTargets({ month: new Date().toISOString().slice(0, 7), target: t }); await refreshAll(); toast("Monthly target saved.", "ok"); }); }
  function renderFunnel() {
    const openStages = STAGES.filter(s => s !== "Lost");
    const byStage = {}; STAGES.forEach(s => byStage[s] = { count: 0, value: 0 });
    CUSTOMERS.forEach(c => { const s = byStage[c.stage] || byStage["New"]; s.count++; s.value += (+c.value || 0); });
    const open = CUSTOMERS.filter(c => c.stage !== "Booked" && c.stage !== "Lost");
    const pipeVal = open.reduce((s, c) => s + (+c.value || 0), 0);
    const forecast = open.reduce((s, c) => s + (+c.value || 0) * (STAGE_PROB[c.stage] || 0), 0);
    const monthKey = new Date().toISOString().slice(0, 7);
    const bookedThisMonth = CUSTOMERS.filter(c => c.stage === "Booked" && new Date(c.lastTs || 0).toISOString().slice(0, 7) === monthKey).reduce((s, c) => s + (+c.value || 0), 0);
    const target = +(TARGETS && TARGETS.target) || 0, ach = target ? Math.round(bookedThisMonth / target * 100) : 0;
    document.getElementById("funnelKpis").innerHTML = `${card("Open Leads", open.length, "")}${card("Pipeline Value", crLabel(pipeVal), "")}${card("Weighted Forecast", crLabel(forecast), "probability-adj.")}${card("Booked (This Month)", crLabel(bookedThisMonth), "of " + crLabel(target))}`;
    document.getElementById("targetInput").value = target || "";
    document.getElementById("targetProgress").innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:.9rem"><span class="muted">Booked ${crLabel(bookedThisMonth)} of ${crLabel(target)} target (${monthKey})</span><b>${ach}%</b></div><div style="height:14px;background:var(--line);border-radius:999px;overflow:hidden"><div style="height:100%;width:${Math.min(ach, 100)}%;background:${ach >= 100 ? "var(--ok)" : "var(--accent-2)"};transition:width .6s"></div></div>`;
    const maxCount = Math.max(1, ...openStages.map(s => byStage[s].count));
    document.getElementById("funnelViz").innerHTML = openStages.map(s => { const b = byStage[s], w = 22 + Math.round(b.count / maxCount * 78); return `<div class="fn-row"><div class="fn-label">${esc(s)}</div><div class="fn-bar-wrap"><div class="fn-bar" style="width:${w}%">${b.count}</div></div><div class="fn-val">${b.value ? crLabel(b.value) : "—"}</div></div>`; }).join("");
    document.getElementById("forecastTable").innerHTML = `<thead><tr><th>Stage</th><th>Leads</th><th>Value</th><th>Probability</th><th>Weighted</th></tr></thead><tbody>${openStages.filter(s => s !== "Booked").map(s => { const b = byStage[s]; return `<tr><td>${esc(s)}</td><td>${b.count}</td><td>${crLabel(b.value)}</td><td>${Math.round((STAGE_PROB[s] || 0) * 100)}%</td><td><b>${crLabel(b.value * (STAGE_PROB[s] || 0))}</b></td></tr>`; }).join("")}<tr style="background:var(--foam)"><td><b>Weighted Forecast</b></td><td></td><td></td><td></td><td><b>${crLabel(forecast)}</b></td></tr></tbody>`;
  }

  function wireImport() {
    const dz = document.getElementById("dropzone"), fi = document.getElementById("fileInput");
    document.getElementById("importClose").addEventListener("click", closeImport);
    dz.addEventListener("click", () => fi.click());
    dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
    dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("drag"); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    fi.addEventListener("change", () => { if (fi.files[0]) handleFile(fi.files[0]); });
    document.getElementById("downloadTemplate").addEventListener("click", downloadTemplate);
  }
  function openImport(target) {
    importTarget = target;
    document.getElementById("importTitle").textContent = "Import " + (target === "inventory" ? "Inventory" : target === "partners" ? "Channel Partners" : "Projects");
    document.getElementById("importHelp").textContent = { projects: "Columns: Project Name, Location, Category, Type, Payment Plan, Starting Price (Cr), Configuration, Possession, Image URL, Description. Duplicates merge on Project Name.", inventory: "Columns: Project Name, Unit No, Size, Unit description, Status, Costing. Duplicates merge on Project Name + Unit No.", partners: "Columns: Name, Mobile, Company Name, City, Team Size, Status." }[target];
    document.getElementById("importReport").className = "import-report"; document.getElementById("importReport").innerHTML = ""; document.getElementById("fileInput").value = "";
    document.getElementById("drawerOverlay").classList.add("open"); document.getElementById("importDrawer").classList.add("open");
  }
  function closeImport() { document.getElementById("importDrawer").classList.remove("open"); document.getElementById("drawerOverlay").classList.remove("open"); }
  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "binary" }), ws = wb.Sheets[wb.SheetNames[0]], rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) { toast("Sheet appears empty.", "err"); return; }
        let report;
        if (importTarget === "projects") report = await Store.bulkUpsertProjects(rows);
        else if (importTarget === "inventory") report = await Store.bulkUpsertInventory(rows);
        else report = await importPartners(rows);
        showReport(report); await refreshAll();
      } catch (e) { console.error(e); toast("Could not read file. Ensure it's a valid Excel/CSV.", "err"); }
    };
    reader.readAsBinaryString(file);
  }
  async function importPartners(rows) {
    let added = 0, merged = 0, skipped = 0; const byMobile = new Map(PARTNERS.map(p => [norm(p.mobile), p]));
    for (const r of rows) {
      const name = (r.Name || r.name || "").toString().trim(), mobile = (r.Mobile || r.mobile || "").toString().trim();
      if (!name) { skipped++; continue; }
      const rec = { name, mobile, company: r["Company Name"] || r.company || "", city: r.City || r.city || "", teamSize: parseInt(r["Team Size"] || r.teamSize || 0) || 0, status: (norm(r.Status || r.status).startsWith("in")) ? "Inactive" : "Active" };
      const key = norm(mobile); if (mobile && byMobile.has(key)) { rec.id = byMobile.get(key).id; merged++; } else added++;
      await Store.savePartner(rec);
    }
    return { added, merged, skipped, total: PARTNERS.length + added };
  }
  function showReport(r) { const el = document.getElementById("importReport"); el.className = "import-report show"; el.innerHTML = `<b>✅ Import complete.</b><br>Added: <b>${r.added}</b> · Merged/updated duplicates: <b>${r.merged}</b> · Skipped: <b>${r.skipped}</b><br><span class="muted">Total records now: ${r.total}</span>`; toast(`Imported: ${r.added} new, ${r.merged} merged.`, "ok"); }
  function downloadTemplate(target) {
    target = (typeof target === "string" && target) ? target : importTarget;
    let headers, samples, sheet;
    if (target === "inventory") {
      headers = ["Project Name", "Unit No", "Size", "Unit description", "Status", "BSP", "Costing"];
      samples = [["BPTP Amstoria", "A-104", "2400 sq.ft", "3 BHK ground floor, park facing", "Available", "21500", "5.16"],
                 ["BPTP Amstoria", "A-105", "2650 sq.ft", "4 BHK first floor", "Hold", "21500", "5.70"]];
      sheet = "Inventory";
    } else if (target === "partners") {
      headers = ["Name", "Mobile", "Company Name", "City", "Team Size", "Status"];
      samples = [["New Partner", "+91 98XXXXXXXX", "ABC Realty", "Gurugram", "5", "Active"]];
      sheet = "Partners";
    } else {
      headers = ["Project Name", "Location", "Category", "Type", "Payment Plan", "Starting Price (Cr)", "Configuration", "Possession", "Image URL", "Description"];
      samples = [["BPTP New Project", "Sector XX, Dwarka Expressway, Gurugram", "Under Construction", "High-rise", "10:90 CLP", "3.5", "3 & 4 BHK", "Est. 2028", "assets/newproject.jpg", "Short marketing description here."]];
      sheet = "Projects";
    }
    try {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...samples]);
      ws["!cols"] = headers.map(h => ({ wch: Math.max(14, h.length + 4) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheet);
      XLSX.writeFile(wb, "coffeeanddeals-" + target + "-template.xlsx");
    } catch (e) {
      dl(headers.join(",") + "\n" + samples.map(r => r.map(s => `"${s}"`).join(",")).join("\n") + "\n", "coffeeanddeals-" + target + "-template.csv", "text/csv");
    }
  }

  function openDrawer(title, html) {
    document.getElementById("drawerTitle").textContent = title; document.getElementById("drawerBody").innerHTML = html;
    document.getElementById("drawer").classList.add("open"); document.getElementById("drawerOverlay").classList.add("open");
    document.getElementById("drawerOverlay").onclick = closeAll; document.getElementById("drawerClose").onclick = closeDrawer;
  }
  function closeDrawer() { document.getElementById("drawer").classList.remove("open"); document.getElementById("drawerOverlay").classList.remove("open"); }
  function closeAll() { closeDrawer(); closeImport(); }
  function fld(label, id, v, type) { return `<div class="field"><label>${label}</label><input id="${id}" type="${type || "text"}" value="${v != null ? esc(v) : ""}"></div>`; }
  function area(label, id, v) { return `<div class="field"><label>${label}</label><textarea id="${id}" rows="3">${v != null ? esc(v) : ""}</textarea></div>`; }
  function sel(label, id, opts, cur) { return `<div class="field"><label>${label}</label><select id="${id}">${opts.map(o => `<option ${o === cur ? "selected" : ""}>${o}</option>`).join("")}</select></div>`; }
  function selProjects(label, id, cur) { return `<div class="field"><label>${label}</label><select id="${id}">${PROJECTS.map(p => `<option ${p.name === cur ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>`; }
  const val = (id) => (document.getElementById(id) || {}).value || "";
  function bind(tableId, selector, fn) { document.getElementById(tableId).querySelectorAll(selector).forEach(b => { const d = b.dataset; b.addEventListener("click", (ev) => { ev.preventDefault(); fn(d.edit || d.del || d.toggle || d.approve || d.feat || d.feat2 || d.conv || d.open); }); }); }
  const mob10 = s => (s || "").toString().replace(/\D/g, "").slice(-10);
  async function addActivity(id, type, text) { const c = CUSTOMERS.find(x => x.id === id); if (!c) return; const acts = Array.isArray(c.activities) ? c.activities.slice() : []; acts.unshift({ id: Date.now().toString(36), type, text, ts: Date.now() }); await Store.saveCustomer({ id, activities: acts, lastTs: Date.now() }); }

  // ---- bulk selection / delete ----
  const chkTh = `<th style="width:34px"><input type="checkbox" class="bulk-all" aria-label="Select all"></th>`;
  const chkTd = (id) => `<td><input type="checkbox" class="bulk" data-id="${esc(id)}"></td>`;
  function wireSelectAll(tableId) {
    const tbl = document.getElementById(tableId); if (!tbl) return;
    const all = tbl.querySelector(".bulk-all");
    if (all) all.addEventListener("change", () => tbl.querySelectorAll(".bulk").forEach(c => c.checked = all.checked));
  }
  function selectedIds(tableId) { return [...document.getElementById(tableId).querySelectorAll(".bulk:checked")].map(c => c.dataset.id); }
  async function bulkDelete(tableId, delFn, label) {
    const ids = selectedIds(tableId);
    if (!ids.length) { toast("Tick some rows first.", "err"); return; }
    if (!confirm(`Delete ${ids.length} selected ${label}? This cannot be undone.`)) return;
    for (const id of ids) { try { await delFn(id); } catch (e) {} }
    await refreshAll(); toast(`Deleted ${ids.length} ${label}.`, "ok");
  }
  function truncate(s, n) { s = s || ""; return s.length > n ? s.slice(0, n) + "…" : s; }
  function timeAgo(ts) { if (!ts) return "—"; const d = (Date.now() - ts) / 86400000; if (d < 1) return "Today"; if (d < 2) return "Yesterday"; return Math.floor(d) + "d ago"; }
  function fmtDT(ts) { if (!ts) return "—"; try { return new Date(ts).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return "—"; } }
  function leadInterests(e) { let its = e.interests; if (!its || !its.length) { if (e.project) return [{ project: e.project, units: (e.unit && e.unit !== "(inventory view)") ? [e.unit] : [], lastTs: e.ts }]; return []; } return its; }
  function interestSummary(e) { const its = leadInterests(e); if (!its.length) return "—"; return its.map(it => `<b>${esc(it.project)}</b>: ${esc(it.units && it.units.length ? it.units.join(", ") : "viewed")}`).join("<br>"); }
  function interestText(e) { return leadInterests(e).map(it => it.project + " " + (it.units || []).join(" ")).join(" "); }
  function dl(content, name, mime) { const b = new Blob([content], { type: mime }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
  const norm = Store.helpers.norm;
  const _toasted = {}; function toastOnce(k, m) { if (_toasted[k]) return; _toasted[k] = 1; toast(m); }
})();
