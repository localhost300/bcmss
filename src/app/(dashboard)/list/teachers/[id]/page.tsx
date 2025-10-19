import Announcements from "@/components/Announcements";
import BigCalendar from "@/components/BigCalender";
import FormModal from "@/components/FormModal";
import AccessRestricted from "@/components/AccessRestricted";
import Performance from "@/components/Performance";
import { role, teachersData } from "@/lib/data";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

interface SingleTeacherPageProps {
  params: {
    id: string;
  };
}

const SingleTeacherPage = ({ params }: SingleTeacherPageProps) => {
  const teacherId = Number(params.id);
  const teacher = teachersData.find((item) => item.id === teacherId);

  if (!teacher) {
    notFound();
  }

  if (role !== "admin") {
    return (
      <AccessRestricted        message="Only administrators can view teacher details."
      />
    );
  }

  const infoItems = [
    { icon: "/blood.png", label: "Teacher ID", value: teacher.teacherId },
    {
      icon: "/date.png",
      label: "Primary Class",
      value: teacher.classes[0] ?? "Unassigned",
    },
    { icon: "/mail.png", label: "Email", value: teacher.email ?? "N/A" },
    { icon: "/phone.png", label: "Phone", value: teacher.phone ?? "N/A" },
  ];

  const highlightItems = [
    {
      icon: "/singleAttendance.png",
      label: "Subjects",
      value: teacher.subjects.length.toString(),
    },
    {
      icon: "/singleBranch.png",
      label: "Classes",
      value: teacher.classes.length.toString(),
    },
    {
      icon: "/singleLesson.png",
      label: "Subjects List",
      value: teacher.subjects.join(", ") || "N/A",
    },
    { icon: "/singleClass.png", label: "Address", value: teacher.address },
  ];
  return (
    <div className="flex-1 p-4 flex flex-col gap-4 xl:flex-row">
      {/* LEFT */}
      <div className="w-full xl:w-2/3">
        {/* TOP */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* USER INFO CARD */}
          <div className="bg-lamaSky py-6 px-4 rounded-md flex-1 flex gap-4">
            <div className="w-1/3">
              <Image
                src={teacher.photo}
                alt={teacher.name}
                width={144}
                height={144}
                className="w-36 h-36 rounded-full object-cover"
              />
            </div>
            <div className="w-2/3 flex flex-col justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <h1 className="text-xl font-semibold">{teacher.name}</h1>
                  <p className="text-sm text-gray-500">{teacher.address}</p>
                </div>
                {role === "admin" && (
                  <FormModal table="teacher" type="update" data={teacher} />
                )}
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
          {/* SMALL CARDS */}
          <div className="flex-1 flex gap-4 justify-between flex-wrap">
            {highlightItems.map((item) => (
              <div
                key={item.label}
                className="bg-white p-4 rounded-md flex gap-4 w-full md:w-[48%] xl:w-[45%] 2xl:w-[48%]"
              >
                <Image src={item.icon} alt="" width={24} height={24} className="w-6 h-6" />
                <div>
                  <h1 className="text-xl font-semibold truncate" title={item.value}>
                    {item.value}
                  </h1>
                  <span className="text-sm text-gray-400">{item.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* BOTTOM */}
        <div className="mt-4 bg-white rounded-md p-4 h-[800px]">
          <h1>Teacher&apos;s Schedule</h1>
          <BigCalendar />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-full xl:w-1/3 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-md">
          <h1 className="text-xl font-semibold">Shortcuts</h1>
          <div className="mt-4 flex gap-4 flex-wrap text-xs text-gray-500">
            <Link
              className="p-3 rounded-md bg-lamaSkyLight"
              href={`/list/classes?teacherId=${teacher.id}`}
            >
              Teacher&apos;s Classes
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaPurpleLight"
              href={`/list/students?teacherId=${teacher.id}`}
            >
              Teacher&apos;s Students
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaYellowLight"
              href={`/list/lessons?teacherId=${teacher.id}`}
            >
              Teacher&apos;s Lessons
            </Link>
            <Link
              className="p-3 rounded-md bg-pink-50"
              href={`/list/exams?teacherId=${teacher.id}`}
            >
              Teacher&apos;s Exams
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaSkyLight"
              href={`/list/assignments?teacherId=${teacher.id}`}
            >
              Teacher&apos;s Assignments
            </Link>
            <Link
              className="p-3 rounded-md bg-lamaYellowLight"
              href={`/list/results?teacherId=${teacher.id}`}
            >
              Teacher&apos;s Results
            </Link>
          </div>
        </div>
        <Performance />
        <Announcements />
      </div>
    </div>
  );
};

export default SingleTeacherPage;

