import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

const DATABASE_DEGRADED_RESPONSE = {
  status: "degraded",
  reason: "database-unreachable",
};

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.warn("Database health degraded - returning degraded status.", error);
      return NextResponse.json(DATABASE_DEGRADED_RESPONSE);
    }

    console.error("Database health check failed", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
