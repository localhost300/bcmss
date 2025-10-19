"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useSchoolScope } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { buildExamTypeOptions } from "@/lib/exams";
import { getJSON, postJSON } from "@/lib/utils/api";
import InputField from "../InputField";

const schema = z.object({
  name: z.string().min(1, { message: "Exam name is required." }),
  date: z.string().min(1, { message: "Exam date is required." }),
  startTime: z.string().min(1, { message: "Start time is required." }),
  endTime: z.string().min(1, { message: "End time is required." }),
  classId: z
    .coerce.number({ invalid_type_error: "Choose a class." })
    .int()
    .positive({ message: "Choose a class." })
    .optional(),
  subjectId: z
    .coerce.number({ invalid_type_error: "Choose a subject." })
    .int()
    .positive({ message: "Choose a subject." })
    .optional(),
  examType: z.enum(["FINAL", "MIDTERM"], { invalid_type_error: "Select an exam type." }),
  room: z.string().optional(),
  invigilator: z.string().optional(),
});

type Inputs = z.infer<typeof schema>;

type ExamFormProps = {
  type: "create" | "update";
  data?: Partial<Inputs> & { id?: number | string };
  id?: number | string;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
};

type ClassOption = { id: number; name: string };
type SubjectOption = { id: number; name: string };

type ClassListResponse = { items?: Array<{ id?: unknown; name?: unknown }> };
type SubjectListResponse = { items?: Array<{ id?: unknown; name?: unknown }> };

