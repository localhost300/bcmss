export type GradeBand = {
  grade: string;
  remark: string;
  min: number;
};

export const gradeBands: GradeBand[] = [
  { grade: "A1", remark: "Excellent", min: 75 },
  { grade: "B2", remark: "Very Good", min: 70 },
  { grade: "B3", remark: "Good", min: 65 },
  { grade: "C4", remark: "Credit", min: 60 },
  { grade: "C5", remark: "Credit", min: 55 },
  { grade: "C6", remark: "Credit", min: 50 },
  { grade: "D7", remark: "Pass", min: 45 },
  { grade: "E8", remark: "Pass", min: 40 },
  { grade: "F9", remark: "Fail", min: 0 },
];
export const gradeColors: Record<string, string> = {
  A1: "text-green-600",
  B2: "text-green-500",
  B3: "text-blue-600",
  C4: "text-blue-500",
  C5: "text-blue-400",
  C6: "text-yellow-600",
  D7: "text-orange-600",
  E8: "text-orange-500",
  F9: "text-red-600",
};

export type GradeSummary = {
  grade: string;
  remark: string;
};

export const clampScore = (score: number) => {
  if (Number.isNaN(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
};

export const getGradeForScore = (score: number): GradeSummary => {
  const normalised = clampScore(score);
  const band =
    gradeBands.find((item) => normalised >= item.min) ?? gradeBands[gradeBands.length - 1];
  return { grade: band.grade, remark: band.remark };
};

export const getGradeForMidtermScore = (scoreOutOfFifty: number): GradeSummary => {
  const percentage = (scoreOutOfFifty / 50) * 100;
  return getGradeForScore(percentage);
};

