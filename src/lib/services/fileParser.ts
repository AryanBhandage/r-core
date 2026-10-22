// ============================================================================
// Resume File Parser
// ----------------------------------------------------------------------------
// Extracts raw text from an uploaded resume. Supports PDF (primary) and plain
// text. Unsupported formats produce a clear, user-facing error.
// ============================================================================

import fs from "fs";

export async function extractFileText(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; format: string }> {
  const name = filename.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = buffer.toString("utf-8").replace(/\u0000/g, "").trim();
    if (!text) throw new Error("The text file is empty.");
    return { text, format: "text" };
  }

  if (name.endsWith(".pdf")) {
    // write to temp file for pdf-parse (stream API)
    const tmp = `/tmp/reqcore-${Date.now()}.pdf`;
    fs.writeFileSync(tmp, buffer);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdf = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const data = await pdf(fs.readFileSync(tmp));
      const text = data.text.replace(/\u0000/g, "").trim();
      if (!text) throw new Error("Could not extract any text from the PDF.");
      return { text, format: "pdf" };
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  if (name.endsWith(".docx")) {
    throw new Error(
      "DOCX parsing is not enabled in this build. Please upload a PDF or TXT resume."
    );
  }

  throw new Error(
    "Unsupported file format. Please upload a PDF or TXT resume."
  );
}
