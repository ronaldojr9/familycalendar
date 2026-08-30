import React, { useState } from 'react';
import { api } from '../api.js';
import { PALETTE, useApp } from '../store.jsx';
import { ColorPicker, EmojiPicker, Field } from './ui.jsx';

export default function SetupWizard() {
  const { reloadCore } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [members, setMembers] = useState([{ name: '', color: PALETTE[0], avatar: '😀', is_child: false }]);
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const searchLocation = async () => {
    const r = await api.get(`/weather/geocode?q=${encodeURIComponent(locQuery)}`);
    setLocResults(r.results);
  };

  const updateMember = (i, patch) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/household', {
        name,
        pin,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        weather_location: location,
        members: members.filter((m) => m.name.trim()),
      });
      await reloadCore();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const steps = [
    // Step 0: household name
    <>
      <h1>Welcome to Family Hub</h1>
      <p className="muted">Let's set up your household. This only happens once.</p>
      <Field label="Household name">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="The Smiths" />
      </Field>
      <button className="btn primary big" disabled={!name.trim()} onClick={() => setStep(1)}>Next</button>
    </>,

    // Step 1: family members
    <>
      <h1>Who's in the family?</h1>
      <p className="muted">Everyone gets a color used across the whole hub — calendar, chores, lists.</p>
      {members.map((m, i) => (
        <div key={i} className="setup-member card">
          <div className="row gap">
            <input
              value={m.name}
              placeholder={`Family member ${i + 1}`}
              onChange={(e) => updateMember(i, { name: e.target.value })}
            />
            <label className="check-inline">
              <input type="checkbox" checked={m.is_child} onChange={(e) => updateMember(i, { is_child: e.target.checked })} />
              Kid
            </label>
            {members.length > 1 && (
              <button className="icon-btn" onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
          <ColorPicker palette={PALETTE} value={m.color} onChange={(c) => updateMember(i, { color: c })} />
          <EmojiPicker value={m.avatar} onChange={(a) => updateMember(i, { avatar: a })} />
        </div>
      ))}
      <button
        className="btn"
        onClick={() =>
          setMembers((ms) => [...ms, { name: '', color: PALETTE[ms.length % PALETTE.length], avatar: '😀', is_child: false }])
        }
      >
        + Add another
      </button>
      <div className="row gap top-space">
        <button className="btn" onClick={() => setStep(0)}>Back</button>
        <button className="btn primary big" disabled={!members.some((m) => m.name.trim())} onClick={() => setStep(2)}>Next</button>
      </div>
    </>,

    // Step 2: weather location (optional)
    <>
      <h1>Weather location</h1>
      <p className="muted">Optional — shows the forecast next to your calendar. Powered by Open-Meteo.</p>
      <div className="row gap">
        <input
          value={locQuery}
          placeholder="City name…"
          onChange={(e) => setLocQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
        />
        <button className="btn" onClick={searchLocation}>Search</button>
      </div>
      <div className="loc-results">
        {locResults.map((r, i) => (
          <button
            key={i}
            className={`btn loc ${location?.name === r.name ? 'primary' : ''}`}
            onClick={() => setLocation(r)}
          >
            📍 {r.name}
          </button>
        ))}
      </div>
      {location && <p>Selected: <strong>{location.name}</strong></p>}
      <div className="row gap top-space">
        <button className="btn" onClick={() => setStep(1)}>Back</button>
        <button className="btn primary big" onClick={() => setStep(3)}>{location ? 'Next' : 'Skip'}</button>
      </div>
    </>,

    // Step 3: PIN
    <>
      <h1>Set a parent PIN</h1>
      <p className="muted">A 4-digit PIN protects settings, family profiles, chore setup and reward redemptions. Kids can still view everything and check off their own chores.</p>
      <Field label="4-digit PIN">
        <input
          type="password" inputMode="numeric" maxLength={4} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <Field label="Confirm PIN">
        <input
          type="password" inputMode="numeric" maxLength={4} value={pin2}
          onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      {error && <p className="pin-error">{error}</p>}
      <div className="row gap top-space">
        <button className="btn" onClick={() => setStep(2)}>Back</button>
        <button
          className="btn primary big"
          disabled={busy || pin.length !== 4 || pin !== pin2}
          onClick={finish}
        >
          {busy ? 'Creating…' : 'Create household'}
        </button>
      </div>
      {pin && pin2 && pin !== pin2 && <p className="pin-error">PINs don't match</p>}
    </>,
  ];

  return (
    <div className="setup-wrap">
      <div className="setup-card">
        <div className="setup-progress">
          {[0, 1, 2, 3].map((i) => <span key={i} className={`setup-bar ${i <= step ? 'on' : ''}`} />)}
        </div>
        {steps[step]}
      </div>
    </div>
  );
}
