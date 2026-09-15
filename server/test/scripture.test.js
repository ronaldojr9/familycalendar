import test from 'node:test';
import assert from 'node:assert/strict';
import { readingFor, CHAPTER_COUNTS, PSALM_ANCHOR, parseNltHtml } from '../src/scripture.js';

test('the bundled books are complete', () => {
  assert.equal(CHAPTER_COUNTS.proverbs, 31);
  assert.equal(CHAPTER_COUNTS.psalms, 150);
});

test('today reads Proverbs 15 and Psalm 15', () => {
  assert.deepEqual(readingFor('2026-09-15'), { proverbs: 15, psalm: 15 });
});

test('Proverbs follows the day of the month', () => {
  assert.equal(readingFor('2026-09-01').proverbs, 1);
  assert.equal(readingFor('2026-10-31').proverbs, 31);
  assert.equal(readingFor('2026-11-01').proverbs, 1);
});

test('the Psalm advances a chapter a day', () => {
  assert.equal(readingFor('2026-09-16').psalm, 16);
  assert.equal(readingFor('2026-09-30').psalm, 30);
  assert.equal(readingFor('2026-10-01').psalm, 31);
});

test('the Psalm wraps from 150 back to 1 and keeps going', () => {
  // Anchor + 135 days lands on 150, the day after starts over.
  const day150 = new Date(Date.UTC(2026, 8, 15) + 135 * 86400000).toISOString().slice(0, 10);
  const day1 = new Date(Date.UTC(2026, 8, 15) + 136 * 86400000).toISOString().slice(0, 10);
  assert.equal(readingFor(day150).psalm, 150);
  assert.equal(readingFor(day1).psalm, 1);
  assert.equal(readingFor(new Date(Date.UTC(2026, 8, 15) + 137 * 86400000).toISOString().slice(0, 10)).psalm, 2);
});

test('the Psalm cycle never leaves 1..150, over five years', () => {
  for (let i = -400; i < 1825; i++) {
    const d = new Date(Date.UTC(2026, 8, 15) + i * 86400000).toISOString().slice(0, 10);
    const { psalm, proverbs } = readingFor(d);
    assert.ok(psalm >= 1 && psalm <= 150, `${d} -> psalm ${psalm}`);
    assert.ok(proverbs >= 1 && proverbs <= 31, `${d} -> proverbs ${proverbs}`);
  }
});

test('the cycle also holds backwards, for yesterday', () => {
  assert.equal(readingFor('2026-09-14').psalm, 14);
  assert.equal(readingFor('2026-09-15').psalm, PSALM_ANCHOR.psalm);
});

test('NLT html parsing pulls verse numbers and text apart', () => {
  const html =
    '<h2>Proverbs 15</h2><p class="body"><span class="vn">1</span>A gentle answer deflects anger, ' +
    '<span class="vn">2</span>The tongue of the wise makes knowledge appealing.</p>';
  assert.deepEqual(parseNltHtml(html), [
    { verse: 1, text: 'A gentle answer deflects anger,' },
    { verse: 2, text: 'The tongue of the wise makes knowledge appealing.' },
  ]);
});

test('NLT parsing returns nothing for junk, so the caller can fall back', () => {
  assert.deepEqual(parseNltHtml('<html><body>Invalid key</body></html>'), []);
  assert.deepEqual(parseNltHtml(''), []);
});

test('a single psalm reads "Psalm", not "Psalms"', async () => {
  const { getPassage } = await import('../src/scripture.js');
  assert.equal((await getPassage('psalms', 15)).reference, 'Psalm 15');
  assert.equal((await getPassage('proverbs', 15)).reference, 'Proverbs 15');
});

test('the bundled chapters have the verse counts they should', async () => {
  const { getPassage } = await import('../src/scripture.js');
  assert.equal((await getPassage('proverbs', 15)).verses.length, 33);
  assert.equal((await getPassage('psalms', 15)).verses.length, 5);
  assert.equal((await getPassage('psalms', 117)).verses.length, 2); // shortest chapter
  assert.equal((await getPassage('psalms', 119)).verses.length, 176); // longest
  assert.equal((await getPassage('psalms', 151)), null); // past the end
});
