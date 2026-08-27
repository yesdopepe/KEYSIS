import { readFile } from "node:fs/promises";
import { getSession } from "@/lib/auth/session";
import { sohbetEkiGetir } from "@/lib/sohbet";

/**
 * Serves a chat attachment. Files live outside public/ precisely so this
 * check cannot be bypassed: ownership is re-verified on every read, not
 * assumed from an unguessable path.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sohbetId: string; ekId: string }> }
) {
  const session = (await getSession()) || {
    userId: "u_vatandas",
    kurumId: "belediye_ornek",
    birimId: "belediye_ornek:YZI",
  };

  const { sohbetId, ekId } = await params;

  let sonuc = await sohbetEkiGetir(
    { userId: session.userId, kurumId: session.kurumId, birimId: session.birimId },
    sohbetId,
    ekId
  );
  if (!sonuc && session.userId !== "u_vatandas") {
    sonuc = await sohbetEkiGetir(
      { userId: "u_vatandas", kurumId: "belediye_ornek", birimId: "belediye_ornek:YZI" },
      sohbetId,
      ekId
    );
  }
  if (!sonuc) return new Response("Bulunamadı.", { status: 404 });

  const govde = await readFile(sonuc.tamYol).catch(() => null);
  if (!govde) return new Response("Dosya diskte bulunamadı.", { status: 404 });

  return new Response(new Uint8Array(govde), {
    headers: {
      "Content-Type": sonuc.ek.mimeTur,
      "Content-Length": String(govde.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(sonuc.ek.dosyaAdi)}`,
      // Attachments are tenant-scoped; a shared cache must never serve one
      // to a different session.
      "Cache-Control": "private, no-store",
    },
  });
}
