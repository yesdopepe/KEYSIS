"use client";

import { Sparkle } from "@phosphor-icons/react/ssr";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";

export const ORNEK_SORULAR = [
  "Sokağımızdaki yol ve kaldırım onarımı için Fen İşleri Müdürlüğüne resmi bir dilekçe hazırla.",
  "İmar durumu ve inşaat ruhsatı başvurusunda hangi belgeler zorunludur?",
  "Apartmandaki aşırı gürültü ve zabıta denetimi için resmi dilekçe taslağı oluştur.",
];

/** The line above the composer before the first turn. */
export function SohbetKarsilamasi() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 pb-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-info-bg text-primary">
        <Sparkle size={22} weight="fill" aria-hidden="true" />
      </span>
      <h2 className="font-heading text-2xl font-semibold text-foreground">
        Size nasıl yardımcı olabilirim?
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Kurumunuzun bilgi tabanı ve mevzuat külliyatından yanıt verir, her yanıtta kaynağını
        belirtir. Sohbete belge veya görsel ekleyebilir, yetkiniz dahilinde belge taslağı
        oluşturabilirsiniz.
      </p>
    </div>
  );
}

/** Starter prompts, shown under the composer only on an empty conversation. */
export function OrnekSorular({ sec }: { sec: (soru: string) => void }) {
  return (
    <Suggestions className="px-4 pt-4">
      {ORNEK_SORULAR.map((soru) => (
        <Suggestion key={soru} suggestion={soru} onClick={sec} className="shrink-0" />
      ))}
    </Suggestions>
  );
}
