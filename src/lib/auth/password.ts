import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export const hashPassword = async (plain: string): Promise<string> => {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(plain, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
};

export const verifyPassword = async (
  plain: string,
  stored: string,
): Promise<boolean> => {
  if (!stored.includes(":")) {
    return false;
  }
  const [saltHex, hashHex] = stored.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const storedHash = Buffer.from(hashHex, "hex");
  const derived = scryptSync(plain, salt, storedHash.length);
  return timingSafeEqual(derived, storedHash);
};
