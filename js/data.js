/* data.js — Data layer: Firestore adapter when configured, else seeded localStorage */
const SEED_PROJECTS = [
  { id:"amstoria-102", name:"BPTP Amstoria", location:"Sector 102, Dwarka Expressway, Gurugram", category:"Ready to Move", type:"Floor",
    paymentPlan:"Flexi 40:60 with assured possession-linked plan", priceFromCr:3.2, priceLabel:"₹3.2 Cr onwards",
    config:"3 & 4 BHK Independent Floors", possession:"Ready to Move", image:"assets/proj-floor.svg",
    tagline:"Low-density luxury floors on Dwarka Expressway.",
    about:"BPTP Amstoria is a premium low-rise township of independent builder floors set within landscaped greens on the Dwarka Expressway corridor. Wide roads, gated security and a boutique community feel make it a favourite of end-users who want a villa-like lifestyle with apartment convenience.",
    why:["Direct Dwarka Expressway connectivity — minutes to IGI Airport.","Low-density gated community with only a few families per acre.","Ready-to-move: zero construction risk, immediate rental potential."],
    usp:["Independent floors with private terraces and stilt parking","Landscaped central greens & clubhouse access","Established social infrastructure — schools, retail, hospitals nearby"],
    roi:{ entryPriceCr:3.2, apprRate:11, rentalYield:3.2, holdYears:5 } },
  { id:"bptp-37d", name:"BPTP Sector 37D", location:"Sector 37D, Dwarka Expressway, Gurugram", category:"Under Construction", type:"High-rise",
    paymentPlan:"Construction-linked plan (CLP) 10:90 launch offer", priceFromCr:3.5, priceLabel:"₹3.5 Cr onwards",
    config:"3 & 4 BHK Luxury High-rise Residences", possession:"Est. 2028", image:"assets/proj-highrise.svg",
    tagline:"New-launch luxury high-rise on the Expressway growth belt.",
    about:"A landmark high-rise development in Sector 37D, positioned on the fast-appreciating Dwarka Expressway belt. Resort-style amenities, sky decks and smart-home-ready residences target the next wave of luxury demand in New Gurugram.",
    why:["New-launch pricing on one of Gurugram's fastest-growing corridors.","Attractive 10:90 payment plan — low entry, capital-efficient.","Expressway + upcoming metro & ISBT catchment driving appreciation."],
    usp:["Resort-style amenities: sky lounge, infinity pool, wellness zone","Large-format 3 & 4 BHK layouts with premium fittings","Grade-A developer track record and RERA-registered launch"],
    roi:{ entryPriceCr:3.5, apprRate:14, rentalYield:2.6, holdYears:6 } },
  { id:"astaire-70a", name:"BPTP Astaire Garden", location:"Sector 70A, Southern Peripheral Road, Gurugram", category:"Ready to Move", type:"Plot",
    paymentPlan:"Down-payment & bank-funding friendly plan", priceFromCr:4.0, priceLabel:"₹4.0 Cr onwards",
    config:"Residential Plots & Villas", possession:"Ready to Move", image:"assets/proj-plot.svg",
    tagline:"Gated plotted living on SPR — build your own signature home.",
    about:"Astaire Garden is an established gated plotted colony on the Southern Peripheral Road (SPR), offering freehold residential plots within a secure, green, low-density community. Ideal for buyers who want land ownership with clear appreciation and the freedom to build.",
    why:["Freehold plots on SPR — a proven appreciation corridor.","Ready infrastructure: roads, power, water, gated security in place.","Land assets historically outperform on long-hold appreciation."],
    usp:["Clear-title freehold plots of multiple sizes","Established, occupied community with parks and wide internal roads","Close to NH-48, SPR and upcoming metro connectivity"],
    roi:{ entryPriceCr:4.0, apprRate:12, rentalYield:1.8, holdYears:7 } },
  { id:"downtown-66", name:"BPTP Downtown", location:"Sector 66, Golf Course Extension Road, Gurugram", category:"Under Construction", type:"High-rise",
    paymentPlan:"Subvention-style plan with milestone payments", priceFromCr:5.5, priceLabel:"₹5.5 Cr onwards",
    config:"3, 4 & 5 BHK Ultra-luxury Residences", possession:"Est. 2029", image:"assets/downtown.jpg", imageFallback:"assets/proj-luxury.svg",
    tagline:"Ultra-luxury address on Golf Course Extension Road.",
    about:"BPTP Downtown is a marquee ultra-luxury high-rise on the prestigious Golf Course Extension Road — Gurugram's most sought-after premium residential corridor. Designed for HNI and NRI buyers seeking a trophy address with best-in-class amenities and appreciation.",
    why:["Golf Course Extension Road — Gurugram's top premium address.","Trophy inventory that HNI/NRI buyers actively seek.","Limited ultra-luxury supply supports pricing power."],
    usp:["Ultra-luxury 3–5 BHK with private-lift lobbies (select units)","Signature clubhouse, concierge and world-class amenities","Prime GCX-Road location with metro and retail at the doorstep"],
    roi:{ entryPriceCr:5.5, apprRate:13, rentalYield:2.9, holdYears:6 } }
];
const SEED_INVENTORY = [
  { id:"amstoria-102|A-101", project:"BPTP Amstoria", unitNo:"A-101", size:"2400 sq.ft", desc:"Ground floor, 3 BHK + study, private garden", status:"Available", costingCr:3.2 },
  { id:"amstoria-102|A-102", project:"BPTP Amstoria", unitNo:"A-102", size:"2650 sq.ft", desc:"First floor, 4 BHK, balcony x2", status:"Available", costingCr:3.6 },
  { id:"amstoria-102|A-103", project:"BPTP Amstoria", unitNo:"A-103", size:"2900 sq.ft", desc:"Second floor + terrace, 4 BHK", status:"Hold", costingCr:3.9 },
  { id:"amstoria-102|B-201", project:"BPTP Amstoria", unitNo:"B-201", size:"2400 sq.ft", desc:"Ground floor, 3 BHK, corner unit", status:"Sold", costingCr:3.3 },
  { id:"bptp-37d|T1-1204", project:"BPTP Sector 37D", unitNo:"T1-1204", size:"2100 sq.ft", desc:"Tower 1, 3 BHK, east facing", status:"Available", costingCr:3.5 },
  { id:"bptp-37d|T1-1805", project:"BPTP Sector 37D", unitNo:"T1-1805", size:"2600 sq.ft", desc:"Tower 1, 4 BHK, high floor, park view", status:"Available", costingCr:4.4 },
  { id:"bptp-37d|T2-0902", project:"BPTP Sector 37D", unitNo:"T2-0902", size:"2100 sq.ft", desc:"Tower 2, 3 BHK, corner", status:"Hold", costingCr:3.6 },
  { id:"bptp-37d|T2-2101", project:"BPTP Sector 37D", unitNo:"T2-2101", size:"3200 sq.ft", desc:"Tower 2, 4 BHK penthouse-style", status:"Available", costingCr:5.6 },
  { id:"astaire-70a|P-14", project:"BPTP Astaire Garden", unitNo:"P-14", size:"250 sq.yd", desc:"Freehold plot, park facing", status:"Available", costingCr:4.0 },
  { id:"astaire-70a|P-22", project:"BPTP Astaire Garden", unitNo:"P-22", size:"300 sq.yd", desc:"Freehold plot, corner", status:"Available", costingCr:4.9 },
  { id:"astaire-70a|P-31", project:"BPTP Astaire Garden", unitNo:"P-31", size:"200 sq.yd", desc:"Freehold plot, wide-road", status:"Sold", costingCr:3.4 },
  { id:"downtown-66|A-2402", project:"BPTP Downtown", unitNo:"A-2402", size:"3100 sq.ft", desc:"3 BHK + servant, high floor", status:"Available", costingCr:5.5 },
  { id:"downtown-66|A-3001", project:"BPTP Downtown", unitNo:"A-3001", size:"3900 sq.ft", desc:"4 BHK, private-lift lobby", status:"Available", costingCr:7.2 },
  { id:"downtown-66|B-3505", project:"BPTP Downtown", unitNo:"B-3505", size:"5200 sq.ft", desc:"5 BHK sky residence", status:"Hold", costingCr:9.8 }
];
const SEED_TESTIMONIALS = [
  { id:"t1", name:"Rajeev Malhotra", role:"HNI Investor, Dubai", rating:5, approved:true, text:"Ashish curated exactly the right BPTP unit for my portfolio. Transparent, data-driven and always reachable across time zones. My best Gurugram investment call." },
  { id:"t2", name:"Priya Nair", role:"NRI Buyer, Singapore", rating:5, approved:true, text:"Buying from overseas is scary. Ashish made it effortless — live inventory, honest ROI numbers, and paperwork handled end-to-end. Genuinely trustworthy." },
  { id:"t3", name:"Sandeep & Co.", role:"Channel Partner, Gurugram", rating:5, approved:true, text:"As a channel partner I get clean inventory, fast responses and fair dealing every single time. Ashish is the person I route my premium clients to." }
];
const SEED_PARTNERS = [
  { id:"cp1", name:"Sandeep Yadav", mobile:"+91 98100 00001", company:"Prime Realty Advisors", city:"Gurugram", teamSize:12, status:"Active" },
  { id:"cp2", name:"Meera Kapoor", mobile:"+91 98100 00002", company:"Skyline Homes", city:"Delhi", teamSize:6, status:"Active" },
  { id:"cp3", name:"Global Reach Realty", mobile:"+65 8000 0003", company:"Global Reach Realty", city:"Singapore", teamSize:20, status:"Inactive" }
];
const SEED_ENQUIRIES = [
  { id:"e1", user:"Amit Verma", mobile:"+91 99000 11111", project:"BPTP Amstoria", unit:"A-102", status:"Open", ts:Date.now()-86400000*2 },
  { id:"e2", user:"Nisha Rao", mobile:"+91 99000 22222", project:"BPTP Downtown", unit:"A-3001", status:"Closed", ts:Date.now()-86400000*6 }
];

