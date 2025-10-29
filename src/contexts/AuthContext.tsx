"use client";

import { useUser } from "@clerk/nextjs";
import { createContext, useContext, useMemo } from "react";

export type UserRole = "admin" | "teacher" | "student" | "parent";

export type CurrentUserProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  role: UserRole;
  managedSchoolIds: string[];
  primarySchoolId: string | null;
  teacherId: number | null;
  studentId: number | null;
  parentId: number | null;
};

type AuthContextValue = {
  user: CurrentUserProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const mapClerkUser = (clerkUser: ReturnType<typeof useUser>["user"]): CurrentUserProfile | null => {
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? "";
  const metadata = (clerkUser.publicMetadata ?? {}) as Record<string, unknown>;

  const rawRole = typeof metadata.role === "string" ? metadata.role : null;
  const normalisedRole = rawRole?.toLowerCase() ?? "";
  const roleMap: Record<string, UserRole> = {
    admin: "admin",
    administrator: "admin",
    superadmin: "admin",
    owner: "admin",
    teacher: "teacher",
    instructor: "teacher",
    student: "student",
    learner: "student",
    pupil: "student",
    parent: "parent",
    guardian: "parent",
  };
  const role = roleMap[normalisedRole] ?? "teacher";

  return {
    id: clerkUser.id,
    email,
    firstName: clerkUser.firstName ?? null,
    lastName: clerkUser.lastName ?? null,
    name: clerkUser.fullName ?? email,
    role,
    managedSchoolIds: asStringArray(metadata.managedSchoolIds),
    primarySchoolId: typeof metadata.primarySchoolId === "string" ? metadata.primarySchoolId : null,
    teacherId: toNullableNumber(metadata.teacherId),
    studentId: toNullableNumber(metadata.studentId),
    parentId: toNullableNumber(metadata.parentId),
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded, user } = useUser();
  const profile = useMemo(() => mapClerkUser(user), [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: profile,
      loading: !isLoaded,
      error: null,
      refresh: async () => undefined, // Clerk keeps user state in sync automatically
    }),
    [profile, isLoaded],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
