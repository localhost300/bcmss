"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import Link from "next/link";
type MenuLink = {
  icon?: string;
  label: string;
  href: string;
  visible: string[];
  children?: MenuLink[];
};
type MenuSection = { title: string; items: MenuLink[] };
const baseMenuSections: MenuSection[] = [
  {
    title: "MENU",
    items: [
      {
        icon: "/home.png",
        label: "Home",
        href: "/",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/teacher.png",
        label: "Teachers",
        href: "/list/teachers",
        visible: ["admin"],
      },
      {
        icon: "/student.png",
        label: "Students",
        href: "/list/students",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/student.png",
        label: "Children",
        href: "/parent",
        visible: ["parent"],
      },
      {
        icon: "/parent.png",
        label: "Parents",
        href: "/list/parents",
        visible: ["admin"],
      },
      {
        icon: "/subject.png",
        label: "Subjects",
        href: "/list/subjects",
        visible: ["admin"],
      },
      {
        icon: "/class.png",
        label: "Classes",
        href: "/list/classes",
        visible: ["admin"],
      },
      {
        icon: "/attendance.png",
        label: "Attendance",
        href: "/list/attendance",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/exam.png",
        label: "Exams",
        href: "/list/exams",
        visible: ["admin", "teacher", "student"],
        children: [
          {
            label: "Exam List",
            href: "/list/exams",
            visible: ["admin", "teacher", "student"],
          },
          {
            label: "Mark Distribution",
            href: "/list/exams/mark-distribution",
            visible: ["admin"],
          },
          {
            label: "Midterm Overview",
            href: "/list/exams/midterm",
            visible: ["admin", "teacher", "student"],
          },
        ],
      },
      {
        icon: "/assignment.png",
        label: "Assignments",
        href: "/list/assignments",
        visible: ["admin", "student"],
      },
      {
        icon: "/result.png",
        label: "Results",
        href: "/list/results",
        visible: ["admin", "teacher", "student", "parent"],
        children: [
          {
            label: "Load Scores",
            href: "/list/results/load",
            visible: ["admin", "teacher"],
          },
          {
            label: "View Results",
            href: "/list/results/view",
            visible: ["admin", "teacher", "student", "parent"],
          },
          {
            label: "View Midterm Results",
            href: "/list/results/midterm",
            visible: ["admin", "teacher", "student"],
          },
          {
            label: "Print Report Card",
            href: "/list/results/report-card",
            visible: ["admin", "student", "parent"],
          },
          {
            label: "Promotion",
            href: "/list/results/promotion",
            visible: ["admin"],
          },
        ],
      },
      {
        icon: "/report.png",
        label: "Trait Ratings",
        href: "/traits",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/event.png",
        label: "Events",
        href: "/list/events",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/announcement.png",
        label: "Announcements",
        href: "/list/announcements",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/message.png",
        label: "Messages",
        href: "/list/messages",
        visible: ["admin", "teacher"],
      },
    ],
  },
  {
    title: "OTHER",
    items: [
      {
        icon: "/finance.png",
        label: "Finance",
        href: "/list/finance",
        visible: ["admin"],
      },
      {
        icon: "/report.png",
        label: "Reports",
        href: "/reports",
        visible: ["admin"],
      },
    ],
  },
  {
    title: "USER",
    items: [
      {
        icon: "/profile.png",
        label: "Profile",
        href: "/profile",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/setting.png",
        label: "Settings",
        href: "/settings",
        visible: ["admin"],
      },
      {
        icon: "/logout.png",
        label: "Logout",
        href: "/logout",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
];
const studentMenuSections: MenuSection[] = [
  {
    title: "MENU",
    items: [
      {
        icon: "/result.png",
        label: "Results",
        href: "/results/self",
        visible: ["student"],
        children: [
          {
            label: "Performance Overview",
            href: "/results/self",
            visible: ["student"],
          },
          {
            label: "Print Report",
            href: "/results/self?print=1",
            visible: ["student"],
          },
        ],
      },
      {
        icon: "/announcement.png",
        label: "Announcements",
        href: "/list/announcements",
        visible: ["student"],
      },
      {
        icon: "/message.png",
        label: "Messages",
        href: "/messages",
        visible: ["student"],
      },
      {
        icon: "/calendar.png",
        label: "Events",
        href: "/list/events",
        visible: ["student"],
      },
    ],
  },
  {
    title: "USER",
    items: [
      {
        icon: "/logout.png",
        label: "Logout",
        href: "/logout",
        visible: ["student"],
      },
    ],
  },
];
const Menu = () => {
  const { user } = useAuth();
  const role = user?.role ?? "teacher";
  const [openItem, setOpenItem] = useState<string | null>(null);
  const isParent = role === "parent";
  const isStudent = role === "student";
  const sections = isStudent ? studentMenuSections : baseMenuSections;
  const toggleItem = (label: string) => {
    setOpenItem((prev) => (prev === label ? null : label));
  };
  return (
    <div className="mt-4 text-sm">
      
      {sections.map((section) => (
        <div className="flex flex-col gap-2" key={section.title}>
          
          <span className="hidden lg:block text-gray-400 font-light my-4">
            
            {section.title}
          </span>
          {section.items.map((item) => {
            if (!item.visible.includes(role)) {
              return null;
            }
            const displayLabel =
              isParent && item.label === "Students" ? "Children" : item.label;
            let itemHref = item.href;
            if (isParent && item.label === "Results") {
              itemHref = "/parent#results";
            }
            if (isStudent && item.label === "Results") {
              itemHref = "/results/self";
            }
            const hasChildren = item.children?.some((child) =>
              child.visible.includes(role),
            );
            const isOpen = hasChildren && openItem === item.label;
            const dropdownId = hasChildren
              ? `menu-${item.label.replace(/\s+/g, "-").toLowerCase()}`
              : undefined;
            return (
              <div key={item.label} className="flex flex-col gap-1">
                
                {hasChildren ? (
                  <div
                    className={[
                      "flex items-center gap-2 text-gray-500 py-2 md:px-2 rounded-md",
                      isOpen ? "bg-lamaSkyLight" : "hover:bg-lamaSkyLight",
                    ].join(" ")}
                  >
                    
                    <Link
                      href={itemHref}
                      className="flex flex-1 items-center justify-center lg:justify-start gap-4"
                    >
                      
                      {item.icon && (
                        <Image src={item.icon} alt="" width={20} height={20} />
                      )}
                      <span className="hidden lg:block">
                        {displayLabel}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleItem(item.label)}
                      aria-expanded={isOpen}
                      aria-controls={dropdownId}
                      aria-label={
                        (isOpen ? "Collapse " : "Expand ") + displayLabel
                      }
                      className="px-2 text-xs text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamaSky"
                    >
                      
                      {isOpen ? "-" : "+"}
                    </button>
                  </div>
                ) : (
                  <Link
                    href={itemHref}
                    className="flex items-center justify-center lg:justify-start gap-4 text-gray-500 py-2 md:px-2 rounded-md hover:bg-lamaSkyLight"
                  >
                    
                    {item.icon && (
                      <Image src={item.icon} alt="" width={20} height={20} />
                    )}
                    <span className="hidden lg:block">{displayLabel}</span>
                  </Link>
                )}
                {hasChildren && isOpen && (
                  <div
                    id={dropdownId}
                    className="flex flex-col gap-1 pl-6 lg:pl-10"
                  >
                    
                    {item.children?.map((child) => {
                      if (!child.visible.includes(role)) {
                        return null;
                      }
                      let childHref = child.href;
                      if (
                        isParent &&
                        (child.label === "View Results" ||
                          child.label === "Print Report Card")
                      ) {
                        childHref = "/parent#results";
                      }
                      if (isStudent) {
                        childHref =
                          child.label === "Print Report"
                            ? "/results/self?print=1"
                            : "/results/self";
                      }
                      return (
                        <Link
                          key={child.label}
                          href={childHref}
                          className="flex items-center gap-2 text-gray-400 text-xs py-1 px-2 rounded-md hover:bg-lamaSkyLight/60"
                        >
                          
                          <span className="w-1.5 h-1.5 rounded-full bg-lamaSky"></span>
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
export default Menu;








