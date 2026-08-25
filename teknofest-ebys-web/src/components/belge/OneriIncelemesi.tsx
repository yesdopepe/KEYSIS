import { diffWordsWithSpace } from "diff";
import { Sparkle, User, Check, X, WarningCircle } from "@phosphor-icons/react/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OneriKaydi } from "@/lib/belgeler/oneriler";

/**
 * Word-level track-changes view of one proposed revision of the whole
 * document body. Insertions and deletions are marked with <ins>/<del> so
 * the change is legible without reading both versions side by side.
 */
function Fark({ onceki, sonraki }: { onceki: string; sonraki: string }) {
  const parcalar = diffWordsWithSpace(onceki, sonraki);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {parcalar.map((p, i) => {
        if (p.added) {
          return (
            <ins key={i} className="rounded-sm bg-success-bg text-success no-underline">
              {p.value}
            </ins>
          );
        }
        if (p.removed) {
          return (
            <del key={i} className="rounded-sm bg-destructive-bg text-destructive">
              {p.value}
            </del>
          );
        }
        return <span key={i}>{p.value}</span>;
      })}
    </p>
  );
}

export interface OneriIncelemesiProps {
  oneri: OneriKaydi;
  /** Current body text, to detect that the document moved on underneath. */
  guncelMetin: string;
  kabulEt: (formData: FormData) => void;
  reddet: (formData: FormData) => void;
  duzenlenebilir: boolean;
}

export function OneriIncelemesi({
  oneri,
  guncelMetin,
  kabulEt,
  reddet,
  duzenlenebilir,
}: OneriIncelemesiProps) {
  const cakisma = guncelMetin !== oneri.oncekiMetin;
  const YapanIkon = oneri.kaynak === "ai" ? Sparkle : User;

  return (
    <Card className="border-warning-border bg-warning-bg/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <YapanIkon size={16} weight="fill" className="text-warning" aria-hidden="true" />
          {oneri.kaynak === "ai" ? "AI önerisi" : `Öneri: ${oneri.olusturanAdSoyad ?? "kullanıcı"}`}
        </p>
        <span className="text-xs text-muted-foreground">
          {oneri.olusturmaZamani.toLocaleString("tr-TR")}
        </span>
      </div>

      {oneri.gerekce && (
        <p className="mt-1.5 text-xs text-muted-foreground">Gerekçe: {oneri.gerekce}</p>
      )}

      <div className="mt-3 rounded-[var(--radius-control)] border border-border bg-card p-3">
        <Fark onceki={oneri.oncekiMetin} sonraki={oneri.oneriMetin} />
      </div>

      {cakisma && (
        <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] border border-destructive-border bg-destructive-bg p-2.5">
          <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-xs text-destructive">
            Belge öneri hazırlandıktan sonra değiştirilmiş. Öneriyi uygulamak
            mevcut metnin üzerine yazacağı için kabul devre dışı bırakıldı;
            değişikliği inceleyip reddedin ve gerekiyorsa yeni öneri isteyin.
          </p>
        </div>
      )}

      {duzenlenebilir && (
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={kabulEt}>
            <input type="hidden" name="oneri_id" value={oneri.id} />
            <Button type="submit" variant="accent" disabled={cakisma}>
              <Check size={18} aria-hidden="true" />
              Kabul Et
            </Button>
          </form>
          <form action={reddet}>
            <input type="hidden" name="oneri_id" value={oneri.id} />
            <Button type="submit" variant="outline">
              <X size={18} aria-hidden="true" />
              Reddet
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
