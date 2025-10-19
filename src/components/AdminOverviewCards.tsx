"use client";

import { useEffect, useMemo, useState } from "react";

import UserCard from "@/components/UserCard";
import { useSchool, useSchoolScope, getSchoolById } from "@/contexts/SchoolContext";
import { getJSON } from "@/lib/utils/api";

type SummaryTotals = {
  students: number;
  teachers: number;
  parents: number;
  staff: number;
};

type SummaryResponse = {
  totals: SummaryTotals;
};

const CARD_CONFIG: Array<{
  key: keyof SummaryTotals;
  title: string;
  variant: "purple" | "yellow";
}> = [
  { key: "students", title: "Students", variant: "purple" },
  { key: "teachers", title: "Teachers", variant: "yellow" },
  { key: "parents", title: "Parents", variant: "purple" },
  { key: "staff", title: "Staff", variant: "yellow" },
];

const AdminOverviewCards = () => {
  const { schools, loading: schoolLoading, error: schoolError } = useSchool();
  const schoolScope = useSchoolScope();

  const [totals, setTotals] = useState<SummaryTotals | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const scopedSchoolId = schoolScope?.trim() ? schoolScope.trim() : undefined;

  const badgeLabel = useMemo(() => {
    if (scopedSchoolId) {
      return getSchoolById(scopedSchoolId)?.name ?? "Selected School";
    }
    if (schools.length === 1) {
      return schools[0]?.name ?? "All Schools";
    }
    return "All Schools";
  }, [scopedSchoolId, schools]);

  useEffect(() => {
    if (schoolLoading) {
      return;
    }

    let ignore = false;

    const fetchTotals = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (scopedSchoolId) {
          params.set("schoolId", scopedSchoolId);
        }
        const query = params.toString();
        const endpoint = query ? `/api/dashboard/summary?${query}` : "/api/dashboard/summary";

        const response = await getJSON<SummaryResponse>(endpoint);
        if (ignore) {
          return;
        }

        setTotals(response.totals);
      } catch (err) {
        if (ignore) {
          return;
        }
        console.error("[AdminOverviewCards] Failed to load totals", err);
        setError(err instanceof Error ? err.message : "Unable to load dashboard totals.");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchTotals();

    return () => {
      ignore = true;
    };
  }, [scopedSchoolId, schoolLoading]);

  const isLoading = loading || schoolLoading;
  const fetchError = error ?? schoolError;

  return (
    <div className="flex w-full flex-col gap-3">
      {fetchError && (
        <div className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          {fetchError}
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-4">
        {CARD_CONFIG.map((config) => (
          <UserCard
            key={config.key}
            title={config.title}
            badgeLabel={badgeLabel}
            total={totals?.[config.key] ?? null}
            isLoading={isLoading && !totals}
            variant={config.variant}
          />
        ))}
      </div>
    </div>
  );
};

export default AdminOverviewCards;
