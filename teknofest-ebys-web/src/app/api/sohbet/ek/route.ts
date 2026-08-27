import { getSession } from "@/lib/auth/session";
import { sohbetEkiEkle, sohbetiSagla } from "@/lib/sohbet";

export const maxDuration = 60;

/**
 * Uploads one file into a single conversation. The file is stored outside
 * public/ and its text (if any) is indexed only under this conversation's
 * namespace — it never joins the institution knowledge base.
 */
export async function POST(req: Request) {
  const session = (await getSession()) || {
    userId: "u_vatandas",
    kurumId: "belediye_ornek",
    birimId: "belediye_ornek:YZI",
  };

  const formData = await req.formData();
  const sohbetId = String(formData.get("sohbetId") ?? "");
  const dosya = formData.get("dosya");

  if (!sohbetId) return Response.json({ hata: "Sohbet kimliği eksik." }, { status: 400 });
  if (!(dosya instanceof File) || dosya.size === 0) {
    return Response.json({ hata: "Dosya bulunamadı." }, { status: 400 });
  }

  const sahip = {
    userId: session.userId,
    kurumId: session.kurumId,
    birimId: session.birimId,
  };

  // An attachment may arrive before the first message, so the conversation
  // is created on demand — still scoped to this user and institution.
  await sohbetiSagla(sahip, sohbetId);

  try {
    const ek = await sohbetEkiEkle(sahip, sohbetId, dosya);
    return Response.json(ek);
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "Ek yüklenemedi.";
    return Response.json({ hata: mesaj }, { status: 422 });
  }
}
