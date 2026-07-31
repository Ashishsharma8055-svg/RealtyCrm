# Hosting on GitHub + moving the database to Firebase

This guide covers two things: (1) putting the site online with GitHub Pages, and
(2) upgrading from browser storage to a real cloud database (Firebase / Firestore)
with proper login. Written with a security-first mindset — please read the
**Security reality check** first.

---

## ⚠️ The most important security setting

With Email/Password sign-in enabled, anyone who has your (public) `apiKey` could
create their **own** Firebase account. If your Firestore rule only says
`if request.auth != null`, that stranger's account would then be able to read your
data. **So the rule must allow only YOUR account(s) by email:**

```
allow read, write: if request.auth != null
  && request.auth.token.email in ["ashishsharma8055@gmail.com"];
```

Add each staff member's email to that list. This is what actually stops anyone
from seeing the data without a valid, *authorized* login — enforced on Google's
servers, impossible to bypass from the browser. (Publish these rules in
Firestore → Rules.) Optional extra layer: enable **App Check** so only requests
from your real site are accepted.

Also hardened in the app itself:
- **No local copy of cloud data.** In cloud mode the CRM keeps data only in memory
  and in Firestore — it does *not* cache it in the browser's localStorage, so there's
  nothing to read on the device without signing in. Logging out clears memory too.
- **Session expires on browser close.** Auth uses session-only persistence, so
  closing the browser forces a fresh login.

## Security reality check (read this)

The current login screen is a **client-side gate**. It hashes the password (never
stored in plain text) and blocks casual access, but it is **not real security**:

- All app data lives in the browser's `localStorage`, which anyone using that
  computer/profile can read with dev-tools.
- Because the code is static files, a technical user can bypass the gate.

That is perfectly fine for a **single person on their own laptop**. But the moment
you want a **team**, shared data, or data that must be protected, you must move
auth and data to a server you don't fully expose to the client. Firebase does this
for you:

- **Firebase Authentication** verifies users on Google's servers (not in your JS).
- **Firestore security rules** decide, on the server, who can read/write what.
- Your web "API key" in the Firebase config is **public by design** — it only
  identifies the project. Your data is protected by the security *rules*, not by
  hiding the key. Never put private keys/service accounts in the website code.

Also: GitHub Pages serves over **HTTPS** (good — keep it). Take regular **Backups**
(sidebar → Backup) until Firestore is wired in.

---

## Part A — Host the site on GitHub Pages (works today, as-is)

1. Create a free GitHub account and a new **public** repository, e.g. `realty-crm`.
2. Upload the four files (`index.html`, `styles.css`, `app.js`, `README.md`) to the
   repo root (drag-and-drop in the GitHub web UI, or `git push`).
3. Repo → **Settings → Pages** → *Build and deployment* → Source = **Deploy from a
   branch** → Branch = `main`, folder = `/ (root)` → **Save**.
4. Wait ~1 minute. Your site is live at
   `https://<your-username>.github.io/realty-crm/`.
5. Every time you push changes, Pages redeploys automatically.

At this stage the app still stores data **per browser** (localStorage). Use
**Backup/Restore** in the sidebar to move data between devices. To get shared,
multi-device data, do Part B.

---

## Part B — Move the database to Firebase (Firestore) + real login

### 1. Create the Firebase project
- Go to <https://console.firebase.google.com> → **Add project**.
- In the project, **Build → Firestore Database → Create database** (start in
  *production mode*, pick a region).
- **Build → Authentication → Get started → Email/Password → Enable**. Add your
  first user (email + password) under the *Users* tab.

### 2. Register a Web App and copy the config
- Project settings (gear icon) → *Your apps* → **Web app** (`</>`).
- Copy the `firebaseConfig` object it gives you. It looks like:

```js
const firebaseConfig = {
  apiKey: "AIza...",            // public — safe to commit
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "0000000000",
  appId: "1:0000:web:abc123"
};
```

### 3. Lock down Firestore with rules (server-enforced security)
In **Firestore → Rules**, require a signed-in user for everything:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email in ["ashishsharma8055@gmail.com"];   // only logged-in users
    }
  }
}
```
Later, to restrict to specific staff, check `request.auth.token.email in [...]`.

### 4. The app is ALREADY WIRED to Firebase ✅
`index.html` now contains your `firebaseConfig` and the Firebase SDK. When the page
loads and a user signs in, the CRM uses **Firebase Auth** for login and stores all
data in **Firestore** (document `crm/state`). If Firebase can't load, it safely
falls back to the local (browser) mode so the app never breaks.

You only need to finish three things in the Firebase console:

1. **Authentication** → *Sign-in method* → **Email/Password** → **Enable**. Then
   *Users* tab → **Add user** (your email + a password). That email/password is
   your CRM login.
2. **Firestore Database** → **Create database** (production mode, pick a region),
   then **Rules** → paste and publish:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if request.auth != null; }
     }
   }
   ```
3. **Authentication → Settings → Authorized domains** → **Add domain** for wherever
   you open the site:
   - `localhost` and `127.0.0.1` are already allowed (so **Live Server** works now).
   - When you publish on GitHub Pages, add `your-username.github.io`.

That's it — reload the app, sign in with the email/password from step 1, and your
data now lives in Firestore (shared across devices and users).

**Moving your existing local data up:** if you were already using it locally, click
**Backup (export)** first to get the JSON. After signing in to cloud mode, use
**Restore (import)** and pick that file — it loads the data and the app writes it to
Firestore automatically.

**Notes / limits (data-analyst + security view):**
- Data is stored as **one Firestore document** (`crm/state`) for simplicity — great
  to start, but a single doc has a **1 MB limit** (~a few thousand records) and uses
  **last-write-wins** if two people save at the exact same moment. When you outgrow
  that, split into per-collection documents (`leads/{id}`, `brokers/{id}`, …) — ask
  and I'll do that refactor.
- The `apiKey` in `index.html` is **public and safe**; your data is protected by the
  Firestore **rules** above (only signed-in users). Never commit a service-account key.
- Change the login password from the sidebar (**Change password**) — in cloud mode
  it updates the Firebase Auth password (you may be asked to re-login first).

### 5. Bonus for analytics
Firestore can stream to **BigQuery** (Firebase extension "Export Collections to
BigQuery"), so a data analyst can run SQL/Looker Studio dashboards on live CRM
data — on top of the built-in Reports and Excel export.

---

## Future updates you mentioned — where they plug in

- **AI automation / lead scoring / summaries** — best added as **Firebase Cloud
  Functions** (server-side) that call an AI API with a secret key kept in
  Functions config (never in the website). Trigger on new/updated leads.
- **Automatic WhatsApp messaging** — use the **WhatsApp Cloud API** (Meta) or a
  provider like Twilio, called from a Cloud Function (e.g. send a birthday/
  follow-up message). Keep the WhatsApp token as a server secret.
- **AI calls** — an outbound-voice provider (e.g. Twilio Voice + an AI agent)
  triggered from a Cloud Function on a schedule or a button.

All three follow the same safe pattern: **the browser calls your Cloud Function,
the Cloud Function holds the secret keys and talks to the third party.** Never put
API secrets in `app.js`.

---

## Quick reference

| Want | Do |
|---|---|
| Put it online now | Part A (GitHub Pages) |
| Team / shared data | Part B (Firestore + Auth) |
| Real, enforced login | Firebase Authentication + Firestore rules |
| Move existing data up | Backup (export) → import into Firestore |
| Keep a local safety copy | Sidebar → Backup (export) regularly |
