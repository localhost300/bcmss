"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { useResults } from "@/contexts/ResultsContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { useSchool } from "@/contexts/SchoolContext";
import Pagination from "@/components/Pagination";
import { gradeColors } from "@/lib/grades";

const ITEMS_PER_PAGE = 10;

const ViewResultsPage = () => {
  const term = useTermScope();
  const sessionId = useSessionScope();
  const { activeSchoolId, schools } = useSchool();
  const activeSchool =
    schools.find((school) => school.id === activeSchoolId) ?? schools[0];

  const {
    classOptions,
    loadClassData,
    isClassLoading,
    getClassError,
    getResultSummaries,
    gradeForPercentage,
  } = useResults();

  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!selectedClass || !sessionId) return;
    void loadClassData({ classId: selectedClass, term, sessionId });
  }, [selectedClass, term, sessionId, loadClassData]);

  const results = useMemo(() => {
    if (!selectedClass) return [];
    return getResultSummaries({ classId: selectedClass, term, sessionId });
  }, [selectedClass, term, sessionId, getResultSummaries]);

  const filteredResults = useMemo(() => {
    if (!searchTerm) return results;
    const query = searchTerm.trim().toLowerCase();
    return results.filter((result) =>
      result.studentName.toLowerCase().includes(query),
    );
  }, [results, searchTerm]);

  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredResults.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredResults, currentPage]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);

  const getGradeInfo = (percentage: number) => {
    const summary = gradeForPercentage(percentage);
    return {
      ...summary,
      color: gradeColors[summary.grade] ?? "text-gray-500",
    };
  };

  const classError = selectedClass
    ? getClassError({ classId: selectedClass, term, sessionId })
    : null;
  const loadingResults = selectedClass
    ? isClassLoading({ classId: selectedClass, term, sessionId })
    : false;

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
            <h1 className="text-xl font-semibold">View Results</h1>
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
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lamaPurple"
          >
            <option value="">Choose a class…</option>
            {classOptions.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Student
          </label>
          <input
            type="text"
            placeholder="Search by student name…"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
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
              Showing {paginatedResults.length} of {filteredResults.length} students
            </p>
          </div>

          {loadingResults ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading results…
            </div>
          ) : paginatedResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Average
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
                  {paginatedResults.map((result) => {
                    const gradeInfo = getGradeInfo(result.averageScore);
                    return (
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center w-8 h-8 bg-lamaPurple text-white rounded-full text-sm font-semibold">
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
                            {result.averageScore.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className={`text-lg font-bold ${gradeInfo.color}`}>
                            {gradeInfo.grade}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className={`text-sm ${gradeInfo.color}`}>
                            {gradeInfo.remark}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <Link
                            href={`/list/results/student/${result.studentId}?view=final`}
                            className="bg-lamaPurple text-white px-3 py-1 rounded-md text-sm hover:bg-lamaPurple/80 transition-colors inline-flex items-center gap-1"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No students found matching your search criteria.
              </p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
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
          <p className="text-gray-500">
            Choose a class from the dropdown above to view student results.
          </p>
        </div>
      )}
    </div>
  );
};

export default ViewResultsPage;