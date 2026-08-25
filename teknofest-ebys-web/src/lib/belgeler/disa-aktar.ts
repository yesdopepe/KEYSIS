import "server-only";
import type { ResmiBelge } from "./resmi-belge";
import { dosyaAdiNormalize } from "./resmi-belge";
import { BELGE_MIME, type BelgeFormati } from "./formatlar";

/**
 * Renders and returns a document as a downloadable file. The renderers are
 * imported lazily so a PDF request never pulls in the DOCX writer (and,
 * more importantly, so the react-server layer never eagerly loads
 * @react-pdf/renderer).
 */
export async function belgeDosyaYaniti(
  belge: ResmiBelge,
  format: BelgeFormati,
  dosyaAdiTabani: string
): Promise<Response> {
  let govde: Buffer;
  if (format === "pdf") {
    govde = await (await import("./render/pdf")).pdfOlustur(belge);
  } else if (format === "docx") {
    govde = await (await import("./render/docx")).docxOlustur(belge);
  } else {
    govde = (await import("./render/udf")).udfOlustur(belge);
  }

  const ascii = `${dosyaAdiNormalize(dosyaAdiTabani)}.${format}`;
  const utf8 = encodeURIComponent(`${dosyaAdiTabani}.${format}`);

  return new Response(new Uint8Array(govde), {
    headers: {
      "Content-Type": BELGE_MIME[format],
      "Content-Length": String(govde.length),
      // Turkish filenames are not Latin-1, so the ASCII form is the
      // fallback and the UTF-8 form is what modern clients actually use.
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
      "Cache-Control": "no-store",
    },
  });
}
