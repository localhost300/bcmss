import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

type RouteParams = { params: { id?: string } };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = params?.id;
  if (!id || typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ message: "Invalid mark distribution id." }, { status: 400 });
  }

  try {
    await prisma.markDistribution.delete({ where: { id } });
    return NextResponse.json({ message: "Mark distribution deleted successfully." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "Mark distribution not found." }, { status: 404 });
    }
    console.error("[MarkDistributions] DELETE failed", error);
    return NextResponse.json({ message: "Unable to delete mark distribution." }, { status: 500 });
  }
}
