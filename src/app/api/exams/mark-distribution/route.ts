import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

const normaliseExamType = (value: string | null): "midterm" | "final" | undefined => {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (normalised === "midterm") return "midterm";
  if (normalised === "final") return "final";
  return undefined;
};

const parseComponents = (
  components: Prisma.JsonValue,
): Array<{ id: string; label: string; maxScore: number | null }> => {
  if (!Array.isArray(components)) return [];

  return components.map((entry, index) => {
    const record = entry as Record<string, unknown>;
    const rawId = record.componentId;
    const rawLabel = record.label;

    const idCandidate =
      typeof rawId === "string" && rawId.trim().length > 0
        ? rawId.trim()
        : typeof rawId === "number" && Number.isFinite(rawId)
        ? `component-${rawId}`
        : typeof rawLabel === "string" && rawLabel.trim().length > 0
        ? rawLabel.trim()
        : `component-${index}`;

    const label =
      typeof rawLabel === "string" && rawLabel.trim().length > 0 ? rawLabel.trim() : idCandidate;

    const maxScoreValue = record.maxScore;
    const maxScore =
      typeof maxScoreValue === "number" && Number.isFinite(maxScoreValue) ? maxScoreValue : null;

    return { id: idCandidate, label, maxScore };
  });
};

const buildTitle = (term: string, examType: "midterm" | "final") => {
  const safeTerm = term.trim().length > 0 ? term : "All Terms";
  const examLabel = examType === "final" ? "Final Exam" : "Midterm Assessment";
  return `${safeTerm} ${examLabel}`;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const sessionId = params.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ message: "sessionId is required." }, { status: 400 });
  }

  const termFilter = params.get("term") ?? undefined;
  const classFilter = params.get("classId") ?? undefined;
  const examTypeFilter = normaliseExamType(params.get("examType"));

  const where: Prisma.StudentScoreRecordWhereInput = { sessionId };
  if (termFilter) where.term = termFilter;
  if (classFilter) where.classId = classFilter;
  if (examTypeFilter) where.examType = examTypeFilter;

  try {
    const records = await prisma.studentScoreRecord.findMany({
      where,
      select: {
        sessionId: true,
        term: true,
        examType: true,
        components: true,
      },
    });

    if (!records.length) {
      return NextResponse.json({ items: [] });
    }

    type ComponentAggregate = {
      id: string;
      label: string;
      totalMax: number;
      count: number;
    };

    type DistributionGroup = {
      sessionId: string;
      term: string;
      examType: "midterm" | "final";
      components: Map<string, ComponentAggregate>;
    };

    const groups = new Map<string, DistributionGroup>();

    for (const record of records) {
      const examType = normaliseExamType(typeof record.examType === "string" ? record.examType : null);
      if (!examType) continue;

      const term = typeof record.term === "string" ? record.term.trim() : "";
      const key = `${term}__${examType}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          sessionId: record.sessionId,
          term,
          examType,
          components: new Map<string, ComponentAggregate>(),
        };
        groups.set(key, group);
      }

      const parsedComponents = parseComponents(record.components);
      if (!parsedComponents.length) continue;

      for (const component of parsedComponents) {
        const componentKey = component.id.trim().toLowerCase();
        const maxScore = component.maxScore ?? 0;

        const existing = group.components.get(componentKey);
        if (existing) {
          existing.totalMax += maxScore;
          existing.count += 1;
        } else {
          group.components.set(componentKey, {
            id: component.id,
            label: component.label,
            totalMax: maxScore,
            count: 1,
          });
        }
      }
    }

    const items = Array.from(groups.values())
      .map((group) => {
        const aggregates = Array.from(group.components.values());
        if (!aggregates.length) return null;

        const averages = aggregates.map((component) => ({
          id: component.id,
          label: component.label,
          avgMax: component.totalMax / Math.max(component.count, 1),
        }));

        let totalMax = averages.reduce((sum, component) => sum + component.avgMax, 0);

        let rawWeights: number[];
        if (totalMax > 0) {
          rawWeights = averages.map((component) => (component.avgMax / totalMax) * 100);
        } else {
          const equalWeight = averages.length ? 100 / averages.length : 0;
          rawWeights = averages.map(() => equalWeight);
        }

        const rounded = rawWeights.map((weight) => roundToOneDecimal(weight));
        let roundedSum = rounded.reduce((sum, weight) => sum + weight, 0);
        const diff = roundToOneDecimal(100 - roundedSum);
        if (rounded.length && diff !== 0) {
          let targetIndex = 0;
          let maxRaw = rawWeights[0] ?? 0;
          for (let index = 1; index < rawWeights.length; index += 1) {
            if (rawWeights[index] > maxRaw) {
              maxRaw = rawWeights[index];
              targetIndex = index;
            }
          }
          rounded[targetIndex] = roundToOneDecimal(rounded[targetIndex] + diff);
          roundedSum = rounded.reduce((sum, weight) => sum + weight, 0);
        }

        const components = averages.map((component, index) => ({
          id: component.id,
          label: component.label,
          weight: rounded[index] ?? 0,
        }));

        const totalWeight = roundToOneDecimal(roundedSum);
        const termLabel = group.term || termFilter || "All Terms";

        return {
          id: `${group.sessionId}-${(termLabel || "all").replace(/\s+/g, "-").toLowerCase()}-${group.examType}`,
          title: buildTitle(termLabel, group.examType),
          sessionId: group.sessionId,
          term: termLabel,
          examType: group.examType,
          components,
          totalWeight,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[MarkDistribution API] Failed to load mark distribution", error);
    return NextResponse.json({ message: "Unable to load mark distribution." }, { status: 500 });
  }
}
