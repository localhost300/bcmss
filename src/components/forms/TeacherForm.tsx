"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useSchool, useSchoolScope } from "@/contexts/SchoolContext";
import { postJSON } from "@/lib/utils/api";
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

const TeacherForm = ({ type, data, id, onSuccess }: TeacherFormProps) => {
  const { activeSchoolId, schools, canSwitch } = useSchool();
  const scopeId = useSchoolScope();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      photo: data?.photo ?? null,
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
