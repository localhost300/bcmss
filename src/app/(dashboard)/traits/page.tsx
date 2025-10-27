"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useAuth } from "@/contexts/AuthContext";
import { useSchoolScope } from "@/contexts/SchoolContext";
import { useSession } from "@/contexts/SessionContext";
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_TRAITS,
  TRAIT_CATEGORY_LABELS,
  TRAIT_SCORE_OPTIONS,
} from "@/lib/constants/traits";
import { getJSON } from "@/lib/utils/api";

type ClassListResponse = {
  items: Array<{
    id: number;
    name: string;
    grade: string;
    schoolId: string;
  }>;
};

type StudentListResponse = {
  items: Array<{
    id: number;
    studentId: string;
    name: string;
    classId: number | null;
    className: string | null;
  }>;
};

type TraitRecord = {
  id: string;
  studentId: string;
  term: string;
  session: string;
  category: string;
  trait: string;
  score: number;
  createdBy: string;
  createdAt: string;
};

const TRAIT_SECTIONS = [
  {
    category: "psychomotor",
    title: "Psychomotor Traits",
    traits: PSYCHOMOTOR_TRAITS,
  },
  {
    category: "affective",
    title: "Affective Traits",
    traits: AFFECTIVE_TRAITS,
  },
] as const;

const buildTraitKey = (category: string, traitLabel: string) => `${category}:${traitLabel}`;

const buildInitialScores = () => {
  const base: Record<string, number> = {};
  TRAIT_SECTIONS.forEach((section) => {
    section.traits.forEach((trait) => {
      base[buildTraitKey(section.category, trait.label)] = 0;
    });
  });
  return base;
};

