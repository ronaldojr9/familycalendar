import test from 'node:test';
import assert from 'node:assert/strict';
import { choreDueOn } from '../src/recurrence.js';
import { holidayChecker, holidaysForYear } from '../src/holidays.js';

const holidays = holidayChecker('');

// Weeks run Saturday -> Friday: 2026-09-05 is a Saturday.
const LUKE_WEEK = '2026-09-05';
const PAUL_WEEK = '2026-09-12';

test('days: rule matches weekdays', () => {
  const sweep = { recurrence_rule: 'days:1,3,5' };
  assert.equal(choreDueOn(sweep, '2026-09-07', holidays), true); // Mon
  assert.equal(choreDueOn(sweep, '2026-09-08', holidays), false); // Tue
  assert.equal(choreDueOn(sweep, '2026-09-09', holidays), true); // Wed
});

test('alternating weeks put exactly one person on the chore each week', () => {
  const luke = { recurrence_rule: `weeks:2:${LUKE_WEEK}:0,1,2,3,4,5,6` };
  const paul = { recurrence_rule: `weeks:2:${PAUL_WEEK}:0,1,2,3,4,5,6` };

  // Every day for eight weeks, exactly one of them is on dishes.
  let lukeDays = 0;
  let paulDays = 0;
  for (let i = 0; i < 56; i++) {
    const d = new Date(Date.UTC(2026, 8, 5) + i * 86400000).toISOString().slice(0, 10);
    const l = choreDueOn(luke, d, holidays);
    const p = choreDueOn(paul, d, holidays);
    assert.equal(l !== p, true, `${d}: expected exactly one of Luke/Paul on dishes`);
    if (l) lukeDays++;
    if (p) paulDays++;
  }
  assert.equal(lukeDays, 28);
  assert.equal(paulDays, 28);
});

test('the rotation switches on Saturday, not Sunday or Monday', () => {
  const luke = { recurrence_rule: `weeks:2:${LUKE_WEEK}:0,1,2,3,4,5,6` };
  assert.equal(choreDueOn(luke, '2026-09-11', holidays), true); // Fri — still Luke's week
  assert.equal(choreDueOn(luke, '2026-09-12', holidays), false); // Sat — handover
  assert.equal(choreDueOn(luke, '2026-09-19', holidays), true); // Sat — back to Luke
});

test('the phase holds backwards, so last week shows the right person', () => {
  const luke = { recurrence_rule: `weeks:2:${LUKE_WEEK}:0,1,2,3,4,5,6` };
  assert.equal(choreDueOn(luke, '2026-08-29', holidays), false); // Paul's week
  assert.equal(choreDueOn(luke, '2026-08-22', holidays), true); // Luke's week
});

test('biweekly recycling lands on alternating Tuesdays', () => {
  const recycling = { recurrence_rule: 'weeks:2:2026-09-08:2' };
  assert.equal(choreDueOn(recycling, '2026-09-08', holidays), true);
  assert.equal(choreDueOn(recycling, '2026-09-15', holidays), false);
  assert.equal(choreDueOn(recycling, '2026-09-22', holidays), true);
  assert.equal(choreDueOn(recycling, '2026-09-09', holidays), false); // Wed, not a Tuesday
});

test('holiday-shift moves trash from Tuesday to Wednesday after a Monday holiday', () => {
  const trash = { recurrence_rule: 'days:2|holiday-shift' };
  // Labor Day 2026 is Monday 2026-09-07.
  assert.equal(holidaysForYear(2026).has('2026-09-07'), true);
  assert.equal(choreDueOn(trash, '2026-09-08', holidays), false); // Tue — bumped
  assert.equal(choreDueOn(trash, '2026-09-09', holidays), true); // Wed — collection day
  // A normal week is untouched.
  assert.equal(choreDueOn(trash, '2026-09-15', holidays), true);
  assert.equal(choreDueOn(trash, '2026-09-16', holidays), false);
});

test('holiday-shift composes with the biweekly recycling rule', () => {
  const recycling = { recurrence_rule: 'weeks:2:2026-09-08:2|holiday-shift' };
  assert.equal(choreDueOn(recycling, '2026-09-08', holidays), false); // bumped by Labor Day
  assert.equal(choreDueOn(recycling, '2026-09-09', holidays), true);
  assert.equal(choreDueOn(recycling, '2026-09-22', holidays), true); // normal Tuesday
  assert.equal(choreDueOn(recycling, '2026-09-15', holidays), false); // off week
});

test('a household-specific extra holiday also shifts trash', () => {
  const trash = { recurrence_rule: 'days:2|holiday-shift' };
  const withLocal = holidayChecker('2026-09-14');
  assert.equal(choreDueOn(trash, '2026-09-15', withLocal), false);
  assert.equal(choreDueOn(trash, '2026-09-16', withLocal), true);
});

test('observed holidays count: Christmas 2027 falls on a Saturday', () => {
  // 2027-12-25 is a Saturday, observed Friday 2027-12-24.
  assert.equal(holidaysForYear(2027).has('2027-12-24'), true);
});

test('federal Monday holidays are computed correctly', () => {
  const h2026 = holidaysForYear(2026);
  assert.equal(h2026.has('2026-01-19'), true); // MLK — 3rd Monday of January
  assert.equal(h2026.has('2026-02-16'), true); // Presidents' Day
  assert.equal(h2026.has('2026-05-25'), true); // Memorial Day — last Monday of May
  assert.equal(h2026.has('2026-11-26'), true); // Thanksgiving — 4th Thursday
});

test('unchanged rules still behave', () => {
  assert.equal(choreDueOn({ recurrence_rule: 'daily' }, '2026-09-08', holidays), true);
  assert.equal(choreDueOn({ recurrence_rule: 'once', due_date: '2026-09-08' }, '2026-09-08', holidays), true);
  assert.equal(choreDueOn({ recurrence_rule: 'once', due_date: '2026-09-08' }, '2026-09-09', holidays), false);
  assert.equal(choreDueOn({}, '2026-09-08', holidays), true); // default is daily
});
