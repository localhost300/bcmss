"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSchoolScope } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";

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

type SummaryCounts = {
  scheduledCount: number;
  distributionCount: number;
  midtermCount: number;
};

const INITIAL_SUMMARY: SummaryCounts = {
  scheduledCount: 0,
  distributionCount: 0,
  midtermCount: 0,
};

const ExamQuickLinks = () => {
  const schoolScope = useSchoolScope();
  const sessionScope = useSessionScope();
  const termScope = useTermScope();

  const [summary, setSummary] = useState({ ...INITIAL_SUMMARY });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    const loadSummary = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (schoolScope) params.set("schoolId", schoolScope);
        if (sessionScope) params.set("sessionId", sessionScope);
        if (termScope) params.set("term", termScope);

        const query = params.toString();
        const response = await fetch(
          query ? `/api/dashboard/exam-summary?${query}` : "/api/dashboard/exam-summary",
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const body = await response
            .json()
            .catch(() => ({ message: "Failed to load exam summary." }));
          throw new Error(body?.message ?? "Failed to load exam summary.");
        }

        const body = (await response.json()) as {
          data?: Partial<SummaryCounts>;
        };
        const data = body.data ?? {};

        if (!ignore) {
          setSummary({
            scheduledCount: Number.isFinite(Number(data.scheduledCount))
              ? Number(data.scheduledCount)
              : 0,
            distributionCount: Number.isFinite(Number(data.distributionCount))
              ? Number(data.distributionCount)
              : 0,
            midtermCount: Number.isFinite(Number(data.midtermCount))
              ? Number(data.midtermCount)
              : 0,
          });
        }
      } catch (fetchError) {
        if (ignore) {
          return;
        }
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        console.error("[ExamQuickLinks] Failed to load summary", fetchError);
        setSummary({ ...INITIAL_SUMMARY });
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load exam summary.");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [schoolScope, sessionScope, termScope]);

  const getStatLabel = (title: ExamQuickLinkCard["title"]) => {
    if (loading) {
      return "Loading...";
    }
    if (error) {
      return "Unavailable";
    }

    switch (title) {
      case "Exam Schedule":
        return `${summary.scheduledCount} scheduled`;
      case "Mark Distribution":
        return `${summary.distributionCount} distributions`;
      case "Midterm Overview":
        return `${summary.midtermCount} records`;
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
      {error && !loading && (
        <p className="mb-3 text-xs text-red-500">Unable to load exam activity summary.</p>
      )}
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

