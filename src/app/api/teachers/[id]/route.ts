import { NextResponse } from "next/server";

import { deleteTeacher, getTeacherById } from "@/lib/services/teachers";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

type RouteParams = { params: { id?: string } };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const teacher = await getTeacherById(params?.id);
    return NextResponse.json({ data: teacher });
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Teachers API] Failed to fetch teacher", error);
    return NextResponse.json({ message: "Unable to load teacher." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await deleteTeacher(params?.id);
    return NextResponse.json({ message: "Teacher deleted successfully." });
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Teachers API] Failed to delete teacher", error);
    return NextResponse.json({ message: "Unable to delete teacher." }, { status: 500 });
  }
}
