"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import { useResults } from "@/contexts/ResultsContext";
import { useSession, useTermScope } from "@/contexts/SessionContext";
import { gradeBands } from "@/lib/grades";
import { TRAIT_SCORE_OPTIONS } from "@/lib/constants/traits";

type ReportCardResponse = {
  data: ReportCardData;
};

type AttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number | null;
};

type ReportCardData = {
  school: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    phone: string;
    email: string;
    principal: string;
    logo: string | null;
  };
  session: {
    id: string;
    name: string;
    term: string;
    startDate: string | null;
    endDate: string | null;
  };
  student: {
    id: number;
    code: string;
    name: string;
    gender: string | null;
    classId: number | null;
    className: string | null;
    age: number | null;
    bestSubject: { name: string; score: number } | null;
    weakestSubject: { name: string; score: number } | null;
  };
  summaries: {
    totalScore: number;
    averageScore: number;
    classPosition: number | null;
    totalSubjects: number;
    totalPossible: number;
    attendance: AttendanceSummary;
  };
  classTeacher: {
    name: string | null;
  };
  subjects: Array<{
    subject: string;
    ca1: number;
    ca2: number;
    exam: number;
    termTotal: number;
    grade: string;
    remark: string;
    position: number | null;
  }>;
  traits: Array<{
    category: "psychomotor" | "affective";
    traits: Array<{ trait: string; score: number }>;
  }>;
};

type StudentOption = {
  id: string;
  name: string;
};

const traitScoreLookup = new Map<number, string>(
  TRAIT_SCORE_OPTIONS.map((entry) => [entry.value, entry.description]),
);

const remarkFromAverage = (average: number): string => {
  if (average >= 85) return "Outstanding performance. Keep soaring.";
  if (average >= 75) return "Excellent effort. Maintain the momentum.";
  if (average >= 65) return "Very good work. Stay consistent.";
  if (average >= 55) return "Good progress. Aim higher next term.";
  if (average >= 50) return "Fair performance. You can do better with focus.";
  if (average >= 45) return "Below expectation. Additional effort required.";
  if (average >= 40) return "Weak performance. Intensive support recommended.";
  return "Poor performance. Immediate intervention required.";
};

const principalRemarkFromAverage = (average: number): string => {
  if (average >= 85) return "Commendable achievement. Keep up the excellent work.";
  if (average >= 75) return "Impressive result. Continue to strive for excellence.";
  if (average >= 65) return "A solid showing. Remain diligent.";
  if (average >= 55) return "Decent outcome. Greater commitment will yield more.";
  if (average >= 50) return "Average performance. Aim for improvement next term.";
  if (average >= 45) return "Work harder. You have potential to do better.";
  if (average >= 40) return "Unsatisfactory. Extra support and dedication required.";
  return "Serious concern. Meet with school authorities immediately.";
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }
  try {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? ""
      : parsed.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
  } catch {
    return "";
  }
};

