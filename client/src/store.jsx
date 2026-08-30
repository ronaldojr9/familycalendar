import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from './api.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export const PALETTE = [
  '#E15554', '#EE8434', '#EAB308', '#3BB273', '#14B8A6',
  '#4D9DE0', '#7768AE', '#E15D9F', '#8D6E63', '#64748B',
];

export function AppProvider({ children }) {
  const [household, setHousehold] = useState(undefined); // undefined = loading, null = needs setup
  const [members, setMembers] = useState([]);
  const [weather, setWeather] = useState(null);
  const [countdowns, setCountdowns] = useState([]);
  const [settings, setSettings] = useState({});
  const [connected, setConnected] = useState(true);
  // Per-domain change counters; views re-fetch when their domain bumps.
  const [ticks, setTicks] = useState({ events: 0, chores: 0, lists: 0, meals: 0, rewards: 0, members: 0 });
  const bump = useCallback((domain) => setTicks((t) => ({ ...t, [domain]: t[domain] + 1 })), []);

  // ----- PIN handling: cache the verified PIN in memory for this tab -----
  const pinRef = useRef(null);
  const [pinPrompt, setPinPrompt] = useState(null); // { resolve, reject, error }

  const requestPin = useCallback((error) => {
    return new Promise((resolve, reject) => setPinPrompt({ resolve, reject, error }));
  }, []);

  const withPin = useCallback(
    async (fn) => {
      let error = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        let pin = pinRef.current;
        if (!pin) {
          try {
            pin = await requestPin(error);
          } finally {
            setPinPrompt(null);
          }
          pinRef.current = pin;
        }
        try {
          return await fn(pin);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            pinRef.current = null;
            error = 'Wrong PIN — try again';
            continue;
          }
          throw e;
        }
      }
      throw new Error('PIN attempts exhausted');
    },
    [requestPin]
  );

  // ----- core loaders -----
  const loadCore = useCallback(async () => {
    const [h, m, s] = await Promise.all([api.get('/household'), api.get('/members'), api.get('/settings')]);
    setHousehold(h.household);
    setMembers(m.members);
    setSettings(s.settings);
  }, []);

  const loadWeather = useCallback(async () => {
    try {
      const w = await api.get('/weather');
      setWeather(w.weather);
    } catch {
      setWeather(null);
    }
  }, []);

  const loadCountdowns = useCallback(async () => {
    try {
      const c = await api.get('/events/countdowns');
      setCountdowns(c.countdowns);
    } catch {}
  }, []);

  useEffect(() => {
    loadCore().catch(() => setHousehold(null));
  }, [loadCore]);

  useEffect(() => {
    if (!household) return;
    loadWeather();
    loadCountdowns();
    const t = setInterval(loadWeather, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [household?.id, loadWeather, loadCountdowns]);

  // ----- realtime sync -----
  useEffect(() => {
    let socket;
    let retry = 0;
    let closed = false;
    let timer;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${proto}://${location.host}/ws`);
      socket.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      socket.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        const t = msg.type || '';
        if (t.startsWith('event.')) {
          bump('events');
          loadCountdowns();
        } else if (t.startsWith('chore.') || t.startsWith('star.')) {
          bump('chores');
          bump('rewards');
          api.get('/members').then((r) => setMembers(r.members)).catch(() => {});
        } else if (t.startsWith('list.')) {
          bump('lists');
        } else if (t.startsWith('meal.') || t.startsWith('recipe.')) {
          bump('meals');
        } else if (t.startsWith('reward.')) {
          bump('rewards');
        } else if (t.startsWith('member.') || t.startsWith('household.') || t.startsWith('settings.')) {
          bump('members');
          loadCore().catch(() => {});
          loadWeather();
        }
      };
      socket.onclose = () => {
        if (closed) return;
        setConnected(false);
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [bump, loadCore, loadWeather, loadCountdowns]);

  const value = useMemo(
    () => ({
      household,
      members,
      weather,
      countdowns,
      settings,
      connected,
      ticks,
      withPin,
      pinPrompt,
      reloadCore: loadCore,
      memberById: (id) => members.find((m) => m.id === id),
      use24h: settings.clock === '24h',
    }),
    [household, members, weather, countdowns, settings, connected, ticks, withPin, pinPrompt, loadCore]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
