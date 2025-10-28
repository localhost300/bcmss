"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useMemo, useState, type ComponentType } from "react";

type ModalAction = "create" | "update" | "delete";

type SupportedTable =
  | "teacher"
  | "student"
  | "school"
  | "parent"
  | "subject"
  | "class"
  | "lesson"
  | "exam"
  | "assignment"
  | "result"
  | "attendance"
  | "event"
  | "announcement"
  | "session"
  | "markDistribution";

type CrudFormProps = {
  type: Extract<ModalAction, "create" | "update">;
  data?: Record<string, unknown>;
  id?: string | number;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
};

type DeleteFormProps = {
  id?: string | number;
  onSuccess?: () => Promise<void> | void;
};

type FormModalProps = {
  table: SupportedTable;
  type: ModalAction;
  data?: Record<string, unknown>;
  id?: string | number;
  onSuccess?: (payload?: unknown) => Promise<void> | void;
};

const LoadingFallback = () => (
  <div className="flex items-center justify-center py-10 text-sm text-gray-500">Loading form...</div>
);

const TeacherForm = dynamic<CrudFormProps>(() => import("./forms/TeacherForm"), {
  loading: LoadingFallback,
  ssr: false,
});
const StudentForm = dynamic<CrudFormProps>(() => import("./forms/StudentForm"), {
  loading: LoadingFallback,
  ssr: false,
});
const SchoolForm = dynamic<CrudFormProps>(() => import("./forms/SchoolForm"), {
  loading: LoadingFallback,
  ssr: false,
});
const SubjectForm = dynamic<CrudFormProps>(() => import("./forms/SubjectForm"), {
  loading: LoadingFallback,
  ssr: false,
});
const ClassForm = dynamic<CrudFormProps>(() => import("./forms/ClassForm"), {
  loading: LoadingFallback,
  ssr: false,
});
const SessionForm = dynamic<CrudFormProps>(() => import("./forms/SessionForm"), {
  loading: LoadingFallback,
  ssr: false,
});
const ExamForm = dynamic<CrudFormProps>(() => import("./forms/ExamForm"), {
  loading: LoadingFallback,
  ssr: false,
});
const MarkDistributionForm = dynamic<CrudFormProps>(
  () => import("./forms/MarkDistributionForm"),
  { loading: LoadingFallback, ssr: false },
);

const SchoolDeleteForm = dynamic<DeleteFormProps>(
  () => import("./forms/SchoolDeleteForm"),
  { loading: LoadingFallback, ssr: false },
);
const ClassDeleteForm = dynamic<DeleteFormProps>(
  () => import("./forms/ClassDeleteForm"),
  { loading: LoadingFallback, ssr: false },
);
const SubjectDeleteForm = dynamic<DeleteFormProps>(
  () => import("./forms/SubjectDeleteForm"),
  { loading: LoadingFallback, ssr: false },
);
const StudentDeleteForm = dynamic<DeleteFormProps>(
  () => import("./forms/StudentDeleteForm"),
  { loading: LoadingFallback, ssr: false },
);
const TeacherDeleteForm = dynamic<DeleteFormProps>(
  () => import("./forms/TeacherDeleteForm"),
  { loading: LoadingFallback, ssr: false },
);
const SessionDeleteForm = dynamic<DeleteFormProps>(
  () => import("./forms/SessionDeleteForm"),
  { loading: LoadingFallback, ssr: false },
);
const ExamDeleteForm = dynamic<DeleteFormProps>(
  () => import("./forms/ExamDeleteForm"),
  { loading: LoadingFallback, ssr: false },
);
const MarkDistributionDeleteForm = dynamic<DeleteFormProps>(
  () => import("./forms/MarkDistributionDeleteForm"),
  { loading: LoadingFallback, ssr: false },
);

const FORM_REGISTRY: Partial<
  Record<
    SupportedTable,
    Partial<Record<Extract<ModalAction, "create" | "update">, ComponentType<CrudFormProps>>>
  >
> = {
  school: {
    create: SchoolForm,
    update: SchoolForm,
  },
  teacher: {
    create: TeacherForm,
    update: TeacherForm,
  },
  student: {
    create: StudentForm,
    update: StudentForm,
  },
  subject: {
    create: SubjectForm,
    update: SubjectForm,
  },
  class: {
    create: ClassForm,
    update: ClassForm,
  },
  exam: {
    create: ExamForm,
    update: ExamForm,
  },
  markDistribution: {
    create: MarkDistributionForm,
    update: MarkDistributionForm,
  },
  session: {
    create: SessionForm,
    update: SessionForm,
  },
};

