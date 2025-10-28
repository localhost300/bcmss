"use client";

import { useEffect, useMemo, useState } from "react";

import ScoreEntryTable from "@/components/results/ScoreEntryTable";
import { useAuth } from "@/contexts/AuthContext";
import { useResults, type ScoreComponentDefinition, type ScoreSheetRow } from "@/contexts/ResultsContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { postJSON } from "@/lib/utils/api";

type ExamSelection = "midterm" | "final";

const EXAM_TYPE_LABELS: Record<ExamSelection, string> = {
  final: "Final Exam (100%)",
  midterm: "Midterm (50%)",
};

const LoadScoresPage = () => {
  const [hydrated, setHydrated] = useState(false);

  const term = useTermScope();
  const sessionId = useSessionScope();

  const {
    classOptions,
    classOptionsLoading,
    classOptionsError,
    loadClassData,
    isClassLoading,
    isClassLoaded,
    getClassError,
    getSubjectsForClass,
    getScoreSheets,
    getScoreComponents,
    updateScore,
    saveScores,
    gradeForPercentage,
    gradeForMidterm,
    getAvailableExamTypes,
    getLockInfo,
  } = useResults();

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [examType, setExamType] = useState<ExamSelection>("final");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lockActionLoading, setLockActionLoading] = useState<Record<ExamSelection, boolean>>({
    midterm: false,
    final: false,
  });
  const [overrideInputs, setOverrideInputs] = useState<Record<ExamSelection, string>>({
    midterm: "",
    final: "",
  });
  const [lockActionError, setLockActionError] = useState<string | null>(null);
  const [lockActionMessage, setLockActionMessage] = useState<string | null>(null);

  const { user } = useAuth();
  const userRole = user?.role ?? "teacher";
  const teacherId = typeof user?.teacherId === "number" ? user.teacherId : null;
  const isAdmin = userRole === "admin";
  const isTeacher = userRole === "teacher";

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!selectedClass || !sessionId) return;
    void loadClassData({ classId: selectedClass, term, sessionId });
  }, [selectedClass, term, sessionId, loadClassData]);

  const availableExamTypes = useMemo(() => {
    if (!selectedClass) return [] as ExamSelection[];
    return getAvailableExamTypes({ classId: selectedClass, term, sessionId });
  }, [selectedClass, term, sessionId, getAvailableExamTypes]);

  useEffect(() => {
    if (!availableExamTypes.length) {
      return;
    }
    setExamType((prev) =>
      prev && availableExamTypes.includes(prev) ? prev : availableExamTypes[0],
    );
  }, [availableExamTypes]);

  const examOptions = useMemo(
    () => availableExamTypes.map((type) => ({ value: type, label: EXAM_TYPE_LABELS[type] })),
    [availableExamTypes],
  );

  const subjects = useMemo(() => {
    if (!selectedClass) return [];
    if (!availableExamTypes.includes(examType)) return [];
    return getSubjectsForClass({ classId: selectedClass, examType, term, sessionId });
  }, [selectedClass, examType, term, sessionId, availableExamTypes, getSubjectsForClass]);

  type LockInfoType = ReturnType<typeof getLockInfo>;

  const lockInfoMap = useMemo<Record<ExamSelection, LockInfoType>>(() => {
    const base: Record<ExamSelection, LockInfoType> = { midterm: null, final: null };
    if (!selectedClass) {
      return base;
    }
    availableExamTypes.forEach((type) => {
      base[type] = getLockInfo({ classId: selectedClass, term, sessionId, examType: type });
    });
    return base;
  }, [selectedClass, term, sessionId, availableExamTypes, getLockInfo]);

  const activeLock = lockInfoMap[examType];
  const teacherHasOverride = Boolean(
    isTeacher && teacherId != null && activeLock?.allowedTeacherIds.includes(teacherId),
  );

  const isReadOnly = useMemo(() => {
    if (!selectedClass) return true;
    if (isAdmin) return false;
    if (!isTeacher) return true;
    if (!activeLock?.isLocked) return false;
    return !teacherHasOverride;
  }, [selectedClass, isAdmin, isTeacher, activeLock, teacherHasOverride]);

  const lockMessage = useMemo(() => {
    if (!activeLock?.isLocked) return null;
    const lockedDate = activeLock.lockedAt ? new Date(activeLock.lockedAt) : null;
    const formatted = lockedDate ? lockedDate.toLocaleString() : null;
    if (isAdmin) {
      return `Published${formatted ? ` on ${formatted}` : ""}.`;
    }
    if (isTeacher) {
      return teacherHasOverride
        ? `Published${formatted ? ` on ${formatted}` : ""}. You have temporary edit access granted by an administrator.`
        : `Published${formatted ? ` on ${formatted}` : ""}. Contact an administrator to request changes.`;
    }
    return "Results have been published.";
  }, [activeLock, isAdmin, isTeacher, teacherHasOverride]);

  useEffect(() => {
    if (!subjects.length) {
      setSelectedSubject("");
      return;
    }
    setSelectedSubject((prev) => (prev && subjects.includes(prev) ? prev : subjects[0]));
  }, [subjects]);

  const sheets = useMemo(() => {
    if (!selectedClass || !selectedSubject) return [] as ScoreSheetRow[];
    return getScoreSheets({
      classId: selectedClass,
      subject: selectedSubject,
      examType,
      term,
      sessionId,
    });
  }, [selectedClass, selectedSubject, examType, term, sessionId, getScoreSheets]);

  const componentDefinitions = useMemo<ScoreComponentDefinition[]>(() => {
    if (!selectedClass || !selectedSubject || !sessionId) {
      return [];
    }
    return getScoreComponents({
      classId: selectedClass,
      subject: selectedSubject,
      examType,
      term,
      sessionId,
    });
  }, [
    selectedClass,
    selectedSubject,
    examType,
    term,
    sessionId,
    getScoreComponents,
  ]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sheets;
    return sheets.filter((row) => row.studentName.toLowerCase().includes(query));
  }, [sheets, searchTerm]);

  const resolveGrade = useMemo(() => {
    if (examType === "midterm") {
      return (row: ScoreSheetRow) =>
        gradeForMidterm(row.maxScore ? (row.totalScore / row.maxScore) * 50 : row.totalScore);
    }
    return (row: ScoreSheetRow) => gradeForPercentage(row.percentage);
  }, [examType, gradeForMidterm, gradeForPercentage]);

  const runLockMutation = async (
    targetExamType: ExamSelection,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => {
    if (!selectedClass || !sessionId) {
      setLockActionError("Select a class before updating publishing settings.");
      setLockActionMessage(null);
      return;
    }

    setLockActionError(null);
    setLockActionMessage(null);
    setLockActionLoading((prev) => ({ ...prev, [targetExamType]: true }));
    try {
      await postJSON("/api/results/locks", payload);
      setLockActionMessage(successMessage);
      await loadClassData({ classId: selectedClass, term, sessionId });
    } catch (error) {
      setLockActionError(
        error instanceof Error ? error.message : "Unable to update publishing settings.",
      );
    } finally {
      setLockActionLoading((prev) => ({ ...prev, [targetExamType]: false }));
    }
  };

  const handleLockAction = async (targetExamType: ExamSelection, intent: "lock" | "unlock") => {
    if (!selectedClass || !sessionId) {
      setLockActionError("Select a class before updating publishing settings.");
      setLockActionMessage(null);
      return;
    }
    const label = EXAM_TYPE_LABELS[targetExamType];
    const action = intent === "lock" ? "lock" : "unlock";
    await runLockMutation(
      targetExamType,
      {
        action,
        classId: selectedClass,
        sessionId,
        term,
        examType: targetExamType,
      },
      intent === "lock"
        ? `${label} published successfully.`
        : `${label} reverted to draft.`,
    );
  };

  const handleRevokeOverride = async (targetExamType: ExamSelection, teacherId: number) => {
    if (!selectedClass || !sessionId) {
      setLockActionError("Select a class before updating overrides.");
      setLockActionMessage(null);
      return;
    }
    await runLockMutation(
      targetExamType,
      {
        action: "revokeOverride",
        classId: selectedClass,
        sessionId,
        term,
        examType: targetExamType,
        teacherId,
      },
      `Override removed for teacher #${teacherId}.`,
    );
  };
  const handleGrantOverride = async (targetExamType: ExamSelection) => {
    if (!selectedClass || !sessionId) {
      setLockActionError("Select a class before granting overrides.");
      setLockActionMessage(null);
      return;
    }
    const rawValue = overrideInputs[targetExamType] ?? "";
    const trimmed = rawValue.trim();
    const teacherId = Number.parseInt(trimmed, 10);
    if (!trimmed || !Number.isFinite(teacherId) || teacherId <= 0) {
      setLockActionError("Enter a valid teacher ID to grant access.");
      setLockActionMessage(null);
      return;
    }
    await runLockMutation(
      targetExamType,
      {
        action: "grantOverride",
        classId: selectedClass,
        sessionId,
        term,
        examType: targetExamType,
        teacherId,
      },
      `Override granted for teacher #${teacherId}.`,
    );
    setOverrideInputs((prev) => ({ ...prev, [targetExamType]: "" }));
  };
  const handleScoreChange = (sheetId: string, componentId: string, value: number) => {
    if (isReadOnly) {
      return;
    }
    updateScore(sheetId, componentId, value);
  };

  const handleSave = async () => {
    if (
      isReadOnly ||
      !selectedClass ||
      !selectedSubject ||
      !availableExamTypes.includes(examType)
    ) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const message = await saveScores(
        {
          classId: selectedClass,
          subject: selectedSubject,
          examType,
          term,
          sessionId,
        },
        sheets,
      );
      setSaveMessage(message ?? "Scores saved successfully.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save scores.");
    } finally {
      setIsSaving(false);
    }
  };

  const classError = selectedClass
    ? getClassError({ classId: selectedClass, term, sessionId })
    : null;

  if (!hydrated) {
    return null;
  }

  if (!hydrated) {
    return null;
  }

  const loadingClasses = selectedClass
    ? isClassLoading({ classId: selectedClass, term, sessionId }) &&
      !isClassLoaded({ classId: selectedClass, term, sessionId })
    : false;

  return (
    <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0 border border-gray-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Load Scores</h1>
          <p className="text-xs text-gray-500">
            Session {sessionId} • {term}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col text-xs text-gray-500">
            <label htmlFor="exam-type" className="mb-1 font-medium">
              Exam Type
            </label>
            <select
              id="exam-type"
              value={examType}
              onChange={(event) =>
                setExamType(event.target.value as "midterm" | "final")
              }
              className="ring-[1.5px] ring-gray-300 rounded-md px-3 py-2"
            >
              {examOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {!examOptions.length && (
              <span className="mt-1 text-[11px] text-red-500">
                Schedule an exam for this class to enable score entry.
              </span>
            )}
          </div>
          <div className="flex flex-col text-xs text-gray-500">
            <label htmlFor="score-search" className="mb-1 font-medium">
              Search Student
            </label>
            <input
              id="score-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Type a name"
              className="ring-[1.5px] ring-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-6">
        <div className="flex flex-col text-xs text-gray-500 min-w-[200px]">
          <label htmlFor="class-select" className="mb-1 font-medium">
            Class
          </label>
          <select
            id="class-select"
            value={selectedClass}
            onChange={(event) => {
              setSelectedClass(event.target.value);
              setSearchTerm("");
              setSelectedSubject("");
            }}
            className="ring-[1.5px] ring-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Select class</option>
            {classOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          {classOptionsLoading && <span className="mt-1 text-gray-400">Loading classesâ€¦</span>}
          {classOptionsError && (
            <span className="mt-1 text-red-500 text-xs">{classOptionsError}</span>
          )}
        </div>
        <div className="flex flex-col text-xs text-gray-500 min-w-[200px]">
          <label htmlFor="subject-select" className="mb-1 font-medium">
            Subject
          </label>
          <select
            id="subject-select"
            value={selectedSubject}
            onChange={(event) => setSelectedSubject(event.target.value)}
            disabled={!subjects.length}
            className="ring-[1.5px] ring-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
          >
            {!subjects.length && <option value="">No subjects</option>}
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isAdmin && selectedClass && (
        <div className="mt-6 space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Publishing Controls</h2>
            <span className="text-xs text-gray-500">Session {sessionId} • {term}</span>
          </div>
          {availableExamTypes.length === 0 ? (
            <p className="text-xs text-gray-500">
              Schedule an exam for this class to enable publishing.
            </p>
          ) : (
            availableExamTypes.map((type) => {
              const lock = lockInfoMap[type];
              const published = lock?.isLocked ?? false;
              const overrides = lock?.allowedTeacherIds ?? [];
              const lockedAtLabel = lock?.lockedAt ? new Date(lock.lockedAt).toLocaleString() : null;
              return (
                <div
                  key={type}
                  className="rounded-md border border-gray-200 bg-white px-3 py-3 space-y-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {EXAM_TYPE_LABELS[type]}
                      </p>
                      <p className="text-xs text-gray-500">
                        Status: {published ? "Published" : "Draft"}
                        {published && lockedAtLabel ? ` · ${lockedAtLabel}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {published ? (
                        <button
                          type="button"
                          className="rounded-md bg-red-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                          onClick={() => void handleLockAction(type, "unlock")}
                          disabled={lockActionLoading[type]}
                        >
                          {lockActionLoading[type] ? "Processing..." : "Unpublish"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-md bg-lamaSky px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                          onClick={() => void handleLockAction(type, "lock")}
                          disabled={lockActionLoading[type]}
                        >
                          {lockActionLoading[type] ? "Processing..." : "Publish"}
                        </button>
                      )}
                    </div>
                  </div>
                  {published && (
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex flex-col gap-1 sm:flex-row sm:items-center">
                          <span className="font-semibold text-gray-700">Grant teacher access</span>
                          <input
                            type="number"
                            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs sm:ml-3 sm:w-40"
                            value={overrideInputs[type] ?? ""}
                            onChange={(event) =>
                              setOverrideInputs((prev) => ({
                                ...prev,
                                [type]: event.target.value,
                              }))
                            }
                            placeholder="Teacher ID"
                            disabled={lockActionLoading[type]}
                          />
                        </label>
                        <button
                          type="button"
                          className="rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                          onClick={() => void handleGrantOverride(type)}
                          disabled={lockActionLoading[type]}
                        >
                          {lockActionLoading[type] ? "Processing..." : "Grant"}
                        </button>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-700">Overrides</p>
                        {overrides.length ? (
                          <ul className="mt-1 flex flex-wrap gap-2">
                            {overrides.map((id) => (
                              <li
                                key={id}
                                className="flex items-center gap-1 rounded border border-gray-200 bg-gray-100 px-2 py-1"
                              >
                                <span>Teacher #{id}</span>
                                <button
                                  type="button"
                                  className="text-xs text-red-500 hover:underline"
                                  onClick={() => void handleRevokeOverride(type, id)}
                                  disabled={lockActionLoading[type]}
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500">No teacher overrides.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {lockActionError && <p className="text-xs text-red-500">{lockActionError}</p>}
          {lockActionMessage && <p className="text-xs text-green-600">{lockActionMessage}</p>}
        </div>
      )}
      <div className="mt-6">
        {classError && (
          <div className="mb-4 text-sm text-red-500 border border-red-200 bg-red-50 rounded-md px-4 py-3">
            {classError}
          </div>
        )}

        {selectedClass && selectedSubject ? (
          <div className="space-y-3">
            {loadingClasses ? (
              <div className="text-sm text-gray-500 text-center py-8">Loading scores…</div>
            ) : (
              <>
                {lockMessage && (
                  <div
                    className={`text-xs ${
                      isReadOnly ? "text-red-600" : "text-gray-500"
                    } border border-dashed border-gray-300 rounded-md px-3 py-2`}
                  >
                    {lockMessage}
                  </div>
                )}
                {componentDefinitions.length ? (
                  <ScoreEntryTable
                    rows={filteredRows}
                    examType={examType}
                    components={componentDefinitions}
                    resolveGrade={resolveGrade}
                    onScoreChange={handleScoreChange}
                    onSave={handleSave}
                    isSaving={isSaving}
                    readOnly={isReadOnly}
                  />
                ) : (
                  <div className="text-sm text-amber-700 border border-amber-200 bg-amber-50 rounded-md px-4 py-3 text-center">
                    No components found. Check Mark Distribution settings.
                  </div>
                )}
              </>
            )}
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            {!saveError && saveMessage && (
              <p className="text-sm text-green-600">{saveMessage}</p>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-md p-8 text-center">
            Choose a class and subject to begin recording scores for this session and term.
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadScoresPage;


























