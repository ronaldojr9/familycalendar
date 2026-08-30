import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { PALETTE, useApp } from '../store.jsx';
import { Modal, Field, ColorPicker } from './ui.jsx';

const TYPE_ICON = { grocery: '🛒', todo: '☑️', custom: '📋' };

function ListEditor({ initial, onClose }) {
  const [title, setTitle] = useState(initial.title || '');
  const [color, setColor] = useState(initial.color || PALETTE[5]);
  const [type, setType] = useState(initial.type || 'custom');
  const [error, setError] = useState('');

  const save = async () => {
    if (!title.trim()) return setError('Give the list a name');
    try {
      if (initial.id) await api.put(`/lists/${initial.id}`, { title: title.trim(), color, type });
      else await api.post('/lists', { title: title.trim(), color, type });
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Modal title={initial.id ? 'Edit list' : 'New list'} onClose={onClose}>
      <Field label="Name">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Camping packing list" />
      </Field>
      <Field label="Type">
        <div className="segmented">
          {[['grocery', '🛒 Grocery'], ['todo', '☑️ To-do'], ['custom', '📋 Custom']].map(([v, l]) => (
            <button key={v} className={type === v ? 'active' : ''} onClick={() => setType(v)}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="Color">
        <ColorPicker palette={PALETTE} value={color} onChange={setColor} />
      </Field>
      {error && <p className="pin-error">{error}</p>}
      <div className="modal-actions">
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

function ListDetail({ list, onBack }) {
  const { withPin } = useApp();
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const open = list.items.filter((i) => !i.is_checked);
  const checked = list.items.filter((i) => i.is_checked);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await api.post(`/lists/${list.id}/items`, { text: t });
    inputRef.current?.focus();
  };

  const toggle = (item) => api.put(`/lists/${list.id}/items/${item.id}`, { is_checked: !item.is_checked });
  const removeItem = (item) => api.del(`/lists/${list.id}/items/${item.id}`);

  const removeList = async () => {
    if (!confirm(`Delete the whole list "${list.title}"?`)) return;
    try {
      await withPin((pin) => api.del(`/lists/${list.id}`, pin));
      onBack();
    } catch {}
  };

  return (
    <div className="list-detail">
      <div className="cal-toolbar">
        <div className="row gap">
          <button className="btn" onClick={onBack}>‹ All lists</button>
          <h1 className="cal-heading">
            <span className="list-dot" style={{ background: list.color }} /> {list.title}
          </h1>
        </div>
        <div className="row gap">
          {checked.length > 0 && (
            <button className="btn" onClick={() => api.post(`/lists/${list.id}/clear-checked`, {})}>Clear checked</button>
          )}
          <button className="btn danger" onClick={removeList}>Delete list</button>
        </div>
      </div>

      <div className="card list-card-body">
        <div className="row gap">
          <input
            ref={inputRef}
            value={text}
            placeholder="Add an item and press Enter…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn primary" onClick={add}>Add</button>
        </div>

        <ul className="items">
          {open.map((i) => (
            <li key={i.id} className="item-row">
              <button className="chore-check" onClick={() => toggle(i)} aria-label="Check off" />
              <span className="item-text">{i.text}</span>
              <button className="icon-btn subtle" onClick={() => removeItem(i)} aria-label="Delete">✕</button>
            </li>
          ))}
          {checked.map((i) => (
            <li key={i.id} className="item-row checked">
              <button className="chore-check checked" onClick={() => toggle(i)}>✔</button>
              <span className="item-text struck">{i.text}</span>
              <button className="icon-btn subtle" onClick={() => removeItem(i)} aria-label="Delete">✕</button>
            </li>
          ))}
          {list.items.length === 0 && <p className="empty">Empty list — add the first item above.</p>}
        </ul>
      </div>
    </div>
  );
}

export default function Lists() {
  const { ticks } = useApp();
  const [lists, setLists] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    api.get('/lists').then((r) => setLists(r.lists)).catch(() => {});
  }, [ticks.lists]);

  const open = lists.find((l) => l.id === openId);
  if (open) return <ListDetail list={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="lists">
      <div className="cal-toolbar">
        <h1 className="cal-heading">Lists</h1>
        <button className="btn primary" onClick={() => setEditor({})}>+ New list</button>
      </div>
      <div className="list-grid">
        {lists.map((l) => {
          const remaining = l.items.filter((i) => !i.is_checked).length;
          return (
            <button key={l.id} className="list-card card" style={{ borderTopColor: l.color }} onClick={() => setOpenId(l.id)}>
              <span className="list-card-icon">{TYPE_ICON[l.type] || '📋'}</span>
              <span className="list-card-title">{l.title}</span>
              <span className="muted small">{remaining ? `${remaining} to go` : l.items.length ? 'All done ✓' : 'Empty'}</span>
              <span className="list-preview">
                {l.items.filter((i) => !i.is_checked).slice(0, 3).map((i) => (
                  <span key={i.id} className="list-preview-item">• {i.text}</span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {editor && <ListEditor initial={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}
