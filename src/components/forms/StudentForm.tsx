"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useSchool, useSchoolScope } from "@/contexts/SchoolContext";
import { getJSON, postJSON } from "@/lib/utils/api";
import InputField from "../InputField";
import PhotoUploader from "./PhotoUploader";

const categories = ["Science", "Art", "Commercial", "Humanities", "Technical", "General"] as const;
const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const schema = z.object({
  studentId: z.string().min(1, { message: "Student ID is required!" }),
  name: z.string().min(1, { message: "Student name is required!" }),
  email: z.string().email({ message: "Please enter a valid email!" }).optional(),
  address: z.string().min(1, { message: "Address is required!" }),
  photo: z.string().trim().optional().nullable(),
  dateOfBirth: z.string().min(1, { message: "Date of birth is required!" }),
  bloodType: z.enum(bloodTypes, { message: "Select a blood type" }),
  grade: z.coerce
    .number({ invalid_type_error: "Grade must be a number" })
    .min(1, { message: "Grade must be at least 1" })
    .max(12, { message: "Grade must be at most 12" }),
  className: z.string().min(1, { message: "Class selection is required!" }),
  category: z.enum(categories, { message: "Select a category" }),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email({ message: "Provide a valid guardian email!" }).optional().or(z.literal("")),
  guardianRelationship: z.string().optional(),
  existingGuardianId: z.number().int().positive().optional(),
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
type ParentOption = { id: number; name: string; email: string | null; phone: string | null };

const StudentForm = ({ type, data, id, onSuccess }: StudentFormProps) => {
  const { activeSchoolId, schools, canSwitch } = useSchool();
  const scopeId = useSchoolScope();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [classOptions, setClassOptions] = useState<Option[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [guardianOptions, setGuardianOptions] = useState<ParentOption[]>([]);
  const [guardiansLoading, setGuardiansLoading] = useState(false);
  const [guardiansError, setGuardiansError] = useState<string | null>(null);
  const hasExistingGuardianDefault = Boolean((data as any)?.existingGuardianId);
  const [guardianMode, setGuardianMode] = useState<"new" | "existing">(
    () => (hasExistingGuardianDefault ? "existing" : "new"),
  );
  const guardianModeWasSetByUserRef = useRef(false);
  const isMountedRef = useRef(true);

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
      address: data?.address ?? "",
      photo:
        typeof data?.photo === "string" && data.photo.trim().length > 0 ? data.photo : null,
      dateOfBirth: data?.dateOfBirth ? data.dateOfBirth.slice(0, 10) : "",
      bloodType: (data?.bloodType as Inputs["bloodType"]) ?? bloodTypes[0],
      grade: data?.grade ?? 1,
      className: (data as any)?.className ?? (data as any)?.class ?? "",
      category: (data?.category as Inputs["category"]) ?? "General",
      guardianName: data?.guardianName ?? "",
      guardianPhone: data?.guardianPhone ?? "",
      guardianEmail: (data as any)?.guardianEmail ?? "",
      guardianRelationship: (data as any)?.guardianRelationship ?? "",
      existingGuardianId:
        (data as any)?.existingGuardianId !== undefined
          ? Number((data as any)?.existingGuardianId)
          : undefined,
      schoolId: data?.schoolId ?? (canSwitch ? activeSchoolId : scopeId),
    }),
    [data, activeSchoolId, scopeId, canSwitch],
  );

  const refreshGuardians = useCallback(async () => {
    setGuardiansLoading(true);
    setGuardiansError(null);
    try {
      const response = await getJSON<{
        items?: Array<{ id?: unknown; name?: unknown; email?: unknown; phone?: unknown }>;
      }>("/api/parents?pageSize=200");

      const items = Array.isArray(response?.items) ? response.items : [];
      const options = items
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const id =
            typeof item.id === "number"
              ? item.id
              : typeof item.id === "string"
                ? Number.parseInt(item.id, 10)
                : undefined;
          const name = typeof item.name === "string" ? item.name : undefined;
          const email = typeof item.email === "string" ? item.email : null;
          const phone = typeof item.phone === "string" ? item.phone : null;
          if (!id || !name) {
            return null;
          }
          return { id, name, email, phone };
        })
        .filter((item): item is ParentOption => Boolean(item))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!isMountedRef.current) {
        return;
      }

      setGuardianOptions(options);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }
      console.error("[StudentForm] Unable to load guardians", error);
      setGuardiansError(error instanceof Error ? error.message : "Unable to load guardians.");
      setGuardianOptions([]);
    } finally {
      if (!isMountedRef.current) {
        return;
      }
      setGuardiansLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void refreshGuardians();
    return () => {
      isMountedRef.current = false;
    };
  }, [refreshGuardians]);
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

  const selectedGuardianId = watch("existingGuardianId");
  const selectedGuardian = useMemo(
    () => {
      if (guardianMode !== "existing") {
        return null;
      }
      if (typeof selectedGuardianId === "number") {
        return guardianOptions.find((option) => option.id === selectedGuardianId) ?? null;
      }
      return null;
    },
    [guardianMode, guardianOptions, selectedGuardianId],
  );

  const handleGuardianModeChange = (mode: "new" | "existing") => {
    if (guardianMode === mode) {
      return;
    }
    guardianModeWasSetByUserRef.current = true;
    setGuardianMode(mode);
  };

  useEffect(() => {
    reset(defaultValues);
    guardianModeWasSetByUserRef.current = false;
    const desiredMode: "new" | "existing" = hasExistingGuardianDefault ? "existing" : "new";
    setGuardianMode((prev) => (prev === desiredMode ? prev : desiredMode));
  }, [defaultValues, reset, hasExistingGuardianDefault]);

  useEffect(() => {
    if (
      guardianOptions.length > 0 &&
      guardianMode === "new" &&
      !guardianModeWasSetByUserRef.current &&
      !hasExistingGuardianDefault
    ) {
      setGuardianMode("existing");
    }
    if (guardianOptions.length === 0 && guardianMode === "existing" && !hasExistingGuardianDefault) {
      setGuardianMode("new");
    }
  }, [guardianOptions, guardianMode, hasExistingGuardianDefault]);

  useEffect(() => {
    if (guardianMode === "new") {
      setValue("existingGuardianId", undefined);
    } else {
      setValue("guardianName", "");
      setValue("guardianPhone", "");
      setValue("guardianEmail", "");
    }
  }, [guardianMode, setValue]);

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

    if (guardianMode === "existing") {
      if (!formData.existingGuardianId || Number.isNaN(formData.existingGuardianId)) {
        setErrorMessage("Select an existing guardian.");
        setSubmitting(false);
        return;
      }
    } else {
      if (!formData.guardianEmail || !formData.guardianEmail.trim()) {
        setErrorMessage("Guardian email is required when adding a new guardian.");
        setSubmitting(false);
        return;
      }
    }

    if (type === "create" && (!formData.email || !formData.email.trim())) {
      setErrorMessage("Email is required to create a student account.");
      setSubmitting(false);
      return;
    }

    const rawPhoto = formData.photo;
    const normalisedPhoto =
      typeof rawPhoto === "string" && rawPhoto.trim().length > 0 ? rawPhoto.trim() : null;

    const payload: Record<string, unknown> = {
      studentId: formData.studentId.trim(),
      name: formData.name.trim(),
      email: formData.email?.trim() ?? "",
      address: formData.address?.trim() ?? "",
      photo: normalisedPhoto,
      dateOfBirth: formData.dateOfBirth,
      bloodType: formData.bloodType,
      grade: formData.grade,
      className: formData.className.trim(),
      category: formData.category,
      guardianName: guardianMode === "existing"
        ? ""
        : formData.guardianName?.trim() ?? "",
      guardianPhone: guardianMode === "existing"
        ? ""
        : formData.guardianPhone?.trim() ?? "",
      guardianEmail: guardianMode === "existing"
        ? ""
        : formData.guardianEmail?.trim() ?? "",
      guardianRelationship: formData.guardianRelationship?.trim() ?? "",
      schoolId: formData.schoolId,
      action: type,
    };

    if (guardianMode === "existing" && formData.existingGuardianId) {
      payload.existingGuardianId = formData.existingGuardianId;
    }

    if (type === "update") {
      payload.id = entityId;
    }

    try {
      const response = await postJSON<{ message?: string }>(
        "/api/students",
        payload,
      );
      const message = response?.message ?? "Student saved successfully.";
      setSuccessMessage(message);

      if (guardianMode === "new") {
        await refreshGuardians();
      }

      if (type === "create") {
        reset({
          studentId: "",
          name: "",
          email: "",
          address: "",
          photo: null,
          dateOfBirth: "",
          bloodType: bloodTypes[0],
          grade: 1,
          className: "",
          category: "General",
          guardianName: "",
          guardianPhone: "",
          guardianEmail: "",
          guardianRelationship: "",
          existingGuardianId: undefined,
          schoolId: canSwitch ? activeSchoolId : scopeId,
        });
        setGuardianMode("new");
        guardianModeWasSetByUserRef.current = false;
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
          label="Date of Birth"
          name="dateOfBirth"
          type="date"
          defaultValue={defaultValues.dateOfBirth}
          register={register}
          error={errors.dateOfBirth}
        />
        <div className="flex flex-col gap-2 w-full md:w-1/3">
          <label className="text-xs text-gray-500">Blood Type</label>
          <Controller
            control={control}
            name="bloodType"
            render={({ field }) => (
              <select
                className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value as Inputs["bloodType"])}
              >
                {bloodTypes.map((typeOption) => (
                  <option key={typeOption} value={typeOption}>
                    {typeOption}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.bloodType?.message && (
            <p className="text-xs text-red-400">{errors.bloodType.message.toString()}</p>
          )}
        </div>
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
              value={
                typeof field.value === "string" && field.value.trim().length > 0
                  ? field.value
                  : null
              }
              onChange={(value) => field.onChange(value ?? null)}
              disabled={submitting}
              helperText="JPEG, PNG, WEBP or GIF up to 5MB."
              error={errors.photo?.message?.toString() ?? null}
            />
          )}
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
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="guardian-mode"
              value="existing"
              checked={guardianMode === "existing"}
              onChange={() => handleGuardianModeChange("existing")}
              className="accent-lamaPurple"
              disabled={guardianOptions.length === 0 && !hasExistingGuardianDefault}
            />
            Use existing guardian
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="guardian-mode"
              value="new"
              checked={guardianMode === "new"}
              onChange={() => handleGuardianModeChange("new")}
              className="accent-lamaPurple"
            />
            Add a new guardian
          </label>
        </div>

        {guardiansError && <p className="text-xs text-red-400">{guardiansError}</p>}

        {guardianMode === "existing" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 w-full md:w-1/2">
              <label className="text-xs text-gray-500">Existing Guardian</label>
              <Controller
                control={control}
                name="existingGuardianId"
                render={({ field }) => (
                  <select
                    className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
                    value={field.value ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      field.onChange(value ? Number(value) : undefined);
                    }}
                    disabled={guardiansLoading || guardianOptions.length === 0}
                  >
                    <option value="">
                      {guardiansLoading ? "Loading guardians..." : "Select guardian"}
                    </option>
                    {guardianOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                        {option.email ? ` (${option.email})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.existingGuardianId?.message && (
                <p className="text-xs text-red-400">
                  {errors.existingGuardianId.message.toString()}
                </p>
              )}
            </div>
            {guardianOptions.length === 0 && !guardiansLoading && (
              <p className="text-xs text-gray-500">
                No guardians available yet. Switch to &quot;Add a new guardian&quot; to create one.
              </p>
            )}
            {selectedGuardian && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-700">{selectedGuardian.name}</p>
                <p>Email: {selectedGuardian.email ?? "N/A"}</p>
                <p>Phone: {selectedGuardian.phone ?? "N/A"}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-between flex-wrap gap-4">
            <InputField
              label="Guardian Name"
              name="guardianName"
              defaultValue={defaultValues.guardianName}
              register={register}
              error={errors.guardianName}
            />
            <InputField
              label="Guardian Email"
              name="guardianEmail"
              defaultValue={defaultValues.guardianEmail}
              register={register}
              error={errors.guardianEmail}
            />
            <InputField
              label="Guardian Phone"
              name="guardianPhone"
              defaultValue={defaultValues.guardianPhone}
              register={register}
              error={errors.guardianPhone}
            />
          </div>
        )}

        <InputField
          label="Relationship"
          name="guardianRelationship"
          defaultValue={defaultValues.guardianRelationship}
          register={register}
          error={errors.guardianRelationship}
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
