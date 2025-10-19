import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { createSession, listSessions, updateSession } from "@/lib/services/sessions";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().trim().min(1).optional(),
  isCurrent: z.coerce.boolean().optional(),
});

const dateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid date.",
  });

const payloadSchema = z.object({
  action: z.enum(["create", "update"]),
  id: z.union([z.string().trim().min(1), z.number().int().positive()]).optional(),
  name: z.string().trim().min(1),
  startDate: dateSchema,
  endDate: dateSchema,
  isCurrent: z.coerce.boolean().optional(),
});

const normaliseFilters = (raw: Record<string, string | undefined>) => {
  const parsed = querySchema.parse(raw);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search?.trim(),
    isCurrent: typeof parsed.isCurrent === "boolean" ? parsed.isCurrent : undefined,
  };
};

const normalisePayload = (raw: unknown) => {
  const parsed = payloadSchema.parse(raw);
  return {
    action: parsed.action,
    id: parsed.id === undefined ? undefined : String(parsed.id),
    name: parsed.name.trim(),
    startDate: new Date(parsed.startDate),
    endDate: new Date(parsed.endDate),
    isCurrent: parsed.isCurrent ?? false,
  };
};
export async function GET(request: NextRequest) {
  try {
    const rawEntries = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = normaliseFilters(rawEntries);
    const result = await listSessions(filters);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    console.error("[Sessions API] Failed to load sessions", error);
    return NextResponse.json(
      { message: "Unable to load sessions." },
      { status: 500 },
    );
  }
}





export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = normalisePayload(json);

    const input = {
      id: payload.id,
      name: payload.name,
      startDate: payload.startDate,
      endDate: payload.endDate,
      isCurrent: payload.isCurrent,
    };

    if (payload.action === "create") {
      const record = await createSession(input);
      return NextResponse.json(
        { message: "Session created successfully.", data: record },
        { status: 201 },
      );
    }

    if (!payload.id) {
      return NextResponse.json({ message: "Session id is required for update." }, { status: 400 });
    }

    const record = await updateSession(payload.id, input);
    return NextResponse.json({ message: "Session updated successfully.", data: record });
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "A session with these details already exists." },
        { status: 409 },
      );
    }

    console.error("[Sessions API] Failed to process request", error);
    return NextResponse.json(
      { message: "Unable to process request at this time." },
      { status: 500 },
    );
  }
}
