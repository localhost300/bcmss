"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { useResults } from "@/contexts/ResultsContext";
import { useSchool } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import { gradeBands } from "@/lib/grades";

const gradeLegend = gradeBands.map((band, index) => {
  const upperBound = index === 0 ? 100 : gradeBands[index - 1].min - 1;
  return {
    grade: band.grade,
    remark: band.remark,
    range: index === 0 ? `${band.min}% and above` : `${band.min}% - ${upperBound}%`,
  };
});

type ActionCard = {
  title: string;
  description: string;
  href: string;
  icon: string;
  roles: Array<"admin" | "teacher" | "student" | "parent">;
  audience: string;
};

const actionCards: ActionCard[] = [
  {
    title: "Load Scores",
    description: "Capture CA and exam marks for each student with automatic calculations.",
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
    description: "Track midterm standings built from continuous assessment components.",
    href: "/list/results/midterm",
    icon: "/exam.png",
    roles: ["admin", "teacher", "student"],
    audience: "Students & staff",
  },
  {
    title: "Print Report Card",
    description: "Generate a polished report card with school branding and signatures.",
    href: "/list/results/report-card",
    icon: "/calendar.png",
    roles: ["admin", "student", "parent"],
    audience: "Students & parents",
  },
  {
    title: "Promotion",
    description: "Apply rules or override decisions to promote students to the next class.",
    href: "/list/results/promotion",
    icon: "/class.png",
    roles: ["admin"],
    audience: "Staff",
  },
];

const ResultsLandingPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role ?? "teacher";
  const { promotionThreshold } = useResults();
  const term = useTermScope();
  const sessionId = useSessionScope();
  const { activeSchoolId, schools } = useSchool();

  const activeSchool =
    schools.find((school) => school.id === activeSchoolId) ?? schools[0];

  useEffect(() => {
    if (role === "student") {
      router.replace("/results/self");
    }
  }, [role, router]);

  if (role === "student") {
    return (
      <div className="m-4 mt-0 flex-1">
        <div className="bg-white p-6 rounded-md border border-gray-100 text-sm text-gray-600">
          Redirecting you to your personal results workspace…
        </div>
      </div>
    );
  }

  const accessibleActions = actionCards.filter((action) =>
    action.roles.includes(role),
  );

  return (
    <div className="m-4 mt-0 flex-1 space-y-6">
      <section className="bg-white border border-gray-100 rounded-md p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Results Workspace</h1>
          <p className="text-sm text-gray-500">
            {term} | Session {sessionId} | {activeSchool?.name ?? "Campus"}
          </p>
          <p className="text-xs text-gray-400">
            Use the shortcuts below to manage continuous assessments, publish results,
            print report cards, and handle promotions without leaving the dashboard.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accessibleActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="bg-white border border-gray-100 rounded-md p-4 flex items-start gap-3 hover:border-lamaSky transition"
            >
              <Image src={action.icon} alt="" width={32} height={32} className="shrink-0" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-800">{action.title}</h3>
                  <span className="text-[10px] uppercase tracking-wide text-lamaSky bg-lamaSkyLight px-2 py-0.5 rounded-full">
                    {action.audience}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-5">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-gray-100 rounded-md p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Grading Scale</h2>
          <ul className="space-y-2 text-xs text-gray-600">
            {gradeLegend.map((band) => (
              <li key={band.grade} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">{band.grade}</span>
                  <span>{band.remark}</span>
                </div>
                <span className="text-gray-400">{band.range}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-gray-100 rounded-md p-6 flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Promotion Rule</h2>
            <p className="text-xs text-gray-500 leading-5">
              Students with an average of {promotionThreshold}% or higher are promoted automatically.
              You can fine-tune edge cases from the Promotion workspace.
            </p>
          </div>
          <div className="bg-lamaPurpleLight/60 border border-lamaPurpleLight text-lamaPurple rounded-md p-4 text-xs leading-5">
            Score updates immediately refresh the midterm view and report cards for the same student,
            keeping every summary in sync.
          </div>
        </div>
      </section>
    </div>
  );
};

export default ResultsLandingPage;
