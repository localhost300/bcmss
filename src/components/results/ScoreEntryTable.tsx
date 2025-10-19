"use client";

import { useMemo } from "react";
import { type ScoreSheetRow } from "@/contexts/ResultsContext";
import { type GradeSummary } from "@/lib/grades";

export type ScoreEntryTableProps = {
  rows: ScoreSheetRow[];
  examType: "midterm" | "final";
  resolveGrade: (row: ScoreSheetRow) => GradeSummary;
  onScoreChange: (sheetId: string, componentId: string, value: number) => void;
  onSave: () => void;
  isSaving?: boolean;
};

const componentKey = (componentId: string) => componentId;

const ScoreEntryTable = ({ rows, examType, resolveGrade, onScoreChange, onSave, isSaving }: ScoreEntryTableProps) => {
  const componentHeaders = useMemo(() => {
    const firstRow = rows[0];
    if (!firstRow) {
      return [] as ScoreSheetRow["components"];
    }
    return firstRow.components;
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
                  <span className="block text-[10px] text-gray-400">/{component.maxScore}</span>
                </th>
              ))}
              <th className="px-4 py-3 text-center">{totalsLabel}</th>
              <th className="px-4 py-3 text-center">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const grade = resolveGrade(row);
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
                  {row.components.map((component) => (
                    <td key={componentKey(component.componentId)} className="px-4 py-3">
                      <input
                        type="number"
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                        min={0}
                        max={component.maxScore ?? undefined}
                        value={component.score}
                        onChange={(event) =>
                          onScoreChange(row.id, component.componentId, Number(event.target.value) || 0)
                        }
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-semibold">{totalDisplay}</td>
                  <td className="px-4 py-3 text-center text-xs">
                    <span className="font-semibold">{grade.grade}</span>
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
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save Scores"}
        </button>
      </div>
    </div>
  );
};

export default ScoreEntryTable;
