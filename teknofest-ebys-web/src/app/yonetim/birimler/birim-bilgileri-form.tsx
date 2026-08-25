"use client";

import type { birimler } from "@/lib/db/schema";
import { Field, inputClasses } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OnayZinciriCheckboxes } from "../_components/onay-zinciri-checkboxes";
import { SubmitButton } from "../_components/submit-button";
import { birimGuncelleAction } from "./actions";

type Birim = typeof birimler.$inferSelect;

const UST_BIRIM_YOK = "__yok__";

export function BirimBilgileriForm({
  birim,
  ustBirimAdaylari,
  secilenSeviyeler,
}: {
  birim: Birim;
  ustBirimAdaylari: { id: string; ad: string }[];
  secilenSeviyeler: number[];
}) {
  return (
    <form
      action={async (formData) => {
        const ust = formData.get("parent_birim_id");
        if (ust === UST_BIRIM_YOK) formData.set("parent_birim_id", "");
        await birimGuncelleAction(birim.id, birim.kurumId, formData);
      }}
      className="mt-3 space-y-4"
    >
      <Field label="Birim adı" htmlFor="ad" required>
        <Input id="ad" name="ad" defaultValue={birim.ad} required className={inputClasses} />
      </Field>
      <Field label="Birim kodu" htmlFor="kod" required>
        <Input id="kod" name="kod" defaultValue={birim.kod} required className={inputClasses} />
      </Field>
      <Field label="Üst birim" htmlFor="parent_birim_id">
        <Select
          name="parent_birim_id"
          defaultValue={birim.parentBirimId ?? UST_BIRIM_YOK}
          items={{ [UST_BIRIM_YOK]: "(yok)", ...Object.fromEntries(ustBirimAdaylari.map((b) => [b.id, b.ad])) }}
        >
          <SelectTrigger id="parent_birim_id" className={cn(inputClasses, "w-full justify-between font-normal")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UST_BIRIM_YOK}>(yok)</SelectItem>
            {ustBirimAdaylari.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.ad}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SDP kodu başlangıç" htmlFor="sdp_kodu_baslangic">
          <Input
            id="sdp_kodu_baslangic"
            name="sdp_kodu_baslangic"
            defaultValue={birim.sdpKoduBaslangic ?? ""}
            className={inputClasses}
          />
        </Field>
        <Field label="SDP kodu bitiş" htmlFor="sdp_kodu_bitis">
          <Input id="sdp_kodu_bitis" name="sdp_kodu_bitis" defaultValue={birim.sdpKoduBitis ?? ""} className={inputClasses} />
        </Field>
      </div>
      <OnayZinciriCheckboxes defaultSelected={secilenSeviyeler} />
      <Field
        label="Açıklama"
        htmlFor="aciklama"
        hint="Bu birim ne tür başvurulara bakar? Boş bırakılırsa yönlendirme asistanı bu birimi otomatik bulamaz."
      >
        <Textarea id="aciklama" name="aciklama" rows={3} defaultValue={birim.aciklama ?? ""} className={inputClasses} />
      </Field>
      <SubmitButton variant="outline">Değişiklikleri Kaydet</SubmitButton>
    </form>
  );
}
