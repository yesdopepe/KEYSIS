import { Checkbox } from "@/components/ui/checkbox";

const SEVIYELER = [
  { deger: 1, etiket: "Memur" },
  { deger: 2, etiket: "Şube Müdürü" },
  { deger: 3, etiket: "Daire Başkanı" },
] as const;

/**
 * Shared by the "yeni birim" and birim-edit forms — both submit the same
 * name="seviye" checkbox group that seviyeleriOku() in actions.ts reads.
 */
export function OnayZinciriCheckboxes({
  defaultSelected,
  hint,
}: {
  defaultSelected: number[];
  hint?: string;
}) {
  return (
    <div>
      <span className="block text-sm font-semibold text-foreground">Onay zinciri seviyeleri</span>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-4">
        {SEVIYELER.map((s) => (
          <label key={s.deger} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox name="seviye" value={String(s.deger)} defaultChecked={defaultSelected.includes(s.deger)} />
            {s.etiket}
          </label>
        ))}
      </div>
    </div>
  );
}
