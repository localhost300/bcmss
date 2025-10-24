import { NextRequest, NextResponse } from "next/server";

import { resolveRequestActor } from "@/lib/auth/permissions";
import {
  examTypeLabelToEnum,
  grantTeacherOverride,
  listResultLocks,
  ResultLockKey,
  ResultLockSummary,
  revokeTeacherOverride,
  setResultLockStatus,
  summariseResultLock,
  termLabelToEnum,
} from "@/lib/services/resultLocks";

type LockActionRequest = {
  action?: string;
  classId?: string | number;
  sessionId?: string;
  term?: string;
  examType?: string;
  teacherId?: string | number;
  notes?: string | null;
};

const parseClassId = (value: string | number | null | undefined): number | null => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const pickNoteValue = (value: unknown): string | null | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : value;
};

const buildLockKey = (
  body: LockActionRequest,
): { key: ResultLockKey; teacherId?: number } | { error: string } => {
  const classId = parseClassId(body.classId ?? null);
  if (!classId) {
    return { error: "A valid classId is required." };
  }
  const sessionId = typeof body.sessionId === "string" && body.sessionId.trim().length
    ? body.sessionId.trim()
    : null;
  if (!sessionId) {
    return { error: "A valid sessionId is required." };
  }
  const termEnum = termLabelToEnum(body.term ?? null);
  if (!termEnum) {
    return { error: "A valid term is required." };
  }
  const examTypeEnum = examTypeLabelToEnum(body.examType ?? null);
  if (!examTypeEnum) {
    return { error: "A valid examType is required." };
  }

  const teacherId = parseClassId(body.teacherId ?? null);

  return {
    key: {
      classId,
      sessionId,
      term: termEnum,
      examType: examTypeEnum,
    },
    teacherId: teacherId ?? undefined,
  };
};

const ok = (locks: ResultLockSummary | ResultLockSummary[]) =>
  NextResponse.json(
    Array.isArray(locks)
      ? { locks }
      : { lock: locks },
  );

const forbid = (message: string) =>
  NextResponse.json({ message }, { status: 403 });

const badRequest = (message: string) =>
  NextResponse.json({ message }, { status: 400 });

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (!actor.isAdmin) {
      return forbid("Administrator permissions are required.");
    }

    const params = request.nextUrl.searchParams;
    const classIdParam = params.get("classId");
    const sessionId = params.get("sessionId") ?? undefined;
    const termParam = params.get("term");
    const examTypeParam = params.get("examType");

    const classId = parseClassId(classIdParam);
    if (classIdParam && !classId) {
      return badRequest("classId must be a positive integer.");
    }

    const termEnum = termParam ? termLabelToEnum(termParam) : null;
    if (termParam && !termEnum) {
      return badRequest("term must be a recognised value.");
    }

    const examTypeEnum = examTypeParam ? examTypeLabelToEnum(examTypeParam) : null;
    if (examTypeParam && !examTypeEnum) {
      return badRequest("examType must be either midterm or final.");
    }

    const filters: Partial<ResultLockKey> & { classId?: number; sessionId?: string } = {};
    if (classId) {
      filters.classId = classId;
    }
    if (sessionId) {
      filters.sessionId = sessionId;
    }
    if (termEnum) {
      filters.term = termEnum;
    }
    if (examTypeEnum) {
      filters.examType = examTypeEnum;
    }

    const locks = await listResultLocks(filters);
    return ok(locks.map(summariseResultLock));
  } catch (error) {
    console.error("[Result Locks] GET failed", error);
    return NextResponse.json({ message: "Unable to load result locks." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (!actor.isAdmin) {
      return forbid("Administrator permissions are required.");
    }

    const body = (await request.json().catch(() => null)) as LockActionRequest | null;
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }
    const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : null;
    if (!action) {
      return badRequest("Action is required.");
    }

    const parsed = buildLockKey(body);
    if ("error" in parsed) {
      return badRequest(parsed.error);
    }

    const { key, teacherId } = parsed;
    let updated;

    switch (action) {
      case "lock": {
        const notes = pickNoteValue(body.notes);
        updated = await setResultLockStatus(key, {
          isLocked: true,
          lockedBy: actor.clerkUserId,
          notes,
        });
        break;
      }
      case "unlock": {
        const notes = pickNoteValue(body.notes);
        updated = await setResultLockStatus(key, {
          isLocked: false,
          lockedBy: actor.clerkUserId,
          notes,
        });
        break;
      }
      case "grantoverride":
      case "grant_override":
      case "grant": {
        if (!teacherId) {
          return badRequest("teacherId is required to grant an override.");
        }
        updated = await grantTeacherOverride(key, teacherId);
        break;
      }
      case "revokeoverride":
      case "revoke_override":
      case "revoke": {
        if (!teacherId) {
          return badRequest("teacherId is required to revoke an override.");
        }
        updated = await revokeTeacherOverride(key, teacherId);
        break;
      }
      default:
        return badRequest("Unsupported action supplied.");
    }

    return ok(summariseResultLock(updated));
  } catch (error) {
    console.error("[Result Locks] POST failed", error);
    return NextResponse.json({ message: "Unable to update result lock." }, { status: 500 });
  }
}
