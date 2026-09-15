import { Router } from 'express';
import { db, getHousehold, starBalance } from './db.js';
import { hashPin, verifyPin, requirePin } from './pin.js';
import { expandEvent, choreDueOn } from './recurrence.js';
import { holidayChecker } from './holidays.js';
import { dailyReading, readingFor } from './scripture.js';
import { getForecast, geocode } from './weather.js';
import { broadcast } from './ws.js';

export const api = Router();

const bool = (v) => (v ? 1 : 0);

function eventWithMembers(row) {
  const member_ids = db
    .prepare('SELECT member_id FROM event_member WHERE event_id = ?')
    .all(row.id)
    .map((r) => r.member_id);
  return { ...row, all_day: !!row.all_day, countdown_enabled: !!row.countdown_enabled, member_ids };
}

// ---------- household / setup ----------

api.get('/household', (req, res) => {
  const h = getHousehold();
  if (!h) return res.json({ household: null });
  const { pin_hash, ...safe } = h;
  res.json({ household: safe });
});

api.post('/household', (req, res) => {
  if (getHousehold()) return res.status(409).json({ error: 'Household already exists' });
  const { name, pin, timezone, weather_location, members = [] } = req.body || {};
  if (!name || !pin || !/^\d{4}$/.test(String(pin))) {
    return res.status(400).json({ error: 'A household name and a 4-digit PIN are required' });
  }
  const create = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO household (name, pin_hash, timezone, weather_location) VALUES (?, ?, ?, ?)')
      .run(name, hashPin(pin), timezone || 'UTC', weather_location ? JSON.stringify(weather_location) : null);
    const hid = info.lastInsertRowid;
    const insertMember = db.prepare(
      'INSERT INTO family_member (household_id, name, color, avatar, is_child, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    );
    members.forEach((m, i) => {
      if (m.name) insertMember.run(hid, m.name, m.color || '#4D9DE0', m.avatar || '🙂', bool(m.is_child), i);
    });
    // Default grocery list out of the box.
    db.prepare("INSERT INTO list (household_id, title, color, type) VALUES (?, 'Groceries', '#3BB273', 'grocery')").run(hid);
    return hid;
  });
  create();
  broadcast('household.created', {});
  const { pin_hash, ...safe } = getHousehold();
  res.status(201).json({ household: safe });
});

api.put('/household', requirePin, (req, res) => {
  const h = getHousehold();
  const { name, timezone, weather_location, new_pin } = req.body || {};
  db.prepare('UPDATE household SET name = ?, timezone = ?, weather_location = ? WHERE id = ?').run(
    name ?? h.name,
    timezone ?? h.timezone,
    weather_location !== undefined ? (weather_location ? JSON.stringify(weather_location) : null) : h.weather_location,
    h.id
  );
  if (new_pin) {
    if (!/^\d{4}$/.test(String(new_pin))) return res.status(400).json({ error: 'PIN must be 4 digits' });
    db.prepare('UPDATE household SET pin_hash = ? WHERE id = ?').run(hashPin(new_pin), h.id);
  }
  broadcast('household.updated', {});
  const { pin_hash, ...safe } = getHousehold();
  res.json({ household: safe });
});

api.post('/auth/verify-pin', (req, res) => {
  const h = getHousehold();
  if (!h) return res.status(409).json({ error: 'Household not set up yet' });
  res.json({ valid: verifyPin(req.body?.pin, h.pin_hash) });
});

// ---------- family members ----------

api.get('/members', (req, res) => {
  const rows = db.prepare('SELECT * FROM family_member ORDER BY sort_order, id').all();
  res.json({ members: rows.map((m) => ({ ...m, is_child: !!m.is_child, stars: starBalance(m.id) })) });
});

