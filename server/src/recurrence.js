// Lightweight recurrence expansion (RRULE-lite).
// Events store recurrence_rule as '' | 'daily' | 'weekly' | 'monthly' | 'yearly'.
// Dates are local wall-clock strings: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm'.

export function datePart(s) {
  return String(s).slice(0, 10);
}

export function timePart(s) {
  return String(s).length > 10 ? String(s).slice(11, 16) : null;
}

function toUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(dt) {
  return dt.toISOString().slice(0, 10);
}

export function addDaysStr(dateStr, n) {
  const dt = toUTC(dateStr);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

export function diffDays(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

// Expand one event into occurrences whose start date falls within [from, to].
// Returns [{ occurs_on, start_at, end_at }] with times preserved.
export function expandEvent(event, from, to) {
  const startDate = datePart(event.start_at);
  const durationDays = Math.max(0, diffDays(startDate, datePart(event.end_at)));
  const startTime = timePart(event.start_at);
  const endTime = timePart(event.end_at);
  const rule = event.recurrence_rule || '';

  const make = (occDate) => ({
    occurs_on: occDate,
    start_at: startTime ? `${occDate}T${startTime}` : occDate,
    end_at: endTime ? `${addDaysStr(occDate, durationDays)}T${endTime}` : addDaysStr(occDate, durationDays),
  });

  if (!rule) {
    // Non-recurring: include if the event's span overlaps the range.
    if (startDate <= to && datePart(event.end_at) >= from) return [make(startDate)];
    return [];
  }

  const out = [];
  const start = toUTC(startDate);
  const rangeEnd = toUTC(to);
  let cursor = new Date(start);
  let guard = 0;

  // Fast-forward close to the range start for daily/weekly rules.
  if ((rule === 'daily' || rule === 'weekly') && startDate < from) {
    const step = rule === 'daily' ? 1 : 7;
    const behind = Math.floor(diffDays(startDate, from) / step) * step;
    cursor.setUTCDate(cursor.getUTCDate() + behind);
  }

  while (cursor <= rangeEnd && guard++ < 1000) {
    const occDate = fromUTC(cursor);
    if (occDate >= from && occDate <= to && occDate >= startDate) out.push(make(occDate));
    if (rule === 'daily') {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    } else if (rule === 'weekly') {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else if (rule === 'monthly') {
      // Same day-of-month; skip months that don't have it (e.g. Jan 31 -> skips Feb).
      const day = start.getUTCDate();
      let m = (cursor.getUTCFullYear() - start.getUTCFullYear()) * 12 + (cursor.getUTCMonth() - start.getUTCMonth()) + 1;
      let next;
      do {
        next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, day));
        m++;
      } while (next.getUTCDate() !== day && m < 600);
      cursor = next;
    } else if (rule === 'yearly') {
      let y = cursor.getUTCFullYear() + 1;
      let next = new Date(Date.UTC(y, start.getUTCMonth(), start.getUTCDate()));
      // Handle Feb 29 in non-leap years by skipping to the next leap year.
      while (next.getUTCMonth() !== start.getUTCMonth() && y < 2200) {
        y++;
        next = new Date(Date.UTC(y, start.getUTCMonth(), start.getUTCDate()));
      }
      cursor = next;
    } else {
      break;
    }
  }
  return out;
}

// Chores: recurrence_rule is 'daily' | 'once' | 'days:0,2,4' (JS weekday numbers, 0=Sun).
export function choreDueOn(chore, dateStr) {
  const rule = chore.recurrence_rule || 'daily';
  if (rule === 'daily') return true;
  if (rule === 'once') return chore.due_date === dateStr;
  if (rule.startsWith('days:')) {
    const days = rule.slice(5).split(',').filter(Boolean).map(Number);
    return days.includes(toUTC(dateStr).getUTCDay());
  }
  return false;
}
