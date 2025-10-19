"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AccessRestricted from "@/components/AccessRestricted";
import FormModal from "@/components/FormModal";
import Table from "@/components/Table";
import { useAuth } from "@/contexts/AuthContext";
import { getJSON } from "@/lib/utils/api";

type ApiSchool = {
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
  logo: string | null;
};

const columns = [
  { header: "School", accessor: "name" },
  { header: "Code", accessor: "code", className: "hidden sm:table-cell" },
  { header: "Location", accessor: "location", className: "hidden md:table-cell" },
  { header: "Principal", accessor: "principal", className: "hidden lg:table-cell" },
  { header: "Contact", accessor: "contact", className: "hidden xl:table-cell" },
  { header: "Actions", accessor: "action" },
];

const SettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [schools, setSchools] = useState<ApiSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getJSON<{
        items?: ApiSchool[];
        data?: ApiSchool[];
      }>("/api/schools");
      const items = response.items ?? response.data ?? [];
      setSchools(items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load schools.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void loadSchools();
  }, [isAdmin, loadSchools]);

  const rows = useMemo(() => {
    if (!isAdmin) return [];
    return schools.map((school) => ({
      ...school,
      location: `${school.city}, ${school.state}`,
      contact: `${school.phone} - ${school.email}`,
    }));
  }, [schools, isAdmin]);

  const renderRow = (
    school: ApiSchool & { location: string; contact: string },
  ) => (
    <tr key={school.id} className="border-b border-gray-200 text-sm even:bg-slate-50">
      <td className="font-semibold">{school.name}</td>
      <td className="hidden sm:table-cell">{school.code}</td>
      <td className="hidden md:table-cell">{school.location}</td>
      <td className="hidden lg:table-cell">{school.principal}</td>
      <td className="hidden xl:table-cell">{school.contact}</td>
      <td>
        <div className="flex items-center gap-2">
          <FormModal
            table="school"
            type="update"
            data={school}
            onSuccess={loadSchools}
          />
          <FormModal
            table="school"
            type="delete"
            id={school.id}
            onSuccess={loadSchools}
          />
        </div>
      </td>
    </tr>
  );

  if (authLoading) {
    return (
      <div className="m-4 flex-1 rounded-md bg-white p-6 text-sm text-gray-500">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="m-4 flex flex-col gap-6">
      {isAdmin ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-md bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-lg font-semibold">School Branches</h1>
              <p className="text-xs text-gray-500">
                Manage the campuses available in the platform.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500">{rows.length} branch(es)</span>
              <FormModal table="school" type="create" onSuccess={loadSchools} />
            </div>
          </div>

          <div className="rounded-md bg-white p-4">
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-500">
                Loading…
              </div>
            ) : error ? (
              <div className="py-10 text-center text-sm text-red-500">{error}</div>
            ) : rows.length > 0 ? (
              <Table columns={columns} renderRow={renderRow as any} data={rows} />
            ) : (
              <div className="py-10 text-center text-sm text-gray-500">
                No school branches available.
              </div>
            )}
          </div>
        </div>
      ) : (
        <AccessRestricted message="Only administrators can manage school branches." />
      )}

      <div className="rounded-md bg-white p-4 text-sm text-gray-500">
        Account security is managed through Clerk. Visit your Clerk-hosted account
        portal to update password or other credentials.
      </div>
    </div>
  );
};

export default SettingsPage;
