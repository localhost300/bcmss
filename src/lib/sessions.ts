export type Term = "First Term" | "Second Term" | "Third Term";

export type AcademicSession = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
};

export const termOptions: Term[] = ["First Term", "Second Term", "Third Term"];

export const sessionsData: AcademicSession[] = [
  {
    id: "2024-2025",
    name: "2024 / 2025",
    startDate: "2024-09-02",
    endDate: "2025-07-18",
    isCurrent: true,
  },
  {
    id: "2023-2024",
    name: "2023 / 2024",
    startDate: "2023-09-04",
    endDate: "2024-07-19",
  },
  {
    id: "2022-2023",
    name: "2022 / 2023",
    startDate: "2022-09-05",
    endDate: "2023-07-21",
  },
];

const fallbackSession = sessionsData[0];
const fallbackSessionId = fallbackSession?.id ?? "default-session";

export const defaultSessionId = fallbackSessionId;

export const getSessionById = (sessionId: string) =>
  sessionsData.find((session) => session.id === sessionId);

export const getSessionMetaForId = (sessionId?: string) => {
  if (!sessionId) {
    return {
      sessionId: fallbackSession?.id ?? "default-session",
      sessionName: fallbackSession?.name ?? "Session",
    };
  }

  const session = getSessionById(sessionId);
  return {
    sessionId: session?.id ?? (fallbackSession?.id ?? "default-session"),
    sessionName: session?.name ?? (fallbackSession?.name ?? "Session"),
  };
};
