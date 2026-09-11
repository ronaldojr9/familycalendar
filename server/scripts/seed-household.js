// Seeds the Luckow household: family members, morning/night routines, the
// weekly chore rotation, the dinner plan, sports schedules and the Vikings.
//
//   npm run seed
//
// Safe to re-run: everything is matched by name/title and updated in place
// rather than duplicated. Nothing is deleted, so anything you have added or
// edited in the app by hand survives a re-run.
//
// Everything a family would want to change lives in the CONFIG block below.

import { db, getHousehold } from '../src/db.js';
import { hashPin } from '../src/pin.js';
import { addDaysStr } from '../src/recurrence.js';

// ---------------------------------------------------------------------------
// CONFIG — edit these, then re-run `npm run seed`
// ---------------------------------------------------------------------------

// The Saturday that began the week LUKE had dishes. The rotation is locked to
// this date forever, so it stays correct no matter when you re-run the seed.
// Luke has dishes that week, Paul the next, and so on. Whoever is not on
// dishes has counters.
const DISH_ROTATION_START = '2026-09-05';

// The Tuesday of a week that had BOTH trash and recycling. Recycling then
// repeats every other week from here; trash goes out every week.
const RECYCLING_ANCHOR = '2026-09-08';

// Who takes the bins out. Not specified when this was set up — change the name
// here (or just reassign the chore in the app) if it should be someone else.
const TRASH_OWNER = 'John';

// How many weeks of dinners to write. Re-run the seed to extend.
const MEAL_PLAN_WEEKS = 26;

const KIDS = [
  { name: 'Luke', color: '#4D9DE0', avatar: '🧒' },
  { name: 'Paul', color: '#E1AD4E', avatar: '👦' },
  { name: 'John', color: '#3BB273', avatar: '🧑' },
];

// Morning routine — "Ride to School Pass", in the order on the card.
const MORNING_ROUTINE = [
  ['Say good morning to God, Holy Spirit, and Jesus (out loud)', '🙌'],
  ['Give thanks to God, Holy Spirit, and Jesus for something (out loud)', '💛'],
  ['Prayer – Individual (or all 3) (out loud)', '🙏'],
  ['Have breakfast', '🥣'],
  ['Make lunch', '🥪'],
  ['Change clothes', '👕'],
  ['Wash face', '💧'],
  ['Brush / Style hair', '💇'],
  ['Brush teeth', '🦷'],
  ['Gratitude journal', '📓'],
  ['Pray for family', '👨‍👩‍👦'],
];

// Nighttime routine, in the order of the circled numbers on the sheet.
const NIGHT_ROUTINE = [
  ['Pack your lunch', '🎒'],
  ['Shower', '🚿'],
  ['Brush teeth', '🦷'],
  ['Gratitude journal', '📓'],
  ['Bible', '📖'],
  ['Prayer', '🙏'],
];

// Stars: routine items earn nothing (the ride to school is the reward);
// household chores earn stars. Change these two numbers to taste.
const ROUTINE_STARS = 0;
const CHORE_STARS = 2;

// Dinner rotation. `null` = wildcard / cook's choice.
const DINNERS = {
  1: 'Chicken & Risotto', // Monday
  2: 'Tacos', // Tuesday
  3: 'Orange Chicken', // Wednesday
  4: null, // Thursday — wildcard
  5: 'Pizza', // Friday
  6: null, // Saturday — wildcard
  0: null, // Sunday — wildcard
};

// Who cooks on which weekday (0=Sun … 6=Sat).
const DINNER_COOKS = { Luke: 1, Paul: 2, John: 3 };

const RECIPES = [
  ['Chicken & Risotto', 'Chicken breast, arborio rice, stock, parmesan, onion, butter'],
  ['Tacos', 'Tortillas, ground beef or chicken, cheese, lettuce, tomato, salsa'],
  ['Orange Chicken', 'Chicken thighs, orange sauce, rice, broccoli'],
  ['Pizza', 'Dough, sauce, mozzarella, toppings'],
];

// Paul's robotics club: every Monday and Tuesday, 3:00–4:30pm.
const ROBOTICS = { member: 'Paul', days: [1, 2], start: '15:00', end: '16:30', from: '2026-09-07' };

// ---- Fall 2026 soccer -----------------------------------------------------
// Games transcribed from the SportsEngine team schedules. Each row is
// [date, start, end, matchup, venue, field].

