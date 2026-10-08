export function pad(n: number) {
  return n.toString().padStart(2, '0');
}

// Strictly validates "YYYY-MM-DD" + "HH:MM". JS's Date constructor
// silently rolls invalid values forward (hour 32 -> 8am next day), so we
// check ranges ourselves and confirm nothing rolled over.
export function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const dateMatch = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeStr.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]), month = Number(dateMatch[2]), day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]), minute = Number(timeMatch[2]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;

  const date = new Date(year, month - 1, day, hour, minute);
  if (isNaN(date.getTime())) return null;
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

// "YYYY-MM-DD" for today, or for a day some number of days away.
export function dateInputIn(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayInput() {
  return dateInputIn(0);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// "Παρ 10 Οκτ, 18:00". A deadline set to 23:59 means "by the end of that
// day" (it is what the app fills in when no time is typed), so it is shown
// as just the date.
export function formatDue(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short' });
  if (d.getHours() === 23 && d.getMinutes() === 59) return date;
  const time = d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

// "10 Οκτ, 14:30" - a compact stamp for history lines.
export function formatDayTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

// How a deadline stands right now: overdue or not, plus a short phrase.
export function dueInfo(iso: string): { overdue: boolean; phrase: string } {
  const due = new Date(iso);
  const nowMs = Date.now();
  if (due.getTime() < nowMs) {
    const hours = Math.floor((nowMs - due.getTime()) / 3600000);
    const days = Math.floor(hours / 24);
    if (days >= 1) return { overdue: true, phrase: `Εκπρόθεσμο κατά ${days} ${days === 1 ? 'μέρα' : 'μέρες'}` };
    if (hours >= 1) return { overdue: true, phrase: `Εκπρόθεσμο κατά ${hours} ${hours === 1 ? 'ώρα' : 'ώρες'}` };
    return { overdue: true, phrase: 'Εκπρόθεσμο' };
  }
  const days = Math.round((startOfDay(due) - startOfDay(new Date(nowMs))) / 86400000);
  if (days === 0) return { overdue: false, phrase: 'Σήμερα' };
  if (days === 1) return { overdue: false, phrase: 'Αύριο' };
  return { overdue: false, phrase: `Σε ${days} μέρες` };
}

// Orders rows by deadline, soonest first. Overdue ones have the earliest
// deadlines so they come first, and rows with no date go last (the sort is
// stable, so those keep their original order).
export function compareDue(a?: string | null, b?: string | null) {
  const ta = a ? new Date(a).getTime() : Infinity;
  const tb = b ? new Date(b).getTime() : Infinity;
  if (ta === tb) return 0;
  return ta < tb ? -1 : 1;
}
