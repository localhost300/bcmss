import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { exportStudents } from "@/lib/services/students";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  search: z.string().trim().optional(),
  schoolId: z.string().trim().optional(),
  category: z.string().trim().optional(),
  classId: z
    .preprocess((value) => {
      if (typeof value === "string" && value.trim().length > 0) {
        return Number.parseInt(value, 10);
      }
      return value;
    }, z.number().int().positive().optional()),
});

const exportHeaders = [
  "Student ID",
  "Name",
  "Email",
  "Phone",
  "Address",
  "Photo",
  "Grade",
  "Category",
  "Class",
  "Class ID",
  "School ID",
  "School Name",
  "Date of Birth",
  "Blood Type",
  "Guardian Name",
  "Guardian Email",
  "Guardian Phone",
];

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (stringValue === "") {
    return "";
  }
  const needsQuoting = /[",\n\r]/.test(stringValue);
  const safeValue = stringValue.replace(/"/g, '""');
  return needsQuoting ? `"${safeValue}"` : safeValue;
};

const buildCsv = (rows: Awaited<ReturnType<typeof exportStudents>>) => {
  const lines: string[] = [];
  lines.push(exportHeaders.map(escapeCsvValue).join(","));

  for (const row of rows) {
    const line = [
      row.studentId,
      row.name,
      row.email ?? "",
      row.phone ?? "",
      row.address ?? "",
      row.photo ?? "",
      row.grade ?? "",
      row.category ?? "",
      row.className ?? "",
      row.classId ?? "",
      row.schoolId,
      row.schoolName,
      row.dateOfBirth ? row.dateOfBirth.slice(0, 10) : "",
      row.bloodType ?? "",
      row.guardianName ?? "",
      row.guardianEmail ?? "",
      row.guardianPhone ?? "",
    ]
      .map(escapeCsvValue)
      .join(",");

    lines.push(line);
  }

  const csv = lines.join("\r\n");
  // Prepend UTF-8 BOM so Excel opens the file correctly.
  return `\uFEFF${csv}`;
};

const buildDisposition = () => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..+/, "");
  return `attachment; filename="students-${timestamp}.csv"`;
};

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = querySchema.parse(raw);
    const rows = await exportStudents(filters);
    const csv = buildCsv(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": buildDisposition(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Invalid export request.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    console.error("[StudentExport] Failed to export students", error);
    return NextResponse.json({ message: "Unable to export students." }, { status: 500 });
  }
}
