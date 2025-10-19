"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useSchool, useSchoolScope } from "@/contexts/SchoolContext";
import { getJSON, postJSON } from "@/lib/utils/api";
import InputField from "../InputField";

const categories = ["Science", "Art", "Commercial", "Humanities", "Technical", "General"] as const;

const schema = z.object({
  studentId: z.string().min(1, { message: "Student ID is required!" }),
  name: z.string().min(1, { message: "Student name is required!" }),
  email: z.string().email({ message: "Please enter a valid email!" }).optional(),
  phone: z.string().min(1, { message: "Phone number is required!" }).optional(),
  address: z.string().min(1, { message: "Address is required!" }),
  photo: z
    .string()
    .url({ message: "Photo must be a valid URL" })
    .optional()
    .or(z.literal("")),
  grade: z.coerce
    .number({ invalid_type_error: "Grade must be a number" })
    .min(1, { message: "Grade must be at least 1" })
    .max(12, { message: "Grade must be at most 12" }),
  className: z.string().min(1, { message: "Class selection is required!" }),
  category: z.enum(categories, { message: "Select a category" }),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  schoolId: z.string().min(1, { message: "Select a campus" }),
});

type Inputs = z.infer<typeof schema>;

type StudentFormProps = {
  type: "create" | "update";
  data?: Partial<Inputs> & { id?: number | string };
  id?: number | string;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
};

type Option = { id: number; name: string };

const StudentForm = ({ type, data, id, onSuccess }: StudentFormProps) => {
  const { activeSchoolId, schools, canSwitch } = useSchool();
  const scopeId = useSchoolScope();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      studentId: data?.studentId ?? "",
      name: data?.name ?? "",
      email: data?.email ?? "",
      phone: data?.phone ?? "",
      address: data?.address ?? "",
      photo: data?.photo ?? "",
      grade: data?.grade ?? 1,
      className: (data as any)?.className ?? (data as any)?.class ?? "",
      category: (data?.category as Inputs["category"]) ?? "General",
      guardianName: data?.guardianName ?? "",
      guardianPhone: data?.guardianPhone ?? "",
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
        console.error("[StudentForm] Unable to load classes", error);
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

  const onSubmit = handleSubmit(async (formData) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    if (type === "update" && (!entityId || entityId === "")) {
      setErrorMessage("Student id is missing.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      ...formData,
      email: formData.email?.trim() ?? "",
      phone: formData.phone?.trim() ?? "",
      className: formData.className.trim(),
      guardianName: formData.guardianName?.trim() ?? "",
      guardianPhone: formData.guardianPhone?.trim() ?? "",
      action: type,
    };

    if (type === "update") {
      payload.id = entityId;
    }

    if (type === "create" && (!formData.email || !formData.email.trim())) {
      setErrorMessage("Email is required to create a student account.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await postJSON<{ message?: string }>(
        "/api/students",
        payload,
      );
      const message = response?.message ?? "Student saved successfully.";
      setSuccessMessage(message);

      if (type === "create") {
        reset({
          studentId: "",
          name: "",
          email: "",
          phone: "",
          address: "",
          photo: "",
          grade: 1,
          className: "",
          category: "General",
          guardianName: "",
          guardianPhone: "",
          schoolId: canSwitch ? activeSchoolId : scopeId,
        });
      }

      await Promise.resolve(onSuccess?.(response));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save student.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">
        {type === "create" ? "Create a new student" : "Update student"}
      </h1>

      <span className="text-xs text-gray-400 font-medium">Student Information</span>
      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label="Student ID"
          name="studentId"
          defaultValue={defaultValues.studentId}
          register={register}
          error={errors.studentId}
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
      </div>

      <span className="text-xs text-gray-400 font-medium">Academic Details</span>
      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label="Grade"
          name="grade"
          type="number"
          defaultValue={defaultValues.grade.toString()}
          register={register}
          error={errors.grade}
        />
        <div className="flex flex-col gap-2 w-full md:w-1/3">
          <label className="text-xs text-gray-500">Class</label>
          <Controller
            control={control}
            name="className"
            render={({ field }) => (
              <select
                className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              >
                <option value="">Select class</option>
                {classOptions.map((klass) => (
                  <option key={klass.id} value={klass.name}>
                    {klass.name}
                  </option>
                ))}
              </select>
            )}
          />
          {classesLoading && (
            <p className="text-xs text-gray-400">Loading classes…</p>
          )}
          {classesError && <p className="text-xs text-red-400">{classesError}</p>}
          {errors.className?.message && (
            <p className="text-xs text-red-400">{errors.className.message?.toString()}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full md:w-1/3">
          <label className="text-xs text-gray-500">Category</label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <select
                className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
                value={field.value}
                onChange={(event) =>
                  field.onChange(event.target.value as Inputs["category"])
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.category?.message && (
            <p className="text-xs text-red-400">{errors.category.message?.toString()}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full md:w-1/4">
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
            <p className="text-xs text-red-400">{errors.schoolId.message?.toString()}</p>
          )}
        </div>
      </div>

      <span className="text-xs text-gray-400 font-medium">Guardian Information</span>
      <div className="flex justify-between flex-wrap gap-4">
        <InputField
          label="Guardian Name"
          name="guardianName"
          defaultValue={defaultValues.guardianName}
          register={register}
          error={errors.guardianName}
        />
        <InputField
          label="Guardian Phone"
          name="guardianPhone"
          defaultValue={defaultValues.guardianPhone}
          register={register}
          error={errors.guardianPhone}
        />
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

export default StudentForm;
