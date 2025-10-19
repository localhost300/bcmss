"use client";

import { useMemo, useState } from "react";
import { deleteJSON } from "@/lib/utils/api";

type TeacherDeleteFormProps = {
  id?: string | number;
  onSuccess?: () => Promise<void> | void;
};

const TeacherDeleteForm = ({ id, onSuccess }: TeacherDeleteFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const teacherId = useMemo(() => {
    if (typeof id === "string") {
      return id.trim();
    }
    if (typeof id === "number") {
      return String(id);
    }
    return undefined;
  }, [id]);

  if (!teacherId) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-500">Teacher id is missing.</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteJSON("/api/teachers/" + teacherId);
      await Promise.resolve(onSuccess?.());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete teacher.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="p-4 flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <span className="text-center font-medium">
        Deleting this teacher will revoke their access. Are you sure?
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

export default TeacherDeleteForm;
