/* ============================================================================
   Coffee & Deals — AI Voice Calling backend (ElevenLabs)
   ----------------------------------------------------------------------------
   This is the ONLY place that can actually dial a phone. It holds your secret
   keys (never the website). It re-checks every safety rule on the server so
   nobody can ever be bombarded, even if something goes wrong on the front end.

   You do NOT need to understand this file. Follow SETUP_AI_CALLING.md:
     1) create the 3 ElevenLabs secrets,
     2) run:  firebase deploy --only functions
   Until you do that, the CRM stays in Safe Mode and nothing here runs.
   ============================================================================ */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// Your three ElevenLabs values (set once with `firebase functions:secrets:set ...`)
const ELEVENLABS_API_KEY = defineSecret("ELEVENLABS_API_KEY");
const ELEVENLABS_AGENT_ID = defineSecret("ELEVENLABS_AGENT_ID");
const ELEVENLABS_PHONE_ID = defineSecret("ELEVENLABS_PHONE_ID");

// ---- Safety limits (server-enforced; keep these equal to or stricter than the CRM) ----
const WINDOW_START = 9;      // 9 AM IST
const WINDOW_END = 20;       // 8 PM IST (exclusive)
const PER_DAY_MAX = 1;       // max calls to one number per day
const COOLDOWN_H = 20;       // min hours between calls to one number
const GLOBAL_DAILY_CAP = 100;// safety valve across ALL numbers

const istNow = () => { const n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + 5.5 * 3600000); };
const istDay = (d) => (d || istNow()).toISOString().slice(0, 10);
const digits = (s) => String(s || "").replace(/\D/g, "");
const e164IN = (s) => { const d = digits(s); return d.length > 10 ? "+" + d : "+91" + d; };

// Read the live settings the user controls in the CRM's Call Center (window, caps,
// pause, auto/manual switches). Falls back to the safe defaults above if unset.
async function getCallCfg() {
  const d = { paused: false, autoEnabled: true, manualEnabled: true, winStart: WINDOW_START, winEnd: WINDOW_END, perDayMax: PER_DAY_MAX, cooldownH: COOLDOWN_H, globalDailyCap: GLOBAL_DAILY_CAP };
  try {
    const snap = await db.collection("crm").doc("state").get();
    const c = (snap.exists && snap.data().call_settings) || {};
    return {
      paused: !!c.paused,
      autoEnabled: c.autoEnabled != null ? !!c.autoEnabled : true,
      manualEnabled: c.manualEnabled != null ? !!c.manualEnabled : true,
      winStart: c.winStart != null ? c.winStart : d.winStart,
      winEnd: c.winEnd != null ? c.winEnd : d.winEnd,
      perDayMax: c.perDayMax || d.perDayMax,
      cooldownH: c.cooldownH || d.cooldownH,
      globalDailyCap: c.globalDailyCap || d.globalDailyCap,
      agentId: c.agentId || "",
    };
  } catch (e) { return d; }
}
// Returns null if OK to call, or a short reason string if it must be skipped.
// Uses only single-field queries (no composite Firestore index needed) and filters
// in memory, so it can never fail on a "query requires an index" error.
async function serverGuard(job, cfg) {
  const num = digits(job.number);
  if (num.length < 10) return "invalid number";
  if (cfg.paused) return "calling is paused (kill switch)";
  if (job.trigger === "manual" && !cfg.manualEnabled) return "manual calls are turned off";
  if (job.trigger !== "manual" && !cfg.autoEnabled) return "automatic calls are turned off";
  const h = istNow().getHours();
  if (h < cfg.winStart || h >= cfg.winEnd) return `outside calling window (${cfg.winStart}-${cfg.winEnd} IST)`;

  const dnc = await db.collection("call_dnc").doc(num).get();
  if (dnc.exists) return "on do-not-call list";

  const today = istDay();
  const since = Date.now() - cfg.cooldownH * 3600000;

  // Cooldown + per-day cap: one simple query for this number, then check in memory.
  const hist = await db.collection("call_history").where("number", "==", num).get();
  let mostRecent = 0, todayCount = 0;
  hist.forEach((d) => { const x = d.data() || {}; if ((x.ts || 0) > mostRecent) mostRecent = x.ts || 0; if (x.dayIST === today) todayCount++; });
  if (mostRecent > since) return "cooldown";
  if (todayCount >= cfg.perDayMax) return "daily limit for number";

  // Global daily safety cap (single-field query — no index needed).
  const globalHits = await db.collection("call_history").where("dayIST", "==", today).limit(cfg.globalDailyCap).get();
  if (globalHits.size >= cfg.globalDailyCap) return "global daily cap";

  return null;
}

