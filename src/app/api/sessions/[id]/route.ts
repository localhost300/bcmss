import { NextResponse } from "next/server";

import { deleteSession } from "@/lib/services/sessions";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

type RouteParams = { params: { id?: string } };

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await deleteSession(params?.id);
    return NextResponse.json({ message: "Session deleted successfully." });
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Sessions API] Failed to delete session", error);
    return NextResponse.json({ message: "Unable to delete session." }, { status: 500 });
  }
}
