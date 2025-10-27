"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useSchool, useSchoolScope } from "@/contexts/SchoolContext";
import { getJSON, postJSON } from "@/lib/utils/api";
import InputField from "../InputField";
import PhotoUploader from "./PhotoUploader";

const schema = z.object({
  teacherId: z.string().min(1, { message: "Teacher ID is required!" }),
  name: z.string().min(1, { message: "Name is required!" }),
  email: z.string().email({ message: "Invalid email address!" }),
  phone: z.string().min(1, { message: "Phone is required!" }),
  address: z.string().min(1, { message: "Address is required!" }),
  photo: z.string().trim().optional().nullable(),
  schoolId: z.string().min(1, { message: "Select a campus" }),
});

type Inputs = z.infer<typeof schema>;

type TeacherFormProps = {
  type: "create" | "update";
  data?: Partial<Inputs> & { id?: number | string };
  id?: number | string;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
};

type TeacherListResponse = {
  items: Array<{
    id: number;
    teacherId: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    photo: string | null;
    schoolId: string;
    schoolName: string;
  }>;
};

type ExistingTeacherOption = {
  id: number;
  teacherCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  photo: string | null;
  schoolName: string;
  schoolId: string;
};

const TeacherForm = ({ type, data, id, onSuccess }: TeacherFormProps) => {
  const { activeSchoolId, schools, canSwitch } = useSchool();
  const scopeId = useSchoolScope();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"new" | "existing">(type === "create" ? "new" : "new");
  const [existingTeachers, setExistingTeachers] = useState<ExistingTeacherOption[]>([]);
  const [existingLoading, setExistingLoading] = useState(false);
  const [existingError, setExistingError] = useState<string | null>(null);
  const [selectedExistingId, setSelectedExistingId] = useState<number | "">("");

  const availableSchools = useMemo(
    () => (canSwitch ? schools : schools.filter((school) => school.id === scopeId)),
    [canSwitch, schools, scopeId],
  );

  const baseNewValues = useMemo(
    () => ({
      teacherId: "",
      name: "",
      email: "",
      phone: "",
      address: "",
      photo: null as string | null,
      schoolId: canSwitch ? activeSchoolId : scopeId,
    }),
    [activeSchoolId, canSwitch, scopeId],
  );

  const entityId = (data as any)?.id ?? id;

  const defaultValues = useMemo(
    () => ({
      teacherId: data?.teacherId ?? baseNewValues.teacherId,
      name: data?.name ?? baseNewValues.name,
      email: data?.email ?? baseNewValues.email,
      phone: data?.phone ?? baseNewValues.phone,
      address: data?.address ?? baseNewValues.address,
      photo: data?.photo ?? baseNewValues.photo,
      schoolId: data?.schoolId ?? baseNewValues.schoolId,
    }),
    [data, baseNewValues],
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
  } = useForm<Inputs>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const fetchExistingTeachers = useCallback(async () => {
    try {
      setExistingLoading(true);
      setExistingError(null);

      const response = await getJSON<TeacherListResponse>("/api/teachers?pageSize=200");
      const options = Array.isArray(response?.items)
        ? response.items.map((item) => ({
            id: item.id,
            teacherCode: item.teacherId,
            fullName: item.name,
            email: item.email,
            phone: item.phone,
            address: item.address,
            photo: item.photo,
            schoolName: item.schoolName,
            schoolId: item.schoolId,
          }))
        : [];

      setExistingTeachers(options);
    } catch (error) {
      setExistingError(
        error instanceof Error ? error.message : "Unable to load existing teachers.",
      );
    } finally {
      setExistingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (type !== "create") {
      return;
    }
    if (mode !== "existing") {
      return;
    }
    if (existingTeachers.length > 0 || existingLoading) {
      return;
    }
    void fetchExistingTeachers();
  }, [type, mode, existingTeachers.length, existingLoading, fetchExistingTeachers]);

  useEffect(() => {
    if (type !== "create" || mode !== "existing") {
      return;
    }
    if (typeof selectedExistingId !== "number") {
      return;
    }
    const match = existingTeachers.find((teacher) => teacher.id === selectedExistingId);
    if (!match) {
      return;
    }

    const currentSchoolId =
      getValues("schoolId") || (canSwitch ? activeSchoolId : scopeId) || baseNewValues.schoolId;

    reset({
      teacherId: match.teacherCode,
      name: match.fullName || match.teacherCode,
      email: match.email ?? "",
      phone: match.phone ?? "",
      address: match.address ?? "",
      photo: match.photo ?? null,
      schoolId: currentSchoolId,
    });
  }, [
    type,
    mode,
    selectedExistingId,
    existingTeachers,
    reset,
    getValues,
    canSwitch,
    activeSchoolId,
    scopeId,
    baseNewValues.schoolId,
  ]);

  const handleModeChange = (target: "new" | "existing") => {
    setMode(target);
    if (target === "new") {
      setSelectedExistingId("");
      const currentValues = getValues();
      reset({
        ...baseNewValues,
        schoolId: currentValues.schoolId || baseNewValues.schoolId,
      });
    }
  };

  const handleSelectExisting = (value: string) => {
    if (!value) {
      setSelectedExistingId("");
      const currentValues = getValues();
      reset({
        teacherId: "",
        name: "",
        email: "",
        phone: "",
        address: "",
        photo: null,
        schoolId: currentValues.schoolId || baseNewValues.schoolId,
      });
      return;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      setSelectedExistingId(parsed);
    }
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

    const rawPhoto = formData.photo;
    const normalisedPhoto =
      typeof rawPhoto === "string" && rawPhoto.trim().length > 0
        ? rawPhoto.trim()
        : null;

    const payload: Record<string, unknown> = {
      ...formData,
      photo: normalisedPhoto,
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
          photo: null,
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

      {type === "create" && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <span className="text-xs font-semibold uppercase text-gray-500">
            Teacher source
          </span>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="teacher-source"
                value="new"
                checked={mode === "new"}
                onChange={() => handleModeChange("new")}
                className="accent-lamaPurple"
              />
              Enter new teacher details
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="teacher-source"
                value="existing"
                checked={mode === "existing"}
                onChange={() => handleModeChange("existing")}
                className="accent-lamaPurple"
              />
              Copy details from an existing teacher
            </label>
          </div>

          {mode === "existing" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-500">Existing teacher</label>
                <select
                  className="w-full rounded-md border border-gray-300 p-2 text-sm"
                  value={typeof selectedExistingId === "number" ? selectedExistingId : ""}
                  onChange={(event) => handleSelectExisting(event.target.value)}
                  disabled={existingLoading}
                >
                  <option value="">
                    {existingLoading ? "Loading teachers..." : "Select a teacher"}
                  </option>
                  {existingTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.fullName} ({teacher.teacherCode}) - {teacher.schoolName}
                    </option>
                  ))}
                </select>
              </div>
              {existingError && (
                <p className="text-xs text-red-500">{existingError}</p>
              )}
              {!existingLoading && existingTeachers.length === 0 && !existingError && (
                <p className="text-xs text-gray-500">
                  No teachers are available to copy yet. Create one manually first.
                </p>
              )}
              <p className="text-xs text-gray-500">
                Selecting an existing teacher copies their profile into this school. You can still
                adjust the details before saving.
              </p>
            </div>
          )}
        </div>
      )}

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
        <Controller
          control={control}
          name="photo"
          render={({ field }) => (
            <PhotoUploader
              label="Photo"
              value={typeof field.value === "string" ? field.value : null}
              onChange={(value) => field.onChange(value ?? null)}
              disabled={submitting}
              helperText="JPEG, PNG, WEBP or GIF up to 5MB."
              error={errors.photo?.message?.toString() ?? null}
            />
          )}
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
