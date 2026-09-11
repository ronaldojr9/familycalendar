# Family Hub

A self-hosted, LAN-only family calendar & household hub — a Skylight-Calendar-style organizer you run on your own desktop. One server hosts the app and the data; every device on your home Wi-Fi (wall-mounted iPad, phones, desktop browsers) opens the same URL and stays in real-time sync.

**Features**

- 📅 Shared family calendar — Day / Week / Month views, color-coded per family member, recurring events (daily/weekly/monthly/yearly), multi-member events with striped indicators, per-member filtering, countdown badges for birthdays & trips
- ✅ Chore & routine tracker — per-member daily boards with big kid-friendly tap targets, daily / specific-weekday / one-time chores, morning/afternoon/evening buckets, streaks, and a parent overview grid
- ⭐ Rewards — chores earn stars, parents define a reward catalog, redemptions are PIN-confirmed, full star ledger for auditability
- 📝 Custom lists — groceries (created by default), to-dos, or anything; type-and-enter adding, tap to check off, checked items sink to the bottom
- 🍽️ Meal planning — weekly breakfast/lunch/dinner/snack grid plus a simple recipe box
- 🌤️ Weather strip — current + 3-day forecast via Open-Meteo (no API key)
- 🔒 Parental PIN — a 4-digit PIN gates settings, family profiles, chore/reward management, reward redemption, and list deletion. Viewing anything and checking off chores never needs the PIN.
- 🔄 Real-time sync — every change broadcasts over WebSocket to all connected devices (typically well under a second), with a "reconnecting…" banner if the hub goes down

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run build     # builds the frontend into client/dist
npm start         # starts the hub on http://0.0.0.0:8080
```

The server prints the LAN URL to open on other devices, e.g. `http://192.168.1.20:8080`. First visit walks you through household setup (name, family members + colors, weather city, parent PIN).

- **Port**: set `PORT=9000 npm start` to change it.
- **Data**: everything lives in a single SQLite file at `server/data/familyhub.db` — back that file up and you've backed up the household. Set `FAMILY_HUB_DATA=/some/dir` to relocate it.

### Seeding a household

`npm run seed` fills in a household's people, routines, chore rotation, dinner
plan and recurring events in one shot, so nobody has to tap in fifty chores by
hand. Edit the CONFIG block at the top of `server/scripts/seed-household.js`
(rotation start date, who takes the bins out, the dinner menu, how many weeks of
dinners to write) and run it:

```bash
npm run seed
```

It is safe to re-run: chores are matched on person + title + time of day and
updated in place rather than duplicated, nothing is ever deleted, and a dinner
you planned by hand is never overwritten. Re-run it to extend the dinner plan
further out. Refresh the app afterwards to pick up the changes.

**The seed needs a household to attach things to.** Finish the setup wizard in
the app first, then seed — running it beforehand does nothing but print a
message. To skip the wizard, pass a PIN and the script will create the
household itself: `HUB_PIN=1234 npm run seed` (PowerShell:
`$env:HUB_PIN="1234"; npm run seed`).

### When something looks wrong

```bash
npm run doctor
```

Prints what is checked out, which database file the app is really using, what
is in it, what today's board works out to, and what to do next. It is the first
thing to run when the app looks emptier than it should.

### Chore repeat rules

Beyond "every day" and "certain days", chores support two rules that household
schedules actually need:

| Rule | Means |
| --- | --- |
| `daily` | every day |
| `once` + `due_date` | a one-off |
| `days:0,2,4` | those weekdays (0 = Sunday) |
| `weeks:2:2026-09-05:0,1,2,3,4,5,6` | every other week, weeks running from the anchor date — a Saturday here, so weeks run Sat→Fri |
| …any rule + `\|holiday-shift` | slides one day later when the day before was a holiday |

`weeks:` is how a rotation is expressed: give one child the chore anchored to
their week and the other the same chore anchored a week later, and exactly one
of them has it on any given day — in both directions, so last week's board
still shows whoever really had it. The phase is locked to the anchor date, so
it never drifts.

`|holiday-shift` is trash day: out Tuesday night, except when Monday was a
holiday and the truck runs a day late. US federal holidays are computed in
`server/src/holidays.js` (including observed dates when one falls on a weekend).
Add local no-collection days — city holidays, snow days — in the `extra_holidays`
setting as a comma-separated list of `YYYY-MM-DD`.

Both are editable in the app: the chore editor has an **Every other week** mode
with a start-of-week date, and a holiday checkbox.

### Development

```bash
npm run dev   # server on :8080 with reload + Vite dev server on :5173 (proxies /api and /ws)
npm test      # chore recurrence, rotation and holiday rules
```

### iPad kiosk mode

Open the hub URL in Safari → Share → **Add to Home Screen** for a fullscreen app feel, then enable **Guided Access** (Settings → Accessibility) to lock the iPad to it. The month view is designed as the "at rest" wall display.

### Running as an always-on service

The hub is a single Node process (`npm start` at the repo root, or `node server/src/index.js`). Keep it alive across reboots with whatever fits your OS:

- **any OS**: `npm i -g pm2 && pm2 start server/src/index.js --name family-hub && pm2 save && pm2 startup`
- **Linux**: a systemd unit running `node /path/to/familycalendar/server/src/index.js`
- **macOS**: a LaunchAgent plist; **Windows**: Task Scheduler "At log on" task or NSSM

## Architecture

```
Desktop (always-on host)
└── Node.js + Express  ─ serves REST API under /api/v1
    ├── SQLite (better-sqlite3, WAL) ─ single-file DB in server/data/
    ├── ws WebSocket at /ws ─ broadcasts {type, payload} on every mutation
    └── serves the built React app (client/dist) as static files
```

- **Frontend**: React 18 + Vite, hand-rolled CSS design system, touch-first (44px+ targets), responsive breakpoints for tablet-landscape hub / phone portrait / desktop.
- **Auth model**: no accounts. PIN-gated mutations send the PIN in an `x-family-pin` header; the client prompts once and caches it for the tab session. Event times are stored as local wall-clock strings (one household, one timezone).
- **Weather**: proxied server-side through `/api/v1/weather` with a 15-minute cache.

### API surface (`/api/v1`)

```
GET/POST/PUT        /household            POST /auth/verify-pin
GET/POST/PUT/DELETE /members[/:id]                     (PIN)
GET/POST/PUT/DELETE /events[/:id]?range=A..B
GET                 /events/countdowns
GET/POST/PUT/DELETE /chores[/:id]                      (PIN for CUD)
GET                 /chores/board?date=   /chores/completions?from=&to=
POST                /chores/:id/complete  /chores/:id/uncomplete
GET/POST/PUT/DELETE /rewards[/:id]                     (PIN)
POST                /rewards/:id/redeem                (PIN)
GET                 /stars
GET/POST/PUT/DELETE /lists[/:id]                       (PIN for list DELETE)
POST/PUT/DELETE     /lists/:id/items[/:itemId]         POST /lists/:id/clear-checked
GET/POST            /meal-plan            GET/POST/PUT/DELETE /recipes[/:id]
GET/PUT             /settings                          (PIN for PUT)
GET                 /weather              GET /weather/geocode?q=
WS                  /ws  → {type: "event.updated" | "chore.completed" | …, payload}
```

## Out of scope for v1 (Phase 3 ideas)

External calendar sync (Google/Outlook/CalDAV/ICS), remote away-from-home access (solvable later with Tailscale or a reverse proxy), photo/AI event import, multi-household linking, and the ambient screensaver. The single-server + SQLite + REST/WS shape leaves room for all of these.
