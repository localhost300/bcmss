"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useSchool, useSchoolScope } from "@/contexts/SchoolContext";
import { getJSON, postJSON } from "@/lib/utils/api";
import InputField from "../InputField";

const schema = z.object({
  name: z.string().min(1, { message: "Name is required!" }),
  code: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  creditHours: z
    .coerce.number({ invalid_type_error: "Credit hours must be a number" })
    .optional()
    .nullable(),
  description: z.string().optional().nullable(),
  classIds: z.array(z.number().int().positive()).min(1, { message: "Select at least one class!" }),
  schoolId: z.string().min(1, { message: "Select a campus" }),
  teacherIds: z.array(z.number().int().positive()).optional().default([]),
});

type Inputs = z.infer<typeof schema>;

type SubjectFormProps = {
  type: "create" | "update";
  data?: Partial<Inputs> & { id?: number | string } & {
    teachers?: Array<{ id?: number }>;
    classTeacherAssignments?: Array<{ classId: number; teacherId: number | null }>;
  };
  id?: number | string;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
};

const normaliseNumberArray = (input: Array<number | null | undefined>): number[] => {
  const unique = new Set<number>();
  input.forEach((value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      unique.add(Math.trunc(value));
    }
  });
  return Array.from(unique).sort((a, b) => a - b);
};

const mapsAreEqual = (
  left: Record<number, number | null>,
  right: Record<number, number | null>,
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[Number(key)] === right[Number(key)]);
};

const arraysEqual = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
};

