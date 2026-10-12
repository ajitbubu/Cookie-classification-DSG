/**
 * Scheduled-scan timing. Framework-free; moved out of App.jsx so the Schedule
 * Scan pop-up can preview "Next Run" with the same rules the scheduler uses.
 * All times are the browser's local time.
 */
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const parseTime = (time) => (time || '09:00').split(':').map(Number);

// "2026-10-16" at "07:30" as a local Date, or null.
function startMoment(job) {
  if (!job.startDate) return null;
  const [y, m, d] = job.startDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const [h, min] = parseTime(job.scheduleTime);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

/** True when the job's start date and time are still in the future. */
export function startsLater(job, now = new Date()) {
  const start = startMoment(job);
  return Boolean(start && start > now);
}

/** Weekday and day of month for a "YYYY-MM-DD" start date. */
export function scheduleFromStartDate(startDate) {
  if (!startDate) return { day: null, date: null };
  const [y, m, d] = startDate.split('-').map(Number);
  const when = new Date(y, m - 1, d);
  return { day: DAYS[when.getDay()], date: when.getDate() };
}

/** A UTC "HH:MM" on the given date, as the same instant in local "HH:MM". */
export function utcTimeToLocal(time, onDate) {
  const [h, min] = parseTime(time);
  const [y, m, d] = (onDate || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  const instant = new Date(Date.UTC(y, m - 1, d, h, min));
  return `${String(instant.getHours()).padStart(2, '0')}:${String(instant.getMinutes()).padStart(2, '0')}`;
}

/** When a scheduled job runs next. A future start date is honoured. */
export function nextRunTime(job, now = new Date()) {
  const start = startMoment(job);
  // Before the start date, count from just before the start moment.
  const from = start && start > now ? new Date(start.getTime() - 1) : now;
  const interval = job.interval || 1;

  if (job.unit === 'minutes') return start && start > now ? start : new Date(now.getTime() + interval * 60 * 1000);
  if (job.unit === 'hourly') return start && start > now ? start : new Date(now.getTime() + interval * 60 * 60 * 1000);

  const [hours, minutes] = parseTime(job.scheduleTime);

  if (job.unit === 'daily') {
    const next = new Date(from);
    next.setHours(hours, minutes, 0, 0);
    if (next <= from) next.setDate(next.getDate() + interval);
    return next;
  }

  if (job.unit === 'weekly') {
    const target = DAYS.indexOf(job.scheduleDay || 'sunday');
    const next = new Date(from);
    next.setHours(hours, minutes, 0, 0);
    let daysUntil = target - from.getDay();
    if (daysUntil < 0 || (daysUntil === 0 && next <= from)) daysUntil += 7;
    next.setDate(from.getDate() + daysUntil);
    return next;
  }

  if (job.unit === 'monthly') {
    const next = new Date(from.getFullYear(), from.getMonth(), job.scheduleDate || 1, hours, minutes, 0, 0);
    if (next <= from) next.setMonth(next.getMonth() + 1);
    return next;
  }

  return new Date(now.getTime() + 60 * 60 * 1000);
}
