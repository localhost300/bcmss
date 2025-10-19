const DEFAULT_LABELS: Record<string, string> = {
  final: "Final Exam",
  midterm: "Midterm Overview",
};

const normaliseKey = (value: string) => value.trim().toLowerCase();

const toTitleCase = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

export const getExamTypeLabel = (value: string): string => {
  if (!value) {
    return "Exam";
  }
  const lookup = normaliseKey(value);
  if (DEFAULT_LABELS[lookup]) {
    return DEFAULT_LABELS[lookup];
  }
  return toTitleCase(value);
};

export const buildExamTypeOptions = (types: Iterable<string> | ArrayLike<string>) => {
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];

  const values = Array.isArray(types) ? types : Array.from(types);

  for (let index = 0; index < values.length; index += 1) {
    const raw = values[index];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    const key = normaliseKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value, label: getExamTypeLabel(value) });
  }

  return options;
};
