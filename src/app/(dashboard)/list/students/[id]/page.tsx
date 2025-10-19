import Announcements from "@/components/Announcements";
import BigCalendar from "@/components/BigCalender";
import Performance from "@/components/Performance";
import {
  getStudentById,
  type StudentDetail,
} from "@/lib/services/students";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

interface SingleStudentPageProps {
  params: {
    id: string;
  };
}

const formatDateLabel = (value: string | null) => {
  if (!value) {
    return "N/A";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const buildInfoItems = (student: StudentDetail) => [
  { icon: "/blood.png", label: "Student ID", value: student.studentId },
  { icon: "/date.png", label: "Date of Birth", value: formatDateLabel(student.dateOfBirth ?? null) },
  { icon: "/blood.png", label: "Blood Type", value: student.bloodType ?? "N/A" },
  { icon: "/singleAttendance.png", label: "Grade", value: student.grade != null ? `Grade ${student.grade}` : "N/A" },
  { icon: "/singleBranch.png", label: "Category", value: student.category ?? "General" },
  { icon: "/mail.png", label: "Email", value: student.email ?? "N/A" },
  { icon: "/singleBranch.png", label: "Campus", value: student.schoolName },
];

const buildHighlightItems = (student: StudentDetail) => [
  { icon: "/singleBranch.png", label: "Class", value: student.className ?? "Not assigned" },
  { icon: "/singleAttendance.png", label: "Grade", value: student.grade != null ? String(student.grade) : "N/A" },
  { icon: "/singleLesson.png", label: "Guardian", value: student.guardianName ?? "Not assigned" },
  { icon: "/mail.png", label: "Guardian Email", value: student.guardianEmail ?? "N/A" },
  { icon: "/singleClass.png", label: "Guardian Phone", value: student.guardianPhone ?? "N/A" },
];

const SingleStudentPage = async ({ params }: SingleStudentPageProps) => {
  const idParam = params.id;

  let student: StudentDetail;
  try {
    student = await getStudentById(idParam);
  } catch (error) {
    return notFound();
  }

  const infoItems = buildInfoItems(student);
  const highlightItems = buildHighlightItems(student);

  return (
    <div className="flex-1 p-4 flex flex-col gap-4 xl:flex-row">
      <div className="w-full xl:w-2/3">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="bg-lamaSky py-6 px-4 rounded-md flex-1 flex gap-4">
            <div className="w-1/3">
              {student.photo ? (
                <Image
                  src={student.photo}
                  alt={student.name}
                  width={144}
                  height={144}
                  className="w-36 h-36 rounded-full object-cover"
                />
              ) : (
                <div className="w-36 h-36 rounded-full bg-white/40 flex items-center justify-center text-sm text-white">
                  No Photo
                </div>
              )}
            </div>
            <div className="w-2/3 flex flex-col justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">{student.name}</h1>
                <p className="text-sm text-gray-500">{student.address ?? "Address not provided"}</p>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-medium">
                {infoItems.map((item) => (
                  <div
                    key={item.label}
                    className="w-full md:w-1/3 lg:w-full 2xl:w-1/3 flex items-center gap-2"
                  >
                    <Image src={item.icon} alt="" width={14} height={14} />
                    <span>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 flex gap-4 justify-between flex-wrap">
            {highlightItems.map((item) => (
              <div
                key={item.label}
                className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]"
              >
                <Image src={item.icon} alt="" width={24} height={24} className="w-6 h-6" />
                <div>
                  <h1 className="text-xl font-semibold">{item.value}</h1>
                  <span className="text-sm text-gray-400">{item.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 bg-white rounded-md p-4 h-[800px]">
          <h1>Student&apos;s Schedule</h1>
          <BigCalendar />
        </div>
      </div>
      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-md">
          <h1 className="text-xl font-semibold">Shortcuts</h1>
          <div className="mt-4 flex gap-4 flex-wrap text-xs text-gray-500">
            <Link
              className="p-3 rounded-md bg-lamaSkyLight"
              href={`/list/lessons?studentId=${student.id}`}
            >
              Student&apos;s Lessons
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaPurpleLight"
              href={`/list/teachers?studentId=${student.id}`}
            >
              Student&apos;s Teachers
            </Link>
            <Link
              className="p-3 rounded-md bg-pink-50"
              href={`/list/exams?studentId=${student.id}`}
            >
              Student&apos;s Exams
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaSkyLight"
              href={`/list/assignments?studentId=${student.id}`}
            >
              Student&apos;s Assignments
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaYellowLight"
              href={`/list/results?studentId=${student.id}`}
            >
              Student&apos;s Results
            </Link>
          </div>
        </div>
        <Performance />
        <Announcements />
      </div>
    </div>
  );
};

export default SingleStudentPage;
