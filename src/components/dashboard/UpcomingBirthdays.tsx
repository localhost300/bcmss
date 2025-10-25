"use client";

import { useEffect, useState } from "react";

import { useSchoolScope } from "@/contexts/SchoolContext";
import { getJSON } from "@/lib/utils/api";

type BirthdayRecord = {
  studentId: number;
  studentName: string;
  className: string | null;
  birthdayLabel: string;
  nextBirthday: string;
  daysUntil: number;
  ageTurning: number;
};

type BirthdaysResponse = {
  data: {
    items: BirthdayRecord[];
    rangeDays: number;
    fetched: number;
  };
};

const getStatusStyles = (daysUntil: number) => {
  if (daysUntil === 0) {
    return {
      badge: "bg-emerald-100 text-emerald-700",
      icon: "🎉",
      label: "Today",
    };
  }
  if (daysUntil === 1) {
    return {
      badge: "bg-indigo-100 text-indigo-700",
      icon: "⏳",
      label: "Tomorrow",
    };
  }
  if (daysUntil <= 7) {
    return {
      badge: "bg-sky-100 text-sky-700",
      icon: "📅",
      label: `${daysUntil} days`,
    };
  }
  return {
    badge: "bg-gray-100 text-gray-700",
    icon: "🗓️",
    label: `${daysUntil} days`,
  };
};

const UpcomingBirthdays = () => {
  const schoolScope = useSchoolScope();
  const [records, setRecords] = useState<BirthdayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const fetchBirthdays = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (schoolScope) {
          params.set("schoolId", schoolScope);
        }
        params.set("range", "60");
        params.set("limit", "6");

        const endpoint = `/api/dashboard/upcoming-birthdays?${params.toString()}`;

        const response = await getJSON<BirthdaysResponse>(endpoint);
        if (ignore) return;

        setRecords(response.data.items);
      } catch (err) {
        if (ignore) return;
        console.error("[UpcomingBirthdays] Failed to load data", err);
        setError(
          err instanceof Error ? err.message : "Unable to load upcoming birthdays.",
        );
        setRecords([]);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchBirthdays();

    return () => {
      ignore = true;
    };
  }, [schoolScope]);

  return (
    <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-white to-sky-50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Upcoming birthdays</h2>
          <p className="text-xs text-gray-500">
            Celebrations over the next two months
          </p>
        </div>
        <span className="text-2xl" role="img" aria-label="balloon">
          🎈
        </span>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {!error && (
        <ul className="mt-4 flex flex-col gap-3">
          {loading && records.length === 0 ? (
            Array.from({ length: 3 }).map((_, index) => (
              <li
                key={index}
                className="animate-pulse rounded-lg bg-white/70 p-3"
              >
                <div className="h-3 w-24 rounded bg-sky-200" />
                <div className="mt-2 h-2 w-16 rounded bg-sky-100" />
              </li>
            ))
          ) : records.length === 0 ? (
            <li className="rounded-lg bg-white/80 p-3 text-xs text-gray-500">
              No birthdays in the next 60 days.
            </li>
          ) : (
            records.map((item) => {
              const status = getStatusStyles(item.daysUntil);
              return (
                <li
                  key={item.studentId}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-800">
                      {item.studentName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.className ?? "Class not assigned"} · turning{" "}
                      {item.ageTurning}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-sky-700">
                      {item.birthdayLabel}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.badge}`}
                    >
                      {status.icon} {status.label}
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};

export default UpcomingBirthdays;
