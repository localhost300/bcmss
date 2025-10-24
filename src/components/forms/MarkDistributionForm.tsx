"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ExamComponentId, ExamMarkComponent, ExamMarkDistribution } from "@/lib/data";
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

const AVAILABLE_COMPONENTS: Array<{ id: ExamComponentId; defaultLabel: string }> = [
  { id: "ca1", defaultLabel: "CA1" },
  { id: "classParticipation", defaultLabel: "Class Participation" },
  { id: "quiz", defaultLabel: "Quiz" },
  { id: "assignment", defaultLabel: "Assignment" },
  { id: "ca2", defaultLabel: "CA2" },
  { id: "midtermCarry", defaultLabel: "Midterm Aggregate" },
  { id: "exam", defaultLabel: "Exam" },
];

const findComponentMeta = (id: ExamComponentId) =>
  AVAILABLE_COMPONENTS.find((component) => component.id === id);

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
    const typeSet = new Set<DistributionType>(source.map((distribution) => distribution.examType));

    if (isDistributionType(data?.examType)) {
      typeSet.add(data.examType);
    }

    typeSet.add("final");
    typeSet.add("midterm");

    return buildExamTypeOptions(Array.from(typeSet));
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
    setError(null);
    setSuccess(null);
    const numeric = Number(value);
    const safeWeight = Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
    setComponents((prev) =>
      prev.map((component, idx) => (idx === index ? { ...component, weight: safeWeight } : component)),
    );
  };

  const handleLabelChange = (index: number, value: string) => {
    setError(null);
    setSuccess(null);
    setComponents((prev) =>
      prev.map((component, idx) => (idx === index ? { ...component, label: value } : component)),
    );
  };

  const handleRemoveComponent = (index: number) => {
    setError(null);
    setSuccess(null);
    setComponents((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddComponent = () => {
    setError(null);
    setSuccess(null);
    const used = new Set(components.map((component) => component.id));
    const nextMeta = AVAILABLE_COMPONENTS.find((component) => !used.has(component.id));
    if (!nextMeta) {
      setError("All available exam components have been added.");
      return;
    }
    setComponents((prev) => [
      ...prev,
      {
        id: nextMeta.id,
        label: nextMeta.defaultLabel,
        weight: 0,
      },
    ]);
  };

  const handleComponentIdChange = (index: number, value: string) => {
    setError(null);
    setSuccess(null);
    const nextId = value as ExamComponentId;
    setComponents((prev) =>
      prev.map((component, idx) => {
        if (idx !== index) {
          return component;
        }
        const currentMeta = findComponentMeta(component.id);
        const nextMeta = findComponentMeta(nextId);
        const usingDefaultLabel =
          currentMeta !== undefined && component.label.trim() === currentMeta.defaultLabel;
        return {
          ...component,
          id: nextId,
          label: usingDefaultLabel && nextMeta ? nextMeta.defaultLabel : component.label,
        };
      }),
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

    if (components.some((component) => !component.label.trim())) {
      setError("Each component needs a label.");
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
          {components.map((component, index) => {
            const usedIds = components.map((item) => item.id);
            return (
              <div
                key={`${component.id}-${index}`}
                className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 p-3 md:grid-cols-[160px_1fr_120px_40px]"
              >
                <label className="flex flex-col gap-1 text-xs text-gray-500">
                  <span>Component</span>
                  <select
                    className="rounded-md border border-gray-200 p-2 text-sm"
                    value={component.id}
                    onChange={(event) => handleComponentIdChange(index, event.target.value)}
                  >
                    {AVAILABLE_COMPONENTS.map((option) => (
                      <option
                        key={option.id}
                        value={option.id}
                        disabled={
                          option.id !== component.id && usedIds.includes(option.id)
                        }
                      >
                        {option.defaultLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-gray-500">
                  <span>Label</span>
                  <input
                    type="text"
                    className="rounded-md border border-gray-200 p-2 text-sm"
                    value={component.label}
                    onChange={(event) => handleLabelChange(index, event.target.value)}
                    placeholder="e.g. Continuous Assessment"
                  />
                </label>
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
                <div className="flex items-end md:justify-end">
                  <button
                    type="button"
                    className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    onClick={() => handleRemoveComponent(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          {!components.length && (
            <div className="rounded-md border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">
              No components configured for this exam type yet.
            </div>
          )}
        </div>
        <button
          type="button"
          className="self-start rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
          onClick={handleAddComponent}
        >
          Add component
        </button>
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
