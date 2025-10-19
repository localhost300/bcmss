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
import { getJSON } from "@/lib/utils/api";

type SchoolRecord = {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  principal: string;
  established: string;
  logo?: string | null;
};

export type SchoolMeta = {
  schoolId: string;
  schoolName: string;
};

type SchoolContextValue = {
  activeSchoolId: string;
  setActiveSchoolId: (id: string) => void;
  schools: SchoolRecord[];
  canSwitch: boolean;
  loading: boolean;
  error: string | null;
};

type ScopedEntity = {
  id: number | string;
  schoolId?: string;
};

type SchoolListResponse = {
  items?: SchoolRecord[];
};

let cachedSchools: SchoolRecord[] = [];

const SchoolContext = createContext<SchoolContextValue | undefined>(undefined);

const buildSchoolMeta = (
  schools: SchoolRecord[],
  fallbackId: string,
  targetId?: string,
): SchoolMeta => {
  const fallbackSchool = schools.find((item) => item.id === fallbackId) ?? schools[0];
  if (targetId) {
    const match = schools.find((item) => item.id === targetId);
    if (match) {
      return { schoolId: match.id, schoolName: match.name };
    }
  }
  if (fallbackSchool) {
    return { schoolId: fallbackSchool.id, schoolName: fallbackSchool.name };
  }
  const safeId = targetId ?? fallbackId ?? "school";
  return { schoolId: safeId, schoolName: "School" };
};

const normaliseSchools = (payload: SchoolListResponse | SchoolRecord[] | null | undefined) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload?.items && Array.isArray(payload.items)) {
    return payload.items;
  }
  return [] as SchoolRecord[];
};

export const SchoolProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();

  const canSwitch = user?.role === "admin";
  const defaultSchoolId = user?.primarySchoolId ?? user?.managedSchoolIds?.[0] ?? "";

  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let ignore = false;

    const loadSchools = async () => {
      try {
        setLoading(true);
        setError(null);

        const payload = await getJSON<SchoolListResponse | SchoolRecord[]>("/api/schools?pageSize=200");
        const items = normaliseSchools(payload);

        if (ignore) {
          return;
        }

        cachedSchools = items;
        setSchools(items);

        setActiveSchoolIdState((prev) => {
          if (prev && items.some((school) => school.id === prev)) {
            return prev;
          }

          const allowedDefault =
            defaultSchoolId && items.some((school) => school.id === defaultSchoolId)
              ? defaultSchoolId
              : undefined;

          if (!canSwitch) {
            return allowedDefault ?? items[0]?.id ?? "";
          }

          return allowedDefault ?? prev ?? items[0]?.id ?? "";
        });
      } catch (err) {
        if (ignore) {
          return;
        }
        console.error("[SchoolContext] Unable to load schools", err);
        setError(err instanceof Error ? err.message : "Unable to load schools.");
        setSchools([]);
        setActiveSchoolIdState("");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void loadSchools();

    return () => {
      ignore = true;
    };
  }, [authLoading, canSwitch, defaultSchoolId]);

  const setActiveSchoolId = useCallback(
    (id: string) => {
      if (!canSwitch) return;
      setActiveSchoolIdState(id);
    },
    [canSwitch],
  );

  const value = useMemo(
    () => ({
      activeSchoolId,
      setActiveSchoolId,
      schools,
      canSwitch,
      loading: loading || authLoading,
      error,
    }),
    [activeSchoolId, canSwitch, error, loading, authLoading, schools, setActiveSchoolId],
  );

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error("useSchool must be used within a SchoolProvider");
  }
  return context;
};

export const useSchoolScope = () => {
  const { activeSchoolId, canSwitch } = useSchool();
  const { user } = useAuth();
  if (canSwitch) {
    return activeSchoolId;
  }
  return user?.primarySchoolId ?? activeSchoolId;
};

export const useScopedEntities = <T extends ScopedEntity>(
  entities: T[],
): Array<T & SchoolMeta> => {
  const { activeSchoolId, schools } = useSchool();
  const schoolScope = useSchoolScope();

  return useMemo(() => {
    const fallbackMeta = buildSchoolMeta(schools, schoolScope || activeSchoolId || "");

    return entities
      .map((entity, index) => {
        let targetSchoolId = entity.schoolId;
        if (!targetSchoolId && schools.length > 0) {
          const numericId = typeof entity.id === "number" ? Math.max(entity.id - 1, 0) : index;
          const derived = schools[numericId % schools.length];
          if (derived) {
            targetSchoolId = derived.id;
          }
        }

        const schoolMeta = buildSchoolMeta(schools, fallbackMeta.schoolId, targetSchoolId);

        return {
          ...entity,
          ...schoolMeta,
        };
      })
      .filter((entity) => {
        if (!schoolScope) {
          return true;
        }
        return entity.schoolId === schoolScope;
      });
  }, [entities, schools, schoolScope, activeSchoolId]);
};

export const getSchoolById = (schoolId: string): SchoolRecord | undefined =>
  cachedSchools.find((school) => school.id === schoolId);

export const getSchoolMetaForId = (schoolId?: string): SchoolMeta =>
  buildSchoolMeta(cachedSchools, cachedSchools[0]?.id ?? "", schoolId);
