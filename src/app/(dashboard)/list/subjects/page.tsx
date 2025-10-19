"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

import AccessRestricted from "@/components/AccessRestricted";
import FormModal from "@/components/FormModal";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolScope } from "@/contexts/SchoolContext";
import { getJSON } from "@/lib/utils/api";

type SubjectRow = {
  id: number;
  name: string;
  code: string | null;
  category: string | null;
  creditHours: number | null;
  description: string | null;
  schoolId: string;
  schoolName: string;
  classes: Array<{ id: number; name: string }>;
  teachers: Array<{ id: number; name: string; teacherCode: string | null }>;
  teacherIds: number[];
};

type SubjectListResponse = {
  items: SubjectRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const columns = [
  { header: "Subject", accessor: "name" },
  { header: "Code", accessor: "code", className: "hidden md:table-cell" },
  { header: "Category", accessor: "category", className: "hidden lg:table-cell" },
  { header: "Credit Hours", accessor: "creditHours", className: "hidden xl:table-cell" },
  { header: "Teachers", accessor: "teachers", className: "hidden lg:table-cell" },
  { header: "Classes", accessor: "classes", className: "hidden md:table-cell" },
  { header: "Campus", accessor: "schoolName", className: "hidden xl:table-cell" },
  { header: "Actions", accessor: "action" },
];

const PAGE_SIZE = 10;

const SubjectListPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const schoolScope = useSchoolScope();

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
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

    const fetchSubjects = async () => {
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

        const response = await getJSON<SubjectListResponse>(
          `/api/subjects?${params.toString()}`,
        );

        if (ignore) return;

        const { pagination, items } = response;
        if (pagination.totalPages > 0 && page > pagination.totalPages) {
          setPage(pagination.totalPages);
          return;
        }

        const normalisedItems = items.map((item) => ({
          ...item,
          teacherIds:
            Array.isArray(item.teacherIds) && item.teacherIds.length > 0
              ? item.teacherIds
              : (item.teachers ?? []).map((teacher) => teacher.id),
        }));
        setSubjects(normalisedItems);
        setTotalPages(Math.max(pagination.totalPages, 1));
      } catch (fetchError) {
        if (ignore) return;
        console.error("[SubjectListPage] Fetch failed", fetchError);
        setError(
          fetchError instanceof Error ? fetchError.message : "Unable to load subjects.",
        );
        setSubjects([]);
        setTotalPages(1);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    void fetchSubjects();
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

  const renderRow = (item: SubjectRow) => (
    <tr
      key={item.id}
      className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
    >
      <td className="flex flex-col gap-1 p-4">
        <span className="font-semibold">{item.name}</span>
        <span className="text-xs text-gray-400 lg:hidden">
          {item.category ?? "Uncategorised"}
        </span>
      </td>
      <td className="hidden md:table-cell">{item.code ?? "—"}</td>
      <td className="hidden lg:table-cell">{item.category ?? "—"}</td>
      <td className="hidden xl:table-cell">
        {item.creditHours != null ? item.creditHours : "—"}
      </td>
      <td className="hidden md:table-cell">
        {item.classes.length > 0 ? item.classes.map((klass) => klass.name).join(", ") : "No classes"}
      </td>
      <td className="hidden xl:table-cell">{item.schoolName}</td>
      <td>
        <div className="flex items-center gap-2">
          <FormModal table="subject" type="update" data={item} onSuccess={handleRefresh} />
          <FormModal table="subject" type="delete" id={item.id} onSuccess={handleRefresh} />
        </div>
      </td>
    </tr>
  );

  if (!isAdmin) {
    return (
      <AccessRestricted message="Only administrators can manage subject records." />
    );
  }

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold">All Subjects</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search subjects"
          />
          <div className="flex items-center gap-4 self-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            <FormModal table="subject" type="create" onSuccess={handleRefresh} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading subjects…</div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-red-500">{error}</div>
      ) : (
        <>
          <Table columns={columns} renderRow={renderRow} data={subjects} />
          {subjects.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-500">No subjects found.</div>
          )}
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
};

export default SubjectListPage;




