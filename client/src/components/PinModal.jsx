import React, { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';

// Renders whenever a PIN-gated action is waiting on a PIN.
export default function PinModal() {
  const { pinPrompt } = useApp();
  const [digits, setDigits] = useState('');

  useEffect(() => setDigits(''), [pinPrompt]);

  useEffect(() => {
    if (!pinPrompt) return;
    if (digits.length === 4) {
      const d = digits;
      setTimeout(() => pinPrompt.resolve(d), 120);
    }
  }, [digits, pinPrompt]);

  useEffect(() => {
    if (!pinPrompt) return;
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) setDigits((d) => (d.length < 4 ? d + e.key : d));
      else if (e.key === 'Backspace') setDigits((d) => d.slice(0, -1));
      else if (e.key === 'Escape') pinPrompt.reject(new Error('cancelled'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinPrompt]);

  if (!pinPrompt) return null;

  const press = (n) => setDigits((d) => (d.length < 4 ? d + n : d));

  return (
    <div className="modal-backdrop pin-backdrop">
      <div className="modal pin-modal" role="dialog" aria-modal="true">
        <h2>Parent PIN</h2>
        {pinPrompt.error && <p className="pin-error">{pinPrompt.error}</p>}
        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot ${i < digits.length ? 'filled' : ''}`} />
          ))}
        </div>
        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} onClick={() => press(String(n))}>{n}</button>
          ))}
          <button className="pin-ghost" onClick={() => pinPrompt.reject(new Error('cancelled'))}>Cancel</button>
          <button onClick={() => press('0')}>0</button>
          <button className="pin-ghost" onClick={() => setDigits((d) => d.slice(0, -1))}>⌫</button>
        </div>
      </div>
    </div>
  );
}
