"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { useSchoolScope } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { getJSON } from "@/lib/utils/api";

type StudentMetric = {
  studentId: number;
  studentName: string;
  className: string | null;
  average: number;
  examsTaken: number;
};

type SubjectMetric = {
  subject: string;
  average: number;
  examsTaken: number;
};

type TermTrend =
  | {
      term: string;
      average: number;
      difference: number;
      direction: "up" | "down" | "flat";
    }
  | {
      term: string;
      average: number;
      difference: null;
      direction: "baseline";
    };

type PerformanceResponse = {
  data: {
    bestStudents: StudentMetric[];
    strugglingStudents: StudentMetric[];
    subjectAverages: SubjectMetric[];
    termTrends: TermTrend[];
    totals: {
      records: number;
      students: number;
      subjects: number;
      lastUpdated: string | null;
    };
  };
};

const EMPTY_STUDENTS: StudentMetric[] = [];
const EMPTY_SUBJECTS: SubjectMetric[] = [];
const EMPTY_TERMS: TermTrend[] = [];

type StudentListProps = {
  title: string;
  accent: "emerald" | "rose";
  emptyLabel: string;
  students: StudentMetric[];
};

const StudentList = ({ title, accent, emptyLabel, students }: StudentListProps) => {
  const accentBadge =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-rose-100 text-rose-700";

  const accentText = accent === "emerald" ? "text-emerald-700" : "text-rose-700";

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {students.length === 0 ? (
        <p className="text-xs text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {students.map((student, index) => {
            const examLabel = `${student.examsTaken} ${
              student.examsTaken === 1 ? "exam" : "exams"
            }`;
            const classLabel = student.className ?? "Class pending";

            return (
              <li
                key={`${student.studentId}-${index}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${accentBadge}`}
                  >
                    {index + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-800">
                      {student.studentName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {classLabel} • {examLabel}
                    </span>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${accentText}`}>
                  {student.average.toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const formatTimestamp = (raw: string | null): string => {
  if (!raw) {
    return "No recent exams";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "No recent exams";
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const directionStyles: Record<
  TermTrend["direction"],
  { badge: string; text: string; label: string }
> = {
  baseline: {
    badge: "bg-gray-100 text-gray-700",
    text: "text-gray-700",
    label: "Baseline",
  },
  up: {
    badge: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-700",
    label: "Improved",
  },
  down: {
    badge: "bg-rose-100 text-rose-700",
    text: "text-rose-700",
    label: "Declined",
  },
  flat: {
    badge: "bg-gray-100 text-gray-600",
    text: "text-gray-600",
    label: "No change",
  },
};

const TermTrendsList = ({ trends }: { trends: TermTrend[] }) => {
  if (!trends.length) {
    return (
      <p className="text-xs text-gray-500">
        Add results across multiple terms to view performance trends.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {trends.map((trend) => {
        const styles = directionStyles[trend.direction];
        const differenceLabel =
          trend.difference === null
            ? styles.label
            : `${trend.difference > 0 ? "+" : ""}${trend.difference.toFixed(1)} pts`;

        return (
          <li
            key={trend.term}
            className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-800">{trend.term}</span>
              <span className="text-xs text-gray-500">
                Average {trend.average.toFixed(1)}%
              </span>
            </div>
            <span className={`inline-flex items-center gap-2 text-sm font-semibold ${styles.text}`}>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${styles.badge}`}>
                {differenceLabel}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
};

const PerformanceInsights = () => {
  const schoolScope = useSchoolScope();
  const sessionScope = useSessionScope();
  const termScope = useTermScope();

  const [data, setData] = useState<PerformanceResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (schoolScope) params.set("schoolId", schoolScope);
      if (sessionScope) params.set("sessionId", sessionScope);
      if (termScope) params.set("term", termScope);
      params.set("limit", "5");

      const query = params.toString();
      const endpoint = query
        ? `/api/dashboard/performance?${query}`
        : "/api/dashboard/performance";

      const response = await getJSON<PerformanceResponse>(endpoint);
      setData(response.data);
    } catch (err) {
      console.error("[PerformanceInsights] Unable to load data", err);
      setError(
        err instanceof Error ? err.message : "Unable to load performance insights.",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [schoolScope, sessionScope, termScope]);

  useEffect(() => {
    void fetchInsights();
  }, [fetchInsights]);

  const topStudents = data?.bestStudents ?? EMPTY_STUDENTS;
  const strugglingStudents = data?.strugglingStudents ?? EMPTY_STUDENTS;
  const subjectMetrics = data?.subjectAverages ?? EMPTY_SUBJECTS;
  const termTrends = data?.termTrends ?? EMPTY_TERMS;
  const totals = data?.totals;
  const highlightPerformer = topStudents[0] ?? null;
  const spotlightStudent = strugglingStudents[0] ?? null;
  const strongestSubject = subjectMetrics[0] ?? null;
  const subjectNeedsSupport =
    subjectMetrics.length > 0 ? subjectMetrics[subjectMetrics.length - 1] : null;

  const chartData = useMemo(
    () =>
      subjectMetrics.slice(0, 7).map((subject) => ({
        name: subject.subject,
        average: Number(subject.average.toFixed(1)),
      })),
    [subjectMetrics],
  );

  const topSubjects = useMemo(() => subjectMetrics.slice(0, 3), [subjectMetrics]);
  const subjectsNeedingSupport = useMemo(() => {
    if (!subjectMetrics.length) return [];
    return subjectMetrics.slice(-3).reverse();
  }, [subjectMetrics]);
  const termTrendChartData = useMemo(
    () =>
      termTrends.map((trend) => ({
        term: trend.term,
        average: trend.average,
      })),
    [termTrends],
  );
  const latestTrend = termTrends.length ? termTrends[termTrends.length - 1] : null;
  const latestTrendBadge = latestTrend ? directionStyles[latestTrend.direction] : null;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          {error}
        </div>
      )}

      {!error && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-lg font-semibold text-gray-800">Performance snapshot</h1>
                  <p className="text-xs text-gray-500">Latest exam analytics at a glance</p>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTimestamp(totals?.lastUpdated ?? null)}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Records analysed</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{totals?.records ?? 0}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Students covered</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{totals?.students ?? 0}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Subjects tracked</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{totals?.subjects ?? 0}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Top performer
                  </p>
                  {highlightPerformer ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {highlightPerformer.studentName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {highlightPerformer.average.toFixed(1)}% across {highlightPerformer.examsTaken}{" "}
                        {highlightPerformer.examsTaken === 1 ? "exam" : "exams"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">No results yet.</p>
                  )}
                </div>
                <div className="rounded-lg bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                    Star subject
                  </p>
                  {strongestSubject ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {strongestSubject.subject}
                      </p>
                      <p className="text-xs text-gray-500">
                        {strongestSubject.average.toFixed(1)}% average score
                      </p>
                      {subjectNeedsSupport &&
                        subjectNeedsSupport.subject !== strongestSubject.subject && (
                          <p className="mt-1 text-[11px] text-indigo-600">
                            ⚠️ Needs boost: {subjectNeedsSupport.subject} (
                            {subjectNeedsSupport.average.toFixed(1)}%)
                          </p>
                        )}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">No subject analytics yet.</p>
                  )}
                </div>
                <div className="rounded-lg bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                    Watch list
                  </p>
                  {spotlightStudent ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {spotlightStudent.studentName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Averaging {spotlightStudent.average.toFixed(1)}% across {spotlightStudent.examsTaken}{" "}
                        {spotlightStudent.examsTaken === 1 ? "exam" : "exams"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">No students flagged.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Term performance trend</h2>
                  <p className="text-xs text-gray-500">Movement of overall averages across terms</p>
                </div>
                {latestTrend && (
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${latestTrendBadge?.badge ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {latestTrendBadge?.label ?? "Baseline"}
                    </span>
                    {latestTrend.difference !== null && (
                      <span className="text-gray-500">
                        {latestTrend.difference > 0 ? "+" : ""}
                        {latestTrend.difference.toFixed(1)} pts vs previous term
                      </span>
                    )}
                  </div>
                )}
              </div>
              {termTrendChartData.length ? (
                <div className="mt-4 h-48 w-full">
                  <ResponsiveContainer>
                    <LineChart
                      data={termTrendChartData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="term"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        width={32}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, "Average"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="average"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-4 text-xs text-gray-500">
                  Capture results across multiple terms to visualise progress.
                </p>
              )}
              <div className="mt-4">
                <TermTrendsList trends={termTrends} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <StudentList
                title="Top performing students"
                accent="emerald"
                emptyLabel="No recent exam records for this selection."
                students={topStudents}
              />
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <StudentList
                title="Students needing attention"
                accent="rose"
                emptyLabel="No underperforming students detected."
                students={strugglingStudents}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Subject performance</h2>
                <p className="text-xs text-gray-500">Strengths and areas that require more support</p>
              </div>
              <span className="text-xs text-gray-500">
                {chartData.length ? `Top ${chartData.length} shown` : "No data yet"}
              </span>
            </div>

            {chartData.length ? (
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(79, 70, 229, 0.08)" }}
                      contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, "Average score"]}
                    />
                    <Bar dataKey="average" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-4 text-xs text-gray-500">
                Add score records to see subject-level trends.
              </p>
            )}

            <div className="mt-4 grid gap-4 text-xs text-gray-500 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">High-performing subjects</p>
                <ul className="space-y-1">
                  {topSubjects.length ? (
                    topSubjects.map((subject) => (
                      <li
                        key={`subject-top-${subject.subject}`}
                        className="flex items-center justify-between rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700"
                      >
                        <span>{subject.subject}</span>
                        <span>{subject.average.toFixed(1)}%</span>
                      </li>
                    ))
                  ) : (
                    <li>No subjects analysed yet.</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Needs attention</p>
                <ul className="space-y-1">
                  {subjectsNeedingSupport.length ? (
                    subjectsNeedingSupport.map((subject) => (
                      <li
                        key={`subject-support-${subject.subject}`}
                        className="flex items-center justify-between rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700"
                      >
                        <span>{subject.subject}</span>
                        <span>{subject.average.toFixed(1)}%</span>
                      </li>
                    ))
                  ) : (
                    <li>All subjects are performing within range.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {loading && (
        <p className="text-xs text-gray-400">
          Refreshing performance metrics…
        </p>
      )}
    </div>
  );
};

export default PerformanceInsights;

