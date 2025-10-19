import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Operation disabled in production." }, { status: 404 });
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT');
    return NextResponse.json({ message: "passwordHash column ensured." });
  } catch (error) {
    console.error('[Dev] Failed to ensure passwordHash column', error);
    return NextResponse.json({ message: "Unable to ensure passwordHash column." }, { status: 500 });
  }
}
