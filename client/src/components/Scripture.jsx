import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// The daily reading. Compact on the dashboard — reference, translation, and as
// much of the chapter as fits — and a full-page reader when someone wants to
// actually sit and read it.

function VerseList({ passage, size = 'compact' }) {
  return (
    <div className={`verses ${size}`}>
      {passage.verses.map((v) => (
        <p key={v.verse} className="verse">
          <span className="verse-num">{v.verse}</span>
          {v.text}
        </p>
      ))}
    </div>
  );
}

function Reader({ reading, onClose }) {
  // Escape closes, as in any full-screen reader.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="reader" role="dialog" aria-label="Today's reading">
      <header className="reader-bar">
        <h2>Today's reading</h2>
        <span className="version-tag">{reading.passages[0]?.version}</span>
        <span className="spacer" />
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="reader-body">
        {reading.passages.map((p) => (
          <section key={p.book} className="reader-passage">
            <h3 className="reader-ref">{p.reference}</h3>
            <VerseList passage={p} size="full" />
          </section>
        ))}
      </div>
    </div>
  );
}

export default function ScripturePanel({ date }) {
  const [reading, setReading] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    setError('');
    api
      .get(`/scripture?date=${date}`)
      .then((r) => live && setReading(r))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [date]);

  if (error) return <p className="empty">Couldn't load the reading — {error}</p>;
  if (!reading) return <p className="empty muted">Loading…</p>;

  const note = reading.passages.find((p) => p.note)?.note;

  return (
    <>
      <div className="scripture is-compact">
        <div className="scripture-refs">
          {reading.passages.map((p) => (
            <span key={p.book} className="scripture-ref">
              {p.reference}
            </span>
          ))}
          <span className="version-tag" title={reading.passages[0]?.version === 'WEB' ? 'World English Bible (public domain)' : 'New Living Translation'}>
            {reading.passages[0]?.version}
          </span>
        </div>

        <div className="scripture-cols">
          {reading.passages.map((p) => (
            <div key={p.book} className="scripture-col">
              <h4 className="scripture-col-ref">{p.reference}</h4>
              <VerseList passage={p} />
            </div>
          ))}
        </div>

        <div className="scripture-actions">
          <button className="btn" onClick={() => setOpen(true)}>
            Read full chapters
          </button>
          {note && <span className="muted small">{note}</span>}
        </div>
      </div>

      {open && <Reader reading={reading} onClose={() => setOpen(false)} />}
    </>
  );
}
