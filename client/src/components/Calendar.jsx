import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { PALETTE, useApp } from '../store.jsx';
import { WEEKDAYS, MONTHS, fmt, parse, today, addDays, startOfWeek, diffDays, monthGrid, fmtTime, fmtDateLong } from '../dates.js';
import { Modal, Avatar, ColorPicker, Field } from './ui.jsx';

const FAMILY_COLOR = '#64748B';

function eventColor(ev, memberById) {
  if (ev.color_override) return ev.color_override;
  if (ev.member_ids.length === 1) return memberById(ev.member_ids[0])?.color || FAMILY_COLOR;
  return FAMILY_COLOR;
}

// ---------- event form ----------

function EventModal({ initial, onClose, onSaved }) {
  const { members } = useApp();
  const editing = !!initial.id;
  const [title, setTitle] = useState(initial.title || '');
  const [allDay, setAllDay] = useState(initial.all_day ?? false);
  const [date, setDate] = useState(initial.occurs_on || (initial.start_at || today()).slice(0, 10));
  const [startTime, setStartTime] = useState(initial.start_at?.length > 10 ? initial.start_at.slice(11, 16) : '09:00');
  const [endTime, setEndTime] = useState(initial.end_at?.length > 10 ? initial.end_at.slice(11, 16) : '10:00');
  const [memberIds, setMemberIds] = useState(initial.member_ids || []);
  const [locationText, setLocationText] = useState(initial.location || '');
  const [notes, setNotes] = useState(initial.description || '');
  const [recurrence, setRecurrence] = useState(initial.recurrence_rule || '');
  const [countdown, setCountdown] = useState(initial.countdown_enabled ?? false);
  const [colorOverride, setColorOverride] = useState(initial.color_override || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleMember = (id) =>
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const save = async () => {
    if (!title.trim()) return setError('Give the event a title');
    if (!allDay && endTime < startTime) return setError('End time is before start time');
    setBusy(true);
    setError('');
    const body = {
      title: title.trim(),
      description: notes,
      location: locationText,
      all_day: allDay,
      start_at: allDay ? date : `${date}T${startTime}`,
      end_at: allDay ? date : `${date}T${endTime}`,
      recurrence_rule: recurrence,
      member_ids: memberIds,
      color_override: colorOverride,
      countdown_enabled: countdown,
    };
    try {
      if (editing) await api.put(`/events/${initial.id}`, body);
      else await api.post('/events', body);
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${initial.title}"${initial.recurrence_rule ? ' and all its repeats' : ''}?`)) return;
    await api.del(`/events/${initial.id}`);
    onSaved();
  };

  return (
    <Modal title={editing ? 'Edit event' : 'New event'} onClose={onClose}>
      <Field label="Title">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Soccer practice" />
      </Field>
      <div className="row gap wrap">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <label className="check-inline tall">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          All day
        </label>
        {!allDay && (
          <>
            <Field label="Start">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="End">
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </>
        )}
      </div>
      <Field label="Who">
        <div className="member-toggle-row">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`member-chip ${memberIds.includes(m.id) ? 'on' : ''}`}
              style={memberIds.includes(m.id) ? { background: m.color, borderColor: m.color } : {}}
              onClick={() => toggleMember(m.id)}
            >
              {m.avatar} {m.name}
            </button>
          ))}
        </div>
      </Field>
      <div className="row gap wrap">
        <Field label="Repeats">
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            <option value="">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </Field>
        <label className="check-inline tall">
          <input type="checkbox" checked={countdown} onChange={(e) => setCountdown(e.target.checked)} />
          Show countdown badge
        </label>
      </div>
      <Field label="Location">
        <input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Notes">
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Field label="Color (optional — defaults to the member's color)">
        <div className="row gap">
          <ColorPicker palette={PALETTE} value={colorOverride} onChange={setColorOverride} />
          {colorOverride && <button className="btn small" onClick={() => setColorOverride(null)}>Reset</button>}
        </div>
      </Field>
      {error && <p className="pin-error">{error}</p>}
      <div className="modal-actions">
        {editing && <button className="btn danger" onClick={remove}>Delete</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

// ---------- event pills ----------

function EventPill({ ev, onClick, compact }) {
  const { memberById, use24h } = useApp();
  const color = eventColor(ev, memberById);
  const multi = !ev.color_override && ev.member_ids.length > 1;
  const stripe = multi
    ? `repeating-linear-gradient(135deg, ${ev.member_ids
        .map((id, i) => {
          const c = memberById(id)?.color || FAMILY_COLOR;
          return `${c} ${i * 6}px, ${c} ${(i + 1) * 6}px`;
        })
        .join(', ')})`
    : color;
  return (
    <button className={`event-pill ${compact ? 'compact' : ''}`} onClick={onClick}>
      <span className="event-bar" style={{ background: stripe }} />
      <span className="event-text">
        {!ev.all_day && <span className="event-time">{fmtTime(ev.start_at, use24h)}</span>}
        <span className="event-title">{ev.title}</span>
      </span>
    </button>
  );
}

// ---------- main calendar ----------

export default function Calendar() {
  const { members, ticks, countdowns, memberById, use24h } = useApp();
  const [view, setView] = useState('month'); // month | week | day
  const [anchor, setAnchor] = useState(today());
  const [events, setEvents] = useState([]);
  const [modal, setModal] = useState(null); // event object (with id = edit) or {occurs_on} for new
  const [hiddenMembers, setHiddenMembers] = useState(new Set());

  const anchorDate = parse(anchor);
  const range = useMemo(() => {
    if (view === 'month') {
      const cells = monthGrid(anchorDate.getFullYear(), anchorDate.getMonth());
      return [cells[0], cells[41]];
    }
    if (view === 'week') {
      const start = startOfWeek(anchor);
      return [start, addDays(start, 6)];
    }
    return [anchor, anchor];
  }, [view, anchor]);

  useEffect(() => {
    let live = true;
    api
      .get(`/events?range=${range[0]}..${range[1]}`)
      .then((r) => live && setEvents(r.events))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [range[0], range[1], ticks.events]);

  const visible = events.filter(
    (ev) => ev.member_ids.length === 0 || ev.member_ids.some((id) => !hiddenMembers.has(id))
  );
  const byDay = useMemo(() => {
    const map = new Map();
    for (const ev of visible) {
      // Multi-day events appear on each day they span.
      const span = Math.min(diffDays(ev.start_at.slice(0, 10), ev.end_at.slice(0, 10)), 30);
      for (let i = 0; i <= span; i++) {
        const d = addDays(ev.start_at.slice(0, 10), i);
        if (!map.has(d)) map.set(d, []);
        map.get(d).push(ev);
      }
    }
    return map;
  }, [visible]);

  const step = (dir) => {
    if (view === 'month') {
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1);
      setAnchor(fmt(d));
    } else if (view === 'week') setAnchor(addDays(anchor, dir * 7));
    else setAnchor(addDays(anchor, dir));
  };

  const toggleMemberFilter = (id) =>
    setHiddenMembers((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const heading =
    view === 'month'
      ? `${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
      : view === 'week'
        ? `Week of ${fmtDateLong(startOfWeek(anchor))}`
        : fmtDateLong(anchor);

  return (
    <div className="calendar">
      <div className="cal-toolbar">
        <div className="row gap">
          <button className="btn" onClick={() => step(-1)} aria-label="Previous">‹</button>
          <button className="btn" onClick={() => setAnchor(today())}>Today</button>
          <button className="btn" onClick={() => step(1)} aria-label="Next">›</button>
          <h1 className="cal-heading">{heading}</h1>
        </div>
        <div className="row gap">
          <div className="segmented">
            {['day', 'week', 'month'].map((v) => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={() => setModal({ occurs_on: view === 'month' ? today() : anchor })}>
            + Event
          </button>
        </div>
      </div>

      <div className="member-filter">
        {members.map((m) => (
          <Avatar key={m.id} member={m} size={38} active={!hiddenMembers.has(m.id)} onClick={() => toggleMemberFilter(m.id)} />
        ))}
      </div>

      {countdowns.length > 0 && (
        <div className="countdown-strip">
          {countdowns.map((c) => {
            const days = diffDays(today(), c.occurs_on);
            return (
              <button key={c.occurrence_id || c.id} className="countdown-chip" onClick={() => setModal(c)}
                style={{ borderColor: eventColor(c, memberById) }}>
                <strong>{days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days} days`}</strong> until {c.title}
              </button>
            );
          })}
        </div>
      )}

      {view === 'month' && (
        <div className="month-grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="month-head">{d}</div>
          ))}
          {monthGrid(anchorDate.getFullYear(), anchorDate.getMonth()).map((d) => {
            const inMonth = parse(d).getMonth() === anchorDate.getMonth();
            const isToday = d === today();
            const dayEvents = byDay.get(d) || [];
            return (
              <div
                key={d}
                className={`month-cell ${inMonth ? '' : 'dim'} ${isToday ? 'today' : ''}`}
                onClick={() => setModal({ occurs_on: d })}
              >
                <span className="month-daynum">{parse(d).getDate()}</span>
                <div className="month-events">
                  {dayEvents.slice(0, 4).map((ev) => (
                    <EventPill
                      key={ev.occurrence_id + ':' + d}
                      ev={ev}
                      compact
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal(ev);
                      }}
                    />
                  ))}
                  {dayEvents.length > 4 && (
                    <button
                      className="more-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnchor(d);
                        setView('day');
                      }}
                    >
                      +{dayEvents.length - 4} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'week' && (
        <div className="week-grid">
          {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)).map((d) => (
            <div key={d} className={`week-col ${d === today() ? 'today' : ''}`}>
              <button className="week-head" onClick={() => { setAnchor(d); setView('day'); }}>
                <span className="week-day">{WEEKDAYS[parse(d).getDay()]}</span>
                <span className="week-num">{parse(d).getDate()}</span>
              </button>
              <div className="week-events">
                {(byDay.get(d) || []).map((ev) => (
                  <EventPill key={ev.occurrence_id + ':' + d} ev={ev} onClick={() => setModal(ev)} />
                ))}
                <button className="add-slot" onClick={() => setModal({ occurs_on: d })}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'day' && (
        <div className="day-list">
          {(byDay.get(anchor) || []).length === 0 && <p className="empty">Nothing planned. Enjoy the free day! 🎉</p>}
          {(byDay.get(anchor) || []).map((ev) => (
            <button key={ev.occurrence_id} className="day-event" onClick={() => setModal(ev)}>
              <span className="event-bar big" style={{ background: eventColor(ev, memberById) }} />
              <span className="day-event-body">
                <span className="day-event-title">{ev.title}</span>
                <span className="day-event-meta">
                  {ev.all_day ? 'All day' : `${fmtTime(ev.start_at, use24h)} – ${fmtTime(ev.end_at, use24h)}`}
                  {ev.location && ` · 📍 ${ev.location}`}
                </span>
                {ev.member_ids.length > 0 && (
                  <span className="day-event-members">
                    {ev.member_ids.map((id) => {
                      const m = memberById(id);
                      return m ? <span key={id} className="mini-chip" style={{ background: m.color }}>{m.avatar} {m.name}</span> : null;
                    })}
                  </span>
                )}
              </span>
            </button>
          ))}
          <button className="btn primary big top-space" onClick={() => setModal({ occurs_on: anchor })}>+ Add event</button>
        </div>
      )}

      {modal && <EventModal initial={modal} onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
    </div>
  );
}
