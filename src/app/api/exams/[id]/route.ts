import { NextResponse } from "next/server";

import { deleteExam } from "@/lib/services/exams";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

type RouteParams = { params: { id?: string } };

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await deleteExam(params?.id);
    return NextResponse.json({ message: "Exam deleted successfully." });
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Exams API] Failed to delete exam", error);
    return NextResponse.json({ message: "Unable to delete exam." }, { status: 500 });
  }
}
