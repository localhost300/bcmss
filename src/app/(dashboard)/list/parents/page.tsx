"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

import AccessRestricted from "@/components/AccessRestricted";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolScope } from "@/contexts/SchoolContext";
import { getJSON } from "@/lib/utils/api";

const PAGE_SIZE = 10;

type ParentListItem = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  schoolId: string | null;
  schoolName: string | null;
  students: Array<{
    id: number | null;
    name: string;
    relationship: string | null;
    className: string | null;
  }>;
};

type ParentListResponse = {
  items?: ParentListItem[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const columns = [
  { header: "Parent", accessor: "name", className: "p-4" },
  { header: "Students", accessor: "students", className: "p-4 hidden md:table-cell" },
  { header: "Campus", accessor: "schoolName", className: "p-4 hidden lg:table-cell" },
  { header: "Phone", accessor: "phone", className: "p-4 hidden xl:table-cell" },
  { header: "Address", accessor: "address", className: "p-4 hidden xl:table-cell" },
  { header: "Actions", accessor: "action", className: "p-4" },
];

const ParentListPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const schoolScope = useSchoolScope();

  const [parents, setParents] = useState<ParentListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) {
      setParents([]);
      return;
    }

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (searchTerm.trim()) {
      params.set("search", searchTerm.trim());
    }
    if (schoolScope) {
      params.set("schoolId", schoolScope);
    }

    setLoading(true);
    setError(null);

    void getJSON<ParentListResponse>(`/api/parents?${params.toString()}`)
      .then((response) => {
        const items = response?.items ?? [];
        const pagination = response?.pagination;

        if (pagination && pagination.totalPages > 0 && page > pagination.totalPages) {
          setPage(pagination.totalPages);
          return;
        }

        setParents(items);
        setTotalPages(Math.max(pagination?.totalPages ?? 1, 1));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load parent records.");
        setParents([]);
        setTotalPages(1);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isAdmin, page, searchTerm, schoolScope, refreshKey]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const renderRow = useCallback(
    (item: ParentListItem) => {
      const studentList = item.students.length
        ? item.students.map((student) => student.name).join(", ")
        : "No students linked";

      return (
        <tr
          key={item.id}
          className="border-b border-gray-200 text-sm even:bg-slate-50 hover:bg-lamaPurpleLight"
        >
          <td className="p-4">
            <div className="flex flex-col">
              <span className="font-semibold">{item.name}</span>
              <span className="text-xs text-gray-500">{item.email ?? "No email"}</span>
            </div>
          </td>
          <td className="hidden md:table-cell">{studentList}</td>
          <td className="hidden lg:table-cell">{item.schoolName ?? "—"}</td>
          <td className="hidden xl:table-cell">{item.phone ?? "—"}</td>
          <td className="hidden xl:table-cell">{item.address ?? "—"}</td>
          <td className="p-4">
            <span className="text-xs text-gray-400">Managed from central CRM</span>
          </td>
        </tr>
      );
    },
    [],
  );

  if (!isAdmin) {
    return (
      <AccessRestricted message="Only administrators can manage parent records." />
    );
    ;
  }

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-lg font-semibold">All Parents</h1>
        <div className="flex w-full flex-col items-center gap-4 md:w-auto md:flex-row">
          <TableSearch
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search parents"
          />
          <div className="flex items-center gap-4 self-end">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-lamaYellow"
              aria-label="Filter"
            >
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-lamaYellow"
              aria-label="Sort"
            >
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            <button
              onClick={handleRefresh}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              aria-label="Refresh"
            >
              <Image src="/refresh.png" alt="" width={14} height={14} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading parents…</div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-red-500">{error}</div>
      ) : parents.length ? (
        <>
          <Table columns={columns} renderRow={renderRow} data={parents} />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="py-10 text-center text-sm text-gray-500">
          No parents found for the current filters.
        </div>
      )}
    </div>
  );
};

export default ParentListPage;
