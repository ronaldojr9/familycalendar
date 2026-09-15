// Answers "why am I not seeing my stuff?" in one command:
//
//   npm run doctor
//
// Prints what code is checked out, which database the app is actually using,
// what is in it, and what today's chore board would look like — then says
// plainly what to do next.

import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { db, dataDir, getHousehold } from '../src/db.js';
import { choreDueOn } from '../src/recurrence.js';
import { dailyReading, readingFor } from '../src/scripture.js';
import { holidayChecker } from '../src/holidays.js';

const ok = (m) => console.log(`  OK    ${m}`);
const bad = (m) => console.log(`  ISSUE ${m}`);
const info = (m) => console.log(`        ${m}`);
const todo = [];

console.log('\nFamily Hub — checkup\n');

// --- code ------------------------------------------------------------------

console.log('Code');
info(`Node ${process.version}`);
try {
  const head = execSync('git log --oneline -1', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  info(`branch ${branch}`);
  info(`commit ${head}`);
} catch {
  info('not a git checkout (downloaded as a zip/tarball — "git pull" will not work here)');
}

const seedPath = path.join(process.cwd(), 'server', 'scripts', 'seed-household.js');
if (fs.existsSync(seedPath)) ok('seed script is present');
else {
  bad('seed script is MISSING — this checkout predates it');
  todo.push('git pull origin claude/cool-meitner-9jjr6g');
}

const distIndex = path.join(process.cwd(), 'client', 'dist', 'index.html');
if (fs.existsSync(distIndex)) {
  ok(`frontend built (${new Date(fs.statSync(distIndex).mtime).toLocaleString()})`);
} else {
  bad('frontend is NOT built — the app will show a "not built yet" message');
  todo.push('npm run build');
}

// --- database --------------------------------------------------------------

console.log('\nDatabase');
const dbFile = path.join(dataDir, 'familyhub.db');
info(`using ${dbFile}`);
if (process.env.FAMILY_HUB_DATA) info(`(FAMILY_HUB_DATA is set — the app must be started with it set too, or it will read a different file)`);
if (fs.existsSync(dbFile)) ok(`file exists (${(fs.statSync(dbFile).size / 1024).toFixed(0)} KB)`);
else bad('no database file yet — nothing has been saved');

const household = getHousehold();
if (household) {
  ok(`household "${household.name}" (timezone ${household.timezone})`);
} else {
  bad('NO HOUSEHOLD YET — the seed cannot run until one exists');
  info('Open the app and finish the setup wizard, then run the seed.');
  todo.push('open the app, finish setup, then: npm run seed');
}

const count = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
const members = db.prepare('SELECT id, name FROM family_member ORDER BY sort_order, id').all();
const chores = count('chore');
info(`family members: ${members.length ? members.map((m) => m.name).join(', ') : '(none)'}`);
info(`chores: ${chores}   dinners planned: ${count('meal_plan_entry')}   events: ${count('event')}`);

if (household && chores === 0) {
  bad('household exists but has NO CHORES — the seed has not been run against this database');
  todo.push('npm run seed');
} else if (chores > 0) {
  ok('chores are in the database');
}

// --- today's board ---------------------------------------------------------

console.log("\nToday's board");
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
info(`this machine thinks today is ${today}`);

const holidays = holidayChecker(db.prepare("SELECT value FROM settings WHERE key = 'extra_holidays'").get()?.value);
const all = db.prepare('SELECT * FROM chore WHERE active = 1').all();
const due = all.filter((c) => choreDueOn(c, today, holidays));
info(`${due.length} chore${due.length === 1 ? '' : 's'} due today`);
for (const m of members) {
  const mine = due.filter((c) => c.member_id === m.id);
  const notable = mine.filter((c) => /dish|counter|trash|recycl|sweep|dinner/i.test(c.title)).map((c) => c.title);
  info(`  ${m.name}: ${mine.length} due${notable.length ? ` — ${notable.join(', ')}` : ''}`);
}
if (household && chores > 0 && due.length === 0) {
  bad('chores exist but none are due today — check the date above is right');
}

// --- today's reading -------------------------------------------------------

console.log("\nToday's reading");
try {
  const plan = readingFor(today);
  info(`plan: Proverbs ${plan.proverbs}, Psalm ${plan.psalm}`);
  const key = db.prepare("SELECT value FROM settings WHERE key = 'nlt_api_key'").get()?.value?.trim();
  const reading = await dailyReading(today);
  for (const p of reading.passages) {
    info(`${p.reference.padEnd(13)} ${p.version}  ${p.verses.length} verses`);
    if (p.note) bad(p.note);
  }
  const version = reading.passages[0]?.version;
  if (version === 'NLT') {
    const cached = db.prepare("SELECT COUNT(*) AS c FROM scripture_cache WHERE version = 'NLT'").get().c;
    ok(`reading in the NLT (${cached} chapter${cached === 1 ? '' : 's'} cached locally)`);
  } else if (key) {
    bad('an NLT key is set but the reading fell back to the World English Bible — see the reason above');
  } else {
    ok('reading in the World English Bible (public domain)');
    info('Add a free NLT key in Settings -> Daily reading to read the New Living Translation.');
  }
} catch (e) {
  bad(`the reading could not be built: ${e.message}`);
}

// --- verdict ---------------------------------------------------------------

console.log('\nWhat to do next');
if (todo.length === 0) {
  console.log('  Nothing — the data is all here.');
  console.log('  If the app still looks empty: the browser is showing a stale page, or it is');
  console.log('  pointed at a different server. Hard-refresh with Ctrl+F5, and check you are');
  console.log('  on the Chores tab at the same address the server printed when it started.\n');
} else {
  todo.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  console.log('');
}
