export function audioRange(
  value: string | null,
  size: number,
): { start: number; end: number } | null | false {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return false;
  const suffix = !match[1],
    amount = Number(match[2]);
  const start = suffix ? Math.max(0, size - amount) : Number(match[1]);
  const end = suffix
    ? size - 1
    : match[2]
      ? Math.min(Number(match[2]), size - 1)
      : size - 1;
  return !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= size ||
    end < start ||
    (suffix && amount <= 0)
    ? false
    : { start, end };
}
