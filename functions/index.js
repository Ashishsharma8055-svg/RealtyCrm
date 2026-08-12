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

// Returns null if OK to call, or a short reason string if it must be skipped.
async function serverGuard(job) {
  const num = digits(job.number);
  if (num.length < 10) return "invalid number";
  const h = istNow().getHours();
  if (h < WINDOW_START || h >= WINDOW_END) return "outside calling window";

  const dnc = await db.collection("call_dnc").doc(num).get();
  if (dnc.exists) return "on do-not-call list";

  const today = istDay();
  const since = Date.now() - COOLDOWN_H * 3600000;

  // Cooldown: most recent completed call to this number.
  const recent = await db.collection("call_history").where("number", "==", num)
    .orderBy("ts", "desc").limit(1).get();
  if (!recent.empty && (recent.docs[0].data().ts || 0) > since) return "cooldown";

  // Per-day cap for this number.
  const dayHits = await db.collection("call_history").where("number", "==", num)
    .where("dayIST", "==", today).limit(PER_DAY_MAX).get();
  if (dayHits.size >= PER_DAY_MAX) return "daily limit for number";

  // Global daily safety cap.
  const globalHits = await db.collection("call_history").where("dayIST", "==", today)
    .limit(GLOBAL_DAILY_CAP).get();
  if (globalHits.size >= GLOBAL_DAILY_CAP) return "global daily cap";

  return null;
}

async function placeElevenLabsCall(job) {
  const body = {
    agent_id: ELEVENLABS_AGENT_ID.value(),
    agent_phone_number_id: ELEVENLABS_PHONE_ID.value(),
    to_number: e164IN(job.number),
    conversation_initiation_client_data: {
      dynamic_variables: {
        customer_name: job.name || "there",
        party: job.party || "",
        trigger: job.trigger || "",
        project: job.project || "",
        meeting_time: job.meeting_time || "",
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
    if (job.status && job.status !== "pending") return; // already handled

    const reason = await serverGuard(job);
    if (reason) { await snap.ref.update({ status: "skipped", reason, handledAt: Date.now() }); return; }

    try {
      const out = await placeElevenLabsCall(job);
      await db.collection("call_history").add({
        number: digits(job.number), party: job.party || "", trigger: job.trigger || "",
        ts: Date.now(), dayIST: istDay(), conversationId: out.conversation_id || "", callSid: out.callSid || "",
      });
      await snap.ref.update({ status: "sent", conversationId: out.conversation_id || "", handledAt: Date.now() });
    } catch (err) {
      await snap.ref.update({ status: "failed", reason: String(err && err.message || err).slice(0, 300), handledAt: Date.now() });
    }
  }
);

// Meeting reminders: runs every morning at 9 AM IST. Reads the CRM state, finds
// meetings due today/tomorrow with the auto-call toggle on, and queues ONE reminder each.
exports.reminderSweep = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Kolkata" },
  async () => {
    const stateSnap = await db.collection("crm").doc("state").get();
    if (!stateSnap.exists) return;
    const leads = (stateSnap.data().leads) || [];
    const now = Date.now(), horizon = now + 24 * 3600000;

    for (const l of leads) {
      if (!l.followup_at) continue;
      const t = Date.parse(String(l.followup_at).replace(" ", "T"));
      if (isNaN(t) || t < now || t > horizon) continue; // only next 24h

      const project = (l.projects_shared || [])[0] || "";
      const meeting_time = String(l.followup_at);
      const mark = async (party, number, name) => {
        const key = `${l.id}_${party}_reminder_${istDay()}`;
        const ref = db.collection("reminders_sent").doc(key);
        if ((await ref.get()).exists) return;           // already reminded today — never repeat
        await ref.set({ ts: Date.now() });
        await db.collection("call_queue").add({ status: "pending", createdAt: Date.now(), party, number, name, leadId: l.id, trigger: "reminder", project, meeting_time });
      };
      if (l.call_customer && l.customer_mobile) await mark("customer", l.customer_mobile, l.customer_name);
      if (l.call_broker && l.source_mobile) await mark("broker", l.source_mobile, l.source_name);
    }
  }
);
