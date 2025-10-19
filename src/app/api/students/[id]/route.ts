import { NextResponse } from "next/server";

import {
  deleteStudent,
  getStudentById,
} from "@/lib/services/students";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

type RouteParams = { params: { id?: string } };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const student = await getStudentById(params?.id);
    return NextResponse.json({ data: student });
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Students API] Failed to load student", error);
    return NextResponse.json({ message: "Unable to load student." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await deleteStudent(params?.id);
    return NextResponse.json({ message: "Student deleted successfully." });
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Students API] Failed to delete student", error);
    return NextResponse.json({ message: "Unable to delete student." }, { status: 500 });
  }
}
