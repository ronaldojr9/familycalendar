import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { today, startOfWeek, fmtDateLong, currentBucket } from '../dates.js';
import { Avatar, EventIcon, weatherIcon } from './ui.jsx';
import ScripturePanel from './Scripture.jsx';

const BUCKET_LABEL = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌙 Evening', any: 'Anytime' };

const PANELS = [
  { id: 'weather', label: 'Weather' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'scripture', label: "Today's reading" },
  { id: 'chores', label: 'Chores' },
];

const ROTATE_SECONDS = 20;

function fmtTime(startAt, use24h) {
  if (!startAt || startAt.length <= 10) return 'All day';
  const [h, m] = startAt.slice(11, 16).split(':').map(Number);
  if (use24h) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ampm = h < 12 ? 'am' : 'pm';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr}${ampm}` : `${hr}:${String(m).padStart(2, '0')}${ampm}`;
}

function WeatherPanel({ weather }) {
  if (!weather) return <p className="empty">Weather isn't set up yet — add your city in Settings.</p>;
  return (
    <div className="today-weather">
      <div className="today-weather-now">
        <span className="today-weather-icon">{weatherIcon(weather.current.code)}</span>
        <span className="today-weather-temp">{weather.current.temp}°</span>
        {weather.location_name && <span className="muted">{weather.location_name}</span>}
      </div>
      <div className="today-weather-days">
        {weather.daily.slice(0, 4).map((d, i) => (
          <div key={d.date} className="today-weather-day">
            <span className="muted small">
              {i === 0 ? 'Today' : new Date(d.date + 'T12:00').toLocaleDateString([], { weekday: 'short' })}
            </span>
            <span className="today-weather-day-icon">{weatherIcon(d.code)}</span>
            <span>
              <strong>{d.high}°</strong> <span className="muted">{d.low}°</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchedulePanel({ events, members, use24h }) {
  if (!events.length) return <p className="empty">Nothing on the calendar today 🎈</p>;
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  return (
    <ul className="today-schedule">
      {events.map((ev) => {
        const owner = byId[ev.member_ids?.[0]];
        return (
          <li key={ev.occurrence_id} className="today-schedule-row">
            <span className="today-time">{fmtTime(ev.start_at, use24h)}</span>
            <span className="today-bar" style={{ background: ev.color_override || owner?.color || 'var(--accent)' }} />
            <span className="today-schedule-body">
              <span className="today-schedule-title">
                <EventIcon icon={ev.icon} size={16} />
                {ev.title}
              </span>
              {(ev.location || owner) && (
                <span className="muted small">
                  {owner?.name}
                  {owner && ev.location ? ' · ' : ''}
                  {ev.location}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DinnerPanel({ dinner, cooks }) {
  return (
    <div className="today-dinner">
      <span className="today-dinner-name">{dinner || 'Nothing planned'}</span>
      {cooks.length > 0 && (
        <span className="today-dinner-cook">
          {cooks.map((c) => (
            <span key={c.id} className="today-cook">
              <Avatar member={c} size={30} /> {c.name} cooks
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function ChoresPanel({ board, members, bucket }) {
  const inBucket = board.filter((c) => c.time_of_day === bucket || (bucket === 'evening' && c.time_of_day === 'any'));
  return (
    <div className="today-chores">
      {members.map((m) => {
        const mine = inBucket.filter((c) => c.member_id === m.id);
        const all = board.filter((c) => c.member_id === m.id);
        const done = all.filter((c) => c.completed).length;
        return (
          <div key={m.id} className="today-chore-col" style={{ borderTopColor: m.color }}>
            <div className="today-chore-head">
              <Avatar member={m} size={34} />
              <strong>{m.name}</strong>
              <span className="muted small">
                {done}/{all.length}
              </span>
            </div>
            {mine.length === 0 && <p className="muted small">Nothing right now</p>}
            <ul className="today-chore-list">
              {mine.slice(0, 8).map((c) => (
                <li key={c.id} className={c.completed ? 'done' : ''}>
                  <span className="today-chore-tick">{c.completed ? '✔' : '○'}</span>
                  {c.icon && `${c.icon} `}
                  {c.title}
                </li>
              ))}
            </ul>
            {mine.length > 8 && <span className="muted small">+{mine.length - 8} more</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function Today() {
  const { members, weather, ticks, use24h } = useApp();
  const [events, setEvents] = useState([]);
  const [board, setBoard] = useState([]);
  const [dinner, setDinner] = useState('');
  const [rotating, setRotating] = useState(() => {
    try {
      return localStorage.getItem('hub.rotate') === '1';
    } catch {
      return false;
    }
  });
  const [panel, setPanel] = useState(0);
  const [bucket, setBucket] = useState(currentBucket());
  const date = today();

  // Follow the clock so the board rolls over to the evening list on its own.
  useEffect(() => {
    const t = setInterval(() => setBucket(currentBucket()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get(`/events?range=${date}..${date}`).then((r) => setEvents(r.events)).catch(() => {});
  }, [date, ticks.events]);

  useEffect(() => {
    api.get(`/chores/board?date=${date}`).then((r) => setBoard(r.chores)).catch(() => {});
  }, [date, ticks.chores]);

  useEffect(() => {
    Promise.all([api.get(`/meal-plan?week=${startOfWeek(date)}`), api.get('/recipes')])
      .then(([plan, rec]) => {
        const entry = plan.entries.find((e) => e.date === date && e.meal_slot === 'dinner');
        if (!entry) return setDinner('');
        const recipe = rec.recipes.find((r) => r.id === entry.recipe_id);
        setDinner(recipe?.title || entry.free_text || '');
      })
      .catch(() => {});
  }, [date, ticks.meals]);

  const cooksIds = board.filter((c) => /^make dinner/i.test(c.title)).map((c) => c.member_id);

  // Rotation skips panels with nothing in them — an empty weather card holding
  // the wall display for 20 seconds is worse than not showing it at all.
  // Chores always qualify; they are the point of the board.
  const available = useMemo(
    () =>
      PANELS.filter((p) => {
        if (p.id === 'weather') return !!weather;
        if (p.id === 'schedule') return events.length > 0;
        if (p.id === 'dinner') return !!dinner || cooksIds.length > 0;
        return true; // scripture and chores always have something to show
      }),
    [weather, events.length, dinner, cooksIds.length]
  );

  // Rotation for ambient wall display.
  const rotateRef = useRef(null);
  useEffect(() => {
    try {
      localStorage.setItem('hub.rotate', rotating ? '1' : '0');
    } catch {}
    clearInterval(rotateRef.current);
    if (!rotating || available.length < 2) return;
    rotateRef.current = setInterval(() => setPanel((p) => (p + 1) % available.length), ROTATE_SECONDS * 1000);
    return () => clearInterval(rotateRef.current);
  }, [rotating, available.length]);

  const cooks = useMemo(() => members.filter((m) => cooksIds.includes(m.id)), [board, members]);

  const panels = {
    weather: <WeatherPanel weather={weather} />,
    schedule: <SchedulePanel events={events} members={members} use24h={use24h} />,
    dinner: <DinnerPanel dinner={dinner} cooks={cooks} />,
    chores: <ChoresPanel board={board} members={members} bucket={bucket} />,
    scripture: <ScripturePanel date={date} />,
  };

  const Card = ({ id, className = '' }) => (
    <section className={`card today-card ${className}`}>
      <h2 className="today-card-title">
        {id === 'chores' ? `Chores · ${BUCKET_LABEL[bucket]}` : PANELS.find((p) => p.id === id).label}
      </h2>
      {panels[id]}
    </section>
  );

  return (
    <div className="today">
      <div className="cal-toolbar">
        <h1 className="cal-heading">{fmtDateLong(date)}</h1>
        <div className="row gap">
          <button className={`btn ${rotating ? 'primary' : ''}`} onClick={() => setRotating((r) => !r)}>
            {rotating ? '⏸ Stop rotating' : '🔄 Rotate'}
          </button>
        </div>
      </div>

      {rotating ? (
        <div className="today-rotator">
          <Card id={(available[panel] || available[0]).id} className="today-featured" />
          <div className="today-dots">
            {available.map((p, i) => (
              <button
                key={p.id}
                className={`today-dot ${i === panel % available.length ? 'on' : ''}`}
                onClick={() => setPanel(i)}
                aria-label={p.label}
              />
            ))}
          </div>
        </div>
      ) : (
        // Chores last and full width: it is the heaviest panel, and the glanceable
        // things (weather, what's on, what's for dinner) belong above it.
        <div className="today-grid">
          <Card id="schedule" className="today-span2" />
          <Card id="weather" />
          <Card id="dinner" />
          <Card id="scripture" className="today-full" />
          <Card id="chores" className="today-full" />
        </div>
      )}
    </div>
  );
}
