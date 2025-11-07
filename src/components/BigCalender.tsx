"use client";

import { Calendar, momentLocalizer, View, Views } from "react-big-calendar";
import moment from "moment";
import { useMemo, useState } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { calendarEvents } from "@/lib/data";
import { useSchoolScope } from "@/contexts/SchoolContext";

const localizer = momentLocalizer(moment);

const BigCalendar = () => {
  const [view, setView] = useState<View>(Views.WORK_WEEK);
  const schoolId = useSchoolScope();

  const events = useMemo(() => {
    if (!schoolId) {
      return calendarEvents;
    }
    const scoped = calendarEvents.filter(
      (event) => !("schoolId" in event) || event.schoolId == null || event.schoolId === schoolId,
    );
    if (scoped.length > 0) {
      return scoped;
    }
    return calendarEvents.filter((event) => !("schoolId" in event) || event.schoolId == null);
  }, [schoolId]);

  const handleOnChangeView = (selectedView: View) => {
    setView(selectedView);
  };

  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      views={["work_week", "day"]}
      view={view}
      style={{ height: "98%" }}
      onView={handleOnChangeView}
      min={new Date(2025, 1, 0, 8, 0, 0)}
      max={new Date(2025, 1, 0, 17, 0, 0)}
    />
  );
};

export default BigCalendar;
