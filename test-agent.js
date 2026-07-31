const fs = require("fs");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync("admin.html", "utf8");
const uiJs = fs.readFileSync("js/ui.js", "utf8");
const adminJs = fs.readFileSync("js/admin.js", "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
window.requestAnimationFrame = cb => setTimeout(cb, 0);
window.prompt = () => "x"; window.confirm = () => true; window.alert = () => {};

let CUST = [];
let ENQ = [{ id: "e1", code: "CND-0007", user: "Vikram Rao", mobile: "9876500000", status: "Open", ts: Date.now(), createdTs: Date.now(), interests: [{ project: "BPTP Downtown 66", units: ["A-101"] }], agent: { isAgent: true, firm: "Rao Realty", designation: "Director" } }];

window.APP_CONFIG = { backend: "local", brand: { name: "C&D", linkedin: "x", heroImage: "x" }, demoAdminPass: "coffee-admin" };
const arr = a => async () => a;
window.Store = {
  mode: "local", helpers: { norm: s => (s || "").toString().toLowerCase().trim() },
  projects: arr([{ name: "BPTP Downtown 66" }]), inventory: arr([]),
  enquiries: async () => ENQ, partners: arr([]), testimonials: arr([]),
  customers: async () => CUST, tasks: arr([]), targets: async () => ({ month: "2026-07", target: 50 }),
  saveCustomer: async p => { const i = CUST.findIndex(c => c.id === p.id); if (i >= 0) CUST[i] = { ...CUST[i], ...p }; else { const n = { ...p, id: "cN" + CUST.length, code: "CUST-100" + CUST.length }; CUST.push(n); return n; } return CUST[i]; },
  updateEnquiry: async (id, patch) => { const e = ENQ.find(x => x.id === id); if (e) Object.assign(e, patch); },
  deleteCustomer: async () => {}, saveTask: async () => {}, deleteTask: async () => {}, saveTargets: async () => {},
  deleteEnquiry: async () => {}, savePartner: async () => {}, deletePartner: async () => {}, saveProject: async () => {},
  deleteProject: async () => {}, saveUnit: async () => {}, deleteUnit: async () => {}, setTestimonialApproved: async () => {}, deleteTestimonial: async () => {}
};
window.eval(uiJs); window.eval(adminJs);
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
window.document.getElementById("adCode").value = "coffee-admin";
window.document.getElementById("btnLocalLogin").click();

setTimeout(() => {
  try {
    [...window.document.querySelectorAll("#sideNav a")].find(a => a.dataset.view === "enquiries").click();
    const eTable = window.document.getElementById("eTable");
    const agentTag = eTable.querySelector(".agent-tag");
    const agentLine = eTable.querySelector(".agent-line");
    console.log("enquiry agent badge:", !!agentTag, "| firm line:", agentLine ? agentLine.textContent.trim() : "none");
    // convert
    eTable.querySelector("[data-conv]").click();
    setTimeout(() => {
      const c = CUST[0];
      console.log("converted customer source:", c ? c.source : "none", "| notes has firm:", c ? /Rao Realty/.test(c.notes || "") : false);
      console.log(agentTag && c && c.source === "Channel Partner" ? "RESULT: AGENT FLOW WORKS" : "RESULT: BROKEN");
    }, 50);
  } catch (e) { console.log("ERROR:", e.message); }
}, 60);
