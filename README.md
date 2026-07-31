# Coffee &amp; Deals — Real Estate Website + CRM

A trust-first personal brand website and lightweight CRM for **Ashish Sharma** (coffeeanddeals.in). Clean near-white "Monteire-style" design, BPTP projects only, smooth momentum scrolling, live-inventory access gated by mobile OTP, and a full admin panel.

Runs **instantly with zero setup** (local demo data); switches to **Google Firebase** when you paste your config.

## ⭐ Merged project: Website + CRM (start here)

This one folder now holds **both** of your sites, sharing **one** Google Firebase
database (`realtycrm-e2edf`):

| Open this | You get |
|---|---|
| `index.html` | Your **personal website** (Coffee & Deals). |
| `crm.html`   | Your **RealtyCRM** (it lives in `/crm/`; `crm.html` just forwards there). |

### ▶️ Test it right now in VS Code (zero setup)
1. Open this folder in VS Code (**File → Open Folder**).
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click **`index.html` → "Open with Live Server"** — the website opens.
   Browse projects, open a project page, unlock inventory, send an enquiry.
4. In the address bar change `index.html` to **`crm.html`** — the CRM opens.
   Sign in with **`admin`** / **`admin123`**. It starts pre-loaded with sample
   leads, brokers and projects so you can click around immediately.

That's it — nothing to configure. The CRM runs in **local test mode** (data saved
in your browser). When you're ready for the shared cloud database + automatic
website→CRM lead flow, open `crm/index.html`, change the one line
`const CRM_MODE = "local"` to `"cloud"`, and do the four Firebase steps below.

**How leads flow, automatically (in cloud mode):** when a visitor unlocks live inventory or sends
an enquiry on the website, that lead is written to the shared cloud database. The
next time you open the CRM and sign in, those website leads appear as new leads in
RealtyCRM (source = *Website*, or the channel-partner firm if they marked themselves
an agent). No copy-paste, no duplicates.

**Why the website needs no Firebase setup to run:** the public catalog (projects,
inventory, testimonials) stays in local mode, so browsing works instantly. Only the
*leads* are sent to the cloud (see `js/lead-relay.js`). You can move the catalog to
Firebase later too, but you don't have to.

### Real SMS OTP on lead capture (now ON)
The "Unlock Live Inventory" gate now uses **real Firebase Phone Authentication**
(`otpMode: "firebase"` in `js/firebase-config.js`), not the old on-screen demo code.
A visitor enters their mobile, gets a real SMS code, and must verify it to proceed.
To make it work, in the Firebase console for **realtycrm-e2edf**:
1. **Authentication → Sign-in method → Phone → Enable.**
2. **Authentication → Settings → Authorized domains** — `localhost` is already allowed
   (Live Server works); add `coffeeanddeals.in` / your GitHub Pages domain for production.
3. **Real SMS to any number** needs the project on the **Blaze** plan.
   To test the full flow **without** sending SMS or upgrading, add a test number under
   **Authentication → Phone → "Phone numbers for testing"** (number + a fixed code) and
   use those on the site. Set `otpMode` back to `"demo"` anytime for the on-screen code.

### One-time Firebase console steps (do these once)
1. **Authentication → Sign-in method → Email/Password → Enable.** Then **Users → Add
   user**: use `ashishsharma8055@gmail.com` and a password. That's your CRM login.
2. **Firestore Database → Create database** (production mode, pick a region).
3. **Firestore → Rules →** paste the contents of `firestore.rules` (in this folder)
   and **Publish**. (To add a teammate later, add their email to the list at the top
   of that file and re-publish.)
4. **Authentication → Settings → Authorized domains → Add domain** for wherever you
   open the site (`localhost` is already allowed; add `your-username.github.io` or
   `coffeeanddeals.in` when you go live).

Then open `crm.html`, sign in, and your CRM data lives in Firestore. Open a project
page on the website, unlock inventory, and watch the lead show up in the CRM.

