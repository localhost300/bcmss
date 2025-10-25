import { NextResponse } from "next/server";

import {
  importStudents,
  type SaveStudentInput,
  type StudentImportError,
  type StudentImportRow,
} from "@/lib/services/students";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type StudentCsvRow = {
  studentId?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  photo?: string;
  grade?: string;
  category?: string;
  className?: string;
  schoolId?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
  dateOfBirth?: string;
  bloodType?: string;
};

type ParsedCsvRow = {
  rowNumber: number;
  data: StudentCsvRow;
};

type ParsedCsv = {
  headerKeys: Array<keyof StudentCsvRow | null>;
  rows: ParsedCsvRow[];
};

const HEADER_ALIASES: Record<string, keyof StudentCsvRow> = {
  studentid: "studentId",
  studentcode: "studentId",
  code: "studentId",
  admissionnumber: "studentId",
  admissionno: "studentId",
  regno: "studentId",
  registrationnumber: "studentId",
  name: "name",
  fullname: "name",
  email: "email",
  mail: "email",
  phone: "phone",
  phonenumber: "phone",
  address: "address",
  homeaddress: "address",
  photo: "photo",
  avatar: "photo",
  grade: "grade",
  level: "grade",
  year: "grade",
  class: "className",
  classname: "className",
  classroom: "className",
  arm: "className",
  category: "category",
  stream: "category",
  school: "schoolId",
  schoolid: "schoolId",
  campus: "schoolId",
  branch: "schoolId",
  guardianname: "guardianName",
  parentname: "guardianName",
  guardianemail: "guardianEmail",
  parentemail: "guardianEmail",
  guardianphone: "guardianPhone",
  parentphone: "guardianPhone",
  guardianrelationship: "guardianRelationship",
  relationship: "guardianRelationship",
  dob: "dateOfBirth",
  dateofbirth: "dateOfBirth",
  birthdate: "dateOfBirth",
  bloodtype: "bloodType",
  bloodgroup: "bloodType",
};

const stripBom = (value: string) => value.replace(/^\uFEFF/, "");

const normaliseHeader = (value: string): string =>
  stripBom(value).trim().toLowerCase().replace(/[\s/_-]+/g, "");

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const parseCsvContent = (content: string): ParsedCsv => {
  const lines = content.split(/\r?\n/);

  if (!lines.length) {
    return { headerKeys: [], rows: [] };
  }

  let headerIndex = 0;
  while (headerIndex < lines.length && lines[headerIndex].trim().length === 0) {
    headerIndex += 1;
  }

  if (headerIndex >= lines.length) {
    return { headerKeys: [], rows: [] };
  }

  const headerLine = lines[headerIndex].replace(/\r$/, "");
  const rawHeaders = parseCsvLine(headerLine);
  const headerKeys = rawHeaders.map((header) => {
    const normalised = normaliseHeader(header);
    return HEADER_ALIASES[normalised] ?? null;
  });

  const rows: ParsedCsvRow[] = [];

  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    if (!rawLine || rawLine.trim().length === 0) {
      continue;
    }

    const values = parseCsvLine(rawLine.replace(/\r$/, ""));
    const row: StudentCsvRow = {};

    headerKeys.forEach((key, columnIndex) => {
      if (!key) {
        return;
      }
      const cell = values[columnIndex] ?? "";
      row[key] = cell;
    });

    rows.push({ rowNumber: lineIndex + 1, data: row });
  }

  return { headerKeys, rows };
};

const normaliseCell = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseGrade = (value: string | null): number => {
  if (!value) {
    throw new Error("Grade is required.");
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("Grade must be a number.");
  }
  if (parsed < 1) {
    throw new Error("Grade must be at least 1.");
  }
  return parsed;
};

const parseDate = (value: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Date of birth is invalid.");
  }
  return parsed;
};

