"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";

import FormModal from "@/components/FormModal";
import AccessRestricted from "@/components/AccessRestricted";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolScope, type SchoolMeta } from "@/contexts/SchoolContext";
import { getJSON } from "@/lib/utils/api";

type StudentRow = {
  id: number;
  studentId: string;
  name: string;
  email: string | null;
  address: string | null;
  photo: string | null;
  grade: number | null;
  category: string | null;
  className: string | null;
  schoolId: string;
  schoolName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  dateOfBirth: string | null;
  bloodType: string | null;
} & SchoolMeta;

type StudentListResponse = {
  items: StudentRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type ImportSummary = {
  totalRows: number;
  processedRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  skippedRows: Array<{ row: number; message: string }>;
};

const columns = [
  { header: "Info", accessor: "info" },
  { header: "Student ID", accessor: "studentId", className: "hidden md:table-cell" },
  { header: "Grade", accessor: "grade", className: "hidden md:table-cell" },
  { header: "Category", accessor: "category", className: "hidden lg:table-cell" },
  { header: "Class", accessor: "className", className: "hidden lg:table-cell" },
  { header: "Campus", accessor: "schoolName", className: "hidden lg:table-cell" },
  { header: "Blood Type", accessor: "bloodType", className: "hidden xl:table-cell" },
  { header: "Actions", accessor: "action" },
];

const PAGE_SIZE = 10;

const formatDateLabel = (value: string | null) => {
  if (!value) {
    return "N/A";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const StudentListPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const schoolScope = useSchoolScope();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const visibleImportIssues = useMemo(() => {
    if (!importSummary) {
      return [];
    }
    const combined = [...importSummary.errors, ...importSummary.skippedRows];
    return combined.slice(0, 5);
  }, [importSummary]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let ignore = false;

    const fetchStudents = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));
        if (searchTerm.trim()) {
          params.set("search", searchTerm.trim());
        }
        if (schoolScope) {
          params.set("schoolId", schoolScope);
        }

        const response = await getJSON<StudentListResponse>(
          `/api/students?${params.toString()}`,
        );

        if (ignore) {
          return;
        }

        const { items, pagination } = response;
        if (pagination.totalPages > 0 && page > pagination.totalPages) {
          setPage(pagination.totalPages);
          return;
        }

        setStudents(items);
        setTotalPages(Math.max(pagination.totalPages, 1));
      } catch (fetchError) {
        if (ignore) {
          return;
        }
        console.error("[StudentListPage] Fetch failed", fetchError);
        setError(
          fetchError instanceof Error ? fetchError.message : "Unable to load students.",
        );
        setStudents([]);
        setTotalPages(1);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchStudents();

    return () => {
      ignore = true;
    };
  }, [isAdmin, page, searchTerm, schoolScope, refreshKey]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const handleImportButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setImporting(true);
      setImportSummary(null);
      setImportError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        if (schoolScope) {
          formData.append("defaultSchoolId", schoolScope);
        }

        const response = await fetch("/api/students/import", {
          method: "POST",
          body: formData,
        });

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch (parseError) {
          payload = null;
        }

        const data =
          payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

        if (!response.ok) {
          const message =
            typeof data.message === "string" ? data.message : "Unable to import students.";
          const missingColumns = Array.isArray(data.missingColumns)
            ? (data.missingColumns as unknown[])
                .filter((value): value is string => typeof value === "string")
            : [];
          const missingSuffix =
            missingColumns.length > 0 ? ` Missing columns: ${missingColumns.join(", ")}.` : "";
          setImportError(message + missingSuffix);
          return;
        }

        const summary =
          data.summary && typeof data.summary === "object"
            ? (data.summary as Partial<ImportSummary>)
            : undefined;

        setImportSummary({
          totalRows: summary?.totalRows ?? 0,
          processedRows: summary?.processedRows ?? 0,
          created: summary?.created ?? 0,
          updated: summary?.updated ?? 0,
          skipped: summary?.skipped ?? 0,
          failed: summary?.failed ?? 0,
          errors: summary?.errors ?? [],
          skippedRows: summary?.skippedRows ?? [],
        });

        handleRefresh();
      } catch (importError) {
        const message =
          importError instanceof Error ? importError.message : "Unable to import students.";
        setImportError(message);
      } finally {
        setImporting(false);
        event.target.value = "";
      }
    },
    [handleRefresh, schoolScope],
  );

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) {
      params.set("search", searchTerm.trim());
    }
    if (schoolScope) {
      params.set("schoolId", schoolScope);
    }

    const query = params.toString();
    const url = query ? `/api/students/export?${query}` : "/api/students/export";
    window.location.href = url;
  }, [schoolScope, searchTerm]);

  const handleDismissFeedback = useCallback(() => {
    setImportError(null);
    setImportSummary(null);
  }, []);

  const renderRow = useCallback(
    (item: StudentRow) => (
      <tr
        key={item.id}
        className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
      >
        <td className="flex items-center gap-4 p-4">
          {item.photo && (
            <Image
              src={item.photo}
              alt={item.name}
              width={40}
              height={40}
              className="md:hidden xl:block w-10 h-10 rounded-full object-cover"
            />
          )}
          <div className="flex flex-col">
            <h3 className="font-semibold">{item.name}</h3>
            <p className="text-xs text-gray-500">
              {item.className ?? "Class not assigned"}
            </p>
            <p className="text-xs text-gray-400">
              DOB: {formatDateLabel(item.dateOfBirth)}
            </p>
            <p className="text-xs text-gray-400">
              Guardian: {item.guardianEmail ?? "N/A"}
            </p>
          </div>
        </td>
        <td className="hidden md:table-cell">{item.studentId}</td>
        <td className="hidden md:table-cell">{item.grade ?? "—"}</td>
        <td className="hidden lg:table-cell">{item.category ?? "General"}</td>
        <td className="hidden lg:table-cell">{item.className ?? "—"}</td>
        <td className="hidden lg:table-cell">{item.schoolName}</td>
        <td className="hidden xl:table-cell">{item.bloodType ?? "N/A"}</td>
        <td>
          <div className="flex items-center gap-2">
            <Link href={`/list/students/${item.id}`}>
              <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky">
                <Image src="/view.png" alt="" width={16} height={16} />
              </button>
            </Link>
            <FormModal table="student" type="update" data={item} onSuccess={handleRefresh} />
            <FormModal table="student" type="delete" id={item.id} onSuccess={handleRefresh} />
          </div>
        </td>
      </tr>
    ),
    [handleRefresh],
  );

  if (!isAdmin) {
    return (
      <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
        <AccessRestricted message="Only administrators can manage student records." />
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFileChange}
      />

      {importError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Import failed</p>
              <p className="mt-1 text-xs text-red-500">{importError}</p>
            </div>
            <button
              type="button"
              onClick={handleDismissFeedback}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {importSummary && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium">Import complete</p>
              <p className="text-xs text-emerald-600">
                Processed {importSummary.processedRows} of {importSummary.totalRows} rows. Created{" "}
                {importSummary.created}, updated {importSummary.updated}, skipped {importSummary.skipped}, failed{" "}
                {importSummary.failed}.
              </p>
              {visibleImportIssues.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-red-600">
                  {visibleImportIssues.map((item) => (
                    <li key={item.row}>
                      Row {item.row}: {item.message}
                    </li>
                  ))}
                  {importSummary.errors.length + importSummary.skippedRows.length >
                    visibleImportIssues.length && (
                    <li>
                      +{" "}
                      {importSummary.errors.length +
                        importSummary.skippedRows.length -
                        visibleImportIssues.length}{" "}
                      additional issues. See server logs for details.
                    </li>
                  )}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={handleDismissFeedback}
              className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold">All Students</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search students"
          />
          <div className="flex items-center gap-4 self-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="h-8 px-3 rounded-full bg-lamaSky text-white text-xs font-medium hover:bg-lamaSkyLight transition-colors"
            >
              Export
            </button>
            <button
              type="button"
              onClick={handleImportButtonClick}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaPurple text-white hover:bg-lamaPurpleLight disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              title={importing ? "Importing students..." : "Import students from CSV"}
              disabled={importing}
            >
              <Image src="/upload.png" alt="" width={16} height={16} />
              <span className="sr-only">Import students</span>
            </button>
            <FormModal table="student" type="create" onSuccess={handleRefresh} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading students…</div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-red-500">{error}</div>
      ) : (
        <>
          <Table columns={columns} renderRow={renderRow} data={students} />
          {students.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-500">No students found.</div>
          )}
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
};

export default StudentListPage;
