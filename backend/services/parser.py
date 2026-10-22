"""Resume file parser: PDF and DOCX text extraction."""
from __future__ import annotations
import io


def extract_file(filename: str, content: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        from pdfminer.high_level import extract_text
        return extract_text(io.BytesIO(content)).replace("\x00", "").strip()
    if name.endswith(".docx"):
        from docx import Document
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs).strip()
    if name.endswith((".txt", ".md")):
        return content.decode("utf-8", errors="replace").replace("\x00", "").strip()
    raise ValueError("Unsupported file format. Please upload a PDF, DOCX, or TXT resume.")
