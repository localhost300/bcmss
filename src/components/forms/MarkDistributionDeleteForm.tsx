"use client";

import { useMemo, useState } from "react";

import { invalidateMarkDistributionCache } from "@/lib/services/markDistributions";
import { deleteJSON } from "@/lib/utils/api";

type MarkDistributionDeleteFormProps = {
  id?: string | number;
  onSuccess?: () => Promise<void> | void;
};

const MarkDistributionDeleteForm = ({ id, onSuccess }: MarkDistributionDeleteFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const distributionId = useMemo(() => {
    if (typeof id === "string") {
      return id.trim();
    }
    if (typeof id === "number") {
      return String(id);
    }
    return undefined;
  }, [id]);

  if (!distributionId) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-500">Mark distribution id is missing.</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteJSON(`/api/exams/mark-distributions/${distributionId}`);
      invalidateMarkDistributionCache();
      await Promise.resolve(onSuccess?.());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete mark distribution.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-4 p-4" onSubmit={(event) => event.preventDefault()}>
      <span className="text-center text-sm text-gray-700">
        This mark distribution and its components will be permanently removed. Continue?
      </span>
      {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
      <button
        type="button"
        onClick={handleDelete}
        className="self-center rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        disabled={submitting}
      >
        {submitting ? "Deleting..." : "Delete"}
      </button>
    </form>
  );
};

export default MarkDistributionDeleteForm;
