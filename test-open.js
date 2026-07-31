const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync("admin.html", "utf8");
const uiJs = fs.readFileSync("js/ui.js", "utf8");
const adminJs = fs.readFileSync("js/admin.js", "utf8");

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
window.requestAnimationFrame = cb => setTimeout(cb, 0);
window.prompt = () => "Test note";
window.confirm = () => true;
window.alert = () => {};

let CUST = [
  { id: "c1", code: "CUST-1001", name: "Rohan Mehta", mobile: "9876543210", email: "", source: "Website", project: "BPTP Downtown 66", value: 6.5, budget: 6, stage: "Site Visit", owner: "Ashish", nextFollowUp: Date.now() + 86400000, createdTs: Date.now() - 5 * 86400000, lastTs: Date.now() - 86400000, activities: [{ id: "a1", type: "Note", text: "Called, interested", ts: Date.now() - 3600000 }] },
  { id: "c2", code: "CUST-1002", name: "Neha Kapoor", mobile: "9811122233", source: "Referral", project: "", value: 0, stage: "New", owner: "", createdTs: Date.now() - 2 * 86400000, lastTs: Date.now() - 2 * 86400000 }
];

window.APP_CONFIG = { backend: "local", brand: { name: "Coffee & Deals", linkedin: "x", heroImage: "x" }, demoAdminPass: "coffee-admin" };
const arr = a => async () => a;
window.Store = {
  mode: "local",
  helpers: { norm: s => (s || "").toString().toLowerCase().trim() },
  projects: arr([{ name: "BPTP Downtown 66" }]),
  inventory: arr([]),
  enquiries: arr([{ id: "e1", code: "CND-0007", user: "Rohan Mehta", mobile: "9876543210", status: "Open", ts: Date.now(), createdTs: Date.now(), interests: [{ project: "BPTP Downtown 66", units: ["A-101"] }] }]),
  partners: arr([]), testimonials: arr([]),
  customers: async () => CUST,
  tasks: arr([{ id: "t1", title: "Site visit follow-up", type: "Call", customer: "Rohan Mehta", due: Date.now() + 86400000, done: false, priority: "High" }]),
  targets: async () => ({ month: "2026-07", target: 50 }),
  saveCustomer: async p => { const i = CUST.findIndex(c => c.id === p.id); if (i >= 0) CUST[i] = { ...CUST[i], ...p }; else CUST.push({ ...p, id: "cN", code: "CUST-1003" }); return CUST[i] || CUST[CUST.length - 1]; },
  deleteCustomer: async () => {}, saveTask: async () => {}, deleteTask: async () => {}, saveTargets: async () => {},
  updateEnquiry: async () => {}, deleteEnquiry: async () => {}, savePartner: async () => {}, deletePartner: async () => {},
  saveProject: async () => {}, deleteProject: async () => {}, saveInventory: async () => {}, deleteInventory: async () => {},
  setTestimonialApproved: async () => {}, saveTestimonial: async () => {}, deleteTestimonial: async () => {}
};

window.eval(uiJs);
window.eval(adminJs);
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));

window.document.getElementById("adCode").value = "coffee-admin";
window.document.getElementById("btnLocalLogin").click();

setTimeout(() => {
  try {
    const custNav = [...window.document.querySelectorAll("#sideNav a")].find(a => a.dataset.view === "customers");
    custNav.click();
    const table = window.document.getElementById("custTable");
    const rowCount = table.querySelectorAll("tbody tr").length;
    const openBtn = table.querySelector("[data-open]");
    console.log("customer rows:", rowCount, "| has [data-open]:", !!openBtn);
    if (!openBtn) throw new Error("no data-open element found");
    openBtn.click();
    setTimeout(() => {
      const panel = window.document.querySelector(".cd-panel");
      const name = panel && panel.querySelector(".cd-name") ? panel.querySelector(".cd-name").textContent : null;
      const tl = panel ? panel.querySelectorAll(".cd-tl").length : 0;
      console.log("PROFILE OPENED:", !!panel, "| name:", name, "| timeline items:", tl);
      const score = panel ? panel.querySelector(".score-badge") : null;
      console.log("profile score badge:", score ? score.textContent : "none");
      window.document.querySelector(".cd-ov").click();
      // board
      window.document.getElementById("custViewToggle").click();
      const cards = window.document.querySelectorAll("#custBoard .kb-card").length;
      const boardScores = window.document.querySelectorAll("#custBoard .score-badge").length;
      console.log("board cards:", cards, "| board score badges:", boardScores);
      window.document.getElementById("custViewToggle").click();
      // analytics
      const anNav = [...window.document.querySelectorAll("#sideNav a")].find(a => a.dataset.view === "analytics");
      anNav.click();
      const anKpi = window.document.querySelectorAll("#anKpis .mcard").length;
      const anSrc = window.document.querySelectorAll("#anSource .fn-row").length;
      const anConv = window.document.querySelectorAll("#anConv .fn-row").length;
      const anOwner = window.document.querySelectorAll("#anOwner tbody tr").length;
      console.log("analytics: kpis", anKpi, "| sources", anSrc, "| stages", anConv, "| owner rows", anOwner);
      // auto-assign
      window.confirm = () => true;
      window.document.getElementById("custAssign").click();
      setTimeout(() => {
        const assigned = CUST.filter(c => ["Ashish","Priya","Rahul","Sana"].includes(c.owner) && c.stage !== "Booked" && c.stage !== "Lost").length;
        console.log("owners assigned (open leads):", assigned);
        console.log(panel && anKpi === 4 && cards === 2 ? "RESULT: ALL FEATURES WORK" : "RESULT: SOMETHING BROKEN");
      }, 40);
    }, 30);
  } catch (e) { console.log("ERROR:", e.message); }
}, 60);
