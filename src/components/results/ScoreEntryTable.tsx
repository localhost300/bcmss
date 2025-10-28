"use client";

import { useMemo, type ChangeEvent } from "react";
import { type ScoreSheetRow } from "@/contexts/ResultsContext";
import { gradeColors, type GradeSummary } from "@/lib/grades";

export type ScoreEntryTableProps = {
  rows: ScoreSheetRow[];
  examType: "midterm" | "final";
  resolveGrade: (row: ScoreSheetRow) => GradeSummary;
  onScoreChange: (sheetId: string, componentId: string, value: number) => void;
  onSave: () => void;
  isSaving?: boolean;
  readOnly?: boolean;
};

const componentKey = (componentId: string) => componentId;

const ScoreEntryTable = ({
  rows,
  examType,
  resolveGrade,
  onScoreChange,
  onSave,
  isSaving,
  readOnly = false,
}: ScoreEntryTableProps) => {
  const componentHeaders = useMemo(() => {
    const headerMap = new Map<
      string,
      { componentId: string; label: string; maxScore: number | null | undefined; order: number }
    >();

    rows.forEach((row) => {
      row.components.forEach((component, index) => {
        const existing = headerMap.get(component.componentId);
        if (existing) {
          const nextOrder = Math.min(existing.order, index);
          const maxScore =
            existing.maxScore == null && component.maxScore != null
              ? component.maxScore
              : existing.maxScore;
          if (nextOrder !== existing.order || maxScore !== existing.maxScore) {
            headerMap.set(component.componentId, {
              componentId: component.componentId,
              label: existing.label || component.label,
              maxScore,
              order: nextOrder,
            });
          }
        } else {
          headerMap.set(component.componentId, {
            componentId: component.componentId,
            label: component.label,
            maxScore: component.maxScore,
            order: index,
          });
        }
      });
    });

    return Array.from(headerMap.values()).sort((a, b) => a.order - b.order);
  }, [rows]);

  if (!rows.length) {
    return <div className="text-sm text-gray-500 text-center py-8">No students found for this selection.</div>;
  }

  const totalsLabel = examType === "midterm" ? "Total (50)" : "Total (100)";

  return (
    <div className="bg-white rounded-md border border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F8FA] text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-4 py-3">Student</th>
              {componentHeaders.map((component) => (
                <th key={componentKey(component.componentId)} className="px-4 py-3 text-center">
                  {component.label}
                  <span className="block text-[10px] text-gray-400">
                    /{component.maxScore ?? "?"}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-center">{totalsLabel}</th>
              <th className="px-4 py-3 text-center">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const grade = resolveGrade(row);
              const gradeColor = gradeColors[grade.grade] ?? "text-gray-600";
              const totalDisplay = examType === "midterm"
                ? row.totalScore + " / " + row.maxScore
                : row.percentage + "%";

              return (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-lamaPurpleLight/30">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex flex-col">
                      <span>{row.studentName}</span>
                      <span className="text-[10px] text-gray-400">{row.subject}</span>
                    </div>
                  </td>
                  {componentHeaders.map((header) => {
                    const component =
                      row.components.find(
                        (candidate) => candidate.componentId === header.componentId,
                      ) ?? null;
                    const isMidtermCarry =
                      examType === "final" && header.componentId === "midtermCarry";
                    const value = component?.score ?? 0;
                    const maxScore = header.maxScore ?? component?.maxScore ?? undefined;

                    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
                      if (isMidtermCarry) {
                        return;
                      }
                      const nextValue = Number(event.target.value);
                      onScoreChange(row.id, header.componentId, Number.isFinite(nextValue) ? nextValue : 0);
                    };

                    return (
                      <td key={componentKey(header.componentId)} className="px-4 py-3">
                        <input
                          type="number"
                          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                          min={0}
                          max={maxScore ?? undefined}
                          value={value}
                          disabled={readOnly || isMidtermCarry}
                          title={
                            isMidtermCarry
                              ? "Auto-filled from midterm performance."
                              : undefined
                          }
                          onChange={handleChange}
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-semibold">{totalDisplay}</td>
                  <td className="px-4 py-3 text-center text-xs">
                    <span className={`font-semibold ${gradeColor}`}>{grade.grade}</span>
                    <span className="block text-[10px] text-gray-400">{grade.remark}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end px-4 py-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onSave}
          className="bg-lamaSky text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
          disabled={isSaving || readOnly}
        >
          {isSaving ? "Saving..." : "Save Scores"}
        </button>
      </div>
      {readOnly && (
        <div className="px-4 pb-4 text-xs text-gray-500 text-right">
          Results are locked. Editing is disabled.
        </div>
      )}
    </div>
  );
};

export default ScoreEntryTable;
