"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { sohbetiSil, sohbetiYenidenAdlandir } from "@/lib/sohbet";

async function sahipBilgisi() {
  const session = await oturumZorunluKil();
  return {
    userId: session.userId,
    kurumId: session.kurumId,
    birimId: session.birimId,
  };
}

export async function sohbetAdiniDegistir(sohbetId: string, formData: FormData) {
  const baslik = String(formData.get("baslik") ?? "").trim();
  if (!baslik) return;

  // Scoped inside sohbetiYenidenAdlandir — a chat belonging to someone else
  // simply matches no rows rather than throwing.
  await sohbetiYenidenAdlandir(await sahipBilgisi(), sohbetId, baslik.slice(0, 80));
  revalidatePath("/panel/asistan");
}

export async function sohbetiKaldir(sohbetId: string) {
  await sohbetiSil(await sahipBilgisi(), sohbetId);
  revalidatePath("/panel/asistan");
  redirect("/panel/asistan");
}
