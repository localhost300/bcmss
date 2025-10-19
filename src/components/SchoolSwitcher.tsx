"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getSchoolById, useSchool, useSchoolScope } from "@/contexts/SchoolContext";

const SchoolSwitcher = () => {
  const { user } = useAuth();
  const { activeSchoolId, setActiveSchoolId, canSwitch, schools, loading, error } = useSchool();
  const scopeId = useSchoolScope();
  const managedIds = user?.managedSchoolIds ?? [];

  if (loading) {
    return <div className="text-xs text-gray-500">Loading campuses…</div>;
  }

  if (error) {
    return <div className="text-xs text-red-500">Unable to load campuses: {error}</div>;
  }

  const lookupId = canSwitch ? activeSchoolId : scopeId;
  const activeSchool = getSchoolById(lookupId ?? "") ?? schools[0];

  if (!activeSchool) {
    return (
      <div className="flex flex-col text-xs text-gray-500">
        <span className="font-semibold text-gray-700">No campus available</span>
      </div>
    );
  }

  if (!canSwitch) {
    return (
      <div className="flex flex-col text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{activeSchool.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Your campus</span>
      </div>
    );
  }

  const managedSchools = managedIds.length
    ? schools.filter((school) => managedIds.includes(school.id))
    : schools;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="school-switcher" className="text-xs text-gray-500 hidden md:block">
        School
      </label>
      <select
        id="school-switcher"
        value={activeSchoolId}
        onChange={(event) => setActiveSchoolId(event.target.value)}
        className="ring-[1.5px] ring-gray-300 rounded-md text-xs px-3 py-2 bg-white"
      >
        {managedSchools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SchoolSwitcher;
