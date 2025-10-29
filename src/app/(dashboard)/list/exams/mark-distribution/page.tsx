'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import AccessRestricted from "@/components/AccessRestricted";
import FormModal from "@/components/FormModal";
import Table from "@/components/Table";
import { useAuth } from "@/contexts/AuthContext";
import { useResults } from "@/contexts/ResultsContext";
import { useSchoolScope } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { buildExamTypeOptions, getExamTypeLabel } from "@/lib/exams";
import type { ExamMarkDistribution, ExamMarkComponent } from "@/lib/data";
import { listMarkDistributions } from "@/lib/services/markDistributions";

type DistributionType = ExamMarkDistribution["examType"];

const columns = [
  { header: "Component", accessor: "component", className: "p-4" },
  {
    header: "Weight",
    accessor: "weight",
    className: "p-4 text-right w-28",
  },
];

const MarkDistributionPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { refreshMarkDistributions } = useResults();
  const schoolScope = useSchoolScope();
  const sessionScope = useSessionScope();
  const termScope = useTermScope();

  const [selectedExamType, setSelectedExamType] = useState<string>("");
  const [distributions, setDistributions] = useState<ExamMarkDistribution[]>([]);
  const [loadingDistributions, setLoadingDistributions] = useState(true);
  const [distributionError, setDistributionError] = useState<string | null>(null);

  const loadDistributions = useCallback(async () => {
    setLoadingDistributions(true);
    setDistributionError(null);
    try {
      if (!schoolScope) {
        setDistributions([]);
        return;
      }

      const baseParams = {
        sessionId: sessionScope ?? undefined,
        term: termScope ?? undefined,
      };

      const scoped = await listMarkDistributions({ ...baseParams, schoolId: schoolScope });
      const relevant = scoped.filter((distribution) => distribution.schoolId === schoolScope);

      const unique = new Map<string, ExamMarkDistribution>();
      relevant.forEach((distribution) => {
        const key = `${distribution.sessionId}|${distribution.term}|${distribution.examType}`;
        const existing = unique.get(key);
        if (!existing) {
          unique.set(key, distribution);
          return;
        }
        unique.set(key, distribution);
      });

      const ordered = Array.from(unique.values()).sort((a, b) => {
        if (a.term !== b.term) return a.term.localeCompare(b.term);
        if (a.sessionId !== b.sessionId) return a.sessionId.localeCompare(b.sessionId);
        return a.examType.localeCompare(b.examType);
      });

      setDistributions(ordered);
    } catch (error) {
      console.error("[MarkDistributionPage] Failed to load mark distributions", error);
      setDistributions([]);
      setDistributionError("Unable to load mark distributions. Please try again.");
    } finally {
      setLoadingDistributions(false);
    }
  }, [schoolScope, sessionScope, termScope]);

  useEffect(() => {
    void loadDistributions();
  }, [loadDistributions]);

  const filteredDistributions = useMemo(
    () =>
      distributions.filter((distribution) => {
        const sessionMatches = sessionScope
          ? distribution.sessionId === sessionScope
          : true;
        const termMatches = termScope ? distribution.term === termScope : true;
        const schoolMatches = schoolScope ? distribution.schoolId === schoolScope : true;
        return sessionMatches && termMatches && schoolMatches;
      }),
    [distributions, sessionScope, termScope, schoolScope],
  );

  const examTypeOptions = useMemo(() => {
    const source =
      filteredDistributions.length > 0 ? filteredDistributions : distributions;
    const typeSet = new Set(source.map((distribution) => distribution.examType));
    typeSet.add("final");
    typeSet.add("midterm");
    return buildExamTypeOptions(Array.from(typeSet));
  }, [filteredDistributions, distributions]);

  useEffect(() => {
    if (!examTypeOptions.length) {
      setSelectedExamType("");
      return;
    }
    setSelectedExamType((prev) => {
      if (prev && examTypeOptions.some((option) => option.value === prev)) {
        return prev;
      }
      return examTypeOptions[0]?.value ?? "";
    });
  }, [examTypeOptions]);

  const activeExamType = useMemo(() => {
    if (!selectedExamType) {
      return null;
    }
    const match = examTypeOptions.find((option) => option.value === selectedExamType);
    return (match?.value ?? null) as DistributionType | null;
  }, [examTypeOptions, selectedExamType]);

  const activeDistribution = useMemo(
    () =>
      activeExamType
        ? filteredDistributions.find(
            (distribution) => distribution.examType === activeExamType,
          ) ?? null
        : null,
    [filteredDistributions, activeExamType],
  );

  const componentRows: ExamMarkComponent[] = useMemo(
    () => activeDistribution?.components ?? [],
    [activeDistribution],
  );

  const totalWeight = useMemo(
    () =>
      componentRows.reduce(
        (sum, component) => sum + (Number(component.weight) || 0),
        0,
      ),
    [componentRows],
  );

  const handleDistributionSave = useCallback(async () => {
    await loadDistributions();
    await refreshMarkDistributions();
  }, [loadDistributions, refreshMarkDistributions]);

  const renderRow = useCallback(
    (component: ExamMarkComponent) => (
      <tr
        key={component.id}
        className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
      >
        <td className="p-4">{component.label}</td>
        <td className="p-4 text-right font-medium text-gray-700">
          {component.weight}
        </td>
      </tr>
    ),
    [],
  );

  const resolvedExamType = (
    activeExamType ??
    (examTypeOptions[0]?.value as DistributionType | undefined) ??
    "final"
  ) as DistributionType;

  const templateForResolvedType = useMemo(
    () =>
      distributions.find(
        (distribution) =>
          distribution.examType === resolvedExamType &&
          (sessionScope ? distribution.sessionId === sessionScope : true) &&
          (termScope ? distribution.term === termScope : true) &&
          (schoolScope ? distribution.schoolId === schoolScope : true),
      ) ?? null,
    [distributions, resolvedExamType, sessionScope, termScope, schoolScope],
  );

  if (authLoading) {
    return (
      <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0 text-sm text-gray-500">
        Loading user profile…
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <AccessRestricted message="Only administrators can manage mark distribution." />
    );
  }

  if (!schoolScope) {
    return (
      <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0 text-sm text-gray-500">
        Select a school to manage mark distributions.
      </div>
    );
  }

  const modalData: Partial<ExamMarkDistribution> =
    activeDistribution ?? {
      examType: resolvedExamType,
      sessionId: sessionScope ?? "",
      term: termScope ?? "First Term",
      components: templateForResolvedType?.components ?? [],
      title: `${termScope ?? "Term"} ${getExamTypeLabel(resolvedExamType)}`,
      schoolId: schoolScope,
    };

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="hidden md:block text-lg font-semibold">
            Mark Distribution
          </h1>
          <p className="text-xs text-gray-500">
            Session {sessionScope ?? "—"} | Term {termScope ?? "—"}
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <span>Exam Type</span>
            <select
              className="rounded-md p-2 text-sm ring-[1.5px] ring-gray-300 disabled:bg-gray-100 disabled:text-gray-400"
              value={selectedExamType}
              onChange={(event) => setSelectedExamType(event.target.value)}
              disabled={!examTypeOptions.length}
            >
              {examTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 self-end">
            <FormModal
              table="markDistribution"
              type={activeDistribution ? "update" : "create"}
              data={modalData}
              id={activeDistribution?.id}
              onSuccess={handleDistributionSave}
            />
            {activeDistribution && (
              <FormModal
                table="markDistribution"
                type="delete"
                id={activeDistribution.id}
                onSuccess={handleDistributionSave}
              />
            )}
          </div>
        </div>
      </div>

      {loadingDistributions ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading mark distributions…</div>
      ) : distributionError ? (
        <div className="py-10 text-center text-sm text-red-500">{distributionError}</div>
      ) : componentRows.length > 0 ? (
        <>
          <Table columns={columns} renderRow={renderRow} data={componentRows} />
          <div className="mt-4 text-sm text-gray-600">
            Total weight:{" "}
            <span className="font-semibold text-gray-800">{totalWeight}</span>
          </div>
        </>
      ) : (
        <div className="py-10 text-center text-sm text-gray-500">
          No mark distribution configured for this exam type yet. Use the edit
          button to set it up.
        </div>
      )}
    </div>
  );
};

export default MarkDistributionPage;




