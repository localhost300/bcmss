"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useSchool, useSchoolScope } from "@/contexts/SchoolContext";
import { getJSON, postJSON } from "@/lib/utils/api";
import InputField from "../InputField";

type TeacherOption = { id: number; name: string };

const schema = z.object({
  name: z.string().min(1, { message: "Class name is required!" }),
  code: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  section: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  supervisor: z.string().optional().nullable(),
  capacity: z.coerce.number({ invalid_type_error: "Capacity must be a number" }).min(1),
  grade: z.string().min(1, { message: "Grade is required!" }),
  formTeacherId: z
    .union([z.number().int().positive(), z.literal(0), z.null(), z.undefined()])
    .transform((value) => (value ? Number(value) : 0)),
  schoolId: z.string().min(1, { message: "Select a campus" }),
});

type Inputs = z.infer<typeof schema>;

type ClassFormProps = {
  type: "create" | "update";
  data?: Partial<Inputs> & { id?: number | string };
  id?: number | string;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
};

const normalizeTeacherId = (value: number | null | undefined): number => {
  if (!value || value <= 0) {
    return 0;
  }
  return value;
};

const ClassForm = ({ type, data, id, onSuccess }: ClassFormProps) => {
  const { activeSchoolId, schools, canSwitch } = useSchool();
  const scopeId = useSchoolScope();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const loadTeachers = async () => {
      setTeachersLoading(true);
      setTeacherError(null);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "200");
        if (scopeId) {
          params.set("schoolId", scopeId);
        }
        const response = await getJSON<{ items?: Array<{ id: number; name?: string; teacherId?: string }> }>(
          `/api/teachers?${params.toString()}`,
        );

        if (ignore) return;

        const items = response.items ?? [];
        setTeacherOptions(
          items.map((teacher) => ({
            id: teacher.id,
            name: teacher.name?.trim() || teacher.teacherId || `Teacher ${teacher.id}`,
          })),
        );
      } catch (error) {
        if (ignore) return;
        setTeacherError(error instanceof Error ? error.message : "Unable to load teachers.");
        setTeacherOptions([]);
      } finally {
        if (!ignore) {
          setTeachersLoading(false);
        }
      }
    };

    void loadTeachers();

    return () => {
      ignore = true;
    };
  }, [scopeId]);

  const entityId = (data as any)?.id ?? id;

  const availableSchools = useMemo(
    () => (canSwitch ? schools : schools.filter((school) => school.id === scopeId)),
    [canSwitch, schools, scopeId],
  );

  const defaultValues = useMemo(
    () => ({
      name: data?.name ?? "",
      code: data?.code ?? "",
      category: data?.category ?? "",
      section: data?.section ?? "",
      room: data?.room ?? "",
      supervisor: data?.supervisor ?? "",
      capacity: data?.capacity ?? 25,
      grade: data?.grade ?? "",
      formTeacherId: normalizeTeacherId((data as any)?.formTeacherId),
      schoolId: data?.schoolId ?? (canSwitch ? activeSchoolId : scopeId),
    }),
    [data, activeSchoolId, scopeId, canSwitch],
  );

  const {
    register,
    control,
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

  const onSubmit = handleSubmit(async (formData) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    if (type === "update" && (!entityId || entityId === "")) {
      setErrorMessage("Class id is missing.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      ...formData,
      code: formData.code?.trim() ?? "",
      category: formData.category?.trim() ?? "",
      section: formData.section?.trim() ?? "",
      room: formData.room?.trim() ?? "",
      supervisor: formData.supervisor?.trim() ?? "",
      grade: formData.grade.trim(),
      formTeacherId: normalizeTeacherId(formData.formTeacherId),
      action: type,
    };

    if (type === "update") {
      payload.id = entityId;
    }

    try {
      const response = await postJSON<{ message?: string }>("/api/classes", payload);
      const message = response?.message ?? "Class saved successfully.";
      setSuccessMessage(message);

      if (type === "create") {
        reset({
          name: "",
          code: "",
          category: "",
          section: "",
          room: "",
          supervisor: "",
          capacity: 25,
          grade: "",
          formTeacherId: 0,
          schoolId: canSwitch ? activeSchoolId : scopeId,
        });
      }

      await Promise.resolve(onSuccess?.(response));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save class.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">
        {type === "create" ? "Create a new class" : "Update class"}
      </h1>

      <span className="text-xs text-gray-400 font-medium">Class Information</span>
      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label="Class Name"
          name="name"
          defaultValue={defaultValues.name}
          register={register}
          error={errors.name}
        />
        <InputField
          label="Class Code"
          name="code"
          defaultValue={defaultValues.code ?? ""}
          register={register}
          error={errors.code}
        />
        <InputField
          label="Category"
          name="category"
          defaultValue={defaultValues.category ?? ""}
          register={register}
          error={errors.category}
        />
        <InputField
          label="Section"
          name="section"
          defaultValue={defaultValues.section ?? ""}
          register={register}
          error={errors.section}
        />
        <InputField
          label="Room"
          name="room"
          defaultValue={defaultValues.room ?? ""}
          register={register}
          error={errors.room}
        />
        <InputField
          label="Supervisor"
          name="supervisor"
          defaultValue={defaultValues.supervisor ?? ""}
          register={register}
          error={errors.supervisor}
        />
        <InputField
          label="Capacity"
          name="capacity"
          type="number"
          defaultValue={defaultValues.capacity.toString()}
          register={register}
          error={errors.capacity}
        />
        <InputField
          label="Grade"
          name="grade"
          defaultValue={defaultValues.grade}
          register={register}
          error={errors.grade}
        />
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500">Form Teacher</label>
          <Controller
            control={control}
            name="formTeacherId"
            render={({ field }) => (
              <select
                className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm"
                value={field.value ?? 0}
                onChange={(event) => field.onChange(Number(event.target.value))}
                disabled={teachersLoading && teacherOptions.length === 0}
              >
                <option value={0}>Unassigned</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            )}
          />
          {teachersLoading && <p className="text-xs text-gray-400">Loading teachers...</p>}
          {teacherError && <p className="text-xs text-red-400">{teacherError}</p>}
          {!teachersLoading && teacherOptions.length === 0 && !teacherError && (
            <p className="text-xs text-gray-400">No teachers available for this campus.</p>
          )}
          {errors.formTeacherId?.message && (
            <p className="text-xs text-red-400">{errors.formTeacherId.message?.toString()}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500">Campus</label>
          <Controller
            control={control}
            name="schoolId"
            render={({ field }) => (
              <select
                className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                disabled={!canSwitch}
              >
                {canSwitch && <option value="">Select campus</option>}
                {availableSchools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.schoolId?.message && (
            <p className="text-xs text-red-400">{errors.schoolId.message?.toString()}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
        {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-400 text-white p-2 rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : type === "create" ? "Create" : "Update"}
        </button>
      </div>
    </form>
  );
};

export default ClassForm;
