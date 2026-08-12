# AI Voice Calling — Setup Guide (for beginners)

This adds automatic + manual **AI phone calls** to your CRM using **ElevenLabs**.
It is built to be **safe first**: right now it is in **Safe Mode**, which means it
**logs who would be called but never actually dials anyone.** You can use and trust
it today, and only switch on real calls when you're ready.

Nobody gets bombarded — ever. Every call (manual or automatic) must pass **all** of
these limits before it can go out:

- Calling hours only **9 AM – 8 PM IST**
- **Max 1 call per person per day** + a **20-hour cooldown**
- Each automatic message (thank-you / reminder) fires **once per lead, never repeats**
- **Only Active** channel partners and **contact-in-future** customers are ever called
- A per-lead **on/off toggle** for customer and CP
- A **Do-Not-Call list**, a **Pause-everything kill switch**, and a **global daily cap**

---

## PART A — Use it today (Safe Mode, no accounts needed)

Nothing here makes real calls. It just proves the system behaves correctly.

1. Open the CRM → left sidebar → **Settings → Call Center (AI calls)**.
   You'll see a green **SAFE MODE** banner. Leave it as-is.
2. Open any **Enquiry** → scroll to the new **AI Voice Calling** section → tick
   *Auto-call customer* and/or *Auto-call channel partner* → **Save**.
3. Open a **Lead Profile** → use the **📞 Call customer / 📞 Call CP** buttons.
4. Go back to **Call Center** → the **Call history** table shows every attempt and,
   for anything skipped, the exact reason (e.g. "outside calling hours").

Watch it for a few days. When the log looks right, do Part B to go live.

---

## PART B — Turn on real calls (do this only when ready)

You need two accounts: **ElevenLabs** (the voice/AI) and **Twilio** (the phone line).

### Step 1 — ElevenLabs API key
1. Sign in at **elevenlabs.io** → top-right profile → **API Keys → Create**.
2. Copy the key (starts with `sk_...`). This is your **ELEVENLABS_API_KEY**.

### Step 2 — Create your calling agent + script
1. ElevenLabs → **Agents → Create agent**. Pick a voice + language (Hindi/English).
2. In the agent's first message / prompt, use these placeholders — the CRM fills them in:
   *"Hello {{customer_name}}, this is Ashish's team from Coffee & Deals about {{project}}. {{trigger}}…"*
3. Copy the agent's ID → this is your **ELEVENLABS_AGENT_ID**.
   *(Tip: you can keep one agent and branch on the `{{trigger}}` variable — thank-you vs reminder — or make separate agents.)*

### Step 3 — Connect a Twilio phone number
1. In **Twilio**, buy/verify a phone number.
2. ElevenLabs → **Phone Numbers → Import / Connect Twilio** → follow the steps.
3. Copy the phone number's ID → this is your **ELEVENLABS_PHONE_ID**.

### Step 4 — ⚠️ India compliance (don't skip)
Automated voice calls to Indian mobiles are regulated (TRAI / DLT), and Twilio needs
regulatory bundles for Indian numbers. **Confirm the current requirements before going
live.** Your rules (Active CPs, contact-in-future customers, opt-out list) already give
you a clean consent basis — keep records.

### Step 5 — Deploy the backend (one time)
The `functions/` folder is already in your project. In a terminal, from the project folder:

```bash
npm install -g firebase-tools        # if you don't have it
firebase login
# store your 3 secrets (paste each value when asked):
firebase functions:secrets:set ELEVENLABS_API_KEY
firebase functions:secrets:set ELEVENLABS_AGENT_ID
firebase functions:secrets:set ELEVENLABS_PHONE_ID
# deploy:
firebase deploy --only functions
```

### Step 6 — Allow the CRM to queue calls (Firestore rules)
In `firestore.rules`, add these lines inside `match /databases/{db}/documents {` so only
you (admin) can create call jobs, and the server can manage them:

```
match /call_queue/{id}   { allow create: if isAdmin(); allow read, update: if isAdmin(); }
match /call_history/{id}  { allow read: if isAdmin(); }
match /call_dnc/{id}      { allow read, write: if isAdmin(); }
match /reminders_sent/{id}{ allow read: if isAdmin(); }
```

Publish the rules (Firebase console → Firestore → Rules → Publish), or run
`firebase deploy --only firestore:rules`.

### Step 7 — Go live + test on yourself first
1. CRM → **Settings → Call Center** → flip **Go live** (confirm the warning).
2. Add a test lead with **your own** mobile, toggle auto-call on, and press
   **📞 Call customer**. You should get a real call within seconds.
3. Watch **Call history** — it should show `sent`.

That's it. To pause everything instantly at any time, open **Call Center** and tick
**⛔ Pause ALL calls**.

---

## What each call says (triggers)
| Trigger | When it fires | Once only? |
|---|---|---|
| Manual button | You click 📞 on a lead | — |
| Thank-you · enquiry | A new enquiry is saved | Yes, per lead |
| Thank-you · site visit | Lead stage becomes **SVD** | Yes, per lead |
| Meeting reminder | 9 AM the day of / before a meeting | Yes, per lead per day |

You can turn any of these on/off in **Call Center → Which calls are on**.
