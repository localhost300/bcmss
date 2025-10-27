import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "uploads");
const TEMP_UPLOADS = path.join(os.tmpdir(), "uploads");

const getContentType = (filename: string) => {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
};

const readFileIfExists = async (targetPath: string) => {
  try {
    const data = await fs.readFile(targetPath);
    return data;
  } catch (error) {
    return null;
  }
};

export async function GET(
  _request: NextRequest,
  context: { params: { filename: string } },
) {
  const filename = context.params?.filename ?? "";
  if (!filename) {
    return NextResponse.json({ message: "File name is required." }, { status: 400 });
  }

  const safeName = path.basename(filename);
  const publicPath = path.join(PUBLIC_UPLOADS, safeName);
  const tempPath = path.join(TEMP_UPLOADS, safeName);

  const publicFile = await readFileIfExists(publicPath);
  if (publicFile) {
    return new NextResponse(publicFile, {
      status: 200,
      headers: {
        "Content-Type": getContentType(safeName),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const tempFile = await readFileIfExists(tempPath);
  if (tempFile) {
    return new NextResponse(tempFile, {
      status: 200,
      headers: {
        "Content-Type": getContentType(safeName),
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ message: "File not found." }, { status: 404 });
}
