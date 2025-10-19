"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