const DELETE_FORM_REGISTRY: Partial<Record<SupportedTable, ComponentType<DeleteFormProps>>> = {
  school: SchoolDeleteForm,
  class: ClassDeleteForm,
  subject: SubjectDeleteForm,
  student: StudentDeleteForm,
  teacher: TeacherDeleteForm,
  session: SessionDeleteForm,
  exam: ExamDeleteForm,
  markDistribution: MarkDistributionDeleteForm,
};

const ICONS: Record<ModalAction, string> = {
  create: "/create.png",
  update: "/update.png",
  delete: "/delete.png",
};

const ACTION_LABELS: Record<ModalAction, string> = {
  create: "Add",
  update: "Edit",
  delete: "Delete",
};

const TABLE_LABELS: Record<SupportedTable, string> = {
  teacher: "teacher",
  student: "student",
  school: "school",
  parent: "parent",
  subject: "subject",
  class: "class",
  lesson: "lesson",
  exam: "exam",
  assignment: "assignment",
  result: "result",
  attendance: "attendance",
  event: "event",
  announcement: "announcement",
  session: "session",
  markDistribution: "mark distribution",
};

const TRIGGER_CLASSES: Record<ModalAction, string> = {
  create:
    "w-8 h-8 flex items-center justify-center rounded-full bg-lamaPurple text-gray-700 hover:bg-lamaPurpleLight focus:outline-none focus:ring-2 focus:ring-lamaPurple focus:ring-offset-2 transition-colors",
  update:
    "w-8 h-8 flex items-center justify-center rounded-full bg-lamaSky hover:bg-lamaSkyLight focus:outline-none focus:ring-2 focus:ring-lamaSky focus:ring-offset-2 transition-colors",
  delete:
    "w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 transition-colors",
};

const FormModal = ({ table, type, data, id, onSuccess }: FormModalProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const FormComponent =
    type === "delete"
      ? undefined
      : FORM_REGISTRY[table]?.[type as Extract<ModalAction, "create" | "update">];
  const DeleteComponent = type === "delete" ? DELETE_FORM_REGISTRY[table] : undefined;
  const formAvailable = Boolean(FormComponent ?? DeleteComponent);

  const tableLabel = TABLE_LABELS[table] ?? "item";
  const prettyTableLabel = useMemo(
    () => tableLabel.charAt(0).toUpperCase() + tableLabel.slice(1),
    [tableLabel],
  );

  const actionLabel = ACTION_LABELS[type];
  const modalTitle = actionLabel + " " + prettyTableLabel;
  const modalDescription =
    "Fill in the details below to " + actionLabel.toLowerCase() + " the " + tableLabel + ".";

  const handleFormSuccess = useCallback(
    async (payload?: unknown) => {
      try {
        await Promise.resolve(onSuccess?.(payload));
      } finally {
        setIsOpen(false);
      }
    },
    [onSuccess],
  );

  const crudFormProps = useMemo(() => {
    if (type === "delete") {
      return undefined;
    }
    const base: Record<string, unknown> = { type, onSuccess: handleFormSuccess };
    if (data !== undefined) {
      base.data = data;
    }
    if (id !== undefined) {
      base.id = id;
    }
    return base;
  }, [type, data, id, handleFormSuccess]);

  const deleteFormId = useMemo(() => {
    if (id === undefined) {
      return undefined;
    }
    return typeof id === "string" ? id : String(id);
  }, [id]);

  const deleteFormOnSuccess = useCallback(() => handleFormSuccess(undefined), [handleFormSuccess]);

  const triggerLabel = actionLabel + " " + tableLabel;
  const triggerTitle = formAvailable
    ? triggerLabel
    : "The " + tableLabel + " " + type + " form is not available yet.";
  const triggerClasses = formAvailable
    ? TRIGGER_CLASSES[type]
    : TRIGGER_CLASSES[type] + " opacity-60";

  return (
    <>
      <button
        type="button"
        className={triggerClasses}
        onClick={() => setIsOpen(true)}
        aria-disabled={!formAvailable}
        title={triggerTitle}
      >
        <Image src={ICONS[type]} alt="" width={16} height={16} />
        <span className="sr-only">{triggerLabel}</span>
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-full overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold capitalize">{modalTitle}</h2>
                <p className="text-xs text-gray-500">{modalDescription}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
              >
                <Image src="/close.png" alt="Close modal" width={14} height={14} />
                <span className="sr-only">Close modal</span>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-6">
              {type === "delete" && DeleteComponent ? (
                <DeleteComponent id={deleteFormId} onSuccess={deleteFormOnSuccess} />
              ) : FormComponent ? (
                <FormComponent {...(crudFormProps as CrudFormProps)} />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-gray-500">
                  <p>
                    {"The " + prettyTableLabel.toLowerCase() + " " + actionLabel.toLowerCase() +
                      " form is still being built."}
                  </p>
                  <p className="text-xs text-gray-400">
                    Please check back soon or contact support if you need this feature urgently.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FormModal;

