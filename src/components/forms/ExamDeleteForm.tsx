"use client";

import { useMemo, useState } from "react";
import { deleteJSON } from "@/lib/utils/api";

type ExamDeleteFormProps = {
  id?: string | number;
  onSuccess?: () => Promise<void> | void;
};

const ExamDeleteForm = ({ id, onSuccess }: ExamDeleteFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const examId = useMemo(() => {
    if (typeof id === "string") {
      return id.trim();
    }
    if (typeof id === "number") {
      return String(id);
    }
    return undefined;
  }, [id]);

  if (!examId) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-500">Exam id is missing.</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteJSON("/api/exams/" + examId);
      await Promise.resolve(onSuccess?.());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete exam.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="p-4 flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <span className="text-center font-medium">
        This exam will be removed from schedules and results. Are you sure?
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

export default ExamDeleteForm;