const VENUES = {
  yankton: ['Yankton Trail Park', '3901 South Minnesota Avenue, Sioux Falls, SD, 57108, US'],
  tomar: ['Tomar Park', '100 West Twin Oaks Road, Sioux Falls, SD, 57105, US'],
};

// John — U10 Boys Oaks.
const JOHN_GAMES = [
  ['2026-09-14', '17:45', '19:00', 'Oaks vs Inferno', 'yankton', '20S'],
  ['2026-09-20', '13:00', '14:15', 'Oaks vs Chargers', 'tomar', '3'],
  ['2026-09-26', '09:00', '10:15', 'Oaks vs Narwhals', 'tomar', '2'],
  ['2026-10-03', '09:00', '10:15', 'Oaks vs Ocelots', 'yankton', '18S'],
  ['2026-10-17', '09:00', '10:15', 'Oaks vs Lions', 'tomar', '2'],
  ['2026-10-24', '10:15', '11:30', 'Oaks vs Spartans', 'tomar', '1'],
];

// Paul — U14 Boys SaberCats. Home team first, as the schedule lists it.
const PAUL_GAMES = [
  ['2026-09-14', '19:30', '21:15', 'SaberCats vs Raccoons', 'yankton', '12'],
  ['2026-09-22', '19:30', '21:15', 'SaberCats vs Roadrunners', 'yankton', '12'],
  ['2026-09-28', '19:30', '21:15', 'SaberCats vs Ironclads', 'yankton', '9N'],
  ['2026-10-05', '19:30', '21:15', 'Bluebirds vs SaberCats', 'yankton', '9N'],
  ['2026-10-12', '19:30', '21:15', 'SaberCats vs Tornadoes', 'yankton', '10S'],
  ['2026-10-19', '19:30', '21:15', 'SaberCats vs Rebels', 'yankton', '12'],
  ['2026-10-27', '19:30', '21:15', 'Bluejays vs SaberCats', 'yankton', '10N'],
];

// John's practice: every Wednesday, 6:00–7:30pm, through the end of the season.
// Venue was not given — set it here (or in the app) once you know it.
const JOHN_PRACTICE = { from: '2026-09-16', until: '2026-10-28', start: '18:00', end: '19:30', location: '' };

// ---- Minnesota Vikings 2026 season ----------------------------------------
// [date, kickoff, 'vs'|'at', opponent, venue, network]. Times are local
// (the schedule's CDT/CST already matches America/Chicago wall-clock).
// Games are assumed to run 3h15m.
const VIKINGS_GAME_MINUTES = 195;
const VIKINGS = [
  ['2026-09-13', '15:25', 'vs', 'Packers', 'U.S. Bank Stadium', 'CBS'],
  ['2026-09-20', '12:00', 'at', 'Bears', 'Soldier Field', 'FOX'],
  ['2026-09-27', '15:05', 'at', 'Buccaneers', 'Raymond James Stadium', 'FOX'],
  ['2026-10-04', '15:05', 'vs', 'Dolphins', 'U.S. Bank Stadium', 'FOX'],
  ['2026-10-11', '12:00', 'at', 'Saints', 'Caesars Superdome', 'FOX'],
  ['2026-10-25', '12:00', 'vs', 'Colts', 'U.S. Bank Stadium', 'CBS'],
  ['2026-11-01', '12:00', 'at', 'Lions', 'Ford Field', 'FOX'],
  ['2026-11-09', '19:15', 'vs', 'Bills', 'U.S. Bank Stadium', 'ESPN'],
  ['2026-11-15', '12:00', 'at', 'Packers', 'Lambeau Field', 'FOX'],
  ['2026-11-22', '19:20', 'vs', '49ers', 'Estadio Banorte', 'NBC'],
  ['2026-11-29', '12:00', 'vs', 'Falcons', 'U.S. Bank Stadium', 'FOX'],
  ['2026-12-06', '15:25', 'vs', 'Panthers', 'U.S. Bank Stadium', 'CBS'],
  ['2026-12-10', '19:15', 'at', 'Patriots', 'Gillette Stadium', 'Prime'],
  ['2026-12-20', '19:20', 'vs', 'Lions', 'U.S. Bank Stadium', 'NBC'],
  ['2027-01-03', '12:00', 'at', 'Jets', 'MetLife Stadium', 'CBS'],
];
// Week 6 is the bye. No date is published for it; it is the open Sunday
// between week 5 (Oct 11) and week 7 (Oct 25).
const VIKINGS_BYE = '2026-10-18';
// Weeks 16 (vs Commanders) and 18 (vs Bears) are still TBD — no date to add.
const VIKINGS_PURPLE = '#4F2683';

// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ALL_DAYS = '0,1,2,3,4,5,6';

function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// The most recent `weekday` on or before `dateStr`.
function onOrBefore(dateStr, weekday) {
  return addDaysStr(dateStr, -((weekdayOf(dateStr) - weekday + 7) % 7));
}

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

const counts = { members: 0, chores: 0, meals: 0, recipes: 0, events: 0 };

// --- household -------------------------------------------------------------

let household = getHousehold();
if (!household) {
  const pin = process.env.HUB_PIN;
  if (!/^\d{4}$/.test(String(pin || ''))) {
    console.error(
      '\nNo household exists yet.\n' +
        'Either finish the setup wizard in the app first (recommended — it also sets\n' +
        'your timezone and weather city), or create one here by passing a PIN:\n\n' +
        '  PowerShell:  $env:HUB_PIN="1234"; npm run seed\n' +
        '  bash:        HUB_PIN=1234 npm run seed\n'
    );
    process.exit(1);
  }
  db.prepare('INSERT INTO household (name, pin_hash, timezone) VALUES (?, ?, ?)').run(
    process.env.HUB_NAME || 'Family Hub',
    hashPin(pin),
    process.env.HUB_TZ || 'America/Chicago'
  );
  db.prepare("INSERT INTO list (household_id, title, color, type) VALUES (?, 'Groceries', '#3BB273', 'grocery')").run(
    getHousehold().id
  );
  household = getHousehold();
  console.log(`Created household "${household.name}".`);
}
const hid = household.id;

// --- family members --------------------------------------------------------

function upsertMember({ name, color, avatar }, sortOrder) {
  const existing = db.prepare('SELECT * FROM family_member WHERE LOWER(name) = LOWER(?)').get(name);
  if (existing) {
    db.prepare('UPDATE family_member SET color = ?, avatar = ?, is_child = 1 WHERE id = ?').run(color, avatar, existing.id);
    return existing.id;
  }
  counts.members++;
  return db
    .prepare('INSERT INTO family_member (household_id, name, color, avatar, is_child, sort_order) VALUES (?, ?, ?, ?, 1, ?)')
    .run(hid, name, color, avatar, sortOrder).lastInsertRowid;
}

const memberIds = {};
KIDS.forEach((kid, i) => {
  memberIds[kid.name] = upsertMember(kid, i);
});

// --- chores ----------------------------------------------------------------

