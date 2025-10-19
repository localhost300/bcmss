"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { postJSON } from "@/lib/utils/api";

const schema = z.object({
  name: z.string().min(1, { message: "Session name is required!" }),
  startDate: z.string().min(1, { message: "Start date is required!" }),
  endDate: z.string().min(1, { message: "End date is required!" }),
  isCurrent: z.boolean().optional(),
});

type Inputs = z.infer<typeof schema>;

type SessionFormProps = {
  type: "create" | "update";
  data?: Partial<Inputs> & { id?: string | number };
  id?: string | number;
  onSuccess?: () => Promise<void> | void;
};

const SessionForm = ({ type, data, id, onSuccess }: SessionFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const rawEntityId = data?.id ?? id;
  const entityId = rawEntityId === undefined ? undefined : String(rawEntityId);

  const defaultValues = useMemo(
    () => ({
      name: data?.name ?? "",
      startDate: data?.startDate ?? "",
      endDate: data?.endDate ?? "",
      isCurrent: data?.isCurrent ?? false,
    }),
    [data],
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

  const onSubmit = handleSubmit(async (formData) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    if (type === "update" && (!entityId || entityId.trim() === "")) {
      setErrorMessage("Session id is missing.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      ...formData,
      action: type,
    };

    if (type === "update") {
      payload.id = entityId;
    }

    try {
      const response = await postJSON<{ message?: string }>("/api/sessions", payload);
      const message = response?.message ?? "Session saved successfully.";
      setSuccessMessage(message);

      if (type === "create") {
        reset({
          name: "",
          startDate: "",
          endDate: "",
          isCurrent: false,
        });
      }

      await Promise.resolve(onSuccess?.());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save session.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">
        {type === "create" ? "Create a new session" : "Update session"}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputFieldWithError
          label="Session Name"
          name="name"
          register={register}
          error={errors.name?.message}
          defaultValue={defaultValues.name}
        />
        <InputFieldWithError
          label="Start Date"
          name="startDate"
          type="date"
          register={register}
          error={errors.startDate?.message}
          defaultValue={defaultValues.startDate}
        />
        <InputFieldWithError
          label="End Date"
          name="endDate"
          type="date"
          register={register}
          error={errors.endDate?.message}
          defaultValue={defaultValues.endDate}
        />
        <label className="flex items-center gap-2 text-xs text-gray-500 mt-2">
          <input type="checkbox" {...register("isCurrent")} defaultChecked={defaultValues.isCurrent} />
          <span>Mark as current session</span>
        </label>
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

const InputFieldWithError = ({
  label,
  name,
  register,
  error,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: keyof Inputs;
  register: UseFormRegister<Inputs>;
  error?: string;
  defaultValue: string;
  type?: string;
}) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs text-gray-500">{label}</label>
    <input
      {...register(name)}
      defaultValue={defaultValue}
      type={type}
      className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm"
    />
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
);

export default SessionForm;




