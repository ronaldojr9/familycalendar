import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { today, addDays, parse, fmtDateLong } from '../dates.js';
import { Modal, Field, Avatar } from './ui.jsx';

const TIME_LABELS = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌙 Evening', any: 'Anytime' };
const CHORE_ICONS = ['🛏️','🦷','🐕','🍽️','🧺','🗑️','📚','🧹','🌱','🎒','🧸','🚿'];
const HOLIDAY_SHIFT = '|holiday-shift';
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// recurrence_rule is 'daily' | 'once' | 'days:0,2' | 'weeks:N:ANCHOR:days',
// optionally suffixed with '|holiday-shift'. Parsing it back out keeps an
// alternating chore alternating when a parent opens it just to rename it.
function parseRule(raw) {
  const rule = raw || 'daily';
  const holidayShift = rule.endsWith(HOLIDAY_SHIFT);
  const base = holidayShift ? rule.slice(0, -HOLIDAY_SHIFT.length) : rule;
  if (base.startsWith('weeks:')) {
    const [, every, anchor, days = ''] = base.split(':');
    return {
      mode: 'weeks',
      every: Number(every) || 2,
      anchor,
      days: days.split(',').filter(Boolean).map(Number),
      holidayShift,
    };
  }
  if (base.startsWith('days:')) {
    return { mode: 'days', every: 2, anchor: '', days: base.slice(5).split(',').filter(Boolean).map(Number), holidayShift };
  }
  return { mode: base === 'once' ? 'once' : 'daily', every: 2, anchor: '', days: [], holidayShift };
}

// Most recent Saturday on or before today — the natural start for a weekly
// rotation that changes hands on the weekend.
function lastSaturday() {
  const d = parse(today());
  return addDays(today(), -((d.getDay() + 1) % 7));
}

