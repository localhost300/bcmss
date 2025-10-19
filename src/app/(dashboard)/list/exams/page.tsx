"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

import AccessRestricted from "@/components/AccessRestricted";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolScope } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { getJSON } from "@/lib/utils/api";

const PAGE_SIZE = 10;

type PrismaTerm = "FIRST" | "SECOND" | "THIRD";
type PrismaExamType = "MIDTERM" | "FINAL";

type ExamListItem = {
  id: number;
  name: string;
  assessmentWindow: string | null;
  examDate: string | null;
  examType: PrismaExamType;
  term: PrismaTerm;
  classId: number;
  className: string | null;
  subjectId: number;
  subjectName: string | null;
};

type ExamListResponse = {
  items?: ExamListItem[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const TERM_LABELS: Record<PrismaTerm, string> = {
  FIRST: "First Term",
  SECOND: "Second Term",
  THIRD: "Third Term",
};

const TERM_FROM_LABEL: Record<string, PrismaTerm> = {
  "First Term": "FIRST",
  "Second Term": "SECOND",
  "Third Term": "THIRD",
};

const EXAM_TYPE_LABELS: Record<PrismaExamType, string> = {
  MIDTERM: "Midterm",
  FINAL: "Final",
};

const columns = [
  { header: "Exam", accessor: "exam", className: "p-4" },
  { header: "Type", accessor: "examType", className: "p-4 hidden md:table-cell" },
  { header: "Schedule", accessor: "schedule", className: "p-4 hidden sm:table-cell" },
  { header: "Actions", accessor: "action", className: "p-4" },
];

const mapTermToEnum = (label?: string | null): PrismaTerm | undefined =>
  label ? TERM_FROM_LABEL[label] : undefined;

const formatDate = (value: string | null) => {
  if (!value) return "TBD";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "TBD"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const parseAssessmentWindow = (
  raw: string | null,
): { startDate: string | null; endDate: string | null } => {
  if (!raw) {
    return { startDate: null, endDate: null };
  }
  try {
    const parsed = JSON.parse(raw);
    const startDate =
      parsed && typeof parsed.startDate === "string" ? parsed.startDate : null;
    const endDate = parsed && typeof parsed.endDate === "string" ? parsed.endDate : null;
    return { startDate, endDate };
  } catch {
    return { startDate: null, endDate: null };
  }
};

const ExamListPage = () => {
  const { user, loading: authLoading } = useAuth();
  const schoolScope = useSchoolScope();
  const sessionScope = useSessionScope();
  const termScope = useTermScope();

  const isAdmin = user?.role === "admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const termFilter = useMemo(() => mapTermToEnum(termScope), [termScope]);

  useEffect(() => {
    setPage(1);
  }, [schoolScope, sessionScope, termScope]);

  useEffect(() => {
    if (!sessionScope || authLoading || !isAdmin) {
      setExams([]);
      setTotalPages(1);
      return;
    }

    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("pageSize", String(PAGE_SIZE));
    query.set("sessionId", sessionScope);
    if (schoolScope) query.set("schoolId", schoolScope);
    if (termFilter) query.set("term", termFilter);
    if (searchTerm.trim()) query.set("search", searchTerm.trim());

    const endpoint = query.toString() ? `/api/exams?${query.toString()}` : "/api/exams";

    setLoading(true);
    setError(null);

    void getJSON<ExamListResponse>(endpoint)
      .then((response) => {
        const items = response?.items ?? [];
        const pagination = response?.pagination;
        const nextTotalPages = Math.max(pagination?.totalPages ?? 1, 1);

        if (pagination && pagination.totalPages > 0 && page > pagination.totalPages) {
          setPage(pagination.totalPages);
          return;
        }

        setExams(items);
        setTotalPages(nextTotalPages);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load exams.");
        setExams([]);
        setTotalPages(1);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [authLoading, isAdmin, page, refreshKey, schoolScope, searchTerm, sessionScope, termFilter]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const renderRow = useCallback(
    (exam: ExamListItem) => {
      const windowDates = parseAssessmentWindow(exam.assessmentWindow);
      const startIso = windowDates.startDate ?? exam.examDate;
      const endIso = windowDates.endDate;
      const startLabel = formatDate(startIso);
      const endLabel = endIso ? formatDate(endIso) : null;
      let scheduleLabel = "Not set";
      if (startLabel !== "TBD" && endLabel && endLabel !== "TBD") {
        scheduleLabel = `${startLabel} -> ${endLabel}`;
      } else if (startLabel !== "TBD") {
        scheduleLabel = startLabel;
      } else if (endLabel && endLabel !== "TBD") {
        scheduleLabel = endLabel;
      } else if (exam.assessmentWindow) {
        scheduleLabel = exam.assessmentWindow;
      }

      const examTerm = TERM_LABELS[exam.term] ?? exam.term;
      const examType = EXAM_TYPE_LABELS[exam.examType] ?? exam.examType;

      const updatePayload = {
        id: exam.id,
        name: exam.name,
        startDate: startIso ? startIso.slice(0, 10) : "",
        endDate: endIso ? endIso.slice(0, 10) : "",
        classId: exam.classId,
        subjectId: exam.subjectId,
        examType: exam.examType,
      };

      return (
        <tr
          key={exam.id}
          className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
        >
          <td className="p-4">
            <div className="font-semibold text-gray-900">{exam.name}</div>
            <div className="text-xs text-gray-500">{examTerm}</div>
            {exam.className && (
              <div className="text-xs text-gray-400">Class: {exam.className}</div>
            )}
            {exam.subjectName && (
              <div className="text-xs text-gray-400">Subject: {exam.subjectName}</div>
            )}
          </td>
          <td className="p-4 hidden md:table-cell capitalize">{examType}</td>
          <td className="p-4 hidden sm:table-cell">{scheduleLabel}</td>
          <td className="p-4">
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <>
                  <FormModal
                    table="exam"
                    type="update"
                    data={updatePayload}
                    onSuccess={handleRefresh}
                  />
                  <FormModal
                    table="exam"
                    type="delete"
                    id={exam.id}
                    onSuccess={handleRefresh}
                  />
                </>
              ) : (
                <span className="text-xs text-gray-400">Staff only</span>
              )}
            </div>
          </td>
        </tr>
      );
    },
    [handleRefresh, isAdmin],
  );

  if (authLoading) {
    return (
      <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0 text-sm text-gray-500">
        Loading user profile…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <AccessRestricted message="Only administrators can manage exam schedules." />
    );
  }

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="hidden md:block text-lg font-semibold">Exam Schedule</h1>
          <p className="text-xs text-gray-500">
            Session {sessionScope || "—"} | Term {termScope || "—"} | Campus {schoolScope || "—"}
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search exams, classes, or subjects"
          />
          <div className="flex items-center gap-4 self-end">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow"
              aria-label="Filter"
            >
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow"
              aria-label="Sort"
            >
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            <FormModal table="exam" type="create" onSuccess={handleRefresh} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading exams…</div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-red-500">{error}</div>
      ) : exams.length > 0 ? (
        <>
          <Table columns={columns} renderRow={renderRow} data={exams} />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="py-10 text-center text-sm text-gray-500">
          No exams scheduled for this campus, session, and term selection.
        </div>
      )}
    </div>
  );
};

export default ExamListPage;
