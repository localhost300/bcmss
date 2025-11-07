'use client';

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "react-toastify";

import AccessRestricted from "@/components/AccessRestricted";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useResults } from "@/contexts/ResultsContext";

type AttendanceStatus = "present" | "late" | "absent";

type AttendanceStudent = {
  studentId: number;
  studentName: string;
  status: AttendanceStatus | null;
  remarks: string | null;
};

type AttendanceResponse = {
  data: {
    students: AttendanceStudent[];
    totals: {
      present: number;
      late: number;
      absent: number;
      unmarked: number;
    };
  };
};

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
];

const columns = [
  { header: "Student", accessor: "student" },
  { header: "Status", accessor: "status", className: "text-center" },
  { header: "Remarks", accessor: "remarks", className: "hidden md:table-cell" },
];

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const AttendanceListPage = () => {
  const { user } = useAuth();
  const { classOptions } = useResults();

  const role = user?.role ?? "teacher";
  const canManage = role === "admin" || role === "teacher";

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => toISODate(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  const [records, setRecords] = useState<AttendanceStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!classOptions.length) {
      setSelectedClassId("");
      return;
    }
    setSelectedClassId((prev) => {
      if (prev && classOptions.some((option) => option.id === prev)) {
        return prev;
      }
      return classOptions[0]?.id ?? "";
    });
  }, [classOptions]);

  useEffect(() => {
    if (!selectedClassId || !selectedDate) {
      setRecords([]);
      return;
    }

    const controller = new AbortController();
    let ignore = false;

    const fetchAttendance = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          classId: selectedClassId,
          date: selectedDate,
        });
        const response = await fetch(`/api/attendance?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? "Unable to load attendance records.");
        }
        const payload = (await response.json()) as AttendanceResponse;
        if (ignore) return;

        const students =
          payload.data?.students?.map((student) => ({
            ...student,
            status: student.status ?? null,
            remarks: student.remarks ?? null,
          })) ?? [];
        setRecords(students);
      } catch (err) {
        if (ignore || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        console.error("[Attendance] Failed to load records", err);
        setError(err instanceof Error ? err.message : "Unable to load attendance records.");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchAttendance();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [selectedClassId, selectedDate, refreshKey]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => record.studentName.toLowerCase().includes(query));
  }, [records, searchTerm]);

  const summary = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        switch (record.status) {
          case "present":
            acc.present += 1;
            break;
          case "late":
            acc.late += 1;
            break;
          case "absent":
            acc.absent += 1;
            break;
          default:
            acc.unmarked += 1;
        }
        return acc;
      },
      { present: 0, late: 0, absent: 0, unmarked: 0 },
    );
  }, [records]);

  const handleStatusChange = (studentId: number, value: string) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.studentId === studentId
          ? {
              ...record,
              status: value ? (value as AttendanceStatus) : null,
            }
          : record,
      ),
    );
  };

  const handleRemarkChange = (studentId: number, value: string) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.studentId === studentId
          ? {
              ...record,
              remarks: value.trim() ? value : null,
            }
          : record,
      ),
    );
  };

  const handleSave = async () => {
    if (!selectedClassId || !selectedDate) {
      toast.error("Select a class and date before saving attendance.");
      return;
    }
    if (!records.length) {
      toast.error("No students available for the selected class.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        classId: Number.parseInt(selectedClassId, 10),
        date: selectedDate,
        records: records.map((record) => ({
          studentId: record.studentId,
          status: (record.status ?? "absent") as AttendanceStatus,
          remarks: record.remarks ?? null,
        })),
      };

      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorBody?.message ?? "Unable to save attendance records.");
      }

      toast.success("Attendance updated successfully.");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      console.error("[Attendance] Failed to save records", err);
      toast.error(err instanceof Error ? err.message : "Unable to save attendance records.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = canManage && !loading && !saving && records.length > 0;

  if (!canManage) {
    return <AccessRestricted message="Only administrators and teachers can manage attendance." />;
  }

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Attendance Manager</h1>
          <p className="text-xs text-gray-500">
            Mark daily attendance for your class and keep student records up to date.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <span>Class</span>
            <select
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              {classOptions.length === 0 && <option value="">No classes available</option>}
              {classOptions.map((classOption) => (
                <option key={classOption.id} value={classOption.id}>
                  {classOption.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <span>Date</span>
            <input
              type="date"
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
              value={selectedDate}
              max={toISODate(new Date())}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          <TableSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search students..."
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
          Present <span className="font-semibold">{summary.present}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-700">
          Late <span className="font-semibold">{summary.late}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-red-600">
          Absent <span className="font-semibold">{summary.absent}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-gray-600">
          Unmarked <span className="font-semibold">{summary.unmarked}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-indigo-600">
          Total Students <span className="font-semibold">{records.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          Loading attendance records...
        </div>
      ) : error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-600">
          {error}
        </div>
      ) : filteredRecords.length ? (
        <Table
          columns={columns}
          data={filteredRecords}
          renderRow={(record) => (
            <tr
              key={record.studentId}
              className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight/40"
            >
              <td className="px-3 py-2 font-medium text-gray-800">{record.studentName}</td>
              <td className="px-3 py-2">
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
                  value={record.status ?? ""}
                  onChange={(event) => handleStatusChange(record.studentId, event.target.value)}
                >
                  <option value="">Not set</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="hidden px-3 py-2 text-xs text-gray-600 md:table-cell">
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
                  value={record.remarks ?? ""}
                  placeholder="Remarks (optional)"
                  onChange={(event) => handleRemarkChange(record.studentId, event.target.value)}
                />
              </td>
            </tr>
          )}
        />
      ) : (
        <div className="mt-6 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          No students found for the selected class.
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          <Image src="/update.png" alt="Refresh records" width={14} height={14} />
          Refresh
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-lamaSky px-4 py-2 text-xs font-semibold text-white transition hover:bg-lamaSkyDark disabled:cursor-not-allowed disabled:bg-gray-300"
          onClick={handleSave}
          disabled={!canSave}
        >
          {saving ? "Saving..." : "Save Attendance"}
        </button>
      </div>
    </div>
  );
};

export default AttendanceListPage;