function ChoreEditor({ initial, onClose, onSaved }) {
  const { members, withPin } = useApp();
  const editing = !!initial.id;
  const [title, setTitle] = useState(initial.title || '');
  const [memberId, setMemberId] = useState(initial.member_id || members[0]?.id);
  const [icon, setIcon] = useState(initial.icon || '');
  const parsed = useMemo(() => parseRule(initial.recurrence_rule), [initial.recurrence_rule]);
  const [mode, setMode] = useState(parsed.mode);
  const [days, setDays] = useState(parsed.days);
  const [every] = useState(parsed.every);
  const [anchor, setAnchor] = useState(parsed.anchor || lastSaturday());
  const [holidayShift, setHolidayShift] = useState(parsed.holidayShift);
  const [dueDate, setDueDate] = useState(initial.due_date || today());
  const [timeOfDay, setTimeOfDay] = useState(initial.time_of_day || 'any');
  const [stars, setStars] = useState(initial.star_value ?? 1);
  const [error, setError] = useState('');

  const sortedDays = () => [...days].sort((a, b) => a - b).join(',');

  const buildRule = () => {
    if (mode === 'daily') return 'daily';
    if (mode === 'once') return 'once';
    const base = mode === 'weeks' ? `weeks:${every}:${anchor}:${sortedDays()}` : `days:${sortedDays()}`;
    return holidayShift ? base + HOLIDAY_SHIFT : base;
  };

  const save = async () => {
    if (!title.trim()) return setError('Give the chore a name');
    if ((mode === 'days' || mode === 'weeks') && days.length === 0) return setError('Pick at least one weekday');
    const body = {
      title: title.trim(),
      member_id: memberId,
      icon,
      recurrence_rule: buildRule(),
      due_date: mode === 'once' ? dueDate : null,
      time_of_day: timeOfDay,
      star_value: Number(stars) || 0,
    };
    try {
      await withPin((pin) => (editing ? api.put(`/chores/${initial.id}`, body, pin) : api.post('/chores', body, pin)));
      onSaved();
    } catch (e) {
      if (e.message !== 'cancelled') setError(e.message);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete chore "${initial.title}"?`)) return;
    try {
      await withPin((pin) => api.del(`/chores/${initial.id}`, pin));
      onSaved();
    } catch (e) {
      if (e.message !== 'cancelled') setError(e.message);
    }
  };

  return (
    <Modal title={editing ? 'Edit chore' : 'New chore'} onClose={onClose}>
      <Field label="Chore">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Make the bed" />
      </Field>
      <Field label="Icon">
        <div className="emoji-row">
          {CHORE_ICONS.map((i) => (
            <button key={i} type="button" className={`emoji-dot ${icon === i ? 'selected' : ''}`} onClick={() => setIcon(icon === i ? '' : i)}>{i}</button>
          ))}
        </div>
      </Field>
      <Field label="Assigned to">
        <select value={memberId} onChange={(e) => setMemberId(Number(e.target.value))}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.avatar} {m.name}</option>)}
        </select>
      </Field>
      <Field label="Repeats">
        <div className="segmented">
          {[['daily', 'Every day'], ['days', 'Certain days'], ['weeks', 'Every other week'], ['once', 'One time']].map(([v, l]) => (
            <button key={v} className={mode === v ? 'active' : ''} onClick={() => setMode(v)}>{l}</button>
          ))}
        </div>
      </Field>
      {(mode === 'days' || mode === 'weeks') && (
        <>
          <div className="weekday-row">
            {WEEKDAY_INITIALS.map((l, i) => (
              <button
                key={i}
                className={`weekday-dot ${days.includes(i) ? 'on' : ''}`}
                onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
              >
                {l}
              </button>
            ))}
          </div>
          {mode === 'weeks' && (
            <Field label="Starting the week of">
              <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
              <p className="muted small">
                Repeats every {every === 2 ? 'other' : `${every}th`} week from this date, so the week runs from this
                day. Give the other person the same chore starting a week later and they will alternate.
              </p>
            </Field>
          )}
          <label className="row gap check-row">
            <input type="checkbox" checked={holidayShift} onChange={(e) => setHolidayShift(e.target.checked)} />
            <span>Move to the next day if the day before was a holiday <span className="muted">(trash day)</span></span>
          </label>
          {mode === 'weeks' && days.length === 7 && (
            <p className="muted small">Every day of that week.</p>
          )}
        </>
      )}
      {mode === 'once' && (
        <Field label="Due date">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      )}
      <div className="row gap wrap">
        <Field label="Time of day">
          <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)}>
            <option value="any">Anytime</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </Field>
        <Field label="Stars earned">
          <input type="number" min="0" max="99" value={stars} onChange={(e) => setStars(e.target.value)} />
        </Field>
      </div>
      {error && <p className="pin-error">{error}</p>}
      <div className="modal-actions">
        {editing && <button className="btn danger" onClick={remove}>Delete</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

export default function Chores() {
  const { members, ticks } = useApp();
  const [date, setDate] = useState(today());
  const [board, setBoard] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [editor, setEditor] = useState(null);
  const [overview, setOverview] = useState(false);
  const [justDone, setJustDone] = useState(null);

  useEffect(() => {
    api.get(`/chores/board?date=${date}`).then((r) => setBoard(r.chores)).catch(() => {});
    api
      .get(`/chores/completions?from=${addDays(date, -27)}&to=${date}`)
      .then((r) => setCompletions(r.completions))
      .catch(() => {});
  }, [date, ticks.chores]);

  const toggle = async (chore) => {
    if (chore.completed) {
      await api.post(`/chores/${chore.id}/uncomplete`, { date });
    } else {
      setJustDone(chore.id);
      setTimeout(() => setJustDone(null), 900);
      await api.post(`/chores/${chore.id}/complete`, { date, member_id: chore.member_id });
    }
  };

  // Streak: consecutive days (ending at `date`) where the member completed at
  // least one chore. Today not being done yet doesn't break the streak.
  const streaks = useMemo(() => {
    const out = {};
    for (const m of members) {
      const days = new Set(completions.filter((c) => c.completed_by_member_id === m.id).map((c) => c.date));
      let streak = 0;
      for (let i = 0; i < 28; i++) {
        const d = addDays(date, -i);
        if (days.has(d)) streak++;
        else if (i > 0) break;
      }
      out[m.id] = streak;
    }
    return out;
  }, [completions, members, date]);

  const groups = ['morning', 'afternoon', 'evening', 'any'];

  return (
    <div className="chores">
      <div className="cal-toolbar">
        <div className="row gap">
          <button className="btn" onClick={() => setDate(addDays(date, -1))}>‹</button>
          <button className="btn" onClick={() => setDate(today())}>Today</button>
          <button className="btn" onClick={() => setDate(addDays(date, 1))}>›</button>
          <h1 className="cal-heading">{date === today() ? "Today's chores" : fmtDateLong(date)}</h1>
        </div>
        <div className="row gap">
          <div className="segmented">
            <button className={!overview ? 'active' : ''} onClick={() => setOverview(false)}>By person</button>
            <button className={overview ? 'active' : ''} onClick={() => setOverview(true)}>Overview</button>
          </div>
          <button className="btn primary" onClick={() => setEditor({})}>+ Chore</button>
        </div>
      </div>

      {!overview && (
        <div className="chore-columns">
          {members.map((m) => {
            const mine = board.filter((c) => c.member_id === m.id);
            const doneCount = mine.filter((c) => c.completed).length;
            return (
              <section key={m.id} className="chore-col card" style={{ borderTopColor: m.color }}>
                <header className="chore-col-head">
                  <Avatar member={m} size={44} />
                  <div>
                    <h2>{m.name}</h2>
                    <span className="muted small">
                      {mine.length ? `${doneCount}/${mine.length} done` : 'No chores'}
                      {streaks[m.id] > 1 && ` · 🔥 ${streaks[m.id]}-day streak`}
                    </span>
                  </div>
                  <span className="star-badge">⭐ {m.stars}</span>
                </header>
                {groups.map((g) => {
                  const bucket = mine.filter((c) => c.time_of_day === g);
                  if (!bucket.length) return null;
                  return (
                    <div key={g}>
                      <div className="bucket-label">{TIME_LABELS[g]}</div>
                      {bucket.map((c) => (
                        <div key={c.id} className={`chore-row ${c.completed ? 'done' : ''} ${justDone === c.id ? 'pop' : ''}`}>
                          <button className="chore-check" onClick={() => toggle(c)} aria-label={c.completed ? 'Undo' : 'Complete'}>
                            {c.completed ? '✔' : ''}
                          </button>
                          <button className="chore-body" onClick={() => toggle(c)}>
                            <span className="chore-title">{c.icon && `${c.icon} `}{c.title}</span>
                            {c.star_value > 0 && <span className="chore-stars">+{c.star_value}⭐</span>}
                          </button>
                          <button className="icon-btn subtle" onClick={() => setEditor(c)} aria-label="Edit">✎</button>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {mine.length === 0 && <p className="empty small">Nothing today 🎈</p>}
              </section>
            );
          })}
        </div>
      )}

      {overview && (
        <div className="card overview-wrap">
          <table className="overview-table">
            <thead>
              <tr>
                <th>Chore</th>
                {members.map((m) => (
                  <th key={m.id}><Avatar member={m} size={34} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.map((c) => (
                <tr key={c.id}>
                  <td>{c.icon && `${c.icon} `}{c.title}</td>
                  {members.map((m) => (
                    <td key={m.id} className="overview-cell">
                      {c.member_id === m.id ? (
                        <button className={`chore-check ${c.completed ? '' : ''}`} onClick={() => toggle(c)}>
                          {c.completed ? '✔' : ''}
                        </button>
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {board.length === 0 && (
                <tr><td colSpan={members.length + 1} className="empty">No chores due today.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editor && <ChoreEditor initial={editor} onClose={() => setEditor(null)} onSaved={() => setEditor(null)} />}
    </div>
  );
}
