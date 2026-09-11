// Seeds the Luckow household: family members, morning/night routines, the
// weekly chore rotation, the dinner plan, and Paul's robotics club.
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
