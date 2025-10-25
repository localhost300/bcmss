import Announcements from "@/components/Announcements";
import AdminOverviewCards from "@/components/AdminOverviewCards";
import ExamQuickLinks from "@/components/dashboard/ExamQuickLinks";
import PerformanceInsights from "@/components/dashboard/PerformanceInsights";
import UpcomingBirthdays from "@/components/dashboard/UpcomingBirthdays";
import EventCalendar from "@/components/EventCalendar";

const AdminPage = () => {
  return (
    <div className="p-4 flex gap-4 flex-col md:flex-row">
      {/* LEFT */}
      <div className="w-full lg:w-2/3 flex flex-col gap-8">
        {/* USER CARDS */}
        <AdminOverviewCards />
        {/* EXAM LINKS */}
        <ExamQuickLinks />
        {/* PERFORMANCE INSIGHTS */}
        <PerformanceInsights />
      </div>
      {/* RIGHT */}
      <div className="w-full lg:w-1/3 flex flex-col gap-8">
        <UpcomingBirthdays />
        <EventCalendar />
        <Announcements />
      </div>
    </div>
  );
};

export default AdminPage;
