"use client";

import { useMemo, useState } from "react";
import { deleteJSON } from "@/lib/utils/api";
type SchoolDeleteFormProps = {
  id?: string | number;
  onSuccess?: () => Promise<void> | void;
};

const SchoolDeleteForm = ({ id, onSuccess }: SchoolDeleteFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!id) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-500">School id is missing.</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteJSON(`/api/schools/${id}`);
      await Promise.resolve(onSuccess?.());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete school.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="p-4 flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <span className="text-center font-medium">
        All data will be lost. Are you sure you want to delete this school?
      </span>
      {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
      <button
        onClick={handleDelete}
        className="bg-red-700 text-white py-2 px-4 rounded-md border-none w-max self-center disabled:opacity-60"
        disabled={submitting}
      >
        {submitting ? "Deleting..." : "Delete"}
      </button>
    </form>
  );
};

export default SchoolDeleteForm;

