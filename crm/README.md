# RealtyCRM — Developer Sales Suite (local build)

A complete, self-contained CRM for a real estate developer's sales team. It runs entirely in your browser — no install, no server, no internet needed. Your data is saved locally on your computer (in the browser's storage).

## Modules

- **Dashboard (interactive)** — every KPI tile is clickable and drills into the underlying records (e.g. click "Hot Leads" to see the list, "Booked" to see closed deals). The stage chart bars and rating legend are clickable too. Shows a three-bucket follow-up glance, an embedded month **calendar**, and a clearer recent-activity feed (each entry names the exact lead/broker and is clickable).
- **Lead / Broker profile (colourful)** — click any lead or broker name (or the "View" button) to open a rich, colour-coded profile: a gradient header, four colourful "hero" cards (budget, requirement, stage, next follow-up), accented info panels for customer and source/enquiry, projects shared with costing, and the complete **journey timeline** of every logged touchpoint. You can log a new activity, set the next follow-up, edit, or cancel the meeting right from the profile.
- **Stylish enquiry form** — the new-enquiry form uses colour-coded sections with icons (Enquiry, Source, Customer, Projects, Tracking) rather than one long plain form.
- **Smart CP auto-fetch** — when the source is a **CP**, the "Source / CP Name" box suggests your existing channel partners; pick one and their mobile and firm auto-fill (still editable). Type a CP not in the system and saving creates that CP as a new record in Brokers.
- **Smart Customer auto-fill / auto-create** — the Customer "Name" box suggests your existing customers; pick one and mobile, email, city, category and profession auto-fill (editable). **Phone-number match:** type a mobile that already exists and the app asks "Existing customer record found… Auto-fill their details?" — say yes to fill, no to leave it. Type a customer who isn't on file and saving adds them to the Customers directory automatically (matched by name or phone, so no duplicates).
- **Customers view with filters** — the Customers tab (and the dashboard "Customers" tile, which now opens the same page) shows each customer's **Contact-in-future** status as a coloured badge, a live count of how many are contactable, and filters for category (Investor / End-user), contact-in-future (Yes / No), and minimum rating — alongside search.
- **Conditional customer section** — choosing enquiry type **CL** or **CP+CL** shows the Customer Details section; choosing **CP Details Only** hides it (and no customer is captured for that enquiry).
- **Follow-ups (board)** — three buckets shown together: **Today** (split into Client Follow-ups and Broker Meetings), **Upcoming**, and **Missed / Overdue**. Each item has **Log / Reschedule** (opens the activity trail to record the outcome and set the next date) and **Cancel** (logs the cancellation to the record and drops it off the board).
- **Google Calendar sync** — on the Calendar page, **Export to Google Calendar (.ics)** downloads all your scheduled follow-ups/meetings; import it in Google Calendar (Settings → Import) to see them there. Each day's schedule also has a **＋ Google** link that opens Google Calendar pre-filled to add that single meeting. (Live two-way sync would need the Google Calendar API with OAuth — can be added later via a Cloud Function.)
- **Calendar** — a month view with a dot on every date that has a meeting (indigo = client follow-up, amber = broker meeting). Click **any** date to open that day, where you can add a **new enquiry** or **new broker** (with the follow-up pre-set to that date), or **schedule an existing** lead/broker onto that day — which fixes the meeting to that record and logs it. A compact mini-calendar also sits on the dashboard next to Recent Activity. Works the same on phone, tablet, and laptop.
- **Enquiries (Leads)** — the full enquiry entry form: type, requirement, budget, source/CP, customer details, multi-project selection with per-project costing, stage, rating, status, next follow-up, remark. Each lead has an **activity trail** (a running log of calls/meetings with timestamps).
- **Brokers** — channel-partner empanelment: name, multiple mobiles, firm, grade (A/B/C), team size, city/sector, connect status, activity trail, follow-up. The Brokers view (and the dashboard "All Brokers" popup) shows detailed stats — Total, Live, Terminated, **Active (brought a client enquiry)**, and **New in the last 3 months** — plus an "enquiries brought" count and an Active pill on each broker, and filters for all of these. A broker is counted "Active" when their name is the source/CP on at least one enquiry. The stat chips are clickable — click one (e.g. "Active · with client" or "Terminated") to instantly filter the list. Clicking a broker's **enquiries count** ("1 lead") opens a stylish page of exactly those enquiries with their stage and status, and you can open any of them to the full lead profile.
- **Customers** — a customer directory with profession, category (investor/end-user), 1–5 rating, contact-in-future flag, and photo.
- **Projects & Inventory** — projects with type, price range, and unit availability (feeds the enquiry project selector).
- **Reports & Analysis (Power BI–style workspace)** — a tabbed analytics area with its own controls (date Period From/To, a **granularity** selector — Daily / Weekly / Monthly / Quarterly / Half-yearly / Annually — and Export Excel + Print/PDF). Report tabs:
    - **Overview** — interactive KPI tiles plus **Hot / Warm / Cold** and **Call / F2F / SVD / Negotiation / VDNB** tiles: click any tile to reveal the exact matching enquiries in a stylish table below (with click-through to each lead). Also a **Project-wise Active CP** summary. Charts use a modern gradient/rounded style.
    - **Channels / Brokers** — Total, Live, Terminated, Active-with-enquiry, **Never brought an enquiry**, **Had enquiry but now idle (3m+/terminated)**, and **New this week/today/month**. Charts for grade, channel-activity-over-time, city, sector and new-empanelment-over-time. Tables: active channels broken down **status-wise and project-wise** (leads, booked, active, inactive, projects, requirements, last-enquiry date, months idle); idle channels; never-produced channels; and newly empanelled channels with dates.
    - **Enquiries** — interest by requirement, budget band, enquiry type, stage, rating, status, and enquiries-over-time.
    - **Sources** — Channel Partner vs Reference split and a source performance table with per-source conversion.
    - **Projects** — enquiries per project, interested customers, requirement mix and inventory/availability, plus **Active CPs per project**: for each project, the unique channel partners (Firm + CP name, no repeats) with how many enquiries each brought and an at-a-glance A/B/I (Active/Booked/Inactive) split. Click any CP to open a detailed breakdown (status chips + that CP's leads for that project, each opening the full lead profile).
    - **Customers** — investor/end-user split, top locations and professions, rating quality, and this-month **birthdays / anniversaries**.
    - **Match Finder** — pick any combination of Requirement, Budget, Project and Enquiry type (e.g. when a unit becomes available) to instantly list the matching CP+CL / CL enquiries and the interested customers.
  Everything is **interactive like Power BI** — click any bar, card, tag or source/project number to **cross-filter every visual at once**; selections show as removable chips (with "Clear all") and can be stacked. Both the Excel workbook (Summary, Enquiries, Brokers, Customers, Projects) and Print/PDF reflect the current period, filters and view. Export it two ways — **Print / PDF** (prints just the report, sidebar hidden) and **Export Excel** (downloads a multi-sheet `.xls` — Summary, Enquiries, Brokers, Customers, Projects — that opens in Excel; the chosen sections and date period are respected).

### How follow-ups & cancellations work

When you set a "Next follow-up" date on a lead or broker, it appears on the Follow-ups board and as a dot on the Calendar. Use **Log / Reschedule** to record what happened and set the next date. If a meeting is called off, use **Cancel** — it writes a "Cancelled" entry into that record's activity trail (so you keep the history) and removes it from the follow-up list so it no longer shows as pending.

## Signing in

The app opens on a **login screen**. First-time credentials are **admin / admin123** —
change the password immediately from the sidebar (**Change password**), and use
**Log out** when you're done. The session ends when you close the browser tab.

Important: this login is a convenience gate for a single user on their own machine —
it is not server-enforced security, and the data lives in this browser. For a shared,
protected, multi-user setup, see **FIREBASE_SETUP.md** (Firebase Authentication +
Firestore) and the GitHub Pages hosting steps there.

## How to run

**Easiest:** double-click `index.html` — it opens in your browser and works immediately.

**In VS Code (recommended):**
1. Open this `RealtyCRM` folder in VS Code (File → Open Folder).
2. Install the **Live Server** extension (by Ritwick Dey) if you don't have it.
3. Right-click `index.html` → **Open with Live Server**.

That's it. The app runs at a local address like `http://127.0.0.1:5500`.

## Your data

- Everything you enter is saved automatically in your browser's local storage on this computer.
- Use **Backup (export)** in the left sidebar to download all your data as a JSON file, and **Restore (import)** to load it back (e.g. on another computer or after clearing the browser).
- **Load sample data** fills the app with a few example records so you can explore. **Reset all data** clears everything.

> Note: because storage is per-browser, your data lives in the browser you use. Take periodic backups with the Export button. If you later want a shared, multi-user version accessible from any device, that's the hosted database version.

## Files

- `index.html` — page shell and layout
- `styles.css` — all styling (navy sidebar, indigo accents)
- `app.js` — all application logic and data handling
