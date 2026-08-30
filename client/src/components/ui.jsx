import React, { useEffect } from 'react';

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Avatar({ member, size = 40, active = true, onClick }) {
  const style = {
    width: size,
    height: size,
    fontSize: size * 0.52,
    background: active ? member.color : 'var(--surface-2)',
    opacity: active ? 1 : 0.45,
  };
  const inner = (
    <span className="avatar" style={style} title={member.name}>
      {member.avatar || member.name[0]}
    </span>
  );
  if (!onClick) return inner;
  return (
    <button className="avatar-btn" onClick={onClick} aria-pressed={active}>
      {inner}
      <span className="avatar-name" style={{ color: active ? 'var(--text)' : 'var(--text-dim)' }}>{member.name}</span>
    </button>
  );
}

export function ColorPicker({ palette, value, onChange }) {
  return (
    <div className="color-row">
      {palette.map((c) => (
        <button
          key={c}
          type="button"
          className={`color-dot ${value === c ? 'selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
    </div>
  );
}

export const EMOJI = ['😀','😎','🦄','🐱','🐶','🐻','🦊','🐸','🦖','⭐','🌈','⚽','🎨','🎮','🚀','👑','🌸','🐢'];

export function EmojiPicker({ value, onChange }) {
  return (
    <div className="emoji-row">
      {EMOJI.map((e) => (
        <button key={e} type="button" className={`emoji-dot ${value === e ? 'selected' : ''}`} onClick={() => onChange(e)}>
          {e}
        </button>
      ))}
    </div>
  );
}

export function weatherIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
