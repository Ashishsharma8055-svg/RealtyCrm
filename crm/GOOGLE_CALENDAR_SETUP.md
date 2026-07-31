# Automatic Google Calendar sync

When enabled, scheduling a meeting in the CRM (New Enquiry / New Broker with a
follow-up, "Schedule existing", or "Log / Reschedule") automatically inserts that
event into **your Google Calendar**.

It's off until you add a Google OAuth Client ID, because Google requires you to
register the app that's allowed to touch your calendar. One-time setup (~5 min):

## 1. Enable the Google Calendar API
- Go to <https://console.cloud.google.com> and select your Firebase project
  (`realtycrm-e2edf` — the Firebase project is a Google Cloud project).
- **APIs & Services → Library** → search **Google Calendar API** → **Enable**.

## 2. Configure the OAuth consent screen (once)
- **APIs & Services → OAuth consent screen** → User type **External** → fill app
  name + your email → Save. Under **Test users**, add your own Google email
  (while the app is in "testing", only listed users can grant access — that's fine
  for you).

## 3. Create an OAuth Client ID (Web)
- **APIs & Services → Credentials → Create credentials → OAuth client ID**.
- Application type: **Web application**.
- **Authorized JavaScript origins** — add exactly where you open the CRM:
  - `http://localhost:5500` and `http://127.0.0.1:5500` (VS Code Live Server), and/or
  - `https://your-username.github.io` (GitHub Pages).
- Create → copy the **Client ID** (looks like `1234-abc.apps.googleusercontent.com`).

## 4. Paste the Client ID into the app
- Open `app.js`, find:
  ```js
  const GCAL_CLIENT_ID = "";
  ```
  and put your ID between the quotes:
  ```js
  const GCAL_CLIENT_ID = "1234-abc.apps.googleusercontent.com";
  ```
- Save, reload the CRM.

## 5. Connect
- Sidebar → **Connect Google Calendar** → approve the Google popup (grant calendar
  access). You only do this once per browser session.
- Now schedule a meeting anywhere in the CRM — it appears in your Google Calendar
  automatically. (You'll see an "Added to Google Calendar" toast.)

## Which calendar
- Events go to the calendar set in `GCAL_CALENDAR_ID` in `app.js`. It's pre-set to a
  **"Realty Cafe"** calendar. To use a different one: Google Calendar → hover the
  calendar → ⋮ → **Settings and sharing** → **Integrate calendar** → copy the
  **Calendar ID**, and paste it into `GCAL_CALENDAR_ID`. Use `"primary"` for your
  default calendar. You must have edit access to whichever calendar you choose.

## Notes
- Each event is a 1-hour block at the follow-up time.
- **Full two-way sync:** creating a follow-up **adds** the event; editing or
  rescheduling **updates** it (one event per record, no duplicates); cancelling the
  follow-up **deletes** it. The record remembers its event via a stored `gcal_event_id`.
- Access is limited to the `calendar.events` scope — the app cannot see anything else
  in your Google account.
- You can still use the per-day **＋ Google** link or the **Export .ics** button as a
  manual alternative.
- The OAuth token lives only in memory for the session; nothing sensitive is stored.
- For fully hands-off, server-side sync (even when the app isn't open), that would be
  a Firebase Cloud Function using a stored refresh token — ask if you want that later.