const DAY = 86400000;
const SEED_CUSTOMERS = [
  { id:"cu1", code:"CUST-1001", name:"Rohit Mehta", mobile:"+91 98111 20001", email:"", source:"Website", project:"BPTP Downtown", budget:6, value:6.5, stage:"Negotiation", owner:"Ashish", nextFollowUp:Date.now()+DAY, notes:"Wants high floor, eyeing A-3001.", createdTs:Date.now()-DAY*10, lastTs:Date.now()-DAY },
  { id:"cu2", code:"CUST-1002", name:"Anita Desai", mobile:"+91 98111 20002", email:"", source:"Channel Partner", project:"BPTP Amstoria", budget:3.5, value:3.6, stage:"Site Visit", owner:"Ashish", nextFollowUp:Date.now()+DAY*2, notes:"Site visit booked Saturday 11am.", createdTs:Date.now()-DAY*7, lastTs:Date.now()-DAY*2 },
  { id:"cu3", code:"CUST-1003", name:"Vikram Rao (NRI)", mobile:"+65 8000 0003", email:"", source:"Referral", project:"BPTP Downtown", budget:9, value:9.8, stage:"Qualified", owner:"Ashish", nextFollowUp:Date.now()+DAY*3, notes:"Dubai based — video call for cost sheet.", createdTs:Date.now()-DAY*5, lastTs:Date.now()-DAY*3 },
  { id:"cu4", code:"CUST-1004", name:"Sanjay Kapoor", mobile:"+91 98111 20004", email:"", source:"Website", project:"BPTP Sector 37D", budget:3.5, value:3.5, stage:"Contacted", owner:"Ashish", nextFollowUp:Date.now()+DAY, notes:"", createdTs:Date.now()-DAY*3, lastTs:Date.now()-DAY },
  { id:"cu5", code:"CUST-1005", name:"Meera Iyer", mobile:"+91 98111 20005", email:"", source:"Walk-in", project:"BPTP Astaire Garden", budget:4, value:4.0, stage:"Booked", owner:"Ashish", nextFollowUp:null, notes:"Booked plot P-14. Collect balance.", createdTs:Date.now()-DAY*20, lastTs:Date.now()-DAY*2 },
  { id:"cu6", code:"CUST-1006", name:"Karan Singh", mobile:"+91 98111 20006", email:"", source:"Website", project:"BPTP Amstoria", budget:3, value:0, stage:"New", owner:"Ashish", nextFollowUp:Date.now(), notes:"Fresh web enquiry — call today.", createdTs:Date.now()-DAY, lastTs:Date.now()-DAY }
];
const SEED_TASKS = [
  { id:"tk1", title:"Call Rohit re: A-3001 pricing & payment plan", type:"Call", customer:"Rohit Mehta", due:Date.now(), done:false, priority:"High", ts:Date.now()-3600000 },
  { id:"tk2", title:"Confirm Anita's site visit (Sat 11am)", type:"Site Visit", customer:"Anita Desai", due:Date.now()+DAY, done:false, priority:"Medium", ts:Date.now() },
  { id:"tk3", title:"Send Downtown cost sheet to Vikram (NRI)", type:"Follow-up", customer:"Vikram Rao (NRI)", due:Date.now()-DAY, done:false, priority:"High", ts:Date.now()-DAY*2 },
  { id:"tk4", title:"Weekly channel-partner sync call", type:"Meeting", customer:"", due:Date.now()+DAY*2, done:false, priority:"Low", ts:Date.now() },
  { id:"tk5", title:"Collect balance payment — Meera (P-14)", type:"Follow-up", customer:"Meera Iyer", due:Date.now()+DAY*4, done:false, priority:"Medium", ts:Date.now() }
];
const SEED_TARGETS = { month:new Date().toISOString().slice(0,7), target:50 };

