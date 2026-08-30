import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Modal, Field, Avatar } from './ui.jsx';

const REWARD_ICONS = ['🎁','🍦','🎮','📺','🎬','🍕','🏊','🎢','🧁','🛍️','🌙','🚲'];

function RewardEditor({ initial, onClose }) {
  const { withPin } = useApp();
  const [title, setTitle] = useState(initial.title || '');
  const [cost, setCost] = useState(initial.star_cost ?? 10);
  const [icon, setIcon] = useState(initial.icon || '🎁');
  const [error, setError] = useState('');

  const save = async () => {
    if (!title.trim()) return setError('Give the reward a name');
    const body = { title: title.trim(), star_cost: Number(cost) || 0, icon };
    try {
      await withPin((pin) => (initial.id ? api.put(`/rewards/${initial.id}`, body, pin) : api.post('/rewards', body, pin)));
      onClose();
    } catch (e) {
      if (e.message !== 'cancelled') setError(e.message);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete reward "${initial.title}"?`)) return;
    try {
      await withPin((pin) => api.del(`/rewards/${initial.id}`, pin));
      onClose();
    } catch {}
  };

  return (
    <Modal title={initial.id ? 'Edit reward' : 'New reward'} onClose={onClose}>
      <Field label="Reward">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="30 min extra screen time" />
      </Field>
      <Field label="Star cost">
        <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
      </Field>
      <Field label="Icon">
        <div className="emoji-row">
          {REWARD_ICONS.map((i) => (
            <button key={i} type="button" className={`emoji-dot ${icon === i ? 'selected' : ''}`} onClick={() => setIcon(i)}>{i}</button>
          ))}
        </div>
      </Field>
      {error && <p className="pin-error">{error}</p>}
      <div className="modal-actions">
        {initial.id && <button className="btn danger" onClick={remove}>Delete</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

function RedeemModal({ reward, onClose }) {
  const { members, withPin } = useApp();
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const redeem = async (member) => {
    setError('');
    try {
      await withPin((pin) => api.post(`/rewards/${reward.id}/redeem`, { member_id: member.id }, pin));
      setDone(member);
    } catch (e) {
      if (e.message !== 'cancelled') setError(e.message);
    }
  };

  if (done) {
    return (
      <Modal title="Redeemed! 🎉" onClose={onClose}>
        <p className="redeem-done">{reward.icon} <strong>{done.name}</strong> redeemed <strong>{reward.title}</strong> for {reward.star_cost} ⭐</p>
        <div className="modal-actions"><span className="spacer" /><button className="btn primary" onClick={onClose}>Done</button></div>
      </Modal>
    );
  }

  return (
    <Modal title={`Redeem: ${reward.icon} ${reward.title}`} onClose={onClose}>
      <p className="muted">Costs <strong>{reward.star_cost} ⭐</strong> — who's redeeming? (A parent PIN confirms it.)</p>
      <div className="redeem-members">
        {members.map((m) => (
          <button key={m.id} className="redeem-member card" disabled={m.stars < reward.star_cost} onClick={() => redeem(m)}>
            <Avatar member={m} size={44} />
            <span>{m.name}</span>
            <span className={m.stars < reward.star_cost ? 'pin-error' : 'star-badge'}>⭐ {m.stars}</span>
          </button>
        ))}
      </div>
      {error && <p className="pin-error">{error}</p>}
    </Modal>
  );
}

export default function Rewards() {
  const { members, ticks, memberById } = useApp();
  const [rewards, setRewards] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [editor, setEditor] = useState(null);
  const [redeeming, setRedeeming] = useState(null);

  useEffect(() => {
    api.get('/rewards').then((r) => setRewards(r.rewards)).catch(() => {});
    api.get('/stars').then((r) => setLedger(r.ledger)).catch(() => {});
  }, [ticks.rewards]);

  return (
    <div className="rewards">
      <div className="cal-toolbar">
        <h1 className="cal-heading">Rewards</h1>
        <button className="btn primary" onClick={() => setEditor({})}>+ Reward</button>
      </div>

      <div className="star-balances">
        {members.map((m) => (
          <div key={m.id} className="star-balance card" style={{ borderTopColor: m.color }}>
            <Avatar member={m} size={48} />
            <span className="star-balance-name">{m.name}</span>
            <span className="star-balance-count">⭐ {m.stars}</span>
          </div>
        ))}
      </div>

      <h2 className="section-title">Reward shop</h2>
      <div className="list-grid">
        {rewards.map((r) => (
          <div key={r.id} className="reward-card card">
            <span className="list-card-icon">{r.icon}</span>
            <span className="list-card-title">{r.title}</span>
            <span className="star-badge">⭐ {r.star_cost}</span>
            <div className="row gap">
              <button className="btn primary" onClick={() => setRedeeming(r)}>Redeem</button>
              <button className="btn" onClick={() => setEditor(r)}>Edit</button>
            </div>
          </div>
        ))}
        {rewards.length === 0 && <p className="empty">No rewards yet — add “Extra screen time”, “Pick dinner”…</p>}
      </div>

      {ledger.length > 0 && (
        <>
          <h2 className="section-title">Recent activity</h2>
          <div className="card ledger">
            {ledger.map((l) => {
              const m = memberById(l.member_id);
              return (
                <div key={l.id} className="ledger-row">
                  <span>{m?.avatar} {m?.name || '—'}</span>
                  <span className="muted">{l.reason.replace('chore:', '✅ ').replace('chore-undo:', '↩️ ').replace('reward:', '🎁 ')}</span>
                  <span className={l.delta >= 0 ? 'ledger-plus' : 'ledger-minus'}>{l.delta >= 0 ? '+' : ''}{l.delta} ⭐</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editor && <RewardEditor initial={editor} onClose={() => setEditor(null)} />}
      {redeeming && <RedeemModal reward={redeeming} onClose={() => setRedeeming(null)} />}
    </div>
  );
}
