"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { useResults } from "@/contexts/ResultsContext";
import { useSchool } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { gradeBands, gradeColors } from "@/lib/grades";

const StudentDetailsPage = () => {
  const params = useParams();
  const studentId = Number(params.id);
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");

  const { getStudentDetails, gradeForPercentage, gradeForMidterm } = useResults();
  const { schools, activeSchoolId } = useSchool();
  const sessionId = useSessionScope();
  const term = useTermScope();

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

  const studentData = useMemo(() => {
    return getStudentDetails({ studentId, term, sessionId });
  }, [studentId, term, sessionId, getStudentDetails]);

  const view =
    viewParam === "midterm" ? "midterm" : viewParam === "final" ? "final" : "all";
  const showFinal = view !== "midterm" && studentData.finals.length > 0;
  const showMidterm = view !== "final" && studentData.midterm.length > 0;
  const backHref = view === "midterm" ? "/list/results/midterm" : "/list/results/view";
  const backLabel = view === "midterm" ? "Back to Midterm Results" : "Back to Final Results";

  const gradeLegend = useMemo(
    () =>
      gradeBands.map((band, index) => {
        const upperBound = index === 0 ? 100 : gradeBands[index - 1].min - 1;
        const range =
          index === 0 ? `${band.min}% and above` : `${band.min}% - ${upperBound}%`;
        return {
          ...band,
          range,
          color: gradeColors[band.grade] ?? "text-gray-500",
        };
      }),
    [],
  );

  const decorateGrade = <T extends { grade: string; remark: string }>(summary: T) => ({
    ...summary,
    color: gradeColors[summary.grade] ?? "text-gray-500",
  });

  const finalSummary = studentData.finalSummary;
  const midtermSummary = studentData.midtermSummary;

  const finalGradeInfo = finalSummary
    ? decorateGrade(gradeForPercentage(finalSummary.averageScore))
    : null;
  const midtermAverageOutOf50 = midtermSummary
    ? Number(((midtermSummary.averageScore / 100) * 50).toFixed(1))
    : null;
  const midtermGradeInfo =
    midtermAverageOutOf50 != null
      ? decorateGrade(gradeForMidterm(midtermAverageOutOf50))
      : null;

  const toggleBaseClass =
    "px-3 py-1 rounded-full border text-xs font-medium transition-colors";
  const finalToggleClass =
    toggleBaseClass +
    (view !== "midterm"
      ? " bg-lamaPurple text-white border-lamaPurple"
      : " text-gray-600 border-gray-300 hover:border-gray-400");
  const midtermToggleClass =
    toggleBaseClass +
    (view !== "final"
      ? " bg-blue-500 text-white border-blue-500"
      : " text-gray-600 border-gray-300 hover:border-gray-400");
  const allToggleClass =
    toggleBaseClass +
    (view === "all"
      ? " bg-gray-900 text-white border-gray-900"
      : " text-gray-600 border-gray-300 hover:border-gray-400");

  if (!studentData.finals.length && !studentData.midterm.length) {
    return (
      <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0">
        <div className="text-center py-12">
          <p className="text-gray-500">No results found for this student.</p>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-lamaPurple hover:underline mt-2"
          >
            <span aria-hidden="true">&larr;</span>
            <span>{backLabel}</span>
          </Link>
        </div>
      </div>
    );
  }

  const studentName =
    studentData.finals[0]?.studentName ??
    studentData.midterm[0]?.studentName ??
    "Unknown Student";

  return (
    <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0 space-y-10">
      <div className="flex items-center justify-between">
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
            <h1 className="text-xl font-semibold">{studentName} - Detailed Results</h1>
            <p className="text-sm text-gray-500">
              {schoolMeta.name} | {term} | Session {sessionId}
            </p>
          </div>
        </div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
        >
          <span aria-hidden="true">&larr;</span>
          <span>{backLabel}</span>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/list/results/student/${studentId}?view=final`}
          className={finalToggleClass}
        >
          Final Results
        </Link>
        <Link
          href={`/list/results/student/${studentId}?view=midterm`}
          className={midtermToggleClass}
        >
          Midterm Results
        </Link>
        {showFinal && showMidterm && (
          <Link
            href={`/list/results/student/${studentId}?view=all`}
            className={allToggleClass}
          >
            Combined View
          </Link>
        )}
      </div>

      {finalSummary || midtermSummary ? (
        <section className="grid gap-4 rounded-md bg-gray-50 p-4 md:grid-cols-3">
          {finalSummary && finalGradeInfo && (
            <div className="text-center">
              <span className="block text-sm text-gray-500">Final Average</span>
              <span className="text-xl font-bold text-gray-900">
                {finalSummary.averageScore.toFixed(1)}%
              </span>
              <div className={`text-sm ${finalGradeInfo.color}`}>{finalGradeInfo.remark}</div>
            </div>
          )}
          {midtermAverageOutOf50 != null && midtermGradeInfo && (
            <div className="text-center">
              <span className="block text-sm text-gray-500">Midterm Average</span>
              <span className="text-xl font-bold text-blue-600">
                {midtermAverageOutOf50.toFixed(1)}/50
              </span>
              <div className={`text-sm ${midtermGradeInfo.color}`}>
                {midtermGradeInfo.remark}
              </div>
            </div>
          )}
          {finalSummary && midtermSummary && (
            <div className="text-center">
              <span className="block text-sm text-gray-500">Final vs Midterm</span>
              <span className="text-xl font-bold text-gray-900">
                {(
                  finalSummary.averageScore - midtermSummary.averageScore
                ).toFixed(1)}
                %
              </span>
              <span className="text-xs text-gray-500">Change in performance</span>
            </div>
          )}
        </section>
      ) : null}

      {showFinal && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Final Term Results</h3>
            <span className="text-xs text-gray-500">Scores calculated out of 100</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  {studentData.finals[0]?.components.map((component) => (
                    <th
                      key={component.componentId}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {component.label}
                      <div className="text-[10px] text-gray-400">
                        /{component.maxScore}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total (%)
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {studentData.finals.map((result) => {
                  const rowGrade = decorateGrade(gradeForPercentage(result.percentage));
                  return (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                        {result.subject}
                      </td>
                      {result.components.map((component) => (
                        <td key={component.componentId} className="px-4 py-4 whitespace-nowrap text-center">
                          {component.score}
                        </td>
                      ))}
                      <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-gray-800">
                        {result.percentage}%
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className={`font-bold ${rowGrade.color}`}>
                          {rowGrade.grade}
                        </span>
                        <div className={`text-xs ${rowGrade.color}`}>{rowGrade.remark}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showMidterm && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Midterm Assessment Results</h3>
            <span className="text-xs text-gray-500">Scores calculated out of 50</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  {studentData.midterm[0]?.components.map((component) => (
                    <th
                      key={component.componentId}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {component.label}
                      <div className="text-[10px] text-gray-400">
                        /{component.maxScore}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total (50)
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {studentData.midterm.map((result) => {
                  const rowGrade = decorateGrade(gradeForMidterm(result.totalScore));
                  return (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                        {result.subject}
                      </td>
                      {result.components.map((component) => (
                        <td key={component.componentId} className="px-4 py-4 whitespace-nowrap text-center">
                          {component.score}
                        </td>
                      ))}
                      <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-gray-800">
                        {result.totalScore}/{result.maxScore}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className={`font-bold ${rowGrade.color}`}>
                          {rowGrade.grade}
                        </span>
                        <div className={`text-xs ${rowGrade.color}`}>{rowGrade.remark}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Grading Scale</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {gradeLegend.map((band) => (
            <div key={band.grade} className="bg-white rounded-md p-3 shadow-sm">
              <span className={`text-sm font-semibold ${band.color}`}>{band.grade}</span>
              <span className="block text-gray-500">{band.remark}</span>
              <span className="block text-gray-400">{band.range}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default StudentDetailsPage;
