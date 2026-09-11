// US federal holidays, computed (no network, no data file).
//
// Used by the chore engine's `holiday-shift` modifier: trash day slides a day
// later when the preceding weekday was a holiday, because that is what the
// collection truck does. Both the true date and the "observed" date are
// included — a Sunday holiday observed on Monday is what actually moves the
// truck, so both need to be in the set.

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// JS weekday of a Y-M-D, computed in UTC so local timezone can't shift it.
function weekdayOf(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// The nth (1-based) `weekday` of a month, e.g. nthWeekday(2026, 1, 1, 3) = 3rd Monday of January.
function nthWeekday(year, month, weekday, n) {
  const first = weekdayOf(year, month, 1);
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

function lastWeekday(year, month, weekday) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = weekdayOf(year, month, daysInMonth);
  return daysInMonth - ((last - weekday + 7) % 7);
}

// Federal rule for fixed-date holidays: Saturday -> observed Friday, Sunday -> observed Monday.
function observed(year, month, day) {
  const out = [ymd(year, month, day)];
  const wd = weekdayOf(year, month, day);
  if (wd === 6) out.push(shift(ymd(year, month, day), -1));
  if (wd === 0) out.push(shift(ymd(year, month, day), 1));
  return out;
}

function shift(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const cache = new Map();

// All US federal holiday dates (true + observed) falling in `year`.
export function holidaysForYear(year) {
  if (cache.has(year)) return cache.get(year);
  const dates = [
    ...observed(year, 1, 1), // New Year's Day
    ymd(year, 1, nthWeekday(year, 1, 1, 3)), // MLK Jr. Day — 3rd Monday of January
    ymd(year, 2, nthWeekday(year, 2, 1, 3)), // Presidents' Day — 3rd Monday of February
    ymd(year, 5, lastWeekday(year, 5, 1)), // Memorial Day — last Monday of May
    ...observed(year, 6, 19), // Juneteenth
    ...observed(year, 7, 4), // Independence Day
    ymd(year, 9, nthWeekday(year, 9, 1, 1)), // Labor Day — 1st Monday of September
    ymd(year, 10, nthWeekday(year, 10, 1, 2)), // Indigenous Peoples' / Columbus Day — 2nd Monday of October
    ...observed(year, 11, 11), // Veterans Day
    ymd(year, 11, nthWeekday(year, 11, 4, 4)), // Thanksgiving — 4th Thursday of November
    ...observed(year, 12, 25), // Christmas Day
  ];
  // Jan 1 of next year lands on a Saturday -> observed Dec 31 of this year.
  if (weekdayOf(year + 1, 1, 1) === 6) dates.push(ymd(year, 12, 31));

  const set = new Set(dates.filter((d) => d.startsWith(String(year))));
  cache.set(year, set);
  return set;
}

// `extra` lets a household add local no-collection days (city holidays, snow
// days) via the `extra_holidays` setting without touching this file.
export function isHoliday(dateStr, extra) {
  if (extra && extra.has(dateStr)) return true;
  return holidaysForYear(Number(dateStr.slice(0, 4))).has(dateStr);
}

// A Set-shaped lookup the recurrence engine can call for any date without
// worrying about which year (or year boundary) the date falls in.
export function holidayChecker(extraValue) {
  const extra = parseExtraHolidays(extraValue);
  return { has: (dateStr) => isHoliday(dateStr, extra) };
}

// Parse the `extra_holidays` setting: a comma/whitespace separated list of YYYY-MM-DD.
export function parseExtraHolidays(value) {
  return new Set(
    String(value || '')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
  );
}