export default function TraitRatingPage() {
  const { user } = useAuth();
  const schoolScope = useSchoolScope();
  const { sessions, activeSessionId, terms, activeTerm } = useSession();

  const [classOptions, setClassOptions] = useState<ClassListResponse["items"]>([]);
  const [studentOptions, setStudentOptions] = useState<StudentListResponse["items"]>([]);

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>(activeSessionId);
  const [selectedTerm, setSelectedTerm] = useState<string>(activeTerm);

  const [traitScores, setTraitScores] = useState<Record<string, number>>(buildInitialScores);
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTraits, setLoadingTraits] = useState(false);
  const [initialised, setInitialised] = useState(false);

  const canAccess = useMemo(() => user?.role === "admin" || user?.role === "teacher", [user]);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [sessions, selectedSessionId],
  );

  useEffect(() => {
    setSelectedSessionId(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    setSelectedTerm(activeTerm);
  }, [activeTerm]);

  useEffect(() => {
    if (!canAccess) {
      return;
    }

    const fetchClasses = async () => {
      try {
        const searchParams = new URLSearchParams({
          pageSize: "200",
        });
        if (schoolScope) {
          searchParams.append("schoolId", schoolScope);
        }
        const data = await getJSON<ClassListResponse>(`/api/classes?${searchParams.toString()}`);
        setClassOptions(data.items ?? []);
        setSelectedClassId((prev) => {
          if (!data.items?.length) {
            return null;
          }
          if (prev && data.items.some((item) => item.id === prev)) {
            return prev;
          }
          return data.items[0].id;
        });
      } catch (error) {
        console.error("[Traits] Unable to load classes", error);
        toast.error(error instanceof Error ? error.message : "Unable to load classes.");
      }
    };

    void fetchClasses();
  }, [canAccess, schoolScope]);

  useEffect(() => {
    if (!canAccess || selectedClassId == null) {
      setStudentOptions([]);
      setSelectedStudentId("");
      return;
    }

    const fetchStudents = async () => {
      try {
        setLoadingStudents(true);
        const data = await getJSON<StudentListResponse>(
          `/api/students?pageSize=200&classId=${selectedClassId}`,
        );
        setStudentOptions(data.items ?? []);
        if (data.items?.length) {
          setSelectedStudentId((prev) => {
            if (prev && data.items.some((student) => student.studentId === prev)) {
              return prev;
            }
            return data.items[0].studentId;
          });
        } else {
          setSelectedStudentId("");
        }
      } catch (error) {
        console.error("[Traits] Unable to load students", error);
        toast.error(error instanceof Error ? error.message : "Unable to load students.");
      } finally {
        setLoadingStudents(false);
      }
    };

    void fetchStudents();
  }, [canAccess, selectedClassId]);

  useEffect(() => {
    if (!selectedStudentId || !selectedTerm || !selectedSession?.name) {
      setTraitScores(buildInitialScores());
      return;
    }

    const fetchTraits = async () => {
      try {
        setLoadingTraits(true);
        setInitialised(false);
        const query = new URLSearchParams({
          term: selectedTerm,
          session: selectedSession.name,
        });
        const data = await getJSON<{
          records: TraitRecord[];
        }>(`/api/traits/student/${selectedStudentId}?${query.toString()}`);

        const nextScores = buildInitialScores();
        data.records?.forEach((record) => {
          const key = buildTraitKey(record.category, record.trait);
          nextScores[key] = record.score;
        });
        setTraitScores(nextScores);
      } catch (error) {
        console.error("[Traits] Unable to load existing ratings", error);
        setTraitScores(buildInitialScores());
        toast.error(error instanceof Error ? error.message : "Unable to load existing ratings.");
      } finally {
        setLoadingTraits(false);
        setInitialised(true);
      }
    };

    void fetchTraits();
  }, [selectedStudentId, selectedTerm, selectedSession?.name]);

  const handleScoreChange = (category: string, traitLabel: string, score: number) => {
    setTraitScores((prev) => ({
      ...prev,
      [buildTraitKey(category, traitLabel)]: score,
    }));
  };

  const handleSubmit = async () => {
    if (!selectedStudentId) {
      toast.error("Please select a student.");
      return;
    }
    if (!selectedSession?.name) {
      toast.error("Please select a session.");
      return;
    }
    if (!selectedTerm) {
      toast.error("Please select a term.");
      return;
    }

    const missingTraits: string[] = [];
    const ratings = TRAIT_SECTIONS.flatMap((section) =>
      section.traits.map((trait) => {
        const key = buildTraitKey(section.category, trait.label);
        const score = traitScores[key] ?? 0;
        if (!score) {
          missingTraits.push(`${section.title}: ${trait.label}`);
        }
        return {
          category: section.category,
          trait: trait.label,
          score,
        };
      }),
    );

    if (missingTraits.length > 0) {
      toast.error(`Please rate all traits before submitting.`);
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/traits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: selectedStudentId,
          term: selectedTerm,
          session: selectedSession.name,
          ratings,
        }),
      });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorBody?.message ?? "Unable to save trait ratings.");
      }

      toast.success("Trait ratings saved successfully.");
    } catch (error) {
      console.error("[Traits] Failed to save ratings", error);
      toast.error(error instanceof Error ? error.message : "Unable to save trait ratings.");
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-4">Student Trait Ratings</h1>
        <p className="text-gray-600">
          You do not have permission to access the student trait rating module.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Student Trait Ratings</h1>
          <p className="text-sm text-gray-500">
            Capture psychomotor and affective ratings for continuous assessment and report cards.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col text-sm text-gray-600">
            Class
            <select
              className="mt-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
              value={selectedClassId ?? ""}
              onChange={(event) => setSelectedClassId(Number(event.target.value) || null)}
              disabled={classOptions.length === 0}
            >
              {classOptions.length === 0 && <option value="">No class available</option>}
              {classOptions.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-gray-600">
            Student
            <select
              className="mt-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky disabled:bg-gray-100"
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              disabled={studentOptions.length === 0 || loadingStudents}
            >
              {studentOptions.length === 0 && <option value="">No student available</option>}
              {studentOptions.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-gray-600">
            Session
            <select
              className="mt-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-gray-600">
            Term
            <select
              className="mt-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-lamaSky focus:outline-none focus:ring-1 focus:ring-lamaSky"
              value={selectedTerm}
              onChange={(event) => setSelectedTerm(event.target.value)}
            >
              {terms.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Rating Scale</h2>
          <p className="text-sm text-gray-500">
            Click a score (1-5) to rate each trait. All traits must be scored before submission.
          </p>
        </div>
        <div className="grid gap-3 px-4 py-3 md:grid-cols-5">
          {TRAIT_SCORE_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600"
            >
              <span className="font-semibold text-gray-800">{option.value}</span> – {option.description}
            </div>
          ))}
        </div>
      </div>

      {TRAIT_SECTIONS.map((section) => (
        <div key={section.category} className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-lg font-semibold text-gray-800">{section.title}</h3>
            <p className="text-sm text-gray-500">
              Rate each trait based on observed behaviour and performance.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {section.traits.map((trait) => {
              const key = buildTraitKey(section.category, trait.label);
              const value = traitScores[key] ?? 0;
              return (
                <div
                  key={trait.key}
                  className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <h4 className="font-medium text-gray-800">{trait.label}</h4>
                    <p className="text-sm text-gray-500">
                      {TRAIT_CATEGORY_LABELS[section.category] ?? "Trait"} rating out of 5.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {TRAIT_SCORE_OPTIONS.map((option) => {
                      const active = option.value === value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleScoreChange(section.category, trait.label, option.value)}
                          className={[
                            "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                            active
                              ? "border-lamaSky bg-lamaSky text-white"
                              : "border-gray-200 bg-white text-gray-600 hover:border-lamaSky hover:text-lamaSky",
                          ].join(" ")}
                          disabled={loadingTraits && !initialised}
                          aria-pressed={active}
                        >
                          {option.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || loadingStudents || loadingTraits}
          className="inline-flex items-center justify-center rounded-md bg-lamaSky px-5 py-2.5 font-semibold text-white transition hover:bg-lamaSkyDark disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {saving ? "Saving..." : "Save Ratings"}
        </button>
      </div>
    </div>
  );
}