### Folder map (after merge)
- `index.html`, `project.html`, `insights.html` — the public website
- `admin.html` — the website's built-in light content/CRM panel (kept for editing the
  catalog; not linked in the public menu)
- `crm.html` → `/crm/` — **RealtyCRM**, your main working CRM. Now also includes:
  - **Digital Enquiry** — every website enquiry, shown as-is (lead code, name, mobile,
    interested projects/units, status). Click **→ Transfer** to open a **pre-filled New
    Enquiry** matched to the website record: name & mobile, enquiry type **CP+CL** (agent)
    or **CL** (direct), source **CP/CL**, projects + the exact units they viewed, a
    **requirement analysis** derived from the project type(s) — Plot / Floor / H-rise
    (multiple if they looked at several), and a lead number **DIGI-&lt;code&gt;** so it's
    clearly a digital lead. Review and Save. Already-transferred ones show **✓ In CRM**
    (deduped by lead code, so no doubles). **Transfer all new** bulk-imports the rest.
  - **Inventory** — units across projects (Project, Unit No, Size, Description, Status,
    BSP, Costing) with Add/Edit/Delete and CSV Template/Import/Export.
  - **Projects** — auto-populated with your real BPTP projects (shared with the website).
- `js/lead-relay.js` — sends website enquiries to the shared cloud database
- `firestore.rules` — one merged rules file protecting both apps

## Run it in VS Code (Live Server)
1. Unzip this folder and open it in VS Code (File → Open Folder → pick the `coffeeanddeals-website` folder).
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click **`index.html`** → **"Open with Live Server"** (or click **Go Live**).
4. Use Live Server (http://), not by double-clicking the file — `file://` blocks the Firebase module and the smooth-scroll library.

Admin passcode: **`coffee-admin`**

## Files
- `index.html` — home (hero, stats, projects, services, process, about, testimonials, insights, FAQ, CTA)
- `project.html` — project detail (light header, full-width cover, ROI calculator, OTP live inventory)
- `insights.html` — three market articles
- `admin.html` — CRM (projects, inventory, enquiries, channel partners, moderation, Excel import)
- `css/`, `js/`, `assets/`, `firebase.json`, `firestore.rules`

## Change ANY image
Every image lives in `assets/`. Swap a file (same name) and hard-refresh (Cmd/Ctrl+Shift+R), or point to a new one.

| What you see | File | How to change |
|---|---|---|
| Hero image | `assets/hero-cut.png` | Replace it, or set `brand.heroImage` in `js/firebase-config.js`. |
| Your portrait (About) | `assets/ashish.jpg` | Add that file, or set `brand.photo`. |
| Services image | `assets/interior.svg` | Replace, or edit the `src` in `index.html`. |
| Project images | `assets/proj-*.svg` | **Admin → Projects → Edit → Image URL** field (no code), or replace the files. |
| CTA background | `assets/hero-villa.svg` | Replace, or edit the `cta-bg` `src`. |

Supported: `.jpg`, `.png`, `.webp`, `.svg`. Convert `.avif`/`.heic` to `.jpg` first.

## Go live with Firebase (optional)
1. Create a project at console.firebase.google.com; enable Firestore + Authentication (Email/Password; add Phone for real SMS OTP).
2. Paste your web config into `js/firebase-config.js` (leave `backend: "auto"`).
3. Add your admin UID to an `admins` collection in Firestore.
4. `npm i -g firebase-tools && firebase login && firebase deploy --only firestore:rules,hosting`.
5. For real OTP: upgrade to Blaze plan, enable Phone auth, add your domain to Authorized domains, set `otpMode: "firebase"`.

## Security notes
- Firebase web config is not a secret; your data is protected by `firestore.rules` + Auth.
- Never put Admin SDK keys / SMS gateway secrets in client files (there are none here).
- All user-generated content is HTML-escaped (XSS-safe). Security headers set in `firebase.json`.

Only BPTP projects are shown, per current employment. Seeded project details are placeholders — refine them in the admin panel. ROI figures are illustrative, not guaranteed. Verify with official BPTP/RERA sources before transacting.