api.post('/members', requirePin, (req, res) => {
  const h = getHousehold();
  const { name, color, avatar, is_child } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM family_member').get().m;
  const info = db
    .prepare('INSERT INTO family_member (household_id, name, color, avatar, is_child, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    .run(h.id, name, color || '#4D9DE0', avatar || '🙂', bool(is_child), max + 1);
  broadcast('member.created', { id: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

api.put('/members/:id', requirePin, (req, res) => {
  const m = db.prepare('SELECT * FROM family_member WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const { name, color, avatar, is_child, sort_order } = req.body || {};
  db.prepare('UPDATE family_member SET name = ?, color = ?, avatar = ?, is_child = ?, sort_order = ? WHERE id = ?').run(
    name ?? m.name,
    color ?? m.color,
    avatar ?? m.avatar,
    is_child !== undefined ? bool(is_child) : m.is_child,
    sort_order ?? m.sort_order,
    m.id
  );
  broadcast('member.updated', { id: m.id });
  res.json({ ok: true });
});

api.delete('/members/:id', requirePin, (req, res) => {
  db.prepare('DELETE FROM family_member WHERE id = ?').run(req.params.id);
  broadcast('member.deleted', { id: Number(req.params.id) });
  res.json({ ok: true });
});

// ---------- events ----------

api.get('/events', (req, res) => {
  const range = String(req.query.range || '');
  const m = range.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
  if (!m) return res.status(400).json({ error: 'range=YYYY-MM-DD..YYYY-MM-DD required' });
  const [, from, to] = m;
  const rows = db.prepare('SELECT * FROM event').all();
  const occurrences = [];
  for (const row of rows) {
    const ev = eventWithMembers(row);
    for (const occ of expandEvent(row, from, to)) {
      occurrences.push({ ...ev, ...occ, occurrence_id: `${row.id}:${occ.occurs_on}` });
    }
  }
  occurrences.sort((a, b) => (a.start_at < b.start_at ? -1 : 1));
  res.json({ events: occurrences });
});

// Events with countdown badges enabled (next upcoming occurrence of each).
api.get('/events/countdowns', (req, res) => {
  const today = String(req.query.today || new Date().toISOString().slice(0, 10));
  const horizon = new Date(new Date(today).getTime() + 366 * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare('SELECT * FROM event WHERE countdown_enabled = 1').all();
  const out = [];
  for (const row of rows) {
    const occ = expandEvent(row, today, horizon).find((o) => o.occurs_on >= today);
    if (occ) out.push({ ...eventWithMembers(row), ...occ });
  }
  out.sort((a, b) => (a.occurs_on < b.occurs_on ? -1 : 1));
  res.json({ countdowns: out.slice(0, 8) });
});

function saveEventBody(req, res, existingId) {
  const h = getHousehold();
  const { title, description, location, start_at, end_at, all_day, recurrence_rule, member_ids, color_override, countdown_enabled, icon } =
    req.body || {};
  if (!title || !start_at || !end_at) return null;
  const tx = db.transaction(() => {
    let id = existingId;
    if (id) {
      db.prepare(
        `UPDATE event SET title=?, description=?, location=?, start_at=?, end_at=?, all_day=?,
         recurrence_rule=?, color_override=?, countdown_enabled=?, icon=? WHERE id=?`
      ).run(title, description || '', location || '', start_at, end_at, bool(all_day), recurrence_rule || '', color_override || null, bool(countdown_enabled), icon || '', id);
      db.prepare('DELETE FROM event_member WHERE event_id = ?').run(id);
    } else {
      const info = db
        .prepare(
          `INSERT INTO event (household_id, title, description, location, start_at, end_at, all_day, recurrence_rule, color_override, countdown_enabled, icon)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(h.id, title, description || '', location || '', start_at, end_at, bool(all_day), recurrence_rule || '', color_override || null, bool(countdown_enabled), icon || '');
      id = info.lastInsertRowid;
    }
    const link = db.prepare('INSERT OR IGNORE INTO event_member (event_id, member_id) VALUES (?, ?)');
    (member_ids || []).forEach((mid) => link.run(id, mid));
    return id;
  });
  return tx();
}

api.post('/events', (req, res) => {
  const id = saveEventBody(req, res);
  if (id == null) return res.status(400).json({ error: 'title, start_at and end_at are required' });
  broadcast('event.created', { id });
  res.status(201).json({ id });
});

api.put('/events/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM event WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const id = saveEventBody(req, res, existing.id);
  if (id == null) return res.status(400).json({ error: 'title, start_at and end_at are required' });
  broadcast('event.updated', { id });
  res.json({ ok: true });
});

api.delete('/events/:id', (req, res) => {
  db.prepare('DELETE FROM event WHERE id = ?').run(req.params.id);
  broadcast('event.deleted', { id: Number(req.params.id) });
  res.json({ ok: true });
});

// ---------- chores ----------

api.get('/chores', (req, res) => {
  const chores = db.prepare('SELECT * FROM chore WHERE active = 1 ORDER BY id').all();
  res.json({ chores: chores.map((c) => ({ ...c, active: !!c.active })) });
});

// Holidays matter to chores that carry the '|holiday-shift' modifier (trash day).
function householdHolidays() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'extra_holidays'").get();
  return holidayChecker(row?.value);
}

// Board for a given date: which chores are due, and which are done.
api.get('/chores/board', (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const chores = db.prepare('SELECT * FROM chore WHERE active = 1 ORDER BY time_of_day, id').all();
  const completions = db.prepare('SELECT * FROM chore_completion WHERE date = ?').all(date);
  const done = new Map(completions.map((c) => [c.chore_id, c]));
  const holidays = householdHolidays();
  const due = chores
    .filter((c) => choreDueOn(c, date, holidays))
    .map((c) => ({ ...c, active: true, completed: done.has(c.id), completed_at: done.get(c.id)?.completed_at || null }));
  res.json({ date, chores: due });
});

// Completion history (for streaks / weekly percentages).
api.get('/chores/completions', (req, res) => {
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
  }
  const rows = db.prepare('SELECT * FROM chore_completion WHERE date >= ? AND date <= ?').all(from, to);
  res.json({ completions: rows });
});

api.post('/chores', requirePin, (req, res) => {
  const h = getHousehold();
  const { member_id, title, icon, recurrence_rule, due_date, time_of_day, star_value } = req.body || {};
  if (!title || !member_id) return res.status(400).json({ error: 'title and member_id are required' });
  const info = db
    .prepare(
      `INSERT INTO chore (household_id, member_id, title, icon, recurrence_rule, due_date, time_of_day, star_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(h.id, member_id, title, icon || '', recurrence_rule || 'daily', due_date || null, time_of_day || 'any', star_value || 0);
  broadcast('chore.created', { id: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

api.put('/chores/:id', requirePin, (req, res) => {
  const c = db.prepare('SELECT * FROM chore WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { member_id, title, icon, recurrence_rule, due_date, time_of_day, star_value, active } = req.body || {};
  db.prepare(
    `UPDATE chore SET member_id=?, title=?, icon=?, recurrence_rule=?, due_date=?, time_of_day=?, star_value=?, active=? WHERE id=?`
  ).run(
    member_id ?? c.member_id,
    title ?? c.title,
    icon ?? c.icon,
    recurrence_rule ?? c.recurrence_rule,
    due_date !== undefined ? due_date : c.due_date,
    time_of_day ?? c.time_of_day,
    star_value ?? c.star_value,
    active !== undefined ? bool(active) : c.active,
    c.id
  );
  broadcast('chore.updated', { id: c.id });
  res.json({ ok: true });
});

api.delete('/chores/:id', requirePin, (req, res) => {
  db.prepare('DELETE FROM chore WHERE id = ?').run(req.params.id);
  broadcast('chore.deleted', { id: Number(req.params.id) });
  res.json({ ok: true });
});

// Checking off a chore is deliberately NOT PIN-gated (kids do this themselves).
api.post('/chores/:id/complete', (req, res) => {
  const c = db.prepare('SELECT * FROM chore WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const date = req.body?.date || new Date().toISOString().slice(0, 10);
  const memberId = req.body?.member_id || c.member_id;
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT OR IGNORE INTO chore_completion (chore_id, date, completed_by_member_id) VALUES (?, ?, ?)')
      .run(c.id, date, memberId);
    if (info.changes > 0 && c.star_value > 0) {
      db.prepare('INSERT INTO star_ledger (member_id, delta, reason) VALUES (?, ?, ?)').run(
        memberId,
        c.star_value,
        `chore:${c.title}`
      );
    }
    return info.changes > 0;
  });
  const changed = tx();
  if (changed) broadcast('chore.completed', { id: c.id, date });
  res.json({ ok: true, stars_awarded: changed ? c.star_value : 0 });
});

api.post('/chores/:id/uncomplete', (req, res) => {
  const c = db.prepare('SELECT * FROM chore WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const date = req.body?.date || new Date().toISOString().slice(0, 10);
  const tx = db.transaction(() => {
    const row = db.prepare('SELECT * FROM chore_completion WHERE chore_id = ? AND date = ?').get(c.id, date);
    if (!row) return false;
    db.prepare('DELETE FROM chore_completion WHERE id = ?').run(row.id);
    if (c.star_value > 0) {
      db.prepare('INSERT INTO star_ledger (member_id, delta, reason) VALUES (?, ?, ?)').run(
        row.completed_by_member_id,
        -c.star_value,
        `chore-undo:${c.title}`
      );
    }
    return true;
  });
  if (tx()) broadcast('chore.uncompleted', { id: c.id, date });
  res.json({ ok: true });
});

// ---------- rewards / stars ----------

api.get('/rewards', (req, res) => {
  const rewards = db.prepare('SELECT * FROM reward ORDER BY star_cost, id').all();
  res.json({ rewards });
});

api.get('/stars', (req, res) => {
  const members = db.prepare('SELECT id FROM family_member').all();
  const balances = Object.fromEntries(members.map((m) => [m.id, starBalance(m.id)]));
  const ledger = db.prepare('SELECT * FROM star_ledger ORDER BY id DESC LIMIT 30').all();
  res.json({ balances, ledger });
});

api.post('/rewards', requirePin, (req, res) => {
  const h = getHousehold();
  const { title, star_cost, icon } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const info = db
    .prepare('INSERT INTO reward (household_id, title, star_cost, icon) VALUES (?, ?, ?, ?)')
    .run(h.id, title, star_cost || 0, icon || '🎁');
  broadcast('reward.created', { id: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

api.put('/rewards/:id', requirePin, (req, res) => {
  const r = db.prepare('SELECT * FROM reward WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { title, star_cost, icon } = req.body || {};
  db.prepare('UPDATE reward SET title=?, star_cost=?, icon=? WHERE id=?').run(
    title ?? r.title,
    star_cost ?? r.star_cost,
    icon ?? r.icon,
    r.id
  );
  broadcast('reward.updated', { id: r.id });
  res.json({ ok: true });
});

api.delete('/rewards/:id', requirePin, (req, res) => {
  db.prepare('DELETE FROM reward WHERE id = ?').run(req.params.id);
  broadcast('reward.deleted', { id: Number(req.params.id) });
  res.json({ ok: true });
});

api.post('/rewards/:id/redeem', requirePin, (req, res) => {
  const r = db.prepare('SELECT * FROM reward WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const memberId = req.body?.member_id;
  if (!memberId) return res.status(400).json({ error: 'member_id is required' });
  if (starBalance(memberId) < r.star_cost) return res.status(400).json({ error: 'Not enough stars' });
  db.prepare('INSERT INTO star_ledger (member_id, delta, reason) VALUES (?, ?, ?)').run(
    memberId,
    -r.star_cost,
    `reward:${r.title}`
  );
  broadcast('star.redeemed', { reward_id: r.id, member_id: memberId });
  res.json({ ok: true });
});

// ---------- lists ----------

api.get('/lists', (req, res) => {
  const lists = db.prepare('SELECT * FROM list ORDER BY id').all();
  const items = db.prepare('SELECT * FROM list_item ORDER BY is_checked, sort_order, id').all();
  res.json({
    lists: lists.map((l) => ({
      ...l,
      items: items.filter((i) => i.list_id === l.id).map((i) => ({ ...i, is_checked: !!i.is_checked })),
    })),
  });
});

api.post('/lists', (req, res) => {
  const h = getHousehold();
  const { title, color, type } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const info = db
    .prepare('INSERT INTO list (household_id, title, color, type) VALUES (?, ?, ?, ?)')
    .run(h.id, title, color || '#4D9DE0', type || 'custom');
  broadcast('list.created', { id: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

api.put('/lists/:id', (req, res) => {
  const l = db.prepare('SELECT * FROM list WHERE id = ?').get(req.params.id);
  if (!l) return res.status(404).json({ error: 'Not found' });
  const { title, color, type } = req.body || {};
  db.prepare('UPDATE list SET title=?, color=?, type=? WHERE id=?').run(title ?? l.title, color ?? l.color, type ?? l.type, l.id);
  broadcast('list.updated', { id: l.id });
  res.json({ ok: true });
});

// Deleting a whole list is PIN-gated (per spec); items are not.
api.delete('/lists/:id', requirePin, (req, res) => {
  db.prepare('DELETE FROM list WHERE id = ?').run(req.params.id);
  broadcast('list.deleted', { id: Number(req.params.id) });
  res.json({ ok: true });
});

api.post('/lists/:id/items', (req, res) => {
  const l = db.prepare('SELECT id FROM list WHERE id = ?').get(req.params.id);
  if (!l) return res.status(404).json({ error: 'Not found' });
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM list_item WHERE list_id = ?').get(l.id).m;
  const info = db.prepare('INSERT INTO list_item (list_id, text, sort_order) VALUES (?, ?, ?)').run(l.id, text, max + 1);
  broadcast('list.updated', { id: l.id });
  res.status(201).json({ id: info.lastInsertRowid });
});

api.put('/lists/:id/items/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM list_item WHERE id = ? AND list_id = ?').get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const { text, is_checked, sort_order } = req.body || {};
  db.prepare('UPDATE list_item SET text=?, is_checked=?, sort_order=? WHERE id=?').run(
    text ?? item.text,
    is_checked !== undefined ? bool(is_checked) : item.is_checked,
    sort_order ?? item.sort_order,
    item.id
  );
  broadcast('list.updated', { id: item.list_id });
  res.json({ ok: true });
});

api.delete('/lists/:id/items/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM list_item WHERE id = ? AND list_id = ?').get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM list_item WHERE id = ?').run(item.id);
  broadcast('list.updated', { id: item.list_id });
  res.json({ ok: true });
});

api.post('/lists/:id/clear-checked', (req, res) => {
  db.prepare('DELETE FROM list_item WHERE list_id = ? AND is_checked = 1').run(req.params.id);
  broadcast('list.updated', { id: Number(req.params.id) });
  res.json({ ok: true });
});

// ---------- meal plan & recipes ----------

api.get('/meal-plan', (req, res) => {
  const week = String(req.query.week || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return res.status(400).json({ error: 'week=YYYY-MM-DD required' });
  const end = new Date(new Date(week + 'T00:00:00Z').getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const entries = db.prepare('SELECT * FROM meal_plan_entry WHERE date >= ? AND date <= ?').all(week, end);
  res.json({ entries });
});

// Upsert one cell; empty recipe_id + free_text clears it.
api.post('/meal-plan', (req, res) => {
  const h = getHousehold();
  const { date, meal_slot, recipe_id, free_text } = req.body || {};
  if (!date || !meal_slot) return res.status(400).json({ error: 'date and meal_slot are required' });
  if (!recipe_id && !(free_text || '').trim()) {
    db.prepare('DELETE FROM meal_plan_entry WHERE household_id = ? AND date = ? AND meal_slot = ?').run(h.id, date, meal_slot);
  } else {
    db.prepare(
      `INSERT INTO meal_plan_entry (household_id, date, meal_slot, recipe_id, free_text) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (household_id, date, meal_slot) DO UPDATE SET recipe_id = excluded.recipe_id, free_text = excluded.free_text`
    ).run(h.id, date, meal_slot, recipe_id || null, (free_text || '').trim() || null);
  }
  broadcast('meal.updated', { date, meal_slot });
  res.json({ ok: true });
});

api.get('/recipes', (req, res) => {
  const recipes = db.prepare('SELECT * FROM recipe ORDER BY is_favorite DESC, title').all();
  res.json({ recipes: recipes.map((r) => ({ ...r, is_favorite: !!r.is_favorite })) });
});

api.post('/recipes', (req, res) => {
  const h = getHousehold();
  const { title, ingredients, instructions, is_favorite } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const info = db
    .prepare('INSERT INTO recipe (household_id, title, ingredients, instructions, is_favorite) VALUES (?, ?, ?, ?, ?)')
    .run(h.id, title, ingredients || '', instructions || '', bool(is_favorite));
  broadcast('recipe.created', { id: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

api.put('/recipes/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM recipe WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { title, ingredients, instructions, is_favorite } = req.body || {};
  db.prepare('UPDATE recipe SET title=?, ingredients=?, instructions=?, is_favorite=? WHERE id=?').run(
    title ?? r.title,
    ingredients ?? r.ingredients,
    instructions ?? r.instructions,
    is_favorite !== undefined ? bool(is_favorite) : r.is_favorite,
    r.id
  );
  broadcast('recipe.updated', { id: r.id });
  res.json({ ok: true });
});

api.delete('/recipes/:id', (req, res) => {
  db.prepare('DELETE FROM recipe WHERE id = ?').run(req.params.id);
  broadcast('recipe.deleted', { id: Number(req.params.id) });
  res.json({ ok: true });
});

// ---------- settings ----------

api.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

api.put('/settings', requirePin, (req, res) => {
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(req.body || {})) upsert.run(k, String(v));
  broadcast('settings.updated', {});
  res.json({ ok: true });
});

// ---------- daily scripture ----------

// A chapter of Proverbs by the date, and a Psalm walking through the book.
api.get('/scripture', async (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD required' });
  try {
    res.json(await dailyReading(date));
  } catch (e) {
    res.status(500).json({ error: 'Could not load the reading', detail: e.message });
  }
});

// Just the chapter numbers, for anything that wants the plan without the text.
api.get('/scripture/plan', (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  res.json(readingFor(date));
});

// ---------- weather ----------

api.get('/weather', async (req, res) => {
  const h = getHousehold();
  let loc = null;
  try {
    loc = h?.weather_location ? JSON.parse(h.weather_location) : null;
  } catch {}
  if (!loc?.lat) return res.json({ weather: null });
  try {
    res.json({ weather: await getForecast(loc, h.timezone) });
  } catch (e) {
    res.json({ weather: null, error: 'Weather unavailable' });
  }
});

api.get('/weather/geocode', async (req, res) => {
  try {
    res.json({ results: await geocode(String(req.query.q || '')) });
  } catch {
    res.json({ results: [] });
  }
});