const normaliseClasses = (payload: ClassListResponse | null | undefined): ClassOption[] => {
  if (!payload?.items || !Array.isArray(payload.items)) return [];
  return payload.items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const id =
        typeof item.id === "number"
          ? item.id
          : typeof item.id === "string"
          ? Number.parseInt(item.id, 10)
          : undefined;
      const name = typeof item.name === "string" ? item.name : undefined;
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((item): item is ClassOption => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const normaliseSubjects = (payload: SubjectListResponse | null | undefined): SubjectOption[] => {
  if (!payload?.items || !Array.isArray(payload.items)) return [];
  return payload.items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const id =
        typeof item.id === "number"
          ? item.id
          : typeof item.id === "string"
          ? Number.parseInt(item.id, 10)
          : undefined;
      const name = typeof item.name === "string" ? item.name : undefined;
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((item): item is SubjectOption => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const EXAM_TYPE_OPTIONS: Array<{ value: Inputs["examType"]; label: string }> =
  buildExamTypeOptions(["FINAL", "MIDTERM"]).map((option) => ({
    value: option.value as Inputs["examType"],
    label: option.label,
  }));

const TERM_LABEL_TO_ENUM: Record<string, "FIRST" | "SECOND" | "THIRD"> = {
  "First Term": "FIRST",
  "Second Term": "SECOND",
  "Third Term": "THIRD",
};

const mapTermLabelToEnum = (label?: string | null) =>
  label && TERM_LABEL_TO_ENUM[label] ? TERM_LABEL_TO_ENUM[label] : undefined;

const ExamForm = ({ type, data, id, onSuccess }: ExamFormProps) => {
  const schoolScope = useSchoolScope();
  const sessionScope = useSessionScope();
  const termScope = useTermScope();

  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const loadOptions = async () => {
      setOptionsLoading(true);
      setOptionsError(null);

      try {
        const classParams = new URLSearchParams();
        classParams.set("pageSize", "200");
        if (schoolScope) classParams.set("schoolId", schoolScope);

        const subjectParams = new URLSearchParams();
        subjectParams.set("pageSize", "200");
        if (schoolScope) subjectParams.set("schoolId", schoolScope);

        const [classResponse, subjectResponse] = await Promise.all([
          getJSON<ClassListResponse>(`/api/classes?${classParams.toString()}`),
          getJSON<SubjectListResponse>(`/api/subjects?${subjectParams.toString()}`),
        ]);

        if (ignore) return;

        setClassOptions(normaliseClasses(classResponse));
        setSubjectOptions(normaliseSubjects(subjectResponse));
      } catch (error) {
        if (ignore) return;
        console.error("[ExamForm] Failed to load classes or subjects", error);
        setOptionsError(
          error instanceof Error ? error.message : "Unable to load classes or subjects.",
        );
        setClassOptions([]);
        setSubjectOptions([]);
      } finally {
        if (!ignore) setOptionsLoading(false);
      }
    };

    void loadOptions();
    return () => {
      ignore = true;
    };
  }, [schoolScope, sessionScope]);

  const entityId = (data as { id?: number | string } | undefined)?.id ?? id;

  const defaultValues = useMemo(
    () => ({
      name: data?.name ?? "",
      date: data?.date ?? "",
      startTime: data?.startTime ?? "",
      endTime: data?.endTime ?? "",
      classId:
        type === "update"
          ? (data?.classId as number | undefined) ?? classOptions[0]?.id
          : undefined,
      subjectId:
        type === "update"
          ? (data?.subjectId as number | undefined) ?? subjectOptions[0]?.id
          : undefined,
      room: data?.room ?? "",
      invigilator: data?.invigilator ?? "",
      examType: data?.examType ?? "FINAL",
    }),
    [data, classOptions, subjectOptions, type],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const optionsReady = classOptions.length > 0 && subjectOptions.length > 0;

  const onSubmit = handleSubmit(async (formData) => {
    const readyForCreate = classOptions.length > 0 && subjectOptions.length > 0;

    if (type === "create" && !readyForCreate) {
      setErrorMessage("At least one class and subject must exist before scheduling an exam.");
      return;
    }

    if (type === "update" && (entityId === undefined || entityId === null || entityId === "")) {
      setErrorMessage("Exam id is missing.");
      return;
    }

    if (type === "update" && (!formData.classId || !formData.subjectId)) {
      setErrorMessage("Choose a class and subject for this exam.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    const basePayload = {
      name: formData.name,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      examType: formData.examType,
      room: formData.room?.trim() ?? "",
      invigilator: formData.invigilator?.trim() ?? "",
      term: mapTermLabelToEnum(termScope),
    };

    try {
      if (type === "create") {
        let createdCount = 0;
        const failures: string[] = [];

        for (const klass of classOptions) {
          for (const subject of subjectOptions) {
            try {
              await postJSON<{ message?: string }>("/api/exams", {
                ...basePayload,
                action: "create" as const,
                classId: klass.id,
                subjectId: subject.id,
              });
              createdCount += 1;
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Unable to save exam.";
              failures.push(`${klass.name} / ${subject.name}: ${message}`);
            }
          }
        }

        if (createdCount > 0) {
          setSuccessMessage(
            `Exam scheduled for ${createdCount} combination${createdCount === 1 ? "" : "s"}.`,
          );
          reset({
            name: "",
            date: "",
            startTime: "",
            endTime: "",
            room: "",
            invigilator: "",
            examType: "FINAL",
            classId: undefined,
            subjectId: undefined,
          });
          await Promise.resolve(onSuccess?.());
        }

        if (failures.length) {
          setErrorMessage(
            `Unable to schedule the exam for ${failures.length} combination${
              failures.length === 1 ? "" : "s"
            }. ${failures.join(" ")}`,
          );
        }

        if (createdCount === 0 && failures.length === 0) {
          setErrorMessage("No classes or subjects were available to schedule the exam.");
        }
      } else {
        const payload = {
          ...basePayload,
          action: "update" as const,
          classId: formData.classId,
          subjectId: formData.subjectId,
          id: entityId,
        };

        const response = await postJSON<{ message?: string }>("/api/exams", payload);
        const message = response?.message ?? "Exam saved successfully.";
        setSuccessMessage(message);
        await Promise.resolve(onSuccess?.(response));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save exam.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">
        {type === "create" ? "Schedule a new exam" : "Update exam"}
      </h1>

      {optionsError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {optionsError}
        </div>
      )}

      {optionsLoading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-600">
          Loading classes and subjects…
        </div>
      )}

      {!optionsLoading && !optionsReady && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          No classes or subjects are available. Create them first before scheduling an exam.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputField
          label="Exam Name"
          name="name"
          defaultValue={defaultValues.name}
          register={register}
          error={errors.name}
        />
        <InputField
          label="Date"
          name="date"
          type="date"
          defaultValue={defaultValues.date}
          register={register}
          error={errors.date}
        />
        <InputField
          label="Start Time"
          name="startTime"
          type="time"
          defaultValue={defaultValues.startTime}
          register={register}
          error={errors.startTime}
        />
        <InputField
          label="End Time"
          name="endTime"
          type="time"
          defaultValue={defaultValues.endTime}
          register={register}
          error={errors.endTime}
        />
        <InputField
          label="Room"
          name="room"
          defaultValue={defaultValues.room}
          register={register}
          error={errors.room}
        />
        <InputField
          label="Invigilator"
          name="invigilator"
          defaultValue={defaultValues.invigilator}
          register={register}
          error={errors.invigilator}
        />

        {type === "update" ? (
          <>
            <label className="flex flex-col gap-2 text-xs text-gray-500">
              <span>Class</span>
              <select
                className="rounded-md p-2 text-sm ring-[1.5px] ring-gray-300"
                {...register("classId", { valueAsNumber: true })}
                defaultValue={defaultValues.classId}
                disabled={!optionsReady}
              >
                {classOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              {errors.classId?.message && (
                <p className="text-xs text-red-400">{errors.classId.message.toString()}</p>
              )}
            </label>

            <label className="flex flex-col gap-2 text-xs text-gray-500">
              <span>Subject</span>
              <select
                className="rounded-md p-2 text-sm ring-[1.5px] ring-gray-300"
                {...register("subjectId", { valueAsNumber: true })}
                defaultValue={defaultValues.subjectId}
                disabled={!optionsReady}
              >
                {subjectOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              {errors.subjectId?.message && (
                <p className="text-xs text-red-400">{errors.subjectId.message.toString()}</p>
              )}
            </label>
          </>
        ) : (
          <div className="md:col-span-2 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            This exam will be scheduled for all {classOptions.length} classes and{" "}
            {subjectOptions.length} subjects currently configured for this school. Add new classes or
            subjects from their respective dashboards to expand the coverage.
          </div>
        )}

        <label className="flex flex-col gap-2 text-xs text-gray-500">
          <span>Exam Type</span>
          <select
            className="rounded-md p-2 text-sm ring-[1.5px] ring-gray-300"
            {...register("examType")}
            defaultValue={defaultValues.examType}
          >
            {EXAM_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.examType?.message && (
            <p className="text-xs text-red-400">{errors.examType.message.toString()}</p>
          )}
          {termScope && (
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              Term: {termScope}
            </span>
          )}
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
        {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        <button
          type="submit"
          disabled={submitting || optionsLoading || !optionsReady}
          className="rounded-md bg-blue-400 p-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : type === "create" ? "Create" : "Update"}
        </button>
      </div>
    </form>
  );
};

export default ExamForm;

