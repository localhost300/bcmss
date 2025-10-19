"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import Pagination from "@/components/Pagination";
import { useResults } from "@/contexts/ResultsContext";
import { useSchool } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { gradeColors, gradeBands, clampScore } from "@/lib/grades";

const ITEMS_PER_PAGE = 10;

const gradeLegend = gradeBands.map((band, index) => {
  const lower = band.min;
  const upper = index === 0 ? 100 : gradeBands[index - 1].min - 1;
  return {
    grade: band.grade,
    remark: band.remark,
    range: index === 0 ? `${lower}% and above` : `${lower}% - ${upper}%`,
    color: gradeColors[band.grade] ?? "text-gray-500",
  };
});

const convertMidtermPercentage = (percentage: number) => {
  const safe = clampScore(percentage);
  return Number(((safe / 100) * 50).toFixed(1));
};

const MidtermResultsPage = () => {
  const term = useTermScope();
  const sessionId = useSessionScope();
  const { activeSchoolId, schools } = useSchool();
  const activeSchool =
    schools.find((school) => school.id === activeSchoolId) ?? schools[0];

  const {
    classOptions,
    classOptionsLoading,
    classOptionsError,
    loadClassData,
    isClassLoading,
    getClassError,
    getMidtermSummaries,
    gradeForMidterm,
  } = useResults();

  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || !selectedClass || !sessionId) return;
    void loadClassData({ classId: selectedClass, term, sessionId });
  }, [isHydrated, selectedClass, term, sessionId, loadClassData]);

  const summaries = useMemo(() => {
    if (!selectedClass) return [];
    return getMidtermSummaries({ classId: selectedClass, term, sessionId });
  }, [selectedClass, term, sessionId, getMidtermSummaries]);

  const filtered = useMemo(() => {
    if (!search.trim()) return summaries;
    const query = search.trim().toLowerCase();
    return summaries.filter(({ studentName }) =>
      studentName.toLowerCase().includes(query),
    );
  }, [summaries, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const classError = selectedClass
    ? getClassError({ classId: selectedClass, term, sessionId })
    : null;
  const loading = selectedClass
    ? isClassLoading({ classId: selectedClass, term, sessionId })
    : false;

  const gradeInfo = (percentage: number) => {
    const midtermScore = convertMidtermPercentage(percentage);
    const summary = gradeForMidterm(midtermScore);
    return {
      ...summary,
      color: gradeColors[summary.grade] ?? "text-gray-500",
      scoreOutOf50: midtermScore,
      percentage: Number(((midtermScore / 50) * 100).toFixed(1)),
    };
  };

  if (!isHydrated) {
    return (
      <div className="m-4 mt-0 flex-1">
        <div className="rounded-md border border-gray-100 bg-white p-6 text-sm text-gray-500">
          Preparing midterm results...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {activeSchool?.logo && (
            <Image
              src={activeSchool.logo}
              alt="School Logo"
              width={50}
              height={50}
              className="rounded-full"
            />
          )}
          <div>
            <h1 className="text-xl font-semibold">Midterm Results</h1>
            <p className="text-sm text-gray-500">
              {activeSchool?.name} | {term} | Session {sessionId}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Class
          </label>
          <select
            value={selectedClass}
            onChange={(event) => {
              setSelectedClass(event.target.value);
              setPage(1);
            }}
            disabled={classOptionsLoading || !classOptions.length}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lamaPurple"
          >
            <option value="">
              {classOptionsLoading ? "Loading classes…" : "Choose a class…"}
            </option>
            {classOptions.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
          {classOptionsLoading && (
            <p className="mt-2 text-xs text-gray-500">Loading class list…</p>
          )}
          {classOptionsError && (
            <p className="mt-2 text-xs text-red-500">{classOptionsError}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Student
          </label>
          <input
            type="text"
            placeholder="Search by student name…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lamaPurple"
          />
        </div>
      </div>

      {classError && (
        <div className="mb-4 text-sm text-red-500 border border-red-200 bg-red-50 rounded-md px-4 py-3">
          {classError}
        </div>
      )}

      {selectedClass ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {paginated.length} of {filtered.length} students
            </p>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 text-center py-8">
              Loading midterm summaries…
            </div>
          ) : paginated.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score (50)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remark
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginated.map((result) => {
                    const grade = gradeInfo(result.averageScore);
                    return (
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full text-sm font-semibold">
                            {result.position}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {result.studentName}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {result.studentId}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className="text-lg font-semibold">
                            {grade.scoreOutOf50.toFixed(1)}/50
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className="text-lg font-semibold text-gray-700">
                            {grade.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className={`text-lg font-bold ${grade.color}`}>
                            {grade.grade}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className={`text-sm ${grade.color}`}>{grade.remark}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() =>
                              window.open(
                                `/list/results/student/${result.studentId}?view=midterm`,
                                "_blank",
                              )
                            }
                            className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No students found for this class.</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h4 className="text-sm font-semibold text-blue-700 mb-3">Grading Scale</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
              {gradeLegend.map((band) => (
                <div key={band.grade} className="flex flex-col gap-1 bg-white px-3 py-2 rounded-md shadow-sm">
                  <span className={`font-semibold ${band.color}`}>{band.grade}</span>
                  <span className="text-gray-500">{band.remark}</span>
                  <span className="text-blue-400">{band.range}</span>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-blue-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Class</h3>
          <p className="text-gray-500">Choose a class above to view midterm results.</p>
        </div>
      )}
    </div>
  );
};

export default MidtermResultsPage;








