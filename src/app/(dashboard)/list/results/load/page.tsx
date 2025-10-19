"use client";

import { useEffect, useMemo, useState } from "react";

import ScoreEntryTable from "@/components/results/ScoreEntryTable";
import { useResults, type ScoreSheetRow } from "@/contexts/ResultsContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";

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
    getClassError,
    getSubjectsForClass,
    getScoreSheets,
    updateScore,
    saveScores,
    gradeForPercentage,
    gradeForMidterm,
    getAvailableExamTypes,
  } = useResults();

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [examType, setExamType] = useState<ExamSelection>("final");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleScoreChange = (sheetId: string, componentId: string, value: number) => {
    updateScore(sheetId, componentId, value);
  };

  const handleSave = async () => {
    if (!selectedClass || !selectedSubject || !availableExamTypes.includes(examType)) return;
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
    ? isClassLoading({ classId: selectedClass, term, sessionId })
    : false;

  return (
    <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0 border border-gray-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Load Scores</h1>
          <p className="text-xs text-gray-500">
            Session {sessionId} | {term}
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
          {classOptionsLoading && <span className="mt-1 text-gray-400">Loading classes…</span>}
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
              <ScoreEntryTable
                rows={filteredRows}
                examType={examType}
                resolveGrade={resolveGrade}
                onScoreChange={handleScoreChange}
                onSave={handleSave}
                isSaving={isSaving}
              />
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












