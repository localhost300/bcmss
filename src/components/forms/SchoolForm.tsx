"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { patchJSON, postJSON } from "@/lib/utils/api";

type SchoolFormState = {
  id?: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  principal: string;
  established: string;
  logo: string;
};

type ApiSchool = {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  principal: string;
  established: string;
  logo: string | null;
};

type SchoolFormProps = {
  type: "create" | "update";
  data?: Partial<SchoolFormState>;
  onSuccess?: (school: ApiSchool) => Promise<void> | void;
};

const defaultState: SchoolFormState = {
  id: "",
  name: "",
  code: "",
  address: "",
  city: "",
  state: "",
  country: "",
  phone: "",
  email: "",
  principal: "",
  established: "",
  logo: "",
};

const SchoolForm = ({ type, data, onSuccess }: SchoolFormProps) => {
  const initialState = useMemo(() => ({ ...defaultState, ...data }), [data]);

  const [formState, setFormState] = useState<SchoolFormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setFormState(initialState);
  }, [initialState]);

  const updateField =
    (field: keyof SchoolFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    const payload = {
      name: formState.name.trim(),
      code: formState.code.trim(),
      address: formState.address.trim(),
      city: formState.city.trim(),
      state: formState.state.trim(),
      country: formState.country.trim(),
      phone: formState.phone.trim(),
      email: formState.email.trim(),
      principal: formState.principal.trim(),
      established: formState.established.trim(),
      logo: formState.logo.trim() || null,
    };

    try {
      let response: { message?: string; data: ApiSchool };

      if (type === "create") {
        response = await postJSON<{ message?: string; data: ApiSchool }>(
          "/api/schools",
          payload,
        );
        setFormState(defaultState);
      } else {
        if (!formState.id) {
          throw new Error("Missing school id");
        }
        response = await patchJSON<{ message?: string; data: ApiSchool }>(
          `/api/schools/${formState.id}`,
          payload,
        );
      }

      const message = response?.message ?? "School saved successfully.";
      setSuccessMessage(message);
      await Promise.resolve(onSuccess?.(response.data));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save school.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fieldConfigs: Array<{
    name: keyof SchoolFormState;
    label: string;
    type?: string;
  }> = [
    { name: "name", label: "School Name" },
    { name: "code", label: "School Code" },
    { name: "principal", label: "Principal" },
    { name: "phone", label: "Phone" },
    { name: "email", label: "Email", type: "email" },
    { name: "established", label: "Established" },
    { name: "address", label: "Address" },
    { name: "city", label: "City" },
    { name: "state", label: "State" },
    { name: "country", label: "Country" },
    { name: "logo", label: "Logo URL", type: "url" },
  ];

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <h1 className="text-xl font-semibold">
        {type === "create" ? "Register a new school" : "Update school"}
      </h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {type === "update" && (
          <label className="flex flex-col gap-2 text-xs text-gray-500">
            <span>School ID</span>
            <input
              value={formState.id ?? ""}
              readOnly
              className="rounded-md bg-gray-100 p-2 text-sm ring-[1.5px] ring-gray-300"
            />
          </label>
        )}

        {fieldConfigs.map((field) => (
          <label
            key={field.name as string}
            className="flex flex-col gap-2 text-xs text-gray-500"
          >
            <span>{field.label}</span>
            <input
              value={(formState[field.name] as string) ?? ""}
              onChange={updateField(field.name)}
              required={field.name !== "logo"}
              className="rounded-md p-2 text-sm ring-[1.5px] ring-gray-300"
              type={field.type ?? "text"}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
        {successMessage && (
          <p className="text-sm text-green-600">{successMessage}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-400 p-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : type === "create" ? "Create" : "Update"}
        </button>
      </div>
    </form>
  );
};

export default SchoolForm;
