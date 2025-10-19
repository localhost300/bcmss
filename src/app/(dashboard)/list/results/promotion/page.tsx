"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import { useResults, type PromotionCandidate } from "@/contexts/ResultsContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { useSchool } from "@/contexts/SchoolContext";
import { gradeBands, gradeColors } from "@/lib/grades";

const gradeLegend = gradeBands.map((band, index) => {
  const upperBound = index === 0 ? 100 : gradeBands[index - 1].min - 1;
  const range =
    index === 0 ? `${band.min}% and above` : `${band.min}% - ${upperBound}%`;
  return {
    ...band,
    range,
    color: gradeColors[band.grade] ?? "text-gray-500",
  };
});

const PromotionPage = () => {
  const {
    classOptions,
    getPromotionCandidates,
    setPromotionDecision,
    finalizePromotion,
    promotionThreshold,
  } = useResults();
  const { schools, activeSchoolId } = useSchool();
  const sessionId = useSessionScope();
  const term = useTermScope();

  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"promote" | "hold" | "">("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  const schoolMeta = useMemo(() => {
    if (!schools.length) {
      return { name: "Campus", logo: null as string | null };
    }
    const match = schools.find((school) => school.id === activeSchoolId);
    return {
      name: match?.name ?? schools[0].name,
      logo: match?.logo ?? null,
    };
  }, [activeSchoolId, schools]);

  const promotionCandidates = useMemo(() => {
    if (!selectedClass) return [];
    return getPromotionCandidates({ classId: selectedClass, term, sessionId });
  }, [selectedClass, term, sessionId, getPromotionCandidates]);

  const filteredCandidates = useMemo(() => {
    if (!searchTerm.trim()) return promotionCandidates;
    const query = searchTerm.trim().toLowerCase();
    return promotionCandidates.filter((candidate) =>
      candidate.studentName.toLowerCase().includes(query),
    );
  }, [promotionCandidates, searchTerm]);

  const stats = useMemo(() => {
    const total = filteredCandidates.length;
    const autoPromoted = filteredCandidates.filter(
      (candidate) => candidate.autoPromoted,
    ).length;
    const manualPromote = filteredCandidates.filter(
      (candidate) => !candidate.autoPromoted && candidate.decision === "promote",
    ).length;
    const held = filteredCandidates.filter(
      (candidate) => candidate.decision === "hold",
    ).length;
    const pending = filteredCandidates.filter(
      (candidate) => candidate.decision === "auto" && !candidate.autoPromoted,
    ).length;
    return { total, autoPromoted, manualPromote, held, pending };
  }, [filteredCandidates]);

  const handleDecisionChange = (studentId: number, decision: "promote" | "hold") => {
    if (!selectedClass) return;
    setPromotionDecision(selectedClass, studentId, decision);
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedStudents.size === 0) return;
    selectedStudents.forEach((studentIdStr) => {
      const studentId = Number.parseInt(studentIdStr, 10);
      handleDecisionChange(studentId, bulkAction);
    });
    setSelectedStudents(new Set());
    setBulkAction("");
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === filteredCandidates.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(
        new Set(filteredCandidates.map((candidate) => candidate.studentId.toString())),
      );
    }
  };

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleFinalizePromotion = () => {
    if (!selectedClass) return;
    finalizePromotion({ classId: selectedClass, term, sessionId });
    setShowConfirmModal(false);
  };

  const getStatusBadge = (candidate: PromotionCandidate) => {
    if (candidate.autoPromoted) {
      return (
        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
          Auto Promoted
        </span>
      );
    }
    if (candidate.decision === "promote") {
      return (
        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
          Manual Promote
        </span>
      );
    }
    if (candidate.decision === "hold") {
      return (
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
          Hold Back
        </span>
      );
    }
    return (
      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
        Pending Decision
      </span>
    );
  };

  return (
    <div className="m-4 mt-0 flex-1 rounded-md bg-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {schoolMeta.logo && (
            <Image
              src={schoolMeta.logo}
              alt="School Logo"
              width={50}
              height={50}
              className="rounded-full"
            />
          )}
          <div>
            <h1 className="text-xl font-semibold">Student Promotion</h1>
            <p className="text-sm text-gray-500">
              {schoolMeta.name} | {term} | Session {sessionId}
            </p>
            <p className="text-xs text-blue-600">
              Promotion Threshold: {promotionThreshold}% Average
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 md:grid-cols-5">
        <div className="rounded-md border border-white/60 bg-white/80 p-3 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Total Candidates
          </p>
          <p className="text-xl font-semibold text-gray-800">{stats.total}</p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/80 p-3 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Auto Promoted
          </p>
          <p className="text-xl font-semibold text-green-600">
            {stats.autoPromoted}
          </p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/80 p-3 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Manual Promote
          </p>
          <p className="text-xl font-semibold text-blue-600">
            {stats.manualPromote}
          </p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/80 p-3 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Held Back
          </p>
          <p className="text-xl font-semibold text-red-600">{stats.held}</p>
        </div>
        <div className="rounded-md border border-white/60 bg-white/80 p-3 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Pending Decision
          </p>
          <p className="text-xl font-semibold text-amber-600">{stats.pending}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Select Class
          </label>
          <select
            value={selectedClass}
            onChange={(event) => {
              setSelectedClass(event.target.value);
              setSelectedStudents(new Set());
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-lamaPurple focus:outline-none focus:ring-1 focus:ring-lamaPurple"
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
          <label className="mb-2 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Search Student
          </label>
          <input
            type="text"
            placeholder="Filter by student name"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-lamaPurple focus:outline-none focus:ring-1 focus:ring-lamaPurple"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Bulk Actions
          </label>
          <div className="flex gap-2">
            <select
              value={bulkAction}
              onChange={(event) =>
                setBulkAction(event.target.value as "promote" | "hold" | "")
              }
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-lamaPurple focus:outline-none focus:ring-1 focus:ring-lamaPurple"
            >
              <option value="">Select action</option>
              <option value="promote">Promote selected</option>
              <option value="hold">Hold selected</option>
            </select>
            <button
              type="button"
              onClick={handleBulkAction}
              className="rounded-md bg-lamaPurple px-3 py-2 text-sm font-medium text-white hover:bg-lamaPurple/80 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!bulkAction || selectedStudents.size === 0}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {selectedClass ? (
        <>
          {filteredCandidates.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          selectedStudents.size > 0 &&
                          selectedStudents.size === filteredCandidates.length
                        }
                        onChange={handleSelectAll}
                        className="rounded"
                        aria-label="Select all students"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-center">Average</th>
                    <th className="px-4 py-3 text-center">Grade</th>
                    <th className="px-4 py-3 text-center">Next Class</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredCandidates.map((candidate) => {
                    const averageColor =
                      candidate.averageScore >= promotionThreshold
                        ? "text-green-600"
                        : "text-gray-600";
                    const gradeColor = gradeColors[candidate.grade] ?? "text-gray-600";
                    const promoteButtonClass =
                      candidate.decision === "promote"
                        ? "px-3 py-1 rounded text-xs font-medium bg-blue-500 text-white"
                        : "px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200";
                    const holdButtonClass =
                      candidate.decision === "hold"
                        ? "px-3 py-1 rounded text-xs font-medium bg-red-500 text-white"
                        : "px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200";

                    return (
                      <tr key={candidate.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedStudents.has(candidate.studentId.toString())}
                            onChange={() => handleStudentSelect(candidate.studentId.toString())}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {candidate.studentName}
                          </div>
                          <div className="text-sm text-gray-500">ID: {candidate.studentId}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-lg font-semibold ${averageColor}`}>
                            {candidate.averageScore.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`font-bold ${gradeColor}`}>{candidate.grade}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm">
                            {candidate.nextClassName || "Final Year"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">{getStatusBadge(candidate)}</td>
                        <td className="px-4 py-4 text-center">
                          {!candidate.autoPromoted && (
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleDecisionChange(candidate.studentId, "promote")}
                                className={promoteButtonClass}
                              >
                                Promote
                              </button>
                              <button
                                onClick={() => handleDecisionChange(candidate.studentId, "hold")}
                                className={holdButtonClass}
                              >
                                Hold
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No students found for promotion in this class.
            </div>
          )}

          {filteredCandidates.length > 0 && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowConfirmModal(true)}
                className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-700"
              >
                Finalize Promotion Decisions
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="py-12 text-center">
          <div className="mb-4 text-gray-400">
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-2.239"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">Select a Class</h3>
          <p className="text-gray-500">
            Choose a class from the dropdown above to manage student promotions.
          </p>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Confirm Promotion Decisions</h3>
            <p className="mb-6 text-gray-600">
              Are you sure you want to finalize the promotion decisions for this class? This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalizePromotion}
                className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="mt-10 rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h4 className="mb-3 text-sm font-semibold text-blue-700">Grading Scale</h4>
        <div className="grid gap-2 text-xs md:grid-cols-3 lg:grid-cols-4">
          {gradeLegend.map((band) => (
            <div
              key={band.grade}
              className="flex flex-col gap-1 rounded-md bg-white px-3 py-2 shadow-sm"
            >
              <span className={`font-semibold ${band.color}`}>{band.grade}</span>
              <span className="text-gray-500">{band.remark}</span>
              <span className="text-blue-400">{band.range}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PromotionPage;
