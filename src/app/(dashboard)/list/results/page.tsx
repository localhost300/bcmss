"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { useResults } from "@/contexts/ResultsContext";
import { useSchool } from "@/contexts/SchoolContext";
import { useSession, useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { gradeBands } from "@/lib/grades";

type ActionCard = {
  title: string;
  description: string;
  href: string;
  icon: string;
  roles: Array<"admin" | "teacher" | "student" | "parent">;
  audience: string;
};

const ACTION_CARDS: ActionCard[] = [
  {
    title: "Load Scores",
    description: "Capture CA and exam marks for each student with automatic midterm totals.",
    href: "/list/results/load",
    icon: "/create.png",
    roles: ["admin", "teacher"],
    audience: "Staff",
  },
  {
    title: "View Results",
    description: "Review final term results with averages, grades, and class positions.",
    href: "/list/results/view",
    icon: "/result.png",
    roles: ["admin", "teacher", "student", "parent"],
    audience: "All users",
  },
  {
    title: "View Midterm Results",
    description: "Track midterm standings built from CA components (out of 50).",
    href: "/list/results/midterm",
    icon: "/exam.png",
    roles: ["admin", "teacher", "student"],
    audience: "Students & staff",
  },
  {
    title: "Print Report Card",
    description: "Generate a modern report card sheet with school branding and signatures.",
    href: "/list/results/report-card",
    icon: "/calendar.png",
    roles: ["admin", "student", "parent"],
    audience: "Students & parents",
  },
  {
    title: "Promotion",
    description: "Apply the automatic promotion rule or override decisions per student.",
    href: "/list/results/promotion",
    icon: "/class.png",
    roles: ["admin"],
    audience: "Staff",
  },
];

const gradeLegend = gradeBands.map((band, index) => {
  const previous = index === 0 ? undefined : gradeBands[index - 1];
  const max = previous ? previous.min - 1 : 100;
  const label = index === 0 ? `${band.min}% and above` : `${band.min}% - ${max}%`;
  return { ...band, max, label };
});

const ResultsLandingPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role ?? "teacher";

  const term = useTermScope();
  const sessionId = useSessionScope();
  const { sessions } = useSession();
  const { schools, activeSchoolId } = useSchool();
  const { promotionThreshold } = useResults();

  useEffect(() => {
    if (role === "student") {
      router.replace("/results/self");
    }
  }, [role, router]);

  const schoolName = useMemo(() => {
    if (!schools.length) return "Campus";
    const match = schools.find((school) => school.id === activeSchoolId);
    return match?.name ?? schools[0].name;
  }, [activeSchoolId, schools]);

  const sessionName = useMemo(() => {
    if (!sessionId) return "Session";
    const match = sessions.find((session) => session.id === sessionId);
    return match?.name ?? sessionId;
  }, [sessionId, sessions]);

  const accessibleActions = useMemo(
    () => ACTION_CARDS.filter((action) => action.roles.includes(role)),
    [role],
  );

  if (role === "student") {
    return (
      <div className="m-4 mt-0 flex-1">
        <div className="rounded-md border border-gray-100 bg-white p-6 text-sm text-gray-600">
          Redirecting you to your personal results workspace…
        </div>
      </div>
    );
  }

  return (
    <div className="m-4 mt-0 flex-1 space-y-6">
      <section className="rounded-md border border-gray-100 bg-white p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Results Workspace</h1>
          <p className="text-sm text-gray-500">
            {term} | Session {sessionName} | {schoolName}
          </p>
          <p className="text-xs text-gray-400">
            Use the shortcuts below to manage scores, publish results, print report cards, and
            promote students without leaving the dashboard.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accessibleActions.map((action) => {
            const targetHref =
              role === "parent" &&
              (action.title === "View Results" || action.title === "Print Report Card")
                ? "/parent#results"
                : action.href;

            return (
              <Link
                key={action.title}
                href={targetHref}
                className="flex items-start gap-3 rounded-md border border-gray-100 bg-white p-4 transition hover:border-lamaSky"
              >
                <Image src={action.icon} alt="" width={32} height={32} className="shrink-0" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-800">{action.title}</h3>
                    <span className="rounded-full bg-lamaSkyLight px-2 py-0.5 text-[10px] uppercase tracking-wide text-lamaSky">
                      {action.audience}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-gray-500">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-gray-100 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Grading Scale</h2>
          <ul className="space-y-2 text-xs text-gray-600">
            {gradeLegend.map((band) => (
              <li key={band.grade} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">{band.grade}</span>
                  <span>{band.remark}</span>
                </div>
                <span className="text-gray-400">{band.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 rounded-md border border-gray-100 bg-white p-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Promotion Rule</h2>
            <p className="text-xs leading-5 text-gray-500">
              Students with an average of {promotionThreshold}% or higher are promoted
              automatically. You can fine-tune special cases in the Promotion workspace.
            </p>
          </div>
          <div className="rounded-md border border-lamaPurpleLight bg-lamaPurpleLight/60 p-4 text-xs leading-5 text-lamaPurple">
            All score updates immediately refresh the midterm view and report cards for the same
            student, keeping every summary in sync.
          </div>
        </div>
      </section>
    </div>
  );
};

export default ResultsLandingPage;
