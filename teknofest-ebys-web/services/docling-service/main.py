"""
Docling ingestion microservice.

One responsibility: converting an uploaded document (PDF, DOCX, image, etc. —
including scanned/OCR-needed files) to text, via the Python-only Docling
library the TypeScript stack cannot call directly. Called over HTTP from the
Next.js app.

Embedding used to happen here too (local sentence-transformers model) but
now goes straight from the Next.js app to the EVREN inference service's
embedding endpoint — see src/lib/ai/client.ts and src/lib/vektor/qdrant.ts.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="KEYSİS Docling Ingestion Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Unset by default (matches today's localhost-only setup: no auth needed).
# Set this once the service is reachable from outside localhost — e.g. run on
# a separate machine — since /convert otherwise accepts files from anyone who
# can reach the port. The Next.js app sends the same value as a Bearer token
# when DOCLING_SHARED_SECRET is set in its own .env (see lib/docling/index.ts).
DOCLING_SHARED_SECRET = os.environ.get("DOCLING_SHARED_SECRET")


def _yetki_dogrula(authorization: str | None = Header(default=None)):
    if not DOCLING_SHARED_SECRET:
        return
    if authorization != f"Bearer {DOCLING_SHARED_SECRET}":
        raise HTTPException(status_code=401, detail="Yetkisiz.")


_converter = None


def _get_converter():
    """Lazily construct the Docling converter (import is slow at startup)."""
    global _converter
    if _converter is None:
        from docling.document_converter import DocumentConverter

        _converter = DocumentConverter()
    return _converter


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert", dependencies=[Depends(_yetki_dogrula)])
async def convert(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Dosya adı eksik.")

    suffix = Path(file.filename).suffix or ""
    content = await file.read()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        converter = _get_converter()
        result = converter.convert(tmp_path)
        markdown_text = result.document.export_to_markdown()
    except Exception as exc:  # noqa: BLE001 - surface conversion failures to caller
        raise HTTPException(status_code=422, detail=f"Belge dönüştürülemedi: {exc}") from exc
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return {
        "raw_text": markdown_text,
        "source": file.filename,
        "content_type": file.content_type,
    }
