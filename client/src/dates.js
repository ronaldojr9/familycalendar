export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parse(s) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return fmt(new Date());
}

export function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

export function startOfWeek(s) {
  const d = parse(s);
  d.setDate(d.getDate() - d.getDay());
  return fmt(d);
}

export function diffDays(a, b) {
  return Math.round((parse(b) - parse(a)) / 86400000);
}

export function monthGrid(year, month) {
  // 6 rows x 7 cols of YYYY-MM-DD covering the given month.
  const first = new Date(year, month, 1);
  const start = addDays(fmt(first), -first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
  return cells;
}

export function fmtTime(isoLocal, use24h = false) {
  if (!isoLocal || isoLocal.length <= 10) return '';
  const [h, m] = isoLocal.slice(11, 16).split(':').map(Number);
  if (use24h) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ampm = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr}${ampm}` : `${hr}:${String(m).padStart(2, '0')}${ampm}`;
}

export function fmtDateLong(s) {
  const d = parse(s);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}
