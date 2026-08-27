"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { vatandasSohbetiKaldir } from "@/lib/auth/vatandas-session";
import { sohbetiSil, sohbetiYenidenAdlandir } from "@/lib/sohbet";

async function sahipBilgisi() {
  const session = await getSession();
  if (session) {
    return {
      userId: session.userId,
      kurumId: session.kurumId,
      birimId: session.birimId,
    };
  }
  return {
    userId: "u_vatandas",
    kurumId: "belediye_ornek",
    birimId: "belediye_ornek:YZI",
  };
}

export async function sohbetAdiniDegistir(sohbetId: string, formData: FormData) {
  const baslik = String(formData.get("baslik") ?? "").trim();
  if (!baslik) return;

  // Scoped inside sohbetiYenidenAdlandir — a chat belonging to someone else
  // simply matches no rows rather than throwing.
  await sohbetiYenidenAdlandir(await sahipBilgisi(), sohbetId, baslik.slice(0, 80));
  revalidatePath("/panel/asistan");
  revalidatePath("/basvuru/asistan");
}

export async function sohbetiKaldir(sohbetId: string) {
  await sohbetiSil(await sahipBilgisi(), sohbetId);
  await vatandasSohbetiKaldir(sohbetId);
  revalidatePath("/panel/asistan");
  revalidatePath("/basvuru/asistan");
}
