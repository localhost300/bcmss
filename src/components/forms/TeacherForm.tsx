"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useSchool, useSchoolScope } from "@/contexts/SchoolContext";
import { getJSON, postJSON } from "@/lib/utils/api";
import InputField from "../InputField";

const schema = z.object({
  teacherId: z.string().min(1, { message: "Teacher ID is required!" }),
  name: z.string().min(1, { message: "Name is required!" }),
  email: z.string().email({ message: "Invalid email address!" }),
  phone: z.string().min(1, { message: "Phone is required!" }),
  address: z.string().min(1, { message: "Address is required!" }),
  photo: z
    .string()
    .url({ message: "Photo must be a valid URL!" })
    .optional()
    .or(z.literal("")),
  subjects: z.array(z.string()).min(1, { message: "Select at least one subject!" }),
  classes: z.array(z.string()).min(1, { message: "Assign at least one class!" }),
  schoolId: z.string().min(1, { message: "Select a campus" }),
});

type Inputs = z.infer<typeof schema>;

type TeacherFormProps = {
  type: "create" | "update";
  data?: Partial<Inputs> & { id?: number | string };
  id?: number | string;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
};

type Option = { id: number; name: string };

const uniqueList = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));

const TeacherForm = ({ type, data, id, onSuccess }: TeacherFormProps) => {
  const { activeSchoolId, schools, canSwitch } = useSchool();
  const scopeId = useSchoolScope();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [subjectOptions, setSubjectOptions] = useState<Option[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const [classOptions, setClassOptions] = useState<Option[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);

  const availableSchools = useMemo(
    () => (canSwitch ? schools : schools.filter((school) => school.id === scopeId)),
    [canSwitch, schools, scopeId],
  );

  const entityId = (data as any)?.id ?? id;

  const defaultValues = useMemo(
    () => ({
      teacherId: data?.teacherId ?? "",
      name: data?.name ?? "",
      email: data?.email ?? "",
      phone: data?.phone ?? "",
      address: data?.address ?? "",
      photo: data?.photo ?? "",
      subjects: data?.subjects ?? [],
      classes: data?.classes ?? [],
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

  useEffect(() => {
    let ignore = false;

    const loadSubjects = async () => {
      setSubjectsLoading(true);
      setSubjectsError(null);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "200");
        if (scopeId) {
          params.set("schoolId", scopeId);
        }
        const response = await getJSON<{ items?: Option[]; data?: Option[] }>(
          `/api/subjects?${params.toString()}`,
        );

        if (ignore) return;

        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray((response as any)?.data)
            ? (response as any).data
            : [];
        setSubjectOptions(items);
      } catch (error) {
        if (ignore) return;
        console.error("[TeacherForm] Unable to load subjects", error);
        setSubjectsError(
          error instanceof Error ? error.message : "Unable to load subjects.",
        );
        setSubjectOptions([]);
      } finally {
        if (!ignore) {
          setSubjectsLoading(false);
        }
      }
    };

    void loadSubjects();

    return () => {
      ignore = true;
    };
  }, [scopeId]);

  useEffect(() => {
    let ignore = false;

    const loadClasses = async () => {
      setClassesLoading(true);
      setClassesError(null);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "200");
        if (scopeId) {
          params.set("schoolId", scopeId);
        }
        const response = await getJSON<{ items?: Option[]; data?: Option[] }>(
          `/api/classes?${params.toString()}`,
        );

        if (ignore) return;

        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray((response as any)?.data)
            ? (response as any).data
            : [];
        setClassOptions(items);
      } catch (error) {
        if (ignore) return;
        console.error("[TeacherForm] Unable to load classes", error);
        setClassesError(error instanceof Error ? error.message : "Unable to load classes.");
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
  }, [scopeId]);

  const renderCheckboxGroup = (
    field: { value: string[]; onChange: (value: string[]) => void },
    options: Option[],
    errorText?: string,
  ) => {
    const currentValue = field.value ?? [];

    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((option) => {
            const isChecked = currentValue.includes(option.name);
            const handleToggle = () => {
              if (isChecked) {
                field.onChange(currentValue.filter((item) => item !== option.name));
              } else {
                field.onChange([...currentValue, option.name]);
              }
            };

            return (
              <label
                key={option.id}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:border-lamaPurpleLight"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={handleToggle}
                  className="accent-lamaPurple"
                />
                <span>{option.name}</span>
              </label>
            );
          })}
        </div>
        {errorText && <p className="text-xs text-red-400">{errorText}</p>}
        {!options.length && (subjectsLoading || classesLoading) && (
          <p className="text-xs text-gray-400">Loading options…</p>
        )}
        {!options.length && !(subjectsLoading || classesLoading) && (
          <p className="text-xs text-gray-400">No options available for this campus.</p>
        )}
      </div>
    );
  };

  const onSubmit = handleSubmit(async (formData) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    if (type === "update" && !entityId) {
      setErrorMessage("Teacher id is missing.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      ...formData,
      photo: formData.photo?.trim() ?? "",
      subjects: uniqueList(formData.subjects),
      classes: uniqueList(formData.classes),
      action: type,
    };

    if (type === "update") {
      payload.id = entityId;
    }

    try {
      const response = await postJSON<{ message?: string }>("/api/teachers", payload);
      const message = response?.message ?? "Teacher saved successfully.";
      setSuccessMessage(message);

      if (type === "create") {
        reset({
          teacherId: "",
          name: "",
          email: "",
          phone: "",
          address: "",
          photo: "",
          subjects: [],
          classes: [],
          schoolId: canSwitch ? activeSchoolId : scopeId,
        });
      }

      await Promise.resolve(onSuccess?.(response));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save teacher.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">
        {type === "create" ? "Create a new teacher" : "Update teacher"}
      </h1>

      <span className="text-xs text-gray-400 font-medium">Teacher Information</span>
      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label="Teacher ID"
          name="teacherId"
          defaultValue={defaultValues.teacherId}
          register={register}
          error={errors.teacherId}
        />
        <InputField
          label="Full Name"
          name="name"
          defaultValue={defaultValues.name}
          register={register}
          error={errors.name}
        />
        <InputField
          label="Email"
          name="email"
          defaultValue={defaultValues.email}
          register={register}
          error={errors.email}
        />
        <InputField
          label="Phone"
          name="phone"
          defaultValue={defaultValues.phone}
          register={register}
          error={errors.phone}
        />
        <InputField
          label="Address"
          name="address"
          defaultValue={defaultValues.address}
          register={register}
          error={errors.address}
        />
        <InputField
          label="Photo URL"
          name="photo"
          defaultValue={defaultValues.photo}
          register={register}
          error={errors.photo}
        />
        <div className="flex flex-col gap-2 w-full md:w-1/3">
          <label className="text-xs text-gray-500">Campus</label>
          <Controller
            control={control}
            name="schoolId"
            render={({ field }) => (
              <select
                className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
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
            <p className="text-xs text-red-400">{errors.schoolId.message.toString()}</p>
          )}
        </div>
      </div>

      <span className="text-xs text-gray-400 font-medium">Subjects</span>
      {subjectsError ? (
        <p className="text-xs text-red-400">{subjectsError}</p>
      ) : (
        <Controller
          control={control}
          name="subjects"
          render={({ field }) =>
            renderCheckboxGroup(field, subjectOptions, errors.subjects?.message?.toString())
          }
        />
      )}

      <span className="text-xs text-gray-400 font-medium">Class Assignments</span>
      {classesError ? (
        <p className="text-xs text-red-400">{classesError}</p>
      ) : (
        <Controller
          control={control}
          name="classes"
          render={({ field }) =>
            renderCheckboxGroup(field, classOptions, errors.classes?.message?.toString())
          }
        />
      )}

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

export default TeacherForm;
