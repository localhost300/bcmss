import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const ensureUploadsDir = async (uploadsDir: string) => {
  await fs.mkdir(uploadsDir, { recursive: true });
};

const isBlobAvailable = () =>
  Boolean(process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN);

const uploadWithBlob = async (key: string, buffer: Buffer, contentType: string) => {
  const blob = await put(key, buffer, {
    access: "public",
    contentType,
  });
  return blob.url;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Attach an image file to upload." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      return NextResponse.json(
        { message: "Only JPEG, PNG, WEBP or GIF images are supported." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ message: "Image is too large (max 5MB)." }, { status: 400 });
    }

    const extension = ALLOWED_IMAGE_TYPES[file.type];
    const uniqueName = `${Date.now()}-${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (isBlobAvailable()) {
      try {
        const publicUrl = await uploadWithBlob(`uploads/${uniqueName}`, buffer, file.type);

        return NextResponse.json(
          {
            message: "Upload successful.",
            data: {
              url: publicUrl,
              size: file.size,
              type: file.type,
              name: uniqueName,
            },
          },
          { status: 201 },
        );
      } catch (blobError) {
        console.warn("[Uploads API] Falling back to local storage", blobError);
      }
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const destinationPath = path.join(uploadsDir, uniqueName);

    try {
      await ensureUploadsDir(uploadsDir);
      await fs.writeFile(destinationPath, buffer);
    } catch (fsError) {
      const tempDir = path.join(os.tmpdir(), "uploads");
      await ensureUploadsDir(tempDir);
      const tempPath = path.join(tempDir, uniqueName);
      await fs.writeFile(tempPath, buffer);

      return NextResponse.json(
        {
          message:
            "Upload completed, but serving from temporary storage. Configure persistent storage for production.",
          data: {
            url: `/api/uploads/${uniqueName}`,
            size: file.size,
            type: file.type,
            name: uniqueName,
          },
        },
        { status: 202 },
      );
    }

    const publicUrl = `/uploads/${uniqueName}`;

    return NextResponse.json(
      {
        message: "Upload successful.",
        data: {
          url: publicUrl,
          size: file.size,
          type: file.type,
          name: uniqueName,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Uploads API] Failed to upload file", error);
    return NextResponse.json(
      { message: "Unable to upload file right now. Please try again later." },
      { status: 500 },
    );
  }
}
