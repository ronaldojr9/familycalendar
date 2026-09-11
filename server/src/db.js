import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = process.env.FAMILY_HUB_DATA || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'familyhub.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS household (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  weather_location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS family_member (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🙂',
  is_child INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  start_at TEXT NOT NULL,          -- local wall-clock: YYYY-MM-DDTHH:mm (or YYYY-MM-DD for all-day)
  end_at TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  recurrence_rule TEXT NOT NULL DEFAULT '',  -- '' | daily | weekly | monthly | yearly
  color_override TEXT,
  countdown_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_member (
  event_id INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, member_id)
);

CREATE TABLE IF NOT EXISTS chore (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  recurrence_rule TEXT NOT NULL DEFAULT 'daily', -- daily | once | days:0,1,2 (JS weekday numbers, 0=Sun)
  due_date TEXT,                                 -- for one-time chores: YYYY-MM-DD
  time_of_day TEXT NOT NULL DEFAULT 'any',       -- any | morning | afternoon | evening
  star_value INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chore_completion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chore_id INTEGER NOT NULL REFERENCES chore(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  completed_by_member_id INTEGER NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (chore_id, date)
);

CREATE TABLE IF NOT EXISTS reward (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  star_cost INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '🎁'
);

CREATE TABLE IF NOT EXISTS star_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES family_member(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4D9DE0',
  type TEXT NOT NULL DEFAULT 'custom', -- grocery | todo | custom
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS list_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES list(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  ingredients TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  is_favorite INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meal_plan_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  meal_slot TEXT NOT NULL, -- breakfast | lunch | dinner | snack
  recipe_id INTEGER REFERENCES recipe(id) ON DELETE SET NULL,
  free_text TEXT,
  UNIQUE (household_id, date, meal_slot)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_start ON event (household_id, start_at);
CREATE INDEX IF NOT EXISTS idx_completion_date ON chore_completion (date);
CREATE INDEX IF NOT EXISTS idx_ledger_member ON star_ledger (member_id);
`);

export function getHousehold() {
  return db.prepare('SELECT * FROM household LIMIT 1').get() || null;
}

export function starBalance(memberId) {
  const row = db.prepare('SELECT COALESCE(SUM(delta), 0) AS bal FROM star_ledger WHERE member_id = ?').get(memberId);
  return row.bal;
}
