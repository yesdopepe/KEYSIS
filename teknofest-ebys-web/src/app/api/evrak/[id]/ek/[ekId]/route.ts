import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const VERI_DIZINI = "./data";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; ekId: string }> }
) {
  const { id: evrakId, ekId } = await context.params;

  // Retrieve attachment record from database
  const [ek] = await db
    .select()
    .from(schema.evrakEkleri)
    .where(
      and(
        eq(schema.evrakEkleri.id, ekId),
        eq(schema.evrakEkleri.evrakId, evrakId)
      )
    );

  if (!ek) {
    return new Response("Ek dosya bulunamadı.", { status: 404 });
  }

  // Access check: either staff with active session, or check if evrak exists
  const session = await getSession();
  if (!session) {
    // Check if valid citizen tracking or staff
    const [evrak] = await db
      .select({ id: schema.evraklar.id })
      .from(schema.evraklar)
      .where(eq(schema.evraklar.id, evrakId));

    if (!evrak) {
      return new Response("Yetkisiz erişim.", { status: 403 });
    }
  }

  const tamYol = path.join(VERI_DIZINI, ek.diskYolu);

  try {
    const dosyaIstatistigi = await stat(tamYol);
    if (!dosyaIstatistigi.isFile()) {
      return new Response("Dosya sunucuda bulunamadı.", { status: 404 });
    }

    const dosyaTamponu = await readFile(tamYol);
    const mimeTur = ek.mimeTur || "application/octet-stream";
    const tarayicidaGoruntulenebilir =
      mimeTur.startsWith("image/") ||
      mimeTur === "application/pdf" ||
      mimeTur.startsWith("text/");

    const headers = new Headers();
    headers.set("Content-Type", mimeTur);
    headers.set("Content-Length", dosyaIstatistigi.size.toString());
    headers.set(
      "Content-Disposition",
      `${tarayicidaGoruntulenebilir ? "inline" : "attachment"}; filename="${encodeURIComponent(ek.ad)}"`
    );
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(dosyaTamponu, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("Ek dosya okuma hatası:", err);
    return new Response("Dosya okunamadı.", { status: 500 });
  }
}
