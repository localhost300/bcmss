import { NextResponse } from "next/server";

import { deleteSubject } from "@/lib/services/subjects";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

type RouteParams = { params: { id?: string } };

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await deleteSubject(params?.id);
    return NextResponse.json({ message: "Subject deleted successfully." });
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Subjects API] Failed to delete subject", error);
    return NextResponse.json({ message: "Unable to delete subject." }, { status: 500 });
  }
}