// Matched on (member, title, time of day) so re-running updates the schedule in
// place instead of stacking duplicates. Time of day has to be part of the key:
// "Brush teeth" and "Gratitude journal" appear in both the morning and the
// night routine, and they are two separate chores.
function upsertChore({ member, title, icon = '', rule, timeOfDay = 'any', stars = 0, dueDate = null }) {
  const memberId = memberIds[member];
  if (!memberId) throw new Error(`Unknown family member: ${member}`);
  const existing = db
    .prepare('SELECT * FROM chore WHERE member_id = ? AND title = ? AND time_of_day = ?')
    .get(memberId, title, timeOfDay);
  if (existing) {
    db.prepare('UPDATE chore SET icon=?, recurrence_rule=?, due_date=?, star_value=?, active=1 WHERE id=?').run(
      icon, rule, dueDate, stars, existing.id
    );
    return existing.id;
  }
  counts.chores++;
  return db
    .prepare(
      `INSERT INTO chore (household_id, member_id, title, icon, recurrence_rule, due_date, time_of_day, star_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(hid, memberId, title, icon, rule, dueDate, timeOfDay, stars).lastInsertRowid;
}

const seedChores = db.transaction(() => {
  // Routines, in card order, per kid. Inserting them in order keeps them in
  // order on the board (the board sorts by id inside each time-of-day bucket).
  for (const kid of KIDS) {
    for (const [title, icon] of MORNING_ROUTINE) {
      upsertChore({ member: kid.name, title, icon, rule: 'daily', timeOfDay: 'morning', stars: ROUTINE_STARS });
    }
  }
  for (const kid of KIDS) {
    for (const [title, icon] of NIGHT_ROUTINE) {
      upsertChore({ member: kid.name, title, icon, rule: 'daily', timeOfDay: 'evening', stars: ROUTINE_STARS });
    }
  }

  // Dishes and counters alternate weekly, weeks running Saturday -> Friday.
  // Luke's weeks are anchored to DISH_ROTATION_START, Paul's to the week after,
  // so exactly one of them is on each job every single day.
  const paulWeek = addDaysStr(DISH_ROTATION_START, 7);
  upsertChore({
    member: 'Luke', title: 'Dishes', icon: '🍽️',
    rule: `weeks:2:${DISH_ROTATION_START}:${ALL_DAYS}`, timeOfDay: 'evening', stars: CHORE_STARS,
  });
  upsertChore({
    member: 'Paul', title: 'Dishes', icon: '🍽️',
    rule: `weeks:2:${paulWeek}:${ALL_DAYS}`, timeOfDay: 'evening', stars: CHORE_STARS,
  });
  upsertChore({
    member: 'Paul', title: 'Clean counters', icon: '🧽',
    rule: `weeks:2:${DISH_ROTATION_START}:${ALL_DAYS}`, timeOfDay: 'evening', stars: CHORE_STARS,
  });
  upsertChore({
    member: 'Luke', title: 'Clean counters', icon: '🧽',
    rule: `weeks:2:${paulWeek}:${ALL_DAYS}`, timeOfDay: 'evening', stars: CHORE_STARS,
  });

  // John sweeps every day.
  upsertChore({
    member: 'John', title: 'Sweep the floor', icon: '🧹',
    rule: 'daily', timeOfDay: 'evening', stars: CHORE_STARS,
  });

  // Bins. '|holiday-shift' slides these to Wednesday when Monday was a
  // holiday, matching the collection schedule.
  upsertChore({
    member: TRASH_OWNER, title: 'Take out the trash', icon: '🗑️',
    rule: 'days:2|holiday-shift', timeOfDay: 'evening', stars: CHORE_STARS,
  });
  upsertChore({
    member: TRASH_OWNER, title: 'Take out the recycling', icon: '♻️',
    rule: `weeks:2:${RECYCLING_ANCHOR}:2|holiday-shift`, timeOfDay: 'evening', stars: CHORE_STARS,
  });

  // Who cooks dinner.
  for (const [name, weekday] of Object.entries(DINNER_COOKS)) {
    upsertChore({
      member: name, title: `Make dinner (${WEEKDAY_NAMES[weekday]})`, icon: '🍳',
      rule: `days:${weekday}`, timeOfDay: 'afternoon', stars: CHORE_STARS,
    });
  }
});
seedChores();

// --- recipes & the dinner plan ---------------------------------------------

const seedMeals = db.transaction(() => {
  const recipeIds = {};
  for (const [title, ingredients] of RECIPES) {
    const existing = db.prepare('SELECT * FROM recipe WHERE title = ?').get(title);
    if (existing) {
      recipeIds[title] = existing.id;
    } else {
      counts.recipes++;
      recipeIds[title] = db
        .prepare('INSERT INTO recipe (household_id, title, ingredients, is_favorite) VALUES (?, ?, ?, 1)')
        .run(hid, title, ingredients).lastInsertRowid;
    }
  }

  // Start from the Sunday of the current week so this week is filled in too.
  const start = onOrBefore(todayStr(), 0);
  const upsert = db.prepare(
    `INSERT INTO meal_plan_entry (household_id, date, meal_slot, recipe_id, free_text) VALUES (?, ?, 'dinner', ?, ?)
     ON CONFLICT (household_id, date, meal_slot) DO UPDATE SET recipe_id = excluded.recipe_id, free_text = excluded.free_text`
  );
  for (let i = 0; i < MEAL_PLAN_WEEKS * 7; i++) {
    const date = addDaysStr(start, i);
    const dish = DINNERS[weekdayOf(date)];
    // Never overwrite a dinner someone has already planned by hand.
    const existing = db
      .prepare("SELECT * FROM meal_plan_entry WHERE household_id = ? AND date = ? AND meal_slot = 'dinner'")
      .get(hid, date);
    if (existing) continue;
    upsert.run(hid, date, dish ? recipeIds[dish] : null, dish ? null : 'Wildcard');
    counts.meals++;
  }
});
seedMeals();

// --- robotics club ---------------------------------------------------------

const seedEvents = db.transaction(() => {
  for (const weekday of ROBOTICS.days) {
    const firstDate = addDaysStr(ROBOTICS.from, (weekday - weekdayOf(ROBOTICS.from) + 7) % 7);
    const startAt = `${firstDate}T${ROBOTICS.start}`;
    const endAt = `${firstDate}T${ROBOTICS.end}`;
    const title = 'Robotics Club';
    const existing = db
      .prepare("SELECT * FROM event WHERE title = ? AND start_at = ? AND recurrence_rule = 'weekly'")
      .get(title, startAt);
    if (existing) continue;
    const id = db
      .prepare(
        `INSERT INTO event (household_id, title, start_at, end_at, all_day, recurrence_rule)
         VALUES (?, ?, ?, ?, 0, 'weekly')`
      )
      .run(hid, title, startAt, endAt).lastInsertRowid;
    db.prepare('INSERT OR IGNORE INTO event_member (event_id, member_id) VALUES (?, ?)').run(id, memberIds[ROBOTICS.member]);
    counts.events++;
  }
});
seedEvents();

// --- soccer ----------------------------------------------------------------

// Events are matched on (title, start_at) so a re-run updates rather than
// duplicates; a rescheduled game gets added as a new one, and the old row is
// left alone to be deleted in the app.
function upsertEvent({ title, startAt, endAt, rule = '', location = '', description = '', member, icon = '', color = null, allDay = false }) {
  const existing = db.prepare('SELECT * FROM event WHERE title = ? AND start_at = ?').get(title, startAt);
  if (existing) {
    db.prepare('UPDATE event SET end_at=?, recurrence_rule=?, location=?, description=?, icon=?, color_override=? WHERE id=?').run(
      endAt, rule, location, description, icon, color, existing.id
    );
    return existing.id;
  }
  const id = db
    .prepare(
      `INSERT INTO event (household_id, title, description, location, start_at, end_at, all_day, recurrence_rule, icon, color_override)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(hid, title, description, location, startAt, endAt, allDay ? 1 : 0, rule, icon, color).lastInsertRowid;
  // Household-wide events (the Vikings schedule) belong to nobody in particular.
  if (member) db.prepare('INSERT OR IGNORE INTO event_member (event_id, member_id) VALUES (?, ?)').run(id, memberIds[member]);
  counts.events++;
  return id;
}

const seedSoccer = db.transaction(() => {
  for (const [member, games] of [['John', JOHN_GAMES], ['Paul', PAUL_GAMES]]) {
    for (const [date, start, end, matchup, venueKey, field] of games) {
      const [venue, address] = VENUES[venueKey];
      upsertEvent({
        title: matchup,
        icon: '⚽',
        startAt: `${date}T${start}`,
        endAt: `${date}T${end}`,
        location: `${venue} — Field ${field}`,
        description: address,
        member,
      });
    }
  }

  const p = JOHN_PRACTICE;
  upsertEvent({
    title: 'Soccer practice',
    icon: '⚽',
    startAt: `${p.from}T${p.start}`,
    endAt: `${p.from}T${p.end}`,
    rule: `weekly|until:${p.until}`,
    location: p.location,
    member: 'John',
  });
});
seedSoccer();

// --- Vikings ---------------------------------------------------------------

const seedVikings = db.transaction(() => {
  for (const [date, kick, homeAway, opponent, venue, network] of VIKINGS) {
    const [h, m] = kick.split(':').map(Number);
    const endMins = h * 60 + m + VIKINGS_GAME_MINUTES;
    const end = `${String(Math.floor(endMins / 60) % 24).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
    upsertEvent({
      title: `Vikings ${homeAway} ${opponent}`,
      startAt: `${date}T${kick}`,
      endAt: `${date}T${end}`,
      location: venue,
      description: `${network} · KFAN`,
      icon: 'vikings',
      color: VIKINGS_PURPLE,
    });
  }
  upsertEvent({
    title: 'Vikings bye week',
    startAt: VIKINGS_BYE,
    endAt: VIKINGS_BYE,
    allDay: true,
    icon: 'vikings',
    color: VIKINGS_PURPLE,
  });
});
seedVikings();

// ---------------------------------------------------------------------------

const paulWeek = addDaysStr(DISH_ROTATION_START, 7);
console.log(`
Seeded "${household.name}".

  family members added   ${counts.members}
  chores added           ${counts.chores}
  recipes added          ${counts.recipes}
  dinners planned        ${counts.meals}
  calendar events added  ${counts.events}

  Dishes rotate Saturday to Friday — Luke's weeks start ${DISH_ROTATION_START},
  Paul's start ${paulWeek}. Whoever is not on dishes has counters.
  Trash goes out Tuesday night, or Wednesday when Monday was a holiday.
  Recycling joins it every other week from ${RECYCLING_ANCHOR}.

  Re-run this any time — it updates in place instead of duplicating, and it
  never overwrites a dinner you planned by hand. Refresh the app to see it.
`);
