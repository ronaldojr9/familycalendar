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

// An event's mark: either a plain emoji, or a named badge the app draws itself
// for things no emoji covers. Named marks are simple fan-style graphics for a
// household's own wall display.
const NAMED_MARKS = {
  // On a month grid this renders around 15px, so it is drawn for that size:
  // the horn and the purple are the whole identity, and a facemask at this
  // scale only turns into a grey smudge.
  vikings: (size) => (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Minnesota Vikings" focusable="false">
      {/* helmet: domed top, jaw cut away at the lower right */}
      <path
        d="M50 6c25 0 44 18 44 42 0 9-2 17-6 24-4 7-10 11-18 11-6 0-10-2-14-6-3-3-6-4-11-4-22 0-39-14-39-34C6 22 25 6 50 6z"
        fill="#4F2683"
      />
      {/* horn */}
      <path
        d="M22 22c-5 9-2 18 8 24 8 5 17 6 25 8 8 2 13 6 15 11 2 5 1 10-3 14 10-3 16-10 16-19 0-13-11-22-26-25-10-2-19-3-25-7-4-2-8-4-10-6z"
        fill="#fff"
      />
      {/* gold sweep under the horn */}
      <path d="M67 65c3 7-1 14-9 17-5 2-11 2-15-1 8 8 20 7 28 1 5-5 5-12 1-17z" fill="#FFC62F" />
      {/* ear hole */}
      <circle cx="38" cy="57" r="7.5" fill="#fff" />
    </svg>
  ),
};

export function EventIcon({ icon, size = 16 }) {
  if (!icon) return null;
  const mark = NAMED_MARKS[icon];
  if (mark) return <span className="event-mark">{mark(size)}</span>;
  return <span className="event-mark emoji">{icon}</span>;
}