const buildStudentInput = (
  row: StudentCsvRow,
  rowNumber: number,
  defaultSchoolId: string | null,
): SaveStudentInput => {
  const studentCode = normaliseCell(row.studentId);
  if (!studentCode) {
    throw new Error("Student ID is required.");
  }

  const name = normaliseCell(row.name);
  if (!name) {
    throw new Error("Student name is required.");
  }

  const schoolId = normaliseCell(row.schoolId) ?? defaultSchoolId;
  if (!schoolId) {
    throw new Error("School ID is required (provide a column or select a campus before importing).");
  }

  const grade = parseGrade(normaliseCell(row.grade));

  const category = normaliseCell(row.category) ?? "General";
  const className = normaliseCell(row.className) ?? "";

  return {
    studentCode,
    name,
    email: normaliseCell(row.email),
    address: normaliseCell(row.address),
    photo: normaliseCell(row.photo),
    grade,
    category,
    className,
    schoolId,
    guardianName: normaliseCell(row.guardianName),
    guardianPhone: normaliseCell(row.guardianPhone),
    guardianEmail: normaliseCell(row.guardianEmail),
    guardianRelationship: normaliseCell(row.guardianRelationship),
    dateOfBirth: parseDate(normaliseCell(row.dateOfBirth)),
    bloodType: normaliseCell(row.bloodType),
    guardianParentId: null,
  };
};

const mergeErrors = (
  parseErrors: StudentImportError[],
  serviceErrors: StudentImportError[],
): StudentImportError[] => {
  if (!parseErrors.length) {
    return serviceErrors;
  }
  if (!serviceErrors.length) {
    return parseErrors;
  }
  return [...parseErrors, ...serviceErrors].sort((a, b) => a.row - b.row);
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const maybeFile = formData.get("file");

    if (!(maybeFile instanceof File)) {
      return NextResponse.json({ message: "Upload a CSV file to import students." }, { status: 400 });
    }

    const defaultSchoolIdRaw = formData.get("defaultSchoolId");
    const defaultSchoolId =
      typeof defaultSchoolIdRaw === "string" && defaultSchoolIdRaw.trim().length > 0
        ? defaultSchoolIdRaw.trim()
        : null;

    const fileText = await maybeFile.text();
    if (!fileText.trim()) {
      return NextResponse.json({ message: "The uploaded file is empty." }, { status: 400 });
    }

    const parsed = parseCsvContent(fileText);
    if (!parsed.rows.length) {
      return NextResponse.json({ message: "No student rows were found in the file." }, { status: 400 });
    }

    const headerSet = new Set(parsed.headerKeys.filter(Boolean) as Array<keyof StudentCsvRow>);
    const missingColumns: string[] = [];

    if (!headerSet.has("studentId")) {
      missingColumns.push("studentId");
    }
    if (!headerSet.has("name")) {
      missingColumns.push("name");
    }
    if (!headerSet.has("grade")) {
      missingColumns.push("grade");
    }
    if (!headerSet.has("schoolId") && !defaultSchoolId) {
      missingColumns.push("schoolId");
    }

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          message:
            "The CSV file is missing required columns. Include the columns listed below or provide defaults.",
          missingColumns,
        },
        { status: 400 },
      );
    }

    const candidates: StudentImportRow[] = [];
    const parseErrors: StudentImportError[] = [];

    for (const row of parsed.rows) {
      try {
        const input = buildStudentInput(row.data, row.rowNumber, defaultSchoolId);
        candidates.push({ rowNumber: row.rowNumber, input });
      } catch (error) {
        parseErrors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : "Unable to parse this row.",
        });
      }
    }

    const emptyResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as StudentImportError[],
      skippedRows: [] as StudentImportError[],
    };
    const result = candidates.length ? await importStudents(candidates) : emptyResult;
    const errors = mergeErrors(parseErrors, result.errors);
    const processedRows = candidates.length;
    const totalRows = processedRows + parseErrors.length;

    return NextResponse.json(
      {
        message: "Student import completed.",
        summary: {
          totalRows,
          processedRows,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          failed: errors.length,
          errors,
          skippedRows: result.skippedRows,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[StudentImport] Failed to import students", error);
    return NextResponse.json(
      { message: "Unable to import students at this time. Please try again later." },
      { status: 500 },
    );
  }
}
