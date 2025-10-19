"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSchoolScope } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { examsData, examMarkDistributions, examScoresData } from "@/lib/data";

type ExamQuickLinkCard = {
  title: string;
  description: string;
  href: string;
};

const cards: ExamQuickLinkCard[] = [
  {
    title: "Exam Schedule",
    description: "Create or edit upcoming exams",
    href: "/list/exams",
  },
  {
    title: "Mark Distribution",
    description: "Review assessment weights",
    href: "/list/exams/mark-distribution",
  },
  {
    title: "Midterm Overview",
    description: "See continuous assessment totals",
    href: "/list/exams/midterm",
  },
];

const ExamQuickLinks = () => {
  const schoolScope = useSchoolScope();
  const sessionScope = useSessionScope();
  const termScope = useTermScope();

  const summary = useMemo(() => {
    const scheduledCount = examsData.filter(
      (exam) =>
        exam.schoolId === schoolScope &&
        exam.sessionId === sessionScope &&
        exam.term === termScope
    ).length;
    const distributionCount = examMarkDistributions.filter(
      (distribution) =>
        distribution.sessionId === sessionScope && distribution.term === termScope
    ).length;
    const midtermCount = examScoresData.filter(
      (score) =>
        score.schoolId === schoolScope &&
        score.sessionId === sessionScope &&
        score.term === termScope
    ).length;

    return { scheduledCount, distributionCount, midtermCount };
  }, [schoolScope, sessionScope, termScope]);

  const getStatLabel = (title: ExamQuickLinkCard["title"]) => {
    switch (title) {
      case "Exam Schedule":
        return summary.scheduledCount + " scheduled";
      case "Mark Distribution":
        return summary.distributionCount + " distributions";
      case "Midterm Overview":
        return summary.midtermCount + " records";
      default:
        return "View details";
    }
  };

  return (
    <section className="bg-white border border-gray-100 rounded-md p-4">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Exam Operations</h2>
        <p className="text-xs text-gray-500">
          Session <strong>{sessionScope}</strong> | Term <strong>{termScope}</strong> | Campus <strong>{schoolScope}</strong>
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => {
          const statLabel = getStatLabel(card.title);

          return (
            <Link
              key={card.title}
              href={card.href}
              className="flex flex-col gap-2 rounded-md bg-[#F7F8FA] hover:bg-[#eef0f4] transition p-4 border border-transparent hover:border-lamaSky/40"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-700">{card.title}</span>
                <span className="text-xs text-gray-500">{card.description}</span>
              </div>
              <span className="text-xs font-medium text-lamaSky mt-2">{statLabel}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default ExamQuickLinks;

