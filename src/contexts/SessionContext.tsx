"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/types/roles";
import { getJSON, postJSON } from "@/lib/utils/api";

const TERM_OPTIONS = ["First Term", "Second Term", "Third Term"] as const;
export type Term = (typeof TERM_OPTIONS)[number];

export type ClientSession = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  firstTermStart: string;
  secondTermStart: string;
  thirdTermStart: string;
};

type SessionFormInput = {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  firstTermStart?: string | null;
  secondTermStart?: string | null;
  thirdTermStart?: string | null;
};

type SessionContextValue = {
  sessions: ClientSession[];
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  addSession: (session: SessionFormInput) => Promise<void>;
  updateSession: (session: SessionFormInput & { id: string }) => Promise<void>;
  refreshSessions: () => Promise<void>;
  canManageSessions: boolean;
  canSwitchSessions: boolean;
  terms: readonly Term[];
  activeTerm: Term;
  setActiveTerm: (term: Term) => void;
  loading: boolean;
  error: string | null;
};

type SessionListResponse = {
  items?: Array<{
    id?: unknown;
    name?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    isCurrent?: unknown;
    firstTermStart?: unknown;
    secondTermStart?: unknown;
    thirdTermStart?: unknown;
  }>;
};

const DEFAULT_TERM: Term = TERM_OPTIONS[0];

const rolePermissions: Record<UserRole, { canManageSessions: boolean; canSwitchSessions: boolean }> = {
  admin: { canManageSessions: true, canSwitchSessions: true },
  teacher: { canManageSessions: false, canSwitchSessions: true },
  parent: { canManageSessions: false, canSwitchSessions: true },
  student: { canManageSessions: false, canSwitchSessions: true },
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const formatDate = (raw: unknown): string => {
  if (!raw) {
    return "";
  }
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? "" : raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "string" || typeof raw === "number") {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }
  return "";
};

const asClientSession = (value: unknown): ClientSession | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : undefined;
  const name = typeof record.name === "string" ? record.name : undefined;
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    startDate: formatDate(record.startDate),
    endDate: formatDate(record.endDate),
    isCurrent: Boolean(record.isCurrent),
    firstTermStart: formatDate(record.firstTermStart),
    secondTermStart: formatDate(record.secondTermStart),
    thirdTermStart: formatDate(record.thirdTermStart),
  };
};

const normaliseSessions = (payload: SessionListResponse | null | undefined): ClientSession[] => {
  if (!payload?.items || !Array.isArray(payload.items)) {
    return [];
  }
  return payload.items
    .map((item) => asClientSession(item))
    .filter((item): item is ClientSession => Boolean(item));
};

const resolveInitialSessionId = (items: ClientSession[], preferred?: string): string => {
  if (preferred && items.some((session) => session.id === preferred)) {
    return preferred;
  }
  const current = items.find((session) => session.isCurrent);
  if (current) {
    return current.id;
  }
  return items[0]?.id ?? "";
};

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const userRole: UserRole = user?.role ?? "teacher";
  const permissions = rolePermissions[userRole] ?? rolePermissions.teacher;
  const { canManageSessions, canSwitchSessions } = permissions;

  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string>("");
  const [activeTerm, setActiveTermState] = useState<Term>(DEFAULT_TERM);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getJSON<SessionListResponse>("/api/sessions?pageSize=200");
      const items = normaliseSessions(response);
      setSessions(items);
      setActiveSessionIdState((prev) => resolveInitialSessionId(items, prev));
      setActiveTermState((prev) => (TERM_OPTIONS.includes(prev) ? prev : DEFAULT_TERM));
    } catch (err) {
      console.error("[SessionContext] Unable to load sessions", err);
      setSessions([]);
      setActiveSessionIdState("");
      setError(err instanceof Error ? err.message : "Unable to load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    void refreshSessions();
  }, [authLoading, refreshSessions]);

  const setActiveSessionId = useCallback(
    (id: string) => {
      if (!canSwitchSessions) {
        return;
      }
      setActiveSessionIdState((prev) => (sessions.some((session) => session.id === id) ? id : prev));
    },
    [canSwitchSessions, sessions],
  );

  const setActiveTerm = useCallback((term: Term) => {
    if (!TERM_OPTIONS.includes(term)) {
      return;
    }
    setActiveTermState(term);
  }, []);

  const addSession = useCallback(
    async ({
      id,
      name,
      startDate,
      endDate,
      isCurrent,
      firstTermStart,
      secondTermStart,
      thirdTermStart,
    }: SessionFormInput) => {
      if (!canManageSessions) {
        return;
      }
      await postJSON("/api/sessions", {
        id,
        name,
        startDate,
        endDate,
        isCurrent: Boolean(isCurrent),
        firstTermStart: firstTermStart ?? "",
        secondTermStart: secondTermStart ?? "",
        thirdTermStart: thirdTermStart ?? "",
        action: "create" as const,
      });
      await refreshSessions();
    },
    [canManageSessions, refreshSessions],
  );

  const updateSession = useCallback(
    async ({
      id,
      name,
      startDate,
      endDate,
      isCurrent,
      firstTermStart,
      secondTermStart,
      thirdTermStart,
    }: SessionFormInput & { id: string }) => {
      if (!canManageSessions) {
        return;
      }
      await postJSON("/api/sessions", {
        id,
        name,
        startDate,
        endDate,
        isCurrent: Boolean(isCurrent),
        firstTermStart: firstTermStart ?? "",
        secondTermStart: secondTermStart ?? "",
        thirdTermStart: thirdTermStart ?? "",
        action: "update" as const,
      });
      await refreshSessions();
    },
    [canManageSessions, refreshSessions],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      sessions,
      activeSessionId,
      setActiveSessionId,
      addSession,
      updateSession,
      refreshSessions,
      canManageSessions,
      canSwitchSessions,
      terms: TERM_OPTIONS,
      activeTerm,
      setActiveTerm,
      loading,
      error,
    }),
    [
      sessions,
      activeSessionId,
      setActiveSessionId,
      addSession,
      updateSession,
      refreshSessions,
      canManageSessions,
      canSwitchSessions,
      activeTerm,
      setActiveTerm,
      loading,
      error,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};

export const useSessionScope = () => {
  const { activeSessionId } = useSession();
  return activeSessionId;
};

export const useTermScope = () => {
  const { activeTerm } = useSession();
  return activeTerm;
};
