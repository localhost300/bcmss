import { NextResponse } from "next/server";

import { deleteClass, getClassById } from "@/lib/services/classes";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

type RouteParams = { params: { id?: string } };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const classRecord = await getClassById(params?.id);
    return NextResponse.json({ data: classRecord });
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Classes API] Failed to load class", error);
    return NextResponse.json({ message: "Unable to load class." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await deleteClass(params?.id);
    return NextResponse.json({ message: "Class deleted successfully." });
  } catch (error) {
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[Classes API] Failed to delete class", error);
    return NextResponse.json({ message: "Unable to delete class." }, { status: 500 });
  }
}
