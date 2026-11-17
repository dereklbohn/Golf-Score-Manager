export function validGameDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 1900 && date.getFullYear() === year
    && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validStrokes(value: string) {
  return /^\d{1,3}$/.test(value.trim()) && Number(value) >= 1;
}
