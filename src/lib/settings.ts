export const ITEM_PER_PAGE = 10;

export const SUPPORTED_ROLES = ["admin", "teacher", "student", "parent"] as const;
export type RoleSlug = (typeof SUPPORTED_ROLES)[number];

export const roleDashboardRoutes: Record<RoleSlug, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};

export const normalizeRole = (value: unknown): RoleSlug | undefined => {
  if (typeof value !== "string") return undefined;
  const lower = value.toLowerCase();
  return SUPPORTED_ROLES.find((role) => role === lower);
};

type RouteAccessMap = Record<string, RoleSlug[]>;

export const routeAccessMap: RouteAccessMap = {
  "/admin(.*)": ["admin"],
  "/student(.*)": ["student"],
  "/teacher(.*)": ["teacher"],
  "/parent(.*)": ["parent"],
  "/list/teachers": ["admin", "teacher"],
  "/list/students": ["admin", "teacher"],
  "/list/parents": ["admin", "teacher"],
  "/list/subjects": ["admin"],
  "/list/classes": ["admin", "teacher"],
  "/list/exams": ["admin", "teacher", "student", "parent"],
  "/list/assignments": ["admin", "teacher", "student", "parent"],
  "/list/results": ["admin", "teacher", "student", "parent"],
  "/list/attendance": ["admin", "teacher"],
  "/list/events": ["admin", "teacher", "student", "parent"],
  "/list/announcements": ["admin", "teacher", "student", "parent"],
};
