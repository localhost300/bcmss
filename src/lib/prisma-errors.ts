import { Prisma } from "@prisma/client";

const TRANSIENT_DB_ERROR_CODES = new Set(["P1001", "P2024"]);

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    TRANSIENT_DB_ERROR_CODES.has(error.code)
  ) {
    return true;
  }

  return false;
}