const norm = (s)=>(s||"").toString().trim().toLowerCase().replace(/\s+/g," ");
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
// Firestore document IDs cannot contain "/" (it's the path separator) and a few other
// reserved forms. Build a safe, stable inventory id from project + unit no.
const invId = (project,unitNo)=>{
  let s = norm(project)+"|"+norm(unitNo);
  s = s.replace(/[\/\\]+/g,"-")        // slashes → hyphen (the actual bug)
       .replace(/[\x00-\x1f\x7f#?%\[\]*]/g,"-") // other awkward chars
       .replace(/-{2,}/g,"-").replace(/^\.+|\.+$/g,"").trim();
  return s || uid();
};
const clone = (o)=>JSON.parse(JSON.stringify(o));
// Privacy masks — the PUBLIC testimonials collection never stores raw contact details,
// only these masked hints (e.g. mobile *****82, email s***1@gmail.com). Full contact
// is kept in the admin-only `testimonial_contacts` collection.
const maskMobile = (m)=>{ const d=(m||"").toString().replace(/\D/g,""); return d?("*****"+d.slice(-2)):""; };
const maskEmail = (e)=>{ e=(e||"").toString().trim(); const at=e.indexOf("@"); if(at<1) return ""; const u=e.slice(0,at),dom=e.slice(at+1); return (u.length<=2?u[0]+"***":u[0]+"***"+u[u.length-1])+"@"+dom; };

const LocalAdapter = (()=>{
  const KEY="cnd_db_v2";
  function db(){ let d=null; try{ d=JSON.parse(localStorage.getItem(KEY)); }catch(e){}
    if(!d){ d={ projects:clone(SEED_PROJECTS), inventory:clone(SEED_INVENTORY), enquiries:clone(SEED_ENQUIRIES), partners:clone(SEED_PARTNERS), testimonials:clone(SEED_TESTIMONIALS) }; }
    let changed=false;
    if(!d.customers){ d.customers=clone(SEED_CUSTOMERS); changed=true; }
    if(!d.tasks){ d.tasks=clone(SEED_TASKS); changed=true; }
    if(!d.targets){ d.targets=clone(SEED_TARGETS); changed=true; }
    localStorage.setItem(KEY,JSON.stringify(d)); return d; }
  function save(d){ localStorage.setItem(KEY,JSON.stringify(d)); }
  return {
    async projects(){ return db().projects; },
    projectsCached(){ try{ return db().projects; }catch(e){ return null; } },
    async project(id){ return db().projects.find(p=>p.id===id)||null; },
    async saveProject(p){ const d=db(); p.id=p.id||uid(); const i=d.projects.findIndex(x=>x.id===p.id); if(i>=0) d.projects[i]={...d.projects[i],...p}; else d.projects.push(p); save(d); return p; },
    async deleteProject(id){ const d=db(); const nm=((SEED_PROJECTS.find(s=>s.id===id)||{}).name)||id; d.projects=d.projects.filter(p=>p.id!==id); d.inventory=d.inventory.filter(u=>norm(u.project)!==norm(nm)); save(d); },
    async inventory(){ return db().inventory; },
    async inventoryFor(name){ return db().inventory.filter(u=>norm(u.project)===norm(name)); },
    async saveUnit(u){ const d=db(); u.id=u.id||invId(u.project,u.unitNo); const i=d.inventory.findIndex(x=>x.id===u.id); if(i>=0) d.inventory[i]={...d.inventory[i],...u}; else d.inventory.push(u); save(d); return u; },
    async deleteUnit(id){ const d=db(); d.inventory=d.inventory.filter(u=>u.id!==id); save(d); },
    async enquiries(){ return db().enquiries.slice().sort((a,b)=>b.ts-a.ts); },
    async addEnquiry(e){ const d=db(); e.id=e.id||uid(); e.ts=e.ts||Date.now(); e.status=e.status||"Open"; d.enquiries.push(e); save(d); return e; },
    async updateEnquiry(id,patch){ const d=db(); const e=d.enquiries.find(x=>x.id===id); if(e) Object.assign(e,patch); save(d); },
    async deleteEnquiry(id){ const d=db(); d.enquiries=d.enquiries.filter(e=>e.id!==id); save(d); },
    async partners(){ return db().partners; },
    async savePartner(p){ const d=db(); p.id=p.id||uid(); const i=d.partners.findIndex(x=>x.id===p.id); if(i>=0) d.partners[i]={...d.partners[i],...p}; else d.partners.push(p); save(d); return p; },
    async deletePartner(id){ const d=db(); d.partners=d.partners.filter(p=>p.id!==id); save(d); },
    async testimonials(all){ const t=db().testimonials; return all?t:t.filter(x=>x.approved); },
    async addTestimonial(t){ const d=db(); t.id=t.id||uid(); t.approved=false; t.ts=Date.now(); t.mobileMasked=maskMobile(t.mobile); t.emailMasked=maskEmail(t.email); d.testimonials.push(t); save(d); return t; },
    async testimonialContacts(){ return db().testimonials.filter(t=>t.mobile||t.email).map(t=>({id:t.id,name:t.name,mobile:t.mobile||"",email:t.email||"",who:t.who||""})); },
    async setTestimonialApproved(id,v){ const d=db(); const t=d.testimonials.find(x=>x.id===id); if(t) t.approved=v; save(d); },
    async deleteTestimonial(id){ const d=db(); d.testimonials=d.testimonials.filter(t=>t.id!==id); save(d); },
    async bulkUpsertProjects(rows){ const d=db(); const r=mergeProjects(d.projects,rows); d.projects=r.list; save(d); return r.report; },
    async bulkUpsertInventory(rows){ const d=db(); const r=mergeInventory(d.inventory,rows); d.inventory=r.list; save(d); return r.report; },
    async customers(){ return db().customers; },
    async saveCustomer(c){ const d=db(); c.id=c.id||uid(); const i=d.customers.findIndex(x=>x.id===c.id); if(i>=0) d.customers[i]={...d.customers[i],...c}; else { c.code=c.code||("CUST-"+(1001+d.customers.length)); c.createdTs=c.createdTs||Date.now(); c.lastTs=Date.now(); d.customers.push(c);} save(d); return c; },
    async deleteCustomer(id){ const d=db(); d.customers=d.customers.filter(c=>c.id!==id); save(d); },
    async tasks(){ return db().tasks; },
    async saveTask(t){ const d=db(); t.id=t.id||uid(); const i=d.tasks.findIndex(x=>x.id===t.id); if(i>=0) d.tasks[i]={...d.tasks[i],...t}; else { t.ts=t.ts||Date.now(); d.tasks.push(t);} save(d); return t; },
    async deleteTask(id){ const d=db(); d.tasks=d.tasks.filter(t=>t.id!==id); save(d); },
    async targets(){ return db().targets; },
    async saveTargets(t){ const d=db(); d.targets={...d.targets,...t}; save(d); return d.targets; }
  };
})();

const FirebaseAdapter = (()=>{
  let fb=null;
  // ---- Lightweight per-tab cache so the public site paints instantly and never
  // shows a false "not found" during a slow/flaky network read. Stale-while-revalidate:
  // callers get the cached copy immediately; a fresh read updates the cache in the
  // background for the next navigation. TTL is generous — marketing data, not live prices. ----
  const PCACHE_KEY="cnd_projects_cache", PCACHE_TTL=10*60*1000;
  function readProjCache(){ try{ const r=JSON.parse(sessionStorage.getItem(PCACHE_KEY)); if(r&&Array.isArray(r.list)) return r; }catch(e){} return null; }
  function writeProjCache(list){ try{ sessionStorage.setItem(PCACHE_KEY, JSON.stringify({list, ts:Date.now()})); }catch(e){} }
  function cachedProject(id){ const c=readProjCache(); return c ? (c.list.find(p=>p.id===id)||null) : null; }
  async function ensure(){ if(fb) return fb;
    const appMod=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const fsMod=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const authMod=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    let app; try{ app=appMod.getApp(); }catch(e){ app=appMod.initializeApp(window.APP_CONFIG.firebase); }
    fb={ db:fsMod.getFirestore(app), auth:authMod.getAuth(app), fs:fsMod, authM:authMod, app }; return fb; }
  async function all(name){ const {db,fs}=await ensure(); const snap=await fs.getDocs(fs.collection(db,name)); return snap.docs.map(d=>({id:d.id,...d.data()})); }
  async function put(name,id,data){ const {db,fs}=await ensure(); const ref=id?fs.doc(db,name,id):fs.doc(fs.collection(db,name)); const clean=JSON.parse(JSON.stringify(data)); await fs.setDoc(ref,clean,{merge:true}); return {id:ref.id,...data}; }
  async function del(name,id){ const {db,fs}=await ensure(); await fs.deleteDoc(fs.doc(db,name,id)); }
  // Catalog "init" flags. The catalog (inventory/testimonials) falls back to the built-in
  // SEED set while the cloud collection is empty, so the public site is never blank. The
  // downside: deleting a seed-backed item just re-appears from the fallback. Fix: the first
  // time the user mutates the catalog we MATERIALISE the seeds into the cloud and set an
  // "init" flag; after that the fallback is disabled, so deletes (even down to empty) stick.
  async function catMeta(){ try{ const {db,fs}=await ensure(); const s=await fs.getDoc(fs.doc(db,"settings","catalog")); return s.exists()?s.data():{}; }catch(e){ return {}; } }
  async function materialize(name,seed,flag){
    const m=await catMeta(); if(m[flag]) return;
    const cur=await all(name);
    if(!cur.length){ for(const it of seed){ const d={...it}; const id=d.id; delete d.id; await put(name,id,d); } }
    try{ await put("settings","catalog",{[flag]:true}); }catch(e){}
  }
  return {
    ensure, _fb:()=>fb,
    // SAFETY: if the cloud catalog is empty (never migrated / offline), fall back to
    // the built-in catalogue so the public site NEVER goes blank.
    async projects(){ const l=await all("projects"); const out=l.length?l:clone(SEED_PROJECTS); if(l.length) writeProjCache(l); return out; },
    // Instant, cache-first list (used to paint the listing before the network returns).
    projectsCached(){ const c=readProjCache(); return c?c.list:null; },
    async projectsRaw(){ return all("projects"); },   // no fallback — used by the migration check
    // Resilient single-project read. Order: live doc → per-tab cache → full list → seed.
    // A slow/failed network read no longer produces a false "project not found".
    async project(id){
      try{
        const {db,fs}=await ensure();
        const s=await fs.getDoc(fs.doc(db,"projects",id));
        if(s.exists()){ const p={id:s.id,...s.data()}; return p; }
      }catch(e){ /* offline / slow — fall back below */ }
      const cached=cachedProject(id); if(cached) return cached;
      try{ const l=await all("projects"); if(l.length){ writeProjCache(l); const hit=l.find(p=>p.id===id); if(hit) return hit; } }catch(e){}
      const seed=SEED_PROJECTS.find(p=>p.id===id); return seed?clone(seed):null;
    },
    async saveProject(p){ const id=p.id; const d={...p}; delete d.id; return put("projects",id,d); },
    async deleteProject(id){ return del("projects",id); },
    async inventory(){ const l=await all("inventory"); if(l.length) return l; const m=await catMeta(); return m.inventoryInit?[]:clone(SEED_INVENTORY); },
    async inventoryFor(name){ const l=await this.inventory(); return l.filter(u=>norm(u.project)===norm(name)); },
    async saveUnit(u){ await materialize("inventory",SEED_INVENTORY,"inventoryInit"); const id=u.id||invId(u.project,u.unitNo); const d={...u}; delete d.id; return put("inventory",id,d); },
    async deleteUnit(id){ await materialize("inventory",SEED_INVENTORY,"inventoryInit"); return del("inventory",id); },
    async enquiries(){ const l=await all("enquiries"); return l.sort((a,b)=>(b.ts||0)-(a.ts||0)); },
    async addEnquiry(e){ e.ts=e.ts||Date.now(); e.status=e.status||"Open"; return put("enquiries",null,e); },
    async updateEnquiry(id,patch){ return put("enquiries",id,patch); },
    async deleteEnquiry(id){ return del("enquiries",id); },
    async partners(){ return all("partners"); },
    async savePartner(p){ const id=p.id; const d={...p}; delete d.id; return put("partners",id,d); },
    async deletePartner(id){ return del("partners",id); },
    async testimonials(af){
      if(af){ // ADMIN wants everything (incl. pending). Rules require admin auth.
        const l=await all("testimonials"); if(l.length) return l;
        const m=await catMeta(); return m.testimonialsInit?[]:clone(SEED_TESTIMONIALS);
      }
      // PUBLIC: query approved-only so the security rule permits the read and no
      // pending/unmoderated content is ever exposed.
      try{
        const {db,fs}=await ensure();
        const snap=await fs.getDocs(fs.query(fs.collection(db,"testimonials"), fs.where("approved","==",true)));
        const l=snap.docs.map(d=>({id:d.id,...d.data()}));
        if(l.length) return l;
        const m=await catMeta(); return m.testimonialsInit?[]:clone(SEED_TESTIMONIALS).filter(x=>x.approved);
      }catch(e){ return clone(SEED_TESTIMONIALS).filter(x=>x.approved); }
    },
    // The PUBLIC doc carries only masked contact hints. Full contact goes to the
    // admin-only `testimonial_contacts` collection (visitors may create, only you read).
    async addTestimonial(t){
      await materialize("testimonials",SEED_TESTIMONIALS,"testimonialsInit");
      const pub={ name:t.name||"", role:t.role||"", text:t.text||"", rating:t.rating||5, who:t.who||"",
        mobileMasked:maskMobile(t.mobile), emailMasked:maskEmail(t.email), approved:false, ts:Date.now() };
      const saved=await put("testimonials",null,pub);
      if(t.mobile||t.email){ try{ await put("testimonial_contacts",saved.id,{ name:t.name||"", mobile:t.mobile||"", email:t.email||"", who:t.who||"", ts:Date.now() }); }catch(e){} }
      return saved;
    },
    async testimonialContacts(){ try{ return await all("testimonial_contacts"); }catch(e){ return []; } },
    async setTestimonialApproved(id,v){ await materialize("testimonials",SEED_TESTIMONIALS,"testimonialsInit"); return put("testimonials",id,{approved:v}); },
    async deleteTestimonial(id){ await materialize("testimonials",SEED_TESTIMONIALS,"testimonialsInit"); try{ await del("testimonial_contacts",id); }catch(e){} return del("testimonials",id); },
    async bulkUpsertProjects(rows){ const cur=await all("projects"); const r=mergeProjects(cur,rows); for(const p of r.list){ const id=p.id; const d={...p}; delete d.id; await put("projects",id,d); } return r.report; },
    async bulkUpsertInventory(rows){ const cur=await all("inventory"); const r=mergeInventory(cur,rows); for(const u of r.list){ const id=u.id; const d={...u}; delete d.id; await put("inventory",id,d); } return r.report; },
    async customers(){ return all("customers"); },
    async saveCustomer(c){ const id=c.id; const d={...c}; delete d.id; if(!d.code) d.code="CUST-"+Date.now().toString().slice(-4); d.lastTs=Date.now(); if(!d.createdTs) d.createdTs=Date.now(); return put("customers",id,d); },
    async deleteCustomer(id){ return del("customers",id); },
    async tasks(){ return all("tasks"); },
    async saveTask(t){ const id=t.id; const d={...t}; delete d.id; if(!d.ts) d.ts=Date.now(); return put("tasks",id,d); },
    async deleteTask(id){ return del("tasks",id); },
    async targets(){ const {db,fs}=await ensure(); const s=await fs.getDoc(fs.doc(db,"settings","targets")); return s.exists()?s.data():{month:new Date().toISOString().slice(0,7),target:50}; },
    async saveTargets(t){ return put("settings","targets",t); }
  };
})();

function mergeProjects(existing,incoming){
  const map=new Map(); existing.forEach(p=>map.set(norm(p.name),p)); let added=0,merged=0,skipped=0;
  incoming.forEach(row=>{ const name=(row.name||row["Project Name"]||"").toString().trim(); if(!name){ skipped++; return; }
    const key=norm(name); const rec={ name, location:row.location||row.Location||"", category:normalizeCategory(row.category||row.Category), type:normalizeType(row.type||row.Type), paymentPlan:row.paymentPlan||row["Payment Plan"]||row["payment plan"]||"", priceFromCr:parseCr(row.priceFromCr||row["Starting Price (Cr)"]||row["Starting Price"]||row.Price||""), config:row.config||row.Configuration||row.Config||"", possession:row.possession||row.Possession||"", image:row.image||row["Image URL"]||row.Image||"", description:row.description||row.Description||row.about||"" };
    if(map.has(key)){ const cur=map.get(key); Object.keys(rec).forEach(k=>{ if(rec[k]!==""&&rec[k]!=null&&rec[k]!==0) cur[k]=rec[k]; }); if(rec.description) cur.about=rec.description; if(rec.priceFromCr) cur.priceLabel="₹"+rec.priceFromCr+" Cr onwards"; merged++; }
    else { rec.id=key.replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")||uid(); rec.about=rec.description; rec.type=rec.type||guessType(rec.category,name); rec.priceLabel=rec.priceFromCr?("₹"+rec.priceFromCr+" Cr onwards"):""; rec.why=["Prime location with strong connectivity.","Trusted BPTP build quality.","Attractive entry with upside potential."]; rec.usp=["Premium specifications","Well-planned amenities","RERA-registered BPTP development"]; rec.roi={entryPriceCr:rec.priceFromCr||3,apprRate:12,rentalYield:3,holdYears:5}; map.set(key,rec); added++; } });
  return { list:Array.from(map.values()), report:{added,merged,skipped,total:map.size} };
}
function mergeInventory(existing,incoming){
  const map=new Map(); existing.forEach(u=>map.set(invId(u.project,u.unitNo),u)); let added=0,merged=0,skipped=0;
  incoming.forEach(row=>{ const project=(row.project||row["Project Name"]||"").toString().trim(); const unitNo=(row.unitNo||row["Unit No"]||row["Unit No."]||row.unit||"").toString().trim(); if(!project||!unitNo){ skipped++; return; }
    const key=invId(project,unitNo); const rec={ project, unitNo, size:(row.size||row.Size||"").toString(), desc:row.desc||row["Unit description"]||row["Unit Description"]||row.description||"", status:normalizeStatus(row.status||row.Status), bsp:parseCr(row.bsp||row.BSP||row["BSP (per sq.ft)"]||""), costingCr:parseCr(row.costingCr||row.Costing||row.costing||row.Cost) };
    if(map.has(key)){ const cur=map.get(key); Object.keys(rec).forEach(k=>{ if(rec[k]!==""&&rec[k]!=null) cur[k]=rec[k]; }); merged++; } else { rec.id=key; map.set(key,rec); added++; } });
  return { list:Array.from(map.values()), report:{added,merged,skipped,total:map.size} };
}
function normalizeCategory(c){ const v=norm(c); if(v.startsWith("ready")) return "Ready to Move"; if(v.startsWith("under")||v.includes("construction")) return "Under Construction"; return c||"Under Construction"; }
function normalizeStatus(s){ const v=norm(s); if(v.startsWith("sold")) return "Sold"; if(v.startsWith("hold")||v.startsWith("block")) return "Hold"; return "Available"; }
function guessType(cat,name){ const v=norm(name); if(v.includes("plot")||v.includes("astaire")) return "Plot"; if(v.includes("floor")||v.includes("amstoria")) return "Floor"; return "High-rise"; }
function normalizeType(t){ const v=norm(t); if(!v) return ""; if(v.includes("plot")) return "Plot"; if(v.includes("floor")) return "Floor"; if(v.includes("high")||v.includes("rise")||v.includes("apartment")||v.includes("tower")) return "High-rise"; return t; }
function parseCr(v){ if(v==null||v==="") return 0; const n=parseFloat(v.toString().replace(/[^0-9.]/g,"")); return isNaN(n)?0:n; }

window.Store = (()=>{
  let adapter=LocalAdapter, mode="local";
  (function pick(){ const cfg=window.APP_CONFIG||{}; const configured=cfg.firebase&&cfg.firebase.apiKey&&cfg.firebase.apiKey!=="YOUR_API_KEY"; const want=cfg.backend||"auto";
    if(want==="firebase"||(want==="auto"&&configured)){ adapter=FirebaseAdapter; mode="firebase"; } else { adapter=LocalAdapter; mode="local"; } })();
  return new Proxy({},{ get(_,prop){ if(prop==="mode") return mode; if(prop==="firebase") return FirebaseAdapter; if(prop==="helpers") return {norm,uid,mergeProjects,mergeInventory,normalizeCategory,normalizeStatus,parseCr}; return (...args)=>adapter[prop](...args); } });
})();
