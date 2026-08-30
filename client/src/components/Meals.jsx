import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { WEEKDAYS, today, addDays, startOfWeek, parse } from '../dates.js';
import { Modal, Field } from './ui.jsx';

const SLOTS = [
  ['breakfast', '🥣 Breakfast'],
  ['lunch', '🥪 Lunch'],
  ['dinner', '🍝 Dinner'],
  ['snack', '🍎 Snack'],
];

function CellEditor({ cell, recipes, onClose }) {
  const existing = cell.entry;
  const [freeText, setFreeText] = useState(existing?.free_text || '');
  const [recipeId, setRecipeId] = useState(existing?.recipe_id || '');

  const save = async () => {
    await api.post('/meal-plan', {
      date: cell.date,
      meal_slot: cell.slot,
      recipe_id: recipeId ? Number(recipeId) : null,
      free_text: recipeId ? '' : freeText,
    });
    onClose();
  };

  const clear = async () => {
    await api.post('/meal-plan', { date: cell.date, meal_slot: cell.slot, recipe_id: null, free_text: '' });
    onClose();
  };

  return (
    <Modal title={`${SLOTS.find(([s]) => s === cell.slot)[1]} · ${cell.date}`} onClose={onClose}>
      <Field label="Pick a saved recipe">
        <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
          <option value="">— none —</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>{r.is_favorite ? '❤️ ' : ''}{r.title}</option>
          ))}
        </select>
      </Field>
      <Field label="…or type anything">
        <input
          autoFocus
          value={freeText}
          disabled={!!recipeId}
          placeholder="Pizza night, leftovers…"
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </Field>
      <div className="modal-actions">
        {existing && <button className="btn danger" onClick={clear}>Clear</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

function RecipeEditor({ initial, onClose }) {
  const [title, setTitle] = useState(initial.title || '');
  const [ingredients, setIngredients] = useState(initial.ingredients || '');
  const [instructions, setInstructions] = useState(initial.instructions || '');
  const [favorite, setFavorite] = useState(initial.is_favorite || false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!title.trim()) return setError('Recipe needs a title');
    const body = { title: title.trim(), ingredients, instructions, is_favorite: favorite };
    if (initial.id) await api.put(`/recipes/${initial.id}`, body);
    else await api.post('/recipes', body);
    onClose();
  };

  const remove = async () => {
    if (!confirm(`Delete recipe "${initial.title}"?`)) return;
    await api.del(`/recipes/${initial.id}`);
    onClose();
  };

  return (
    <Modal title={initial.id ? 'Edit recipe' : 'New recipe'} onClose={onClose}>
      <Field label="Title">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Taco Tuesday tacos" />
      </Field>
      <Field label="Ingredients (one per line)">
        <textarea rows={4} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
      </Field>
      <Field label="Instructions">
        <textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </Field>
      <label className="check-inline">
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        ❤️ Favorite
      </label>
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

export default function Meals() {
  const { ticks } = useApp();
  const [weekStart, setWeekStart] = useState(startOfWeek(today()));
  const [entries, setEntries] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [cell, setCell] = useState(null);
  const [recipeEditor, setRecipeEditor] = useState(null);
  const [showBox, setShowBox] = useState(false);

  useEffect(() => {
    api.get(`/meal-plan?week=${weekStart}`).then((r) => setEntries(r.entries)).catch(() => {});
    api.get('/recipes').then((r) => setRecipes(r.recipes)).catch(() => {});
  }, [weekStart, ticks.meals]);

  const entryFor = (date, slot) => entries.find((e) => e.date === date && e.meal_slot === slot);
  const recipeById = (id) => recipes.find((r) => r.id === id);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="meals">
      <div className="cal-toolbar">
        <div className="row gap">
          <button className="btn" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
          <button className="btn" onClick={() => setWeekStart(startOfWeek(today()))}>This week</button>
          <button className="btn" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
          <h1 className="cal-heading">Meal plan</h1>
        </div>
        <button className="btn" onClick={() => setShowBox(!showBox)}>
          {showBox ? '📅 Back to plan' : `📖 Recipe box (${recipes.length})`}
        </button>
      </div>

      {!showBox && (
        <div className="meal-scroll">
          <table className="meal-table">
            <thead>
              <tr>
                <th></th>
                {days.map((d) => (
                  <th key={d} className={d === today() ? 'today' : ''}>
                    <span className="week-day">{WEEKDAYS[parse(d).getDay()]}</span>
                    <span className="week-num">{parse(d).getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(([slot, label]) => (
                <tr key={slot}>
                  <th className="meal-slot">{label}</th>
                  {days.map((d) => {
                    const entry = entryFor(d, slot);
                    const text = entry ? (entry.recipe_id ? recipeById(entry.recipe_id)?.title : entry.free_text) : '';
                    return (
                      <td key={d} className={d === today() ? 'today' : ''}>
                        <button className={`meal-cell ${entry ? 'filled' : ''}`} onClick={() => setCell({ date: d, slot, entry })}>
                          {text || '+'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showBox && (
        <div className="list-grid">
          <button className="list-card card add-card" onClick={() => setRecipeEditor({})}>
            <span className="list-card-icon">＋</span>
            <span className="list-card-title">New recipe</span>
          </button>
          {recipes.map((r) => (
            <button key={r.id} className="list-card card" onClick={() => setRecipeEditor(r)}>
              <span className="list-card-icon">{r.is_favorite ? '❤️' : '🍲'}</span>
              <span className="list-card-title">{r.title}</span>
              <span className="muted small">{(r.ingredients || '').split('\n').filter(Boolean).length} ingredients</span>
            </button>
          ))}
        </div>
      )}

      {cell && <CellEditor cell={cell} recipes={recipes} onClose={() => setCell(null)} />}
      {recipeEditor && <RecipeEditor initial={recipeEditor} onClose={() => setRecipeEditor(null)} />}
    </div>
  );
}
