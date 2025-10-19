"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
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
  };
  id?: number | string;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
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

  const [teacherOptions, setTeacherOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

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
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const watchedSchoolId = watch("schoolId");
  const watchedClassIds = watch("classIds");
  const watchedTeacherIds = watch("teacherIds");
  const selectedSchoolId = (canSwitch ? watchedSchoolId || activeSchoolId || scopeId : scopeId) ?? "";

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
          items: Array<{ id: number; name: string; teacherId: string }>;
        }>(`/api/teachers?${params.toString()}`);

        if (ignore) return;

        const mapped = (response.items ?? [])
          .map((teacher) => ({
            id: teacher.id,
            name: teacher.name || teacher.teacherId,
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
    if (!Array.isArray(watchedTeacherIds) || watchedTeacherIds.length === 0) {
      return;
    }

    const filtered = watchedTeacherIds.filter((teacherId) =>
      teacherOptions.some((option) => option.id === teacherId),
    );

    if (filtered.length !== watchedTeacherIds.length) {
      setValue("teacherIds", filtered);
    }
  }, [teacherOptions, watchedTeacherIds, setValue]);

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

    const payload: Record<string, unknown> = {
      ...formData,
      code: formData.code?.trim() ?? "",
      category: formData.category?.trim() ?? "",
      description: formData.description?.trim() ?? "",
      teacherIds: formData.teacherIds ?? [],
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

  const renderTeacherCheckboxes = (
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
          <Controller
            control={control}
            name="teacherIds"
            render={({ field }) =>
              renderTeacherCheckboxes(field, teacherOptions, errors.teacherIds?.message?.toString())
            }
          />
          {teachersLoading && <p className="text-xs text-gray-400">Loading teachers...</p>}
          {teacherError && <p className="text-xs text-red-400">{teacherError}</p>}
          {!teachersLoading && teacherOptions.length === 0 && !teacherError && (
            <p className="text-xs text-gray-400">No teachers available for this campus.</p>
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
