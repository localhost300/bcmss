export const PSYCHOMOTOR_TRAITS = [
  { key: "accuracy", label: "Accuracy" },
  { key: "arts_and_craft", label: "Arts and Craft" },
  { key: "dexterity", label: "Dexterity" },
  { key: "punctuality", label: "Punctuality" },
  { key: "musical_skills", label: "Musical Skills" },
  { key: "handwriting", label: "Handwriting" },
] as const;

export const AFFECTIVE_TRAITS = [
  { key: "neatness", label: "Neatness" },
  { key: "initiative", label: "Initiative" },
  { key: "honesty", label: "Honesty" },
  { key: "friendship", label: "Friendship" },
  { key: "diligence", label: "Diligence" },
  { key: "creativity", label: "Creativity" },
  { key: "concentration", label: "Concentration" },
  { key: "cooperative", label: "Co-operative" },
  { key: "attendance", label: "Attendance" },
  { key: "behaviour", label: "Behaviour" },
] as const;

export const TRAIT_SCORE_OPTIONS = [
  { value: 5, label: "5", description: "Excellent" },
  { value: 4, label: "4", description: "High level" },
  { value: 3, label: "3", description: "Acceptable level" },
  { value: 2, label: "2", description: "Minimal level" },
  { value: 1, label: "1", description: "No observable trait" },
] as const;

export type TraitScoreValue = (typeof TRAIT_SCORE_OPTIONS)[number]["value"];

export const TRAIT_CATEGORY_LABELS: Record<string, string> = {
  psychomotor: "Psychomotor",
  affective: "Affective",
};
