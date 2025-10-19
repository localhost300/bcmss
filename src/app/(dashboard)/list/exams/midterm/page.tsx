"use client";

import { useEffect, useMemo, useState } from "react";

import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { useSchoolScope } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { getJSON } from "@/lib/utils/api";

const ITEMS_PER_PAGE = 10;

type MidtermOverviewItem = {
  id: string;
  studentId: number;
  studentName: string;
  subject: string;
  classId: string;
  className: string | null;
  midtermScore: number;
  finalTotal: number;
  percentage: number | null;
};

type MidtermOverviewResponse = {
  items?: MidtermOverviewItem[];
};

const columns = [
  { header: "Student", accessor: "student", className: "p-4" },
  { header: "Subject", accessor: "subject", className: "p-4 hidden sm:table-cell" },
  { header: "Class", accessor: "class", className: "p-4 hidden md:table-cell" },
  { header: "Midterm Score", accessor: "midterm", className: "p-4" },
  { header: "Final Total", accessor: "final", className: "p-4 hidden lg:table-cell" },
];

const MidtermOverviewPage = () => {
  const schoolScope = useSchoolScope(); // included for future filtering parity
  const sessionScope = useSessionScope();
  const termScope = useTermScope();

  const [allRecords, setAllRecords] = useState<MidtermOverviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    if (!sessionScope) {
      setAllRecords([]);
      return;
    }

    const params = new URLSearchParams();
    params.set("sessionId", sessionScope);
    if (termScope) params.set("term", termScope);

    const endpoint = `/api/exams/midterm-overview?${params.toString()}`;

    setLoading(true);
    setError(null);

    void getJSON<MidtermOverviewResponse>(endpoint)
      .then((response) => {
        setAllRecords(response?.items ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load midterm overview.");
        setAllRecords([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionScope, termScope, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [selectedClass, selectedSubject]);

  const classOptions = useMemo(() => {
    const unique = new Map<string, string>();
    allRecords.forEach((record) => {
      const key = record.classId ?? "";
      if (!key) return;
      const label = record.className || key;
      unique.set(key, label);
    });
    return Array.from(unique.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRecords]);

  const subjectOptions = useMemo(() => {
    const unique = new Set<string>();
    allRecords.forEach((record) => {
      if (record.subject) unique.add(record.subject);
    });
    return Array.from(unique).sort();
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    return allRecords.filter((record) => {
      const matchesClass = selectedClass === "all" || record.classId === selectedClass;
      const matchesSubject = selectedSubject === "all" || record.subject === selectedSubject;
      return matchesClass && matchesSubject;
    });
  }, [allRecords, selectedClass, selectedSubject]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, page]);

  const renderRow = (record: MidtermOverviewItem) => (
    <tr key={record.id} className="border-b border-gray-200 text-sm even:bg-slate-50">
      <td className="p-4 font-semibold">{record.studentName}</td>
      <td className="hidden sm:table-cell">{record.subject}</td>
      <td className="hidden md:table-cell">{record.className ?? record.classId}</td>
      <td className="font-medium">{record.midtermScore.toFixed(1)}</td>
      <td className="hidden lg:table-cell text-gray-500">{record.finalTotal.toFixed(1)}</td>
    </tr>
  );

  const handleRefresh = () => setRefreshKey((value) => value + 1);

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Midterm Overview</h1>
          <p className="text-xs text-gray-500">
            Continuous assessment totals derived from recorded exam scores.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <span className="text-xs text-gray-400">
            Session: {sessionScope || "—"} | Term: {termScope || "—"}
          </span>
          <button
            onClick={handleRefresh}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <label htmlFor="midterm-class-filter" className="hidden md:block">
            Class
          </label>
          <select
            id="midterm-class-filter"
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
            className="rounded-md bg-white px-3 py-2 text-xs ring-[1.5px] ring-gray-300"
          >
            <option value="all">All Classes</option>
            {classOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <label htmlFor="midterm-subject-filter" className="hidden md:block">
            Subject
          </label>
          <select
            id="midterm-subject-filter"
            value={selectedSubject}
            onChange={(event) => setSelectedSubject(event.target.value)}
            className="rounded-md bg-white px-3 py-2 text-xs ring-[1.5px] ring-gray-300"
          >
            <option value="all">All Subjects</option>
            {subjectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading midterm overview…</div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-red-500">{error}</div>
      ) : paginatedRecords.length ? (
        <>
          <Table columns={columns} renderRow={renderRow} data={paginatedRecords} />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="py-10 text-center text-sm text-gray-500">
          No midterm data available yet.
        </div>
      )}
    </div>
  );
};

export default MidtermOverviewPage;