const SubjectForm = ({ type, data, id, onSuccess }: SubjectFormProps) => {
  const { activeSchoolId, schools, canSwitch } = useSchool();
  const scopeId = useSchoolScope();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const availableSchools = useMemo(
    () => (canSwitch ? schools : schools.filter((school) => school.id === scopeId)),
    [canSwitch, schools, scopeId],
  );

  const [classOptions, setClassOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);

  const [teacherOptions, setTeacherOptions] = useState<
    Array<{ id: number; name: string; classIds: number[] }>
  >([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [classTeacherMap, setClassTeacherMap] = useState<Record<number, number | null>>({});

  const entityId = (data as { id?: number | string } | undefined)?.id ?? id;

  const defaultValues = useMemo(
    () => ({
      name: data?.name ?? "",
      code: data?.code ?? "",
      category: data?.category ?? "",
      creditHours: data?.creditHours ?? null,
      description: data?.description ?? "",
      classIds: data?.classIds ?? [],
      teacherIds:
        (Array.isArray((data as { teacherIds?: number[] })?.teacherIds)
          ? ((data as { teacherIds?: number[] }).teacherIds as number[])
          : Array.isArray((data as { teachers?: Array<{ id?: number }> })?.teachers)
          ? ((data as { teachers?: Array<{ id?: number }> }).teachers || [])
              .map((teacher) => teacher?.id)
              .filter((teacherId): teacherId is number => typeof teacherId === "number")
          : []),
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
    watch,
    setValue,
    getValues,
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const watchedSchoolId = watch("schoolId");
  const watchedClassIdsRaw = watch("classIds");
  const watchedClassIds = useMemo(
    () =>
      Array.isArray(watchedClassIdsRaw)
        ? watchedClassIdsRaw.filter((value): value is number => typeof value === "number")
        : [],
    [watchedClassIdsRaw],
  );
  const selectedSchoolId = (canSwitch ? watchedSchoolId || activeSchoolId || scopeId : scopeId) ?? "";
  const selectedClasses = useMemo(
    () => classOptions.filter((option) => watchedClassIds.includes(option.id)),
    [classOptions, watchedClassIds],
  );

  useEffect(() => {
    register("teacherIds");
  }, [register]);

  useEffect(() => {
    if (data?.classTeacherAssignments && data.classTeacherAssignments.length > 0) {
      const next: Record<number, number | null> = {};
      data.classTeacherAssignments.forEach(({ classId, teacherId }) => {
        if (typeof classId === "number") {
          next[classId] = typeof teacherId === "number" ? teacherId : null;
        }
      });
      setClassTeacherMap((prev) => (mapsAreEqual(prev, next) ? prev : next));
    } else {
      setClassTeacherMap((prev) => (Object.keys(prev).length > 0 ? {} : prev));
    }
  }, [data?.classTeacherAssignments]);

  useEffect(() => {
    let ignore = false;

    const loadClasses = async () => {
      if (!selectedSchoolId) {
        setClassOptions([]);
        setClassError(null);
        setClassesLoading(false);
        return;
      }

      setClassesLoading(true);
      setClassError(null);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "200");
        params.set("schoolId", selectedSchoolId);
        const response = await getJSON<{ items: Array<{ id: number; name: string }> }>(
          `/api/classes?${params.toString()}`,
        );

        if (ignore) return;

        setClassOptions(response.items);
      } catch (error) {
        if (ignore) return;
        setClassError(error instanceof Error ? error.message : "Unable to load classes.");
        setClassOptions([]);
      } finally {
        if (!ignore) {
          setClassesLoading(false);
        }
      }
    };

    void loadClasses();

    return () => {
      ignore = true;
    };
  }, [selectedSchoolId]);

  useEffect(() => {
    if (!Array.isArray(watchedClassIds) || watchedClassIds.length === 0) {
      return;
    }

    const filtered = watchedClassIds.filter((classId) =>
      classOptions.some((option) => option.id === classId),
    );

    if (filtered.length !== watchedClassIds.length) {
      setValue("classIds", filtered);
    }
  }, [classOptions, watchedClassIds, setValue]);

  useEffect(() => {
    let ignore = false;

    const loadTeachers = async () => {
      if (!selectedSchoolId) {
        setTeacherOptions([]);
        setTeacherError(null);
        setTeachersLoading(false);
        return;
      }

      setTeachersLoading(true);
      setTeacherError(null);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "200");
        params.set("schoolId", selectedSchoolId);
        const response = await getJSON<{
          items: Array<{ id: number; name: string; teacherId: string; classIds?: number[] }>;
        }>(`/api/teachers?${params.toString()}`);

        if (ignore) return;

        const mapped = (response.items ?? [])
          .map((teacher) => ({
            id: teacher.id,
            name: teacher.name || teacher.teacherId,
            classIds: normaliseNumberArray(teacher.classIds ?? []),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setTeacherOptions(mapped);
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
  }, [selectedSchoolId]);

  useEffect(() => {
    setClassTeacherMap((prev) => {
      if (!watchedClassIds.length) {
        return Object.keys(prev).length ? {} : prev;
      }

      const teacherIdsValue = getValues("teacherIds");
      const currentTeacherIds = normaliseNumberArray(
        Array.isArray(teacherIdsValue)
          ? (teacherIdsValue as Array<number | null | undefined>)
          : [],
      );
      const next: Record<number, number | null> = {};

      watchedClassIds.forEach((classId) => {
        const existing = prev[classId] ?? null;
        const isExistingValid =
          typeof existing === "number" &&
          teacherOptions.some((teacher) => teacher.id === existing);

        let value: number | null = isExistingValid ? existing : null;

        if (value === null) {
          const preferred = currentTeacherIds.find((teacherId) =>
            teacherOptions.some(
              (teacher) => teacher.id === teacherId && teacher.classIds.includes(classId),
            ),
          );
          if (typeof preferred === "number") {
            value = preferred;
          }
        }

        if (value === null) {
          const fallback = currentTeacherIds.find((teacherId) =>
            teacherOptions.some((teacher) => teacher.id === teacherId),
          );
          value = typeof fallback === "number" ? fallback : null;
        }

        next[classId] = value;
      });

      if (mapsAreEqual(prev, next)) {
        return prev;
      }

      return next;
    });
  }, [watchedClassIds, teacherOptions, getValues]);

  useEffect(() => {
    const selectedTeacherIds = normaliseNumberArray(Object.values(classTeacherMap));
    const teacherIdsValue = getValues("teacherIds");
    const currentTeacherIds = normaliseNumberArray(
      Array.isArray(teacherIdsValue)
        ? (teacherIdsValue as Array<number | null | undefined>)
        : [],
    );

    if (!arraysEqual(selectedTeacherIds, currentTeacherIds)) {
      setValue("teacherIds", selectedTeacherIds, { shouldDirty: true });
    }
  }, [classTeacherMap, getValues, setValue]);

  const onSubmit = handleSubmit(async (formData) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    if (
      type === "update" &&
      (entityId === undefined || entityId === null || entityId === "")
    ) {
      setErrorMessage("Subject id is missing.");
      setSubmitting(false);
      return;
    }

    const uniqueClassIds = Array.from(new Set(watchedClassIds));
    const classTeacherAssignments = uniqueClassIds.map((classId) => ({
      classId,
      teacherId: classTeacherMap[classId] ?? null,
    }));
    const teacherIdsForPayload = normaliseNumberArray(
      classTeacherAssignments.map((assignment) => assignment.teacherId),
    );

    const payload: Record<string, unknown> = {
      ...formData,
      code: formData.code?.trim() ?? "",
      category: formData.category?.trim() ?? "",
      description: formData.description?.trim() ?? "",
      teacherIds: teacherIdsForPayload,
      classTeacherAssignments,
      action: type,
    };

    if (type === "update") {
      payload.id = entityId;
    }

    try {
      const response = await postJSON<{ message?: string }>("/api/subjects", payload);
      const message = response?.message ?? "Subject saved successfully.";
      setSuccessMessage(message);

      if (type === "create") {
        reset({
          name: "",
          code: "",
          category: "",
          creditHours: null,
          description: "",
          classIds: [],
          teacherIds: [],
          schoolId: canSwitch ? activeSchoolId : scopeId,
        });
        setClassTeacherMap({});
      }

      await Promise.resolve(onSuccess?.(response));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save subject.");
    } finally {
      setSubmitting(false);
    }
  });

  const renderClassCheckboxes = (
    field: { value: number[]; onChange: (value: number[]) => void },
    options: { id: number; name: string }[],
    errorText?: string,
  ) => {
    const currentValue = field.value ?? [];

    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((option) => {
            const isChecked = currentValue.includes(option.id);
            const handleToggle = () => {
              if (isChecked) {
                field.onChange(currentValue.filter((item) => item !== option.id));
              } else {
                field.onChange([...currentValue, option.id]);
              }
            };

            return (
              <label
                key={option.id}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:border-lamaPurpleLight"
              >
                <input type="checkbox" checked={isChecked} onChange={handleToggle} className="accent-lamaPurple" />
                <span>{option.name}</span>
              </label>
            );
          })}
        </div>
        {errorText && <p className="text-xs text-red-400">{errorText}</p>}
      </div>
    );
  };

  const creditHoursDefault =
    defaultValues.creditHours !== null && defaultValues.creditHours !== undefined
      ? String(defaultValues.creditHours)
      : "";

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">{type === "create" ? "Create a new subject" : "Update subject"}</h1>

      <span className="text-xs text-gray-400 font-medium">Subject Information</span>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Name" name="name" defaultValue={defaultValues.name} register={register} error={errors.name} />
        <InputField label="Code" name="code" defaultValue={defaultValues.code ?? ""} register={register} error={errors.code} />
        <InputField
          label="Category"
          name="category"
          defaultValue={defaultValues.category ?? ""}
          register={register}
          error={errors.category}
        />
        <InputField
          label="Credit Hours"
          name="creditHours"
          type="number"
          defaultValue={creditHoursDefault}
          register={register}
          error={errors.creditHours}
        />
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Description</label>
          <textarea
            className="mt-1 ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full min-h-[100px]"
            defaultValue={defaultValues.description ?? ""}
            {...register("description")}
          />
          {errors.description?.message && <p className="text-xs text-red-400">{errors.description.message}</p>}
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="text-xs text-gray-500">Assign Classes</label>
          <Controller
            control={control}
            name="classIds"
            render={({ field }) => renderClassCheckboxes(field, classOptions, errors.classIds?.message?.toString())}
          />
          {classesLoading && <p className="text-xs text-gray-400">Loading classes...</p>}
          {classError && <p className="text-xs text-red-400">{classError}</p>}
          {!classesLoading && classOptions.length === 0 && !classError && (
            <p className="text-xs text-gray-400">No classes available for this campus.</p>
          )}
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="text-xs text-gray-500">Assign Teachers</label>
          {teachersLoading && <p className="text-xs text-gray-400">Loading teachers...</p>}
          {teacherError && <p className="text-xs text-red-400">{teacherError}</p>}
          {!teachersLoading && !teacherError && selectedClasses.length === 0 && (
            <p className="text-xs text-gray-400">Select at least one class to assign teachers.</p>
          )}
          {!teachersLoading && selectedClasses.length > 0 && (
            <div className="flex flex-col gap-3">
              {selectedClasses.map((klass) => {
                const optionsForClass = teacherOptions
                  .map((teacher) => ({
                    ...teacher,
                    priority: teacher.classIds.includes(klass.id) ? 0 : 1,
                  }))
                  .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
                const selectedTeacherId = classTeacherMap[klass.id] ?? null;
                return (
                  <div
                    key={klass.id}
                    className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">{klass.name}</span>
                      {optionsForClass.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {optionsForClass.length} teacher{optionsForClass.length === 1 ? "" : "s"} available
                        </span>
                      )}
                    </div>
                    <select
                      className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm bg-white"
                      value={selectedTeacherId !== null ? String(selectedTeacherId) : ""}
                      onChange={(event) => {
                        const value = event.target.value ? Number(event.target.value) : null;
                        setClassTeacherMap((prev) => ({
                          ...prev,
                          [klass.id]: value,
                        }));
                      }}
                      disabled={optionsForClass.length === 0}
                    >
                      <option value="">Select teacher</option>
                      {optionsForClass.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                    {optionsForClass.length === 0 && (
                      <p className="text-xs text-gray-500">
                        No teachers currently assigned to this class.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!teachersLoading &&
            teacherOptions.length === 0 &&
            !teacherError &&
            selectedClasses.length === 0 && (
              <p className="text-xs text-gray-400">No teachers available for this campus.</p>
            )}
          {errors.teacherIds?.message && (
            <p className="text-xs text-red-400">{errors.teacherIds.message?.toString()}</p>
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

export default SubjectForm;
