"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AccessRestricted from "@/components/AccessRestricted";
import Announcements from "@/components/Announcements";
import SessionSwitcher from "@/components/SessionSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useResults, type ScoreSheetRow } from "@/contexts/ResultsContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { getJSON } from "@/lib/utils/api";
import { gradeColors } from "@/lib/grades";

type ParentProfile = {
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
    classId: string | null;
    className: string | null;
    relationship: string | null;
  }>;
};

type ChildSnapshot = {
  studentId: number | null;
  studentName: string;
  className: string;
  relationship: string | null;
  finalAverage: number | null;
  finalGrade: string | null;
  finalRemark: string | null;
  finalScores: ScoreSheetRow[];
  midtermOutOf50: number | null;
  midtermGrade: string | null;
  midtermRemark: string | null;
  midtermScores: ScoreSheetRow[];
  progress: number | null;
};

const ParentPage = () => {
  const { user, loading: authLoading } = useAuth();
  const isParent = user?.role === "parent";
  const parentId = user?.parentId ?? null;

  const term = useTermScope();
  const sessionId = useSessionScope();

  const {
    loadClassData,
    getStudentDetails,
    gradeForPercentage,
    gradeForMidterm,
    promotionThreshold,
  } = useResults();

  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  useEffect(() => {
    if (!isParent || !parentId) {
      setProfile(null);
      return;
    }

    let ignore = false;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getJSON<ParentProfile>(`/api/parents/${parentId}`);
        if (ignore) return;
        setProfile(result);
        const firstChild = result.students.find((student) => student.id != null);
        setSelectedChildId(firstChild?.id ?? null);
      } catch (err) {
        if (ignore) return;
        console.error("[ParentPage] Failed to load profile", err);
        setError(err instanceof Error ? err.message : "Unable to load parent profile.");
        setProfile(null);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      ignore = true;
    };
  }, [isParent, parentId]);

  useEffect(() => {
    if (!profile) return;
    const uniqueClassIds = new Set(
      profile.students
        .map((student) => student.classId)
        .filter((classId): classId is string => Boolean(classId)),
    );
    uniqueClassIds.forEach((classId) => {
      void loadClassData({ classId, term, sessionId });
    });
  }, [profile, loadClassData, term, sessionId]);

  const snapshots = useMemo<ChildSnapshot[]>(() => {
    if (!profile) return [];

    return profile.students.map((student) => {
      if (!student.id) {
        return {
          studentId: null,
          studentName: student.name,
          className: student.className ?? "Class not assigned",
          relationship: student.relationship,
          finalAverage: null,
          finalGrade: null,
          finalRemark: null,
          finalScores: [],
          midtermOutOf50: null,
          midtermGrade: null,
          midtermRemark: null,
          midtermScores: [],
          progress: null,
        };
      }

      const details = getStudentDetails({ studentId: student.id, term, sessionId });
      const finalSummary = details.finalSummary;
      const midtermSummary = details.midtermSummary;

      const finalAverage = finalSummary?.averageScore ?? null;
      const midtermAveragePercent = midtermSummary?.averageScore ?? null;
      const midtermOutOf50 =
        midtermAveragePercent != null
          ? Number(((midtermAveragePercent / 100) * 50).toFixed(1))
          : null;

      const finalGradeInfo =
        finalAverage != null ? gradeForPercentage(finalAverage) : null;
      const midtermGradeInfo =
        midtermOutOf50 != null ? gradeForMidterm(midtermOutOf50) : null;

      const progress =
        finalAverage != null && midtermAveragePercent != null
          ? Number((finalAverage - midtermAveragePercent).toFixed(1))
          : null;

      return {
        studentId: student.id,
        studentName: student.name,
        className: student.className ?? "Class not assigned",
        relationship: student.relationship,
        finalAverage,
        finalGrade: finalGradeInfo?.grade ?? null,
        finalRemark: finalGradeInfo?.remark ?? null,
        finalScores: details.finals,
        midtermOutOf50,
        midtermGrade: midtermGradeInfo?.grade ?? null,
        midtermRemark: midtermGradeInfo?.remark ?? null,
        midtermScores: details.midterm,
        progress,
      };
    });
  }, [
    profile,
    getStudentDetails,
    gradeForPercentage,
    gradeForMidterm,
    term,
    sessionId,
  ]);

  const activeSnapshot = useMemo(() => {
    if (!snapshots.length) return null;
    if (selectedChildId == null) return snapshots[0];
    return snapshots.find((snapshot) => snapshot.studentId === selectedChildId) ?? snapshots[0];
  }, [snapshots, selectedChildId]);

  if (authLoading) {
    return (
      <div className="m-4 mt-0 flex-1 rounded-md bg-white p-6 text-sm text-gray-500">
        Loading parent dashboard…
      </div>
    );
  }

  if (!isParent) {
    return <AccessRestricted message="Only parents can access this dashboard." />;
  }

  if (!parentId) {
    return (
      <div className="m-4 mt-0 flex-1 rounded-md bg-white p-6 text-sm text-gray-500">
        Your parent account is not fully set up yet. Please contact the school administrator.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="m-4 mt-0 flex-1 rounded-md bg-white p-6 text-sm text-gray-500">
        Loading parent dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 mt-0 flex-1 rounded-md bg-white p-6 text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="m-4 mt-0 flex-1 space-y-6">
      <section className="rounded-md border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Welcome back, {profile.name}</h1>
            <p className="text-sm text-gray-500">
              {profile.schoolName ?? "Your school"} | Session {sessionId} | {term}
            </p>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-500 md:items-end">
            {profile.email && <span>Email: {profile.email}</span>}
            {profile.phone && <span>Phone: {profile.phone}</span>}
            {profile.address && <span>Address: {profile.address}</span>}
          </div>
        </div>
        <div className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
          Promotion threshold is {promotionThreshold}% average. Keep an eye on each learner’s progress.
        </div>
        <div className="mt-4">
          <SessionSwitcher />
        </div>
      </section>

      {snapshots.length > 0 ? (
        <>
          <section className="rounded-md bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {snapshots.map((snapshot) => {
                const isActive = snapshot.studentId === activeSnapshot?.studentId;
                const label = snapshot.relationship
                  ? `${snapshot.studentName} (${snapshot.relationship})`
                  : snapshot.studentName;

                return (
                  <button
                    key={snapshot.studentName}
                    type="button"
                    onClick={() => setSelectedChildId(snapshot.studentId)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-lamaPurple bg-lamaPurple text-white"
                        : "border-gray-300 text-gray-600 hover:border-lamaPurple"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {activeSnapshot && (
            <section className="space-y-6">
              <div className="grid gap-4 rounded-md border border-gray-100 bg-white p-6 shadow-sm md:grid-cols-4">
                <div>
                  <span className="block text-xs uppercase tracking-wide text-gray-500">
                    Learner
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {activeSnapshot.studentName}
                  </span>
                  <span className="block text-xs text-gray-500">{activeSnapshot.className}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide text-gray-500">
                    Final Average
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {activeSnapshot.finalAverage != null
                      ? `${activeSnapshot.finalAverage.toFixed(1)}%`
                      : "--"}
                  </span>
                  {activeSnapshot.finalGrade && (
                    <span
                      className={`text-xs font-medium ${
                        gradeColors[activeSnapshot.finalGrade] ?? "text-gray-500"
                      }`}
                    >
                      {activeSnapshot.finalGrade}
                      {activeSnapshot.finalRemark ? ` • ${activeSnapshot.finalRemark}` : ""}
                    </span>
                  )}
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide text-gray-500">
                    Midterm (50)
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {activeSnapshot.midtermOutOf50 != null
                      ? `${activeSnapshot.midtermOutOf50.toFixed(1)}/50`
                      : "--"}
                  </span>
                  {activeSnapshot.midtermGrade && (
                    <span
                      className={`text-xs font-medium ${
                        gradeColors[activeSnapshot.midtermGrade] ?? "text-gray-500"
                      }`}
                    >
                      {activeSnapshot.midtermGrade}
                      {activeSnapshot.midtermRemark ? ` • ${activeSnapshot.midtermRemark}` : ""}
                    </span>
                  )}
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide text-gray-500">
                    Progress (Final - Midterm)
                  </span>
                  <span
                    className={`text-lg font-semibold ${
                      activeSnapshot.progress != null && activeSnapshot.progress > 0
                        ? "text-green-600"
                        : activeSnapshot.progress != null && activeSnapshot.progress < 0
                        ? "text-red-600"
                        : "text-gray-900"
                    }`}
                  >
                    {activeSnapshot.progress != null
                      ? `${activeSnapshot.progress > 0 ? "+" : ""}${activeSnapshot.progress.toFixed(
                          1,
                        )}%`
                      : "--"}
                  </span>
                  <span className="text-xs text-gray-500">Positive numbers show improvement</span>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  {activeSnapshot.finalScores.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Final Term Breakdown
                        </h3>
                        <span className="text-xs text-gray-500">
                          Scores calculated out of 100
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">Subject</th>
                              {activeSnapshot.finalScores[0]?.components.map((component) => (
                                <th
                                  key={component.componentId}
                                  className="px-4 py-3 text-center font-semibold"
                                >
                                  {component.label}
                                  <div className="text-[10px] text-gray-400">
                                    /{component.maxScore}
                                  </div>
                                </th>
                              ))}
                              <th className="px-4 py-3 text-center font-semibold">Total (%)</th>
                              <th className="px-4 py-3 text-center font-semibold">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {activeSnapshot.finalScores.map((row) => {
                              const rowGrade = gradeForPercentage(row.percentage);
                              return (
                                <tr key={row.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                    {row.subject}
                                  </td>
                                  {row.components.map((component) => (
                                    <td
                                      key={component.componentId}
                                      className="px-4 py-3 text-center text-gray-600"
                                    >
                                      {component.score}
                                    </td>
                                  ))}
                                  <td className="px-4 py-3 text-center font-semibold text-gray-900">
                                    {row.percentage}%
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`font-bold ${
                                        gradeColors[rowGrade.grade] ?? "text-gray-600"
                                      }`}
                                    >
                                      {rowGrade.grade}
                                    </span>
                                    <div
                                      className={`text-xs ${
                                        gradeColors[rowGrade.grade] ?? "text-gray-400"
                                      }`}
                                    >
                                      {rowGrade.remark}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {activeSnapshot.midtermScores.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Midterm Assessment Breakdown
                        </h3>
                        <span className="text-xs text-gray-500">
                          Scores calculated out of 50
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-blue-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">Subject</th>
                              {activeSnapshot.midtermScores[0]?.components.map((component) => (
                                <th
                                  key={component.componentId}
                                  className="px-4 py-3 text-center font-semibold"
                                >
                                  {component.label}
                                  <div className="text-[10px] text-gray-400">
                                    /{component.maxScore}
                                  </div>
                                </th>
                              ))}
                              <th className="px-4 py-3 text-center font-semibold">Total (50)</th>
                              <th className="px-4 py-3 text-center font-semibold">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {activeSnapshot.midtermScores.map((row) => {
                              const rowGrade = gradeForMidterm(row.totalScore);
                              return (
                                <tr key={row.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                    {row.subject}
                                  </td>
                                  {row.components.map((component) => (
                                    <td
                                      key={component.componentId}
                                      className="px-4 py-3 text-center text-gray-600"
                                    >
                                      {component.score}
                                    </td>
                                  ))}
                                  <td className="px-4 py-3 text-center font-semibold text-gray-900">
                                    {row.totalScore}/{row.maxScore}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`font-bold ${
                                        gradeColors[rowGrade.grade] ?? "text-gray-600"
                                      }`}
                                    >
                                      {rowGrade.grade}
                                    </span>
                                    <div
                                      className={`text-xs ${
                                        gradeColors[rowGrade.grade] ?? "text-gray-400"
                                      }`}
                                    >
                                      {rowGrade.remark}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {activeSnapshot.finalScores.length === 0 &&
                    activeSnapshot.midtermScores.length === 0 && (
                      <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                        No published results for this learner in the current term.
                      </p>
                    )}
                </div>

                <div className="space-y-6">
                  <Announcements />
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
                    Upcoming school calendar events will appear here once published.
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          Link a learner profile to this parent account to start tracking performance.
        </section>
      )}

      <Announcements />
    </div>
  );
};

export default ParentPage;
