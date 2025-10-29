import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { StudentTrait } from "@prisma/client";
import { z } from "zod";

import { resolveRequestActor } from "@/lib/auth/permissions";
import prisma from "@/lib/prisma";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";
import { replaceStudentTraits } from "@/lib/services/studentTraits";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ratingSchema = z.object({
  category: z.enum(["psychomotor", "affective"]),
  trait: z.string().trim().min(1),
  score: z.coerce.number().int().min(1).max(5),
});

const requestSchema = z.object({
  studentId: z.string().trim().min(1),
  term: z.string().trim().min(1),
  session: z.string().trim().min(1),
  ratings: z.array(ratingSchema).min(1),
});

const mapTrait = (record: StudentTrait | null) => {
  if (!record) {
    return null;
  }
  return {
    id: record.id,
    studentId: record.studentId,
    term: record.term,
    session: record.session,
    category: record.category,
    trait: record.trait,
    score: record.score,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
  };
};

const mapTraitList = (records: StudentTrait[]) =>
  records.map((record) => mapTrait(record));

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (!actor.isAdmin && !actor.isTeacher) {
      return NextResponse.json(
        { message: "Only administrators and assigned class teachers can record trait ratings." },
        { status: 403 },
      );
    }

    const json = await request.json();
    const payload = requestSchema.parse(json);

    const student = await prisma.student.findUnique({
      where: { studentCode: payload.studentId },
      select: { classId: true },
    });
    if (!student) {
      return NextResponse.json({ message: "Student could not be found." }, { status: 404 });
    }

    if (actor.isTeacher) {
      const classId = student.classId ? String(student.classId) : null;
      if (!classId || !actor.allowedClassIds.has(classId)) {
        return NextResponse.json(
          { message: "You are not assigned to this student's class." },
          { status: 403 },
        );
      }
    }

    let createdBy = actor.clerkUserId
      ? await prisma.user.findUnique({
          where: { clerkId: actor.clerkUserId },
          select: { id: true },
        })
      : null;

    if (!createdBy && actor.clerkUserId) {
      const resolvedRole: "admin" | "teacher" = actor.isAdmin ? "admin" : "teacher";
      const clerkProfile = await currentUser().catch(() => null);
      const primaryEmail =
        clerkProfile?.emailAddresses?.[0]?.emailAddress ??
        (clerkProfile?.primaryEmailAddress?.emailAddress ?? null);
      const fallbackEmail = `${actor.clerkUserId}@no-email.local`;
      const email = primaryEmail?.trim() ? primaryEmail : fallbackEmail;

      const firstName = clerkProfile?.firstName ?? null;
      const lastName = clerkProfile?.lastName ?? null;

      createdBy = await prisma.user.upsert({
        where: { email },
        update: {
          clerkId: actor.clerkUserId,
          firstName,
          lastName,
          role: resolvedRole,
        },
        create: {
          email,
          clerkId: actor.clerkUserId,
          firstName,
          lastName,
          role: resolvedRole,
        },
        select: { id: true },
      });
    }

    if (!createdBy) {
      return NextResponse.json(
        { message: "Unable to resolve the requesting user within the application." },
        { status: 403 },
      );
    }

    const records = await replaceStudentTraits({
      studentId: payload.studentId,
      term: payload.term,
      session: payload.session,
      createdBy: createdBy.id,
      ratings: payload.ratings,
    });

    return NextResponse.json({
      message: "Trait ratings saved successfully.",
      data: mapTraitList(records),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request payload.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Traits API] Failed to create trait ratings", error);
    return NextResponse.json({ message: "Unable to save trait ratings." }, { status: 500 });
  }
}
