import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";

export const maxDuration = 30;

/**
 * POST /api/upload/resume
 *
 * Accepts a PDF file as multipart/form-data (field name: "file").
 * Reads the file into a buffer, extracts raw text with pdf-parse,
 * and returns the cleaned text.
 *
 * Body: FormData { file: File }
 * Response: { text: string }
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 415 }
    );
  }

  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    const result = await pdfParse(buffer);
    text = result.text;
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not parse this PDF. Try a different file or paste your resume as plain text instead.",
      },
      { status: 422 }
    );
  }

  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) {
    return NextResponse.json(
      {
        error:
          "Could not extract text from this PDF. Try pasting your resume as plain text instead.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ text: cleaned });
}
