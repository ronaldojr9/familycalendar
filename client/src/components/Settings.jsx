import React, { useState } from 'react';
import { api } from '../api.js';
import { PALETTE, useApp } from '../store.jsx';
import { Modal, Field, ColorPicker, EmojiPicker, Avatar } from './ui.jsx';

function MemberEditor({ initial, onClose }) {
  const { withPin } = useApp();
  const [name, setName] = useState(initial.name || '');
  const [color, setColor] = useState(initial.color || PALETTE[0]);
  const [avatar, setAvatar] = useState(initial.avatar || '😀');
  const [isChild, setIsChild] = useState(initial.is_child || false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) return setError('Name is required');
    const body = { name: name.trim(), color, avatar, is_child: isChild };
    try {
      await withPin((pin) => (initial.id ? api.put(`/members/${initial.id}`, body, pin) : api.post('/members', body, pin)));
      onClose();
    } catch (e) {
      if (e.message !== 'cancelled') setError(e.message);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${initial.name} from the family? Their events, chores and stars go too.`)) return;
    try {
      await withPin((pin) => api.del(`/members/${initial.id}`, pin));
      onClose();
    } catch {}
  };

  return (
    <Modal title={initial.id ? `Edit ${initial.name}` : 'Add family member'} onClose={onClose}>
      <Field label="Name">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Color">
        <ColorPicker palette={PALETTE} value={color} onChange={setColor} />
      </Field>
      <Field label="Avatar">
        <EmojiPicker value={avatar} onChange={setAvatar} />
      </Field>
      <label className="check-inline">
        <input type="checkbox" checked={isChild} onChange={(e) => setIsChild(e.target.checked)} />
        This is a kid's profile
      </label>
      {error && <p className="pin-error">{error}</p>}
      <div className="modal-actions">
        {initial.id && <button className="btn danger" onClick={remove}>Remove</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

export default function Settings() {
  const { household, members, settings, withPin, use24h } = useApp();
  const [memberEditor, setMemberEditor] = useState(null);
  const [name, setName] = useState(household.name);
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [newPin, setNewPin] = useState('');
  const [msg, setMsg] = useState('');

  const currentLoc = (() => {
    try {
      return household.weather_location ? JSON.parse(household.weather_location) : null;
    } catch {
      return null;
    }
  })();

  const saveHousehold = async (patch) => {
    setMsg('');
    try {
      await withPin((pin) => api.put('/household', patch, pin));
      setMsg('Saved ✓');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      if (e.message !== 'cancelled') setMsg(e.message);
    }
  };

  const searchLocation = async () => {
    const r = await api.get(`/weather/geocode?q=${encodeURIComponent(locQuery)}`);
    setLocResults(r.results);
  };

  const setClock = async (mode) => {
    try {
      await withPin((pin) => api.put('/settings', { clock: mode }, pin));
    } catch {}
  };

  const reorder = async (member, dir) => {
    const idx = members.findIndex((m) => m.id === member.id);
    const other = members[idx + dir];
    if (!other) return;
    try {
      await withPin(async (pin) => {
        await api.put(`/members/${member.id}`, { sort_order: other.sort_order }, pin);
        await api.put(`/members/${other.id}`, { sort_order: member.sort_order }, pin);
      });
    } catch {}
  };

  return (
    <div className="settings">
      <h1 className="cal-heading">Settings</h1>
      <p className="muted">Everything on this page asks for the parent PIN when saved.</p>
      {msg && <p className="save-msg">{msg}</p>}

      <section className="card settings-section">
        <h2>Family members</h2>
        <div className="settings-members">
          {members.map((m, i) => (
            <div key={m.id} className="settings-member-row">
              <Avatar member={m} size={40} />
              <span className="settings-member-name">
                {m.name} {m.is_child && <span className="kid-tag">kid</span>}
              </span>
              <button className="icon-btn" disabled={i === 0} onClick={() => reorder(m, -1)}>↑</button>
              <button className="icon-btn" disabled={i === members.length - 1} onClick={() => reorder(m, 1)}>↓</button>
              <button className="btn small" onClick={() => setMemberEditor(m)}>Edit</button>
            </div>
          ))}
        </div>
        <button className="btn" onClick={() => setMemberEditor({})}>+ Add member</button>
      </section>

      <section className="card settings-section">
        <h2>Household</h2>
        <Field label="Household name">
          <div className="row gap">
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn" disabled={name === household.name} onClick={() => saveHousehold({ name })}>Save</button>
          </div>
        </Field>
        <Field label="Clock format">
          <div className="segmented">
            <button className={!use24h ? 'active' : ''} onClick={() => setClock('12h')}>12-hour</button>
            <button className={use24h ? 'active' : ''} onClick={() => setClock('24h')}>24-hour</button>
          </div>
        </Field>
      </section>

      <section className="card settings-section">
        <h2>Weather location</h2>
        <p className="muted small">{currentLoc ? `Current: ${currentLoc.name}` : 'Not set — no forecast shown.'}</p>
        <div className="row gap">
          <input
            value={locQuery}
            placeholder="Search city…"
            onChange={(e) => setLocQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
          />
          <button className="btn" onClick={searchLocation}>Search</button>
        </div>
        <div className="loc-results">
          {locResults.map((r, i) => (
            <button key={i} className="btn loc" onClick={() => saveHousehold({ weather_location: r })}>📍 {r.name}</button>
          ))}
        </div>
        {currentLoc && <button className="btn small" onClick={() => saveHousehold({ weather_location: null })}>Remove location</button>}
      </section>

      <section className="card settings-section">
        <h2>Parent PIN</h2>
        <Field label="New 4-digit PIN">
          <div className="row gap">
            <input
              type="password" inputMode="numeric" maxLength={4} value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            />
            <button
              className="btn"
              disabled={newPin.length !== 4}
              onClick={async () => {
                await saveHousehold({ new_pin: newPin });
                setNewPin('');
              }}
            >
              Change PIN
            </button>
          </div>
        </Field>
        <p className="muted small">You'll confirm with the current PIN first.</p>
      </section>

      <section className="card settings-section">
        <h2>Connecting devices</h2>
        <p className="muted">
          Open <strong>{location.origin}</strong> from any phone, tablet or computer on your home Wi-Fi.
          On the iPad, use Safari's <em>Share → Add to Home Screen</em> for a fullscreen hub, and turn on
          Guided Access (Settings → Accessibility) to lock it to this app.
        </p>
      </section>

      {memberEditor && <MemberEditor initial={memberEditor} onClose={() => setMemberEditor(null)} />}
    </div>
  );
}
