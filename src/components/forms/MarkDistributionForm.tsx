"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ExamMarkComponent, ExamMarkDistribution } from "@/lib/data";
import { buildExamTypeOptions, getExamTypeLabel } from "@/lib/exams";
import {
  listMarkDistributions,
  upsertMarkDistribution,
} from "@/lib/services/markDistributions";

type DistributionType = ExamMarkDistribution["examType"];

const isDistributionType = (value: unknown): value is DistributionType =>
  value === "final" || value === "midterm";

type MarkDistributionFormProps = {
  type: "create" | "update";
  data?: Partial<ExamMarkDistribution>;
  id?: string | number;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
};

type EditableComponent = ExamMarkComponent;

const cloneComponents = (components: ExamMarkComponent[] | undefined): EditableComponent[] =>
  (components ?? []).map((component) => ({
    id: component.id,
    label: component.label,
    weight: Number(component.weight) || 0,
  }));

const MarkDistributionForm = ({ type, data, onSuccess }: MarkDistributionFormProps) => {
  const [catalogue, setCatalogue] = useState<ExamMarkDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const fetchCatalogue = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const distributions = await listMarkDistributions({
          sessionId: data?.sessionId,
          term: data?.term as "First Term" | "Second Term" | "Third Term" | undefined,
        });
        if (!ignore) {
          setCatalogue(distributions);
        }
      } catch (error) {
        console.error("[MarkDistributionForm] Failed to load templates", error);
        if (!ignore) {
          setCatalogue([]);
          setLoadError("Unable to load mark distribution templates.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchCatalogue();
    return () => {
      ignore = true;
    };
  }, [data?.sessionId, data?.term]);

  const examTypeOptions = useMemo(() => {
    const scoped = catalogue.filter((distribution) => {
      const matchesSession = data?.sessionId ? distribution.sessionId === data.sessionId : true;
      const matchesTerm = data?.term ? distribution.term === data.term : true;
      return matchesSession && matchesTerm;
    });

    const source = scoped.length > 0 ? scoped : catalogue;
    const types: DistributionType[] = source.map((distribution) => distribution.examType);

    if (isDistributionType(data?.examType) && !types.includes(data.examType)) {
      types.push(data.examType);
    }

    if (!types.length) {
      types.push("final", "midterm");
    }

    return buildExamTypeOptions(types);
  }, [catalogue, data?.examType, data?.sessionId, data?.term]);

  const initialExamType = useMemo(() => {
    const preferred = isDistributionType(data?.examType) ? data.examType : null;
    const matched = preferred && examTypeOptions.some((option) => option.value === preferred);
    if (matched && preferred) {
      return preferred;
    }
    const fallback =
      examTypeOptions.map((option) => option.value).find(isDistributionType) ?? "final";
    return fallback;
  }, [data?.examType, examTypeOptions]);

  const [examType, setExamType] = useState<DistributionType>(initialExamType);

  useEffect(() => {
    setExamType(initialExamType);
  }, [initialExamType]);

  const findTemplate = useCallback(
    (targetExamType: DistributionType) =>
      catalogue.find(
        (distribution) =>
          distribution.examType === targetExamType &&
          (data?.sessionId ? distribution.sessionId === data.sessionId : true) &&
          (data?.term ? distribution.term === data.term : true),
      ) ??
      catalogue.find((distribution) => distribution.examType === targetExamType) ??
      null,
    [catalogue, data?.sessionId, data?.term],
  );

  const [components, setComponents] = useState<EditableComponent[]>(() => {
    if (data?.components && isDistributionType(data.examType) && data.examType === initialExamType) {
      return cloneComponents(data.components);
    }
    const template = findTemplate(initialExamType);
    return cloneComponents(template?.components);
  });

  useEffect(() => {
    if (data?.components && (data.examType as DistributionType | undefined) === examType) {
      setComponents(cloneComponents(data.components));
      return;
    }

    const template = findTemplate(examType);
    if (template) {
      setComponents(cloneComponents(template.components));
    }
  }, [data?.components, data?.examType, examType, findTemplate]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalWeight = useMemo(
    () => components.reduce((sum, component) => sum + component.weight, 0),
    [components],
  );

  const handleWeightChange = (index: number, value: string) => {
    setComponents((prev) =>
      prev.map((component, idx) =>
        idx === index ? { ...component, weight: Number(value) || 0 } : component,
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!components.length) {
      setError("Add at least one component to distribute marks.");
      return;
    }

    if (!data?.sessionId) {
      setError("Select a session before saving.");
      return;
    }

    setSaving(true);
    try {
      const payload: ExamMarkDistribution = {
        id:
          typeof data?.id === "string"
            ? data.id
            : `${data?.sessionId}-${data?.term ?? "term"}-${examType}`,
        title: data?.title ?? `Mark Distribution (${getExamTypeLabel(examType)})`,
        sessionId: data.sessionId,
        term: (data?.term ?? "First Term") as ExamMarkDistribution["term"],
        examType,
        components: components.map((component, index) => ({
          id: component.id,
          label: component.label,
          weight: component.weight,
          order: index,
        })),
      };

      const saved = await upsertMarkDistribution(payload);

      setSuccess("Mark distribution saved.");
      await Promise.resolve(onSuccess?.(saved));
    } catch (saveError) {
      console.error("[MarkDistributionForm] Failed to save distribution", saveError);
      setError(saveError instanceof Error ? saveError.message : "Failed to save mark distribution.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading mark distribution templates...</div>;
  }

  if (loadError) {
    return <div className="text-sm text-red-500">{loadError}</div>;
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          {type === "create" ? "Create mark distribution" : "Update mark distribution"}
        </h1>
        <p className="text-xs text-gray-500">
          Configure how marks are distributed across assessments for this exam type.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs text-gray-500">
          <span>Exam Type</span>
          <select
            className="rounded-md p-2 text-sm ring-[1.5px] ring-gray-300"
            value={examType}
            onChange={(event) => setExamType(event.target.value as DistributionType)}
          >
            {examTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end text-xs text-gray-500">
          {data?.sessionId && <span>Session: {data.sessionId}</span>}
          {data?.term && <span>Term: {data.term}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Components
        </span>
        <div className="flex flex-col gap-2">
          {components.map((component, index) => (
            <div
              key={component.id}
              className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 p-3 md:grid-cols-[1fr_120px]"
            >
              <div className="text-sm font-medium text-gray-700">{component.label}</div>
              <label className="flex flex-col gap-1 text-xs text-gray-500">
                <span>Weight</span>
                <input
                  type="number"
                  className="rounded-md border border-gray-200 p-2 text-sm"
                  min={0}
                  step={1}
                  value={Number.isFinite(component.weight) ? component.weight : 0}
                  onChange={(event) => handleWeightChange(index, event.target.value)}
                />
              </label>
            </div>
          ))}
          {!components.length && (
            <div className="rounded-md border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">
              No components configured for this exam type yet.
            </div>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Total weight: <span className="font-semibold text-gray-700">{totalWeight}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button
        type="submit"
        className="rounded-md bg-blue-500 p-2 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
        disabled={saving}
      >
        {saving ? "Saving..." : type === "create" ? "Create distribution" : "Save changes"}
      </button>
    </form>
  );
};

export default MarkDistributionForm;
