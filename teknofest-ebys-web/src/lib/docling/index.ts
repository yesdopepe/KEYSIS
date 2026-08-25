import "server-only";
import { Agent } from "undici";

// Trailing slash stripped so `${DOCLING_URL}/convert` can't become
// `.../convert` with a doubled slash (a bare "https://host/" 404s otherwise).
const DOCLING_URL = (process.env.DOCLING_SERVICE_URL ?? "http://localhost:8100").replace(/\/+$/, "");
/** Only needed once the service runs somewhere other than localhost — see services/docling-service/main.py. */
const DOCLING_SHARED_SECRET = process.env.DOCLING_SHARED_SECRET;

// Node's default fetch dispatcher aborts a request after 5 minutes of no
// response (headersTimeout/bodyTimeout), which a large scanned PDF's OCR
// pass can genuinely exceed — that's Docling still working, not a hang.
const UZUN_ISLEM_DISPATCHER = new Agent({
  headersTimeout: 30 * 60 * 1000,
  bodyTimeout: 30 * 60 * 1000,
});

/**
 * Extracts text from an uploaded file via the local Docling service. Shared
 * by every upload path (knowledge base, mevzuat, chat attachments) so they
 * all handle a missing service the same way.
 */
export async function dosyadanMetinCikar(dosya: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", dosya, dosya.name);

  const res = await fetch(`${DOCLING_URL}/convert`, {
    method: "POST",
    body: formData,
    headers: DOCLING_SHARED_SECRET
      ? { Authorization: `Bearer ${DOCLING_SHARED_SECRET}` }
      : undefined,
    dispatcher: UZUN_ISLEM_DISPATCHER,
  } as RequestInit);
  if (!res.ok) {
    throw new Error(
      `Belge ayrıştırma servisi hata döndürdü (${res.status}). Docling servisinin çalıştığından emin olun.`
    );
  }

  const data = (await res.json()) as { raw_text: string };
  return data.raw_text;
}