const ReportCardGenerator = () => {
  const { classOptions, loadClassData, getClassError, getResultSummaries } = useResults();
  const { sessions, activeSessionId } = useSession();
  const termScope = useTermScope();

  const [selectedSessionId, setSelectedSessionId] = useState<string>(activeSessionId);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [report, setReport] = useState<ReportCardData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [teacherRemark, setTeacherRemark] = useState("");
  const [principalRemark, setPrincipalRemark] = useState("");
  const [nextTermBegins, setNextTermBegins] = useState("");

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedSessionId(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    if (!selectedSessionId || !selectedClassId) {
      return;
    }
    void loadClassData({
      classId: selectedClassId,
      term: termScope,
      sessionId: selectedSessionId,
    });
  }, [loadClassData, selectedClassId, selectedSessionId, termScope]);

  useEffect(() => {
    setReport(null);
    setSelectedStudentId("");
  }, [selectedClassId, selectedSessionId, termScope]);

  const students: StudentOption[] = useMemo(() => {
    if (!selectedSessionId || !selectedClassId) {
      return [];
    }
    const summaries = getResultSummaries({
      classId: selectedClassId,
      term: termScope,
      sessionId: selectedSessionId,
    });
    return summaries
      .map((summary) => ({
        id: String(summary.studentId),
        name: summary.studentName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [getResultSummaries, selectedClassId, selectedSessionId, termScope]);

  useEffect(() => {
    if (students.length === 0) {
      setSelectedStudentId("");
      return;
    }
    setSelectedStudentId((previous) => {
      if (previous && students.some((student) => student.id === previous)) {
        return previous;
      }
      return students[0]?.id ?? "";
    });
  }, [students]);

  const psychomotorTraits = useMemo(
    () => report?.traits.find((group) => group.category === "psychomotor")?.traits ?? [],
    [report],
  );

  const affectiveTraits = useMemo(
    () => report?.traits.find((group) => group.category === "affective")?.traits ?? [],
    [report],
  );

  const handleGenerateReport = async () => {
    if (!selectedSessionId || !selectedStudentId) {
      toast.error("Select a class and student before generating the report.");
      return;
    }
    setLoadingReport(true);
    try {
      const url = new URL(
        `/api/report-cards/${selectedStudentId}`,
        window.location.origin,
      );
      url.searchParams.set("sessionId", selectedSessionId);
      url.searchParams.set("term", termScope);

      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(
          errorBody?.message ?? "Unable to generate report sheet for the student.",
        );
      }
      const payload = (await response.json()) as ReportCardResponse;
      setReport(payload.data);
      setTeacherRemark(remarkFromAverage(payload.data.summaries.averageScore));
      setPrincipalRemark(
        principalRemarkFromAverage(payload.data.summaries.averageScore),
      );
      setNextTermBegins("");
    } catch (error) {
      console.error("[ReportCard] Failed to load report sheet", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to generate report sheet. Please try again.",
      );
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) {
      toast.error("Generate the report before downloading.");
      return;
    }
    if (!printRef.current) {
      toast.error("Printable layout not ready yet. Try again.");
      return;
    }
    try {
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvasModule.default(printRef.current, {
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDFModule.jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      let heightLeft = pdfHeight - 297;
      while (heightLeft > -1) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= 297;
      }
      const filename = `${report.student.name.replace(/\s+/g, "-").toLowerCase()}-report-sheet.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("[ReportCard] Failed to export PDF", error);
      toast.error("Unable to download PDF. Please try again.");
    }
  };

  const classError =
    selectedClassId && selectedSessionId
      ? getClassError({
          classId: selectedClassId,
          term: termScope,
          sessionId: selectedSessionId,
        })
      : null;

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-gray-50 p-6 text-gray-900">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500">
              Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="mt-1 w-52 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500">
              Term
            </label>
            <input
              value={termScope}
              disabled
              className="mt-1 w-40 rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500">
              Class
            </label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="mt-1 w-56 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
            >
              <option value="">Select class</option>
              {classOptions.map((classOption) => (
                <option key={classOption.id} value={classOption.id}>
                  {classOption.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500">
              Student
            </label>
            <select
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              className="mt-1 w-64 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
              disabled={!selectedClassId || students.length === 0}
            >
              {students.length === 0 ? (
                <option value="">No students available</option>
              ) : (
                students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={
              loadingReport ||
              !selectedClassId ||
              !selectedStudentId ||
              !selectedSessionId
            }
            className="inline-flex items-center justify-center rounded-md bg-lamaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-lamaSkyDark disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loadingReport ? "Generating..." : "Generate Report"}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!report}
            className="inline-flex items-center justify-center rounded-md border border-lamaSky px-4 py-2 text-sm font-semibold text-lamaSky transition hover:bg-lamaSky hover:text-white disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
          >
            Download PDF
          </button>
        </div>
      </header>

      {classError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {classError}
        </div>
      )}

      {report ? (
        <div
          ref={printRef}
          className="mx-auto w-full max-w-[210mm] bg-white p-6 text-gray-900 shadow-lg"
        >
          <section className="flex items-center gap-4 border-b border-gray-300 pb-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white">
              {report.school.logo ? (
                <Image
                  src={report.school.logo}
                  alt="School logo"
                  width={80}
                  height={80}
                />
              ) : (
                <span className="text-xs font-semibold text-gray-500">
                  LOGO
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold uppercase text-gray-900">
                {report.school.name}
              </h1>
              <p className="text-sm text-gray-600">
                {report.school.address}, {report.school.city}, {report.school.state},{" "}
                {report.school.country}
              </p>
              <p className="text-xs text-gray-500">
                Tel: {report.school.phone} &bull; Email: {report.school.email}
              </p>
              <p className="text-sm font-semibold text-gray-700">
                Term: {report.session.term} &nbsp; | &nbsp; Session:{" "}
                {report.session.name}
              </p>
            </div>
          </section>

          <section className="mt-4 border border-gray-300">
            <div className="grid grid-cols-1 divide-y divide-gray-300 text-sm md:grid-cols-2 md:divide-y-0 md:divide-x">
              <div className="flex flex-col gap-1 p-4">
                <div className="flex justify-between">
                  <span className="font-semibold">Student Name:</span>
                  <span>{report.student.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Admission No:</span>
                  <span>{report.student.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Class:</span>
                  <span>{report.student.className ?? "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Gender:</span>
                  <span>{report.student.gender ?? "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Age:</span>
                  <span>
                    {report.student.age !== null ? `${report.student.age} years` : "N/A"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1 p-4">
                <div className="flex justify-between">
                  <span className="font-semibold">Total Score:</span>
                  <span>
                    {formatNumber(report.summaries.totalScore)} /{" "}
                    {formatNumber(report.summaries.totalPossible)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Average Score:</span>
                  <span>{formatNumber(report.summaries.averageScore)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Class Position:</span>
                  <span>
                    {report.summaries.classPosition
                      ? `${report.summaries.classPosition}${report.summaries.classPosition === 1 ? "st" : report.summaries.classPosition === 2 ? "nd" : report.summaries.classPosition === 3 ? "rd" : "th"}`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Best Subject:</span>
                  <span>
                    {report.student.bestSubject
                      ? `${report.student.bestSubject.name} (${formatNumber(
                          report.student.bestSubject.score,
                        )})`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Weakest Subject:</span>
                  <span>
                    {report.student.weakestSubject
                      ? `${report.student.weakestSubject.name} (${formatNumber(
                          report.student.weakestSubject.score,
                        )})`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 text-base font-semibold uppercase">
              Subject Performance
            </h2>
            <table className="w-full border border-gray-400 text-sm">
              <thead className="bg-gray-100 text-sm uppercase text-gray-700">
                <tr>
                  <th className="border border-gray-400 px-3 py-2 text-left">Subject</th>
                  <th className="border border-gray-400 px-3 py-2 text-center">
                    CA1
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-center">
                    CA2
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-center">
                    Exam
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-center">
                    Term Total
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-center">
                    Grade
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-center">
                    Position
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-left">
                    Remark
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.subjects.map((subject) => (
                  <tr key={subject.subject} className="odd:bg-white even:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2 font-medium">
                      {subject.subject}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {formatNumber(subject.ca1)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {formatNumber(subject.ca2)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {formatNumber(subject.exam)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-semibold">
                      {formatNumber(subject.termTotal)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-semibold">
                      {subject.grade}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {subject.position ? `${subject.position}` : "—"}
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {subject.remark}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="border border-gray-300">
              <h3 className="border-b border-gray-300 bg-gray-100 px-3 py-2 text-sm font-semibold uppercase">
                Psychomotor Skills
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {psychomotorTraits.length ? (
                    psychomotorTraits.map((trait) => (
                      <tr
                        key={`psychomotor-${trait.trait}`}
                        className="border-b border-gray-200"
                      >
                        <td className="px-3 py-2">{trait.trait}</td>
                        <td className="px-3 py-2 text-center">{trait.score}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {traitScoreLookup.get(trait.score) ?? ""}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-2 text-sm text-gray-500" colSpan={3}>
                        No psychomotor ratings captured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border border-gray-300">
              <h3 className="border-b border-gray-300 bg-gray-100 px-3 py-2 text-sm font-semibold uppercase">
                Affective Domain
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {affectiveTraits.length ? (
                    affectiveTraits.map((trait) => (
                      <tr
                        key={`affective-${trait.trait}`}
                        className="border-b border-gray-200"
                      >
                        <td className="px-3 py-2">{trait.trait}</td>
                        <td className="px-3 py-2 text-center">{trait.score}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {traitScoreLookup.get(trait.score) ?? ""}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-2 text-sm text-gray-500" colSpan={3}>
                        No affective ratings captured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="border border-gray-300 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase">Attendance Summary</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1 font-medium text-gray-700">Total Sessions</td>
                    <td className="py-1 text-right">
                      {report.summaries.attendance.total}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-700">Present</td>
                    <td className="py-1 text-right">
                      {report.summaries.attendance.present}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-700">Late</td>
                    <td className="py-1 text-right">
                      {report.summaries.attendance.late}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium text-gray-700">Absent</td>
                    <td className="py-1 text-right">
                      {report.summaries.attendance.absent}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold text-gray-900">
                      Attendance %
                    </td>
                    <td className="py-1 text-right font-semibold">
                      {report.summaries.attendance.percentage !== null
                        ? `${formatNumber(report.summaries.attendance.percentage)}%`
                        : "N/A"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="border border-gray-300 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase">
                Cognitive Keys (WAEC Grading)
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {gradeBands.map((band) => (
                  <div key={band.grade} className="flex items-center justify-between rounded border border-gray-200 px-2 py-1">
                    <span className="font-semibold">{band.grade}</span>
                    <span className="text-gray-600">{band.remark}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">
                Class Teacher&apos;s Remark
              </label>
              <textarea
                value={teacherRemark}
                onChange={(event) => setTeacherRemark(event.target.value)}
                className="min-h-[90px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
              />
              <div className="mt-2 flex flex-col items-center">
                <div className="h-12 w-full border-b border-gray-400" />
                <span className="mt-1 text-xs uppercase text-gray-600">
                  {report.classTeacher.name ?? "Class Teacher"}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">
                Principal&apos;s Remark
              </label>
              <textarea
                value={principalRemark}
                onChange={(event) => setPrincipalRemark(event.target.value)}
                className="min-h-[90px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
              />
              <div className="mt-2 flex flex-col items-center">
                <div className="h-12 w-full border-b border-gray-400" />
                <span className="mt-1 text-xs uppercase text-gray-600">
                  {report.school.principal}
                </span>
              </div>
            </div>
          </section>

          <section className="mt-6 flex flex-col gap-3 border-t border-gray-300 pt-4 text-sm">
            <div className="flex gap-6">
              <label className="flex items-center gap-3 font-semibold">
                Next Term Begins:
                <input
                  type="date"
                  value={nextTermBegins}
                  onChange={(event) => setNextTermBegins(event.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
                />
              </label>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Generated On:</span>
                <span>{formatDate(new Date().toISOString())}</span>
              </div>
            </div>
            <div className="h-12 border-b border-gray-400" />
            <p className="text-xs text-gray-500">
              This report card is generated electronically and remains valid with authorised signatures.
            </p>
          </section>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
          {loadingReport ? "Preparing report sheet..." : "Select a class and student, then click \"Generate Report\" to preview the final term report sheet."}
        </div>
      )}
    </div>
  );
};

export default ReportCardGenerator;
