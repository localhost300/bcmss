import { InvalidIdError } from "./errors";

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const coerceToIntId = (value: string | number | undefined, entity: string): number => {
  if (value === undefined || value === null) {
    throw new InvalidIdError(`${capitalize(entity)} id is required.`);
  }

  const raw = typeof value === "number" ? value : Number.parseInt(value.trim(), 10);

  if (!Number.isInteger(raw) || raw <= 0) {
    throw new InvalidIdError(`Invalid ${entity} id supplied.`);
  }

  return raw;
};

export const coerceToStringId = (value: string | number | undefined, entity: string): string => {
  if (value === undefined || value === null) {
    throw new InvalidIdError(`${capitalize(entity)} id is required.`);
  }

  const raw = typeof value === "string" ? value.trim() : String(value);

  if (!raw) {
    throw new InvalidIdError(`Invalid ${entity} id supplied.`);
  }

  return raw;
};
