const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getTodayLocalIsoDate() {
  return formatLocalDate(new Date());
}

export function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function compareIsoDates(first: string, second: string) {
  return first.localeCompare(second);
}

export function startOfWeekLocal(date = new Date()) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

export function endOfWeekLocal(date = new Date()) {
  const result = startOfWeekLocal(date);
  result.setDate(result.getDate() + 6);
  return result;
}

export function getInclusiveDayCount(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 1;
  }

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}
