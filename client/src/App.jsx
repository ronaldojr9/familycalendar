import React, { useEffect, useState } from 'react';
import { useApp } from './store.jsx';
import SetupWizard from './components/SetupWizard.jsx';
import PinModal from './components/PinModal.jsx';
import Calendar from './components/Calendar.jsx';
import Chores from './components/Chores.jsx';
import Lists from './components/Lists.jsx';
import Meals from './components/Meals.jsx';
import Rewards from './components/Rewards.jsx';
import Settings from './components/Settings.jsx';
import { weatherIcon } from './components/ui.jsx';

const TABS = [
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'chores', label: 'Chores', icon: '✅' },
  { id: 'lists', label: 'Lists', icon: '📝' },
  { id: 'meals', label: 'Meals', icon: '🍽️' },
  { id: 'rewards', label: 'Rewards', icon: '⭐' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

function Clock({ use24h }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !use24h });
  return <span className="clock">{time}</span>;
}

export default function App() {
  const { household, weather, connected, use24h } = useApp();
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'calendar');

  useEffect(() => {
    const onHash = () => setTab(location.hash.slice(1) || 'calendar');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (household === undefined) return <div className="loading">Loading…</div>;
  if (household === null) return (<><SetupWizard /><PinModal /></>);

  const go = (id) => {
    location.hash = id;
    setTab(id);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🏠</span>
          <span className="brand-name">{household.name}</span>
          <Clock use24h={use24h} />
        </div>
        {weather && (
          <div className="weather-strip" title={weather.location_name || ''}>
            <span className="weather-now">
              {weatherIcon(weather.current.code)} {weather.current.temp}°
            </span>
            {weather.daily.slice(1, 4).map((d) => (
              <span key={d.date} className="weather-day">
                <span className="weather-day-name">{new Date(d.date + 'T12:00').toLocaleDateString([], { weekday: 'short' })}</span>
                {weatherIcon(d.code)} {d.high}°/{d.low}°
              </span>
            ))}
          </div>
        )}
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => go(t.id)}>
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {!connected && <div className="reconnect-banner">Reconnecting to the hub…</div>}

      <main className="main">
        {tab === 'calendar' && <Calendar />}
        {tab === 'chores' && <Chores />}
        {tab === 'lists' && <Lists />}
        {tab === 'meals' && <Meals />}
        {tab === 'rewards' && <Rewards />}
        {tab === 'settings' && <Settings />}
      </main>

      <PinModal />
    </div>
  );
}
