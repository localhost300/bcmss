"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { gradeColors } from "@/lib/grades";

import { useResults } from "@/contexts/ResultsContext";
import { useSchool } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";

type ReportType = "final" | "midterm" | "combined";

const PrintReportCardPage = () => {
  const {
    classOptions,
    getAvailableExamTypes,
    getResultSummaries,
    getMidtermSummaries,
    getStudentDetails,
    gradeForMidterm,
  } = useResults();
  const { schools, activeSchoolId } = useSchool();
  const sessionId = useSessionScope();
  const term = useTermScope();

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [reportType, setReportType] = useState<ReportType>("combined");

  const availableExamTypes = useMemo(() => {
    if (!selectedClass) {
      return [] as Array<"midterm" | "final">;
    }
    return getAvailableExamTypes({ classId: selectedClass, term, sessionId });
  }, [selectedClass, term, sessionId, getAvailableExamTypes]);

  const school = useMemo(() => {
    if (!schools.length) {
      return { name: "Campus", logo: null as string | null };
    }
    const match = schools.find((item) => item.id === activeSchoolId);
    return {
      name: match?.name ?? schools[0].name,
      logo: match?.logo ?? null,
    };
  }, [activeSchoolId, schools]);

  const students = useMemo(() => {
    if (!selectedClass) return [];
    const finalSummaries = getResultSummaries({ classId: selectedClass, term, sessionId });
    const midtermSummaries = getMidtermSummaries({ classId: selectedClass, term, sessionId });

    if (reportType === "final") return finalSummaries;
    if (reportType === "midterm") return midtermSummaries;

    const combined = new Map<string, (typeof finalSummaries)[number]>();
    finalSummaries.forEach((summary) => combined.set(summary.studentId.toString(), summary));
    midtermSummaries.forEach((summary) => {
      const key = summary.studentId.toString();
      if (!combined.has(key)) {
        combined.set(key, summary);
      }
    });

    return Array.from(combined.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [selectedClass, term, sessionId, reportType, getResultSummaries, getMidtermSummaries]);

  const studentData = useMemo(() => {
    if (!selectedStudent) return null;
    const studentId = Number.parseInt(selectedStudent, 10);
    return getStudentDetails({ studentId, term, sessionId });
  }, [selectedStudent, term, sessionId, getStudentDetails]);

  useEffect(() => {
    if (!availableExamTypes.length) {
      setReportType("combined");
      return;
    }

    const hasFinal = availableExamTypes.includes("final");
    const hasMidterm = availableExamTypes.includes("midterm");
    const combinedAllowed = hasFinal && hasMidterm;

    if (reportType === "combined" && !combinedAllowed) {
      setReportType(hasFinal ? "final" : hasMidterm ? "midterm" : "combined");
      return;
    }

    if (reportType !== "combined" && !availableExamTypes.includes(reportType)) {
      setReportType(availableExamTypes[0]);
    }
  }, [availableExamTypes, reportType]);

  const reportTypeOptions = useMemo(() => {
    const options: Array<{ value: ReportType; label: string }> = [];
    const hasFinal = availableExamTypes.includes("final");
    const hasMidterm = availableExamTypes.includes("midterm");

    if (hasFinal && hasMidterm) {
      options.push({ value: "combined", label: "Combined" });
    }
    if (hasFinal) {
      options.push({ value: "final", label: "Final Only" });
    }
    if (hasMidterm) {
      options.push({ value: "midterm", label: "Midterm Only" });
    }
    if (!options.length) {
      options.push({ value: "combined", label: "Combined" });
    }
    return options;
  }, [availableExamTypes]);

  const selectedStudentInfo = useMemo(() => {
    if (!selectedStudent) return null;
    return students.find((summary) => summary.studentId.toString() === selectedStudent) ?? null;
  }, [selectedStudent, students]);

  useEffect(() => {
    if (!selectedStudent) return;
    const exists = students.some((summary) => summary.studentId.toString() === selectedStudent);
    if (!exists) {
      setSelectedStudent("");
    }
  }, [students, selectedStudent]);

  const getGradeInfo = (percentage: number) => {
    if (percentage >= 75) return { grade: "A1", remark: "Excellent", color: "text-green-600" };
    if (percentage >= 70) return { grade: "B2", remark: "Very Good", color: "text-green-500" };
    if (percentage >= 65) return { grade: "B3", remark: "Good", color: "text-blue-600" };
    if (percentage >= 60) return { grade: "C4", remark: "Credit", color: "text-blue-500" };
    if (percentage >= 55) return { grade: "C5", remark: "Credit", color: "text-blue-400" };
    if (percentage >= 50) return { grade: "C6", remark: "Credit", color: "text-yellow-600" };
    if (percentage >= 45) return { grade: "D7", remark: "Pass", color: "text-orange-600" };
    if (percentage >= 40) return { grade: "E8", remark: "Pass", color: "text-orange-500" };
    return { grade: "F9", remark: "Fail", color: "text-red-600" };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0">
      <div className="print:hidden mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Print Report Card</h1>
          {selectedStudent && (
            <button
              onClick={handlePrint}
              className="bg-lamaPurple text-white px-4 py-2 rounded-md hover:bg-lamaPurple/80 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Print Report Card
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Select Class</label>
            <select
              value={selectedClass}
              onChange={(event) => {
                setSelectedClass(event.target.value);
                setSelectedStudent("");
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaPurple"
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
            <label className="mb-2 block text-sm font-medium text-gray-700">Select Student</label>
            <select
              value={selectedStudent}
              onChange={(event) => setSelectedStudent(event.target.value)}
              disabled={!selectedClass}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaPurple disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">Choose a student…</option>
              {students.map((student) => (
                <option key={student.id} value={student.studentId}>
                  {student.studentName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Report Type</label>
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value as typeof reportType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lamaPurple"
            >
              <option value="combined">Combined</option>
              <option value="final">Final Only</option>
              <option value="midterm">Midterm Only</option>
            </select>
          </div>
        </div>
      </div>

      {selectedStudent && studentData && selectedStudentInfo ? (
        <div className="space-y-6">
          <div className="rounded-md border border-gray-200 p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {school.logo && (
                  <Image
                    src={school.logo}
                    alt="School Logo"
                    width={60}
                    height={60}
                    className="rounded-full border border-gray-200"
                  />
                )}
                <div>
                  <h2 className="text-xl font-semibold">{school.name}</h2>
                  <p className="text-sm text-gray-600">
                    {term} | Session {sessionId}
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                <p>
                  <span className="font-medium text-gray-700">Student:</span>{" "}
                  {selectedStudentInfo.studentName}
                </p>
                <p>
                  <span className="font-medium text-gray-700">Class:</span>{" "}
                  {selectedStudentInfo.className}
                </p>
                <p>
                  <span className="font-medium text-gray-700">Position:</span>{" "}
                  {selectedStudentInfo.position}
                </p>
              </div>
            </div>

            {studentData.finalSummary && (
              <div className="mb-6 grid gap-4 rounded-md bg-gray-50 p-4 md:grid-cols-3">
                <div>
                  <span className="block text-xs uppercase tracking-wide text-gray-500">
                    Final Average
                  </span>
                  <span className="text-xl font-bold text-gray-800">
                    {studentData.finalSummary.averageScore.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide text-gray-500">
                    Class Position
                  </span>
                  <span className="text-xl font-bold text-gray-800">
                    {studentData.finalSummary.position}
                  </span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide text-gray-500">
                    Final Grade
                  </span>
                  <span className="text-xl font-bold text-gray-800">
                    {
                      getGradeInfo(studentData.finalSummary.averageScore)
                        .grade
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Final Results Table */}
            {reportType !== "midterm" && studentData.finals.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-700">
                    Final Term Results
                  </h3>
                  <span className="text-xs text-gray-400">
                    Scores calculated out of 100
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 text-sm">
                    <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Subject</th>
                        {studentData.finals[0]?.components.map((component) => (
                          <th
                            key={component.componentId}
                            className="px-4 py-3 text-center"
                          >
                            {component.label}
                            <div className="text-[10px] text-gray-400">
                              /{component.maxScore}
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center">Total (%)</th>
                        <th className="px-4 py-3 text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {studentData.finals.map((result) => {
                        const gradeInfo = getGradeInfo(result.percentage);
                        return (
                          <tr key={result.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 font-medium text-gray-900">
                              {result.subject}
                            </td>
                            {result.components.map((component) => (
                              <td key={component.componentId} className="px-4 py-4 text-center">
                                {component.score}
                              </td>
                            ))}
                            <td className="px-4 py-4 text-center font-semibold text-gray-800">
                              {result.percentage}%
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`font-bold ${gradeInfo.color}`}>
                                {gradeInfo.grade}
                              </span>
                              <div className={`text-xs ${gradeInfo.color}`}>
                                {gradeInfo.remark}
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

            {/* Midterm Results Table */}
            {reportType !== "final" && studentData.midterm.length > 0 && (
              <section className="space-y-3">
                <div className="mt-8 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-700">
                    Midterm Assessment Results
                  </h3>
                  <span className="text-xs text-gray-400">
                    Scores calculated out of 50
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 text-sm">
                    <thead className="bg-blue-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Subject</th>
                        {studentData.midterm[0]?.components.map((component) => (
                          <th
                            key={component.componentId}
                            className="px-4 py-3 text-center"
                          >
                            {component.label}
                            <div className="text-[10px] text-gray-400">
                              /{component.maxScore}
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center">Total (50)</th>
                        <th className="px-4 py-3 text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {studentData.midterm.map((result) => {
                        const gradeInfo = gradeForMidterm(result.totalScore);
                        return (
                          <tr key={result.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 font-medium text-gray-900">
                              {result.subject}
                            </td>
                            {result.components.map((component) => (
                              <td key={component.componentId} className="px-4 py-4 text-center">
                                {component.score}
                              </td>
                            ))}
                            <td className="px-4 py-4 text-center font-semibold text-gray-800">
                              {result.totalScore}/{result.maxScore}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`font-bold ${gradeColors[gradeInfo.grade] ?? "text-gray-600"}`}>
                                {gradeInfo.grade}
                              </span>
                              <div className="text-xs text-gray-500">{gradeInfo.remark}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {studentData.midtermSummary && (
                  <div className="mt-4 rounded bg-blue-50 p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <span className="block text-sm text-gray-600">Midterm Average</span>
                        <span className="text-xl font-bold text-blue-600">
                          {studentData.midtermSummary.averageScore.toFixed(1)}/50
                        </span>
                      </div>
                      <div>
                        <span className="block text-sm text-gray-600">Position in Class</span>
                        <span className="text-xl font-bold text-blue-600">
                          {studentData.midtermSummary.position}
                        </span>
                      </div>
                      <div>
                        <span className="block text-sm text-gray-600">Midterm Grade</span>
                        <span className="text-xl font-bold text-blue-600">
                          {gradeForMidterm(studentData.midtermSummary.averageScore).grade}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="mt-6 rounded border border-gray-200">
            <div className="border-b border-gray-200 p-6">
              <h4 className="mb-3 text-sm font-semibold">GRADING SCALE</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>A1 (75%+): Excellent</div>
                <div>B2 (70-74%): Very Good</div>
                <div>B3 (65-69%): Good</div>
                <div>C4 (60-64%): Credit</div>
                <div>C5 (55-59%): Credit</div>
                <div>C6 (50-54%): Credit</div>
                <div>D7 (45-49%): Pass</div>
                <div>E8 (40-44%): Pass</div>
                <div>F9 (Below 40%): Fail</div>
              </div>
            </div>
            <div className="mt-auto border-t border-gray-200 p-6">
              <div className="grid grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="mb-2 h-16 border-b border-gray-400" />
                  <p className="text-sm font-medium">Class Teacher</p>
                  <p className="text-xs text-gray-500">Signature & Date</p>
                </div>
                <div className="text-center">
                  <div className="mb-2 h-16 border-b border-gray-400" />
                  <p className="text-sm font-medium">Principal</p>
                  <p className="text-xs text-gray-500">Signature & Date</p>
                </div>
                <div className="text-center">
                  <div className="mb-2 h-16 border-b border-gray-400" />
                  <p className="text-sm font-medium">Parent/Guardian</p>
                  <p className="text-xs text-gray-500">Signature & Date</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center">
          <div className="mb-4 text-gray-400">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            Select Class and Student
          </h3>
          <p className="text-gray-500">
            Choose a class and student from the dropdowns above to generate their report card.
          </p>
        </div>
      )}
    </div>
  );
};

export default PrintReportCardPage;