async function placeElevenLabsCall(job, cfg) {
  // One agent for all calls; optional override from Call Center, else the deployed default.
  const agentId = (cfg && cfg.agentId) || ELEVENLABS_AGENT_ID.value();
  const body = {
    agent_id: agentId,
    agent_phone_number_id: ELEVENLABS_PHONE_ID.value(),
    to_number: e164IN(job.number),
    call_recording_enabled: true,   // also have Twilio record the call so you can listen later
    conversation_initiation_client_data: {
      dynamic_variables: {
        message: job.message || "",              // the natural opening line
        objective: job.objective || "",          // e.g. "CP Meeting Fix" — drives the agent's goal
        customer_name: job.customer_name || job.name || "there",
        cp_name: job.broker_name || "",
        broker_name: job.broker_name || "",
        client_ref: job.client_ref || "your client",
        project: job.project || "",
        next_stage: job.followup_kind || "",
        next_date: job.followup_date || (job.meeting_time || "").slice(0, 10) || "",
        meeting_time: job.meeting_time || "",
        greeting: job.greeting || "",
        party: job.party || "",
        trigger: job.trigger || "",
      },
    },
  };
  const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY.value(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("ElevenLabs " + res.status + " · " + text.slice(0, 200));
  return JSON.parse(text || "{}");
}

// Every job the CRM drops into `call_queue` runs through here.
exports.dialQueuedCall = onDocumentCreated(
  { document: "call_queue/{id}", secrets: [ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, ELEVENLABS_PHONE_ID] },
  async (event) => {
    const snap = event.data; if (!snap) return;
    const job = snap.data() || {};
    console.log("dialQueuedCall received", { number: digits(job.number), trigger: job.trigger, status: job.status });
    if (job.status && job.status !== "pending" && job.status !== "queued") { console.log("skip: already handled, status", job.status); return; }

    try {
      const cfg = await getCallCfg();
      const reason = await serverGuard(job, cfg);
      if (reason) { console.log("guard skipped:", reason); await snap.ref.update({ status: "skipped", reason, handledAt: Date.now() }); return; }
      const out = await placeElevenLabsCall(job, cfg);
      await db.collection("call_history").add({
        number: digits(job.number), party: job.party || "", trigger: job.trigger || "",
        ts: Date.now(), dayIST: istDay(), conversationId: out.conversation_id || "", callSid: out.callSid || "",
      });
      await snap.ref.update({ status: "sent", conversationId: out.conversation_id || "", handledAt: Date.now() });
      console.log("call SENT to", digits(job.number), "conversation", out.conversation_id || "");
    } catch (err) {
      const msg = String(err && err.message || err).slice(0, 400);
      console.error("call FAILED:", msg);
      await snap.ref.update({ status: "failed", reason: msg, handledAt: Date.now() });
    }
  }
);

// Meeting reminders — runs every morning at 10 AM IST. Rule (Ashish's spec):
//   remind when a lead is ACTIVE, stage is "Call", the follow-up type is "Site Visit",
//   and the follow-up date is TODAY. The reminder goes to the CHANNEL PARTNER (CP),
//   only if that lead has CP auto-calls on and the CP is Live. Fires once per lead/day.
exports.reminderSweep = onSchedule(
  { schedule: "0 10 * * *", timeZone: "Asia/Kolkata" },
  async () => {
    const stateSnap = await db.collection("crm").doc("state").get();
    if (!stateSnap.exists) return;
    const state = stateSnap.data() || {};
    const leads = state.leads || [], brokers = state.brokers || [];
    const todayIST = istDay();

    for (const l of leads) {
      if (l.status !== "Active") continue;
      if (l.stage !== "Call") continue;
      if (String(l.followup_kind || "").toLowerCase() !== "site visit") continue;
      if (String(l.followup_at || "").slice(0, 10) !== todayIST) continue;   // meeting is today
      if (!l.call_broker || !l.source_mobile) continue;                       // CP auto-calls off / no number

      // CP must be Live (not terminated).
      const num = digits(l.source_mobile);
      const cp = brokers.find((b) => digits(b.mobiles).includes(num)) || brokers.find((b) => (b.name || "").toLowerCase() === (l.source_name || "").toLowerCase());
      if (cp && cp.connect !== "Live") continue;

      const key = `${l.id}_broker_reminder_${todayIST}`;
      const ref = db.collection("reminders_sent").doc(key);
      if ((await ref.get()).exists) continue;                                 // already reminded today
      await ref.set({ ts: Date.now() });

      const project = (l.projects_shared || [])[0] || "";
      const client_ref = l.customer_name || "your client";
      const stage = l.followup_kind || "site meeting";
      const date = String(l.followup_at || "").slice(0, 10) || "today";
      const message = `Dear ${l.source_name || "there"}, this is Ashish Sharma. Just a warm reminder, with thanks — we have a ${stage} scheduled on ${date} with ${client_ref} for ${project || "the project"}. I truly appreciate your support and coordination, and I am confident we will make this a great opportunity together. I hope for the best, and look forward to it.`;
      await db.collection("call_queue").add({
        status: "pending", createdAt: Date.now(), party: "broker", number: num, name: l.source_name || "",
        objective: "CP Meeting Reminder", broker_name: l.source_name || "", customer_name: l.customer_name || "", client_ref, project,
        followup_kind: stage, followup_date: date, meeting_time: String(l.followup_at), greeting: "Good Morning", trigger: "reminder", leadId: l.id, message,
      });
    }
  }
);
