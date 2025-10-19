import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE_NAME = "bc_session";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type BaseSessionPayload = {
  userId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
};

export type SessionPayload = BaseSessionPayload;

export type SessionTokenResult = {
  value: string;
  payload: SessionPayload;
  maxAge: number;
};

export const AUTH_SESSION_COOKIE = SESSION_COOKIE_NAME;
export const AUTH_SESSION_MAX_AGE = DEFAULT_MAX_AGE_SECONDS;

const getSessionSecret = (): string => {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }
  return secret.trim();
};

const base64UrlEncode = (input: string): string => {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const base64UrlDecode = (input: string): string => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
};

const sign = (payload: string): string => {
  const secret = getSessionSecret();
  return createHmac("sha256", secret).update(payload).digest("base64url");
};

const isExpired = (payload: SessionPayload): boolean => {
  return payload.expiresAt <= Math.floor(Date.now() / 1000);
};

export const createSessionToken = ({
  userId,
  email,
  maxAge = DEFAULT_MAX_AGE_SECONDS,
}: {
  userId: string;
  email: string;
  maxAge?: number;
}): SessionTokenResult => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId,
    email,
    issuedAt,
    expiresAt: issuedAt + maxAge,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return {
    value: `${encodedPayload}.${signature}`,
    payload,
    maxAge,
  };
};

export const verifySessionToken = (token: string | null | undefined): SessionPayload | null => {
  if (!token || !token.includes(".")) {
    return null;
  }
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }
  const expectedSignature = sign(encodedPayload);
  try {
    const signaturesMatch = timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
    if (!signaturesMatch) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload.userId || !payload.email || isExpired(payload)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const createSerializedSessionCookie = ({
  token,
  maxAge = DEFAULT_MAX_AGE_SECONDS,
}: {
  token: string;
  maxAge?: number;
}): string => {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (maxAge > 0) {
    parts.push(`Max-Age=${maxAge}`);
    const expires = new Date(Date.now() + maxAge * 1000);
    parts.push("Expires=" + expires.toUTCString());
  }
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
};

export const createClearSessionCookie = (): string => {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; Expires=${new Date(0).toUTCString()}; SameSite=Lax`;
};



