"use client";

import { useMemo, useState } from "react";
import { deleteJSON } from "@/lib/utils/api";

type StudentDeleteFormProps = {
  id?: string | number;
  onSuccess?: () => Promise<void> | void;
};

const StudentDeleteForm = ({ id, onSuccess }: StudentDeleteFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const studentId = useMemo(() => {
    if (typeof id === "string") {
      return id.trim();
    }
    if (typeof id === "number") {
      return String(id);
    }
    return undefined;
  }, [id]);

  if (!studentId) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-500">Student id is missing.</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteJSON("/api/students/" + studentId);
      await Promise.resolve(onSuccess?.());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete student.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="p-4 flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <span className="text-center font-medium">
        The student record and associated data will be removed. Proceed with deletion?
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

export default StudentDeleteForm;
