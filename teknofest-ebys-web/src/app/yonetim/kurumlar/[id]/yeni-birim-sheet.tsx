"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Field, inputClasses } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OnayZinciriCheckboxes } from "../../_components/onay-zinciri-checkboxes";
import { SubmitButton } from "../../_components/submit-button";
import { birimOlusturAction } from "../../birimler/actions";

const UST_BIRIM_YOK = "__yok__";

export function YeniBirimSheet({
  kurumId,
  birimlerListesi,
}: {
  kurumId: string;
  birimlerListesi: { id: string; ad: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus size={16} aria-hidden="true" />
        Birim Ekle
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Yeni birim ekle</SheetTitle>
          <SheetDescription>Bu kurumun altına yeni bir birim tanımlayın.</SheetDescription>
        </SheetHeader>
        <form
          key={String(open)}
          action={async (formData) => {
            const ustBirim = formData.get("parent_birim_id");
            if (ustBirim === UST_BIRIM_YOK) formData.set("parent_birim_id", "");
            await birimOlusturAction(kurumId, formData);
            setOpen(false);
          }}
          className="space-y-4 px-4"
        >
          <Field label="Birim adı" htmlFor="ad_birim" required>
            <Input id="ad_birim" name="ad" required placeholder="örn. Fen İşleri Müdürlüğü" className={inputClasses} />
          </Field>
          <Field label="Birim kodu" htmlFor="kod" required hint="Kurum içinde benzersiz kısa kod, örn. FEN">
            <Input id="kod" name="kod" required className={inputClasses} />
          </Field>
          <Field label="Üst birim" htmlFor="parent_birim_id" hint="İsteğe bağlı; bu birim başka bir birime bağlıysa seçin.">
            <Select
              name="parent_birim_id"
              defaultValue={UST_BIRIM_YOK}
              items={{ [UST_BIRIM_YOK]: "(yok)", ...Object.fromEntries(birimlerListesi.map((b) => [b.id, b.ad])) }}
            >
              <SelectTrigger id="parent_birim_id" className={cn(inputClasses, "w-full justify-between font-normal")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UST_BIRIM_YOK}>(yok)</SelectItem>
                {birimlerListesi.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.ad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SDP kodu başlangıç" htmlFor="sdp_kodu_baslangic">
              <Input id="sdp_kodu_baslangic" name="sdp_kodu_baslangic" className={inputClasses} />
            </Field>
            <Field label="SDP kodu bitiş" htmlFor="sdp_kodu_bitis">
              <Input id="sdp_kodu_bitis" name="sdp_kodu_bitis" className={inputClasses} />
            </Field>
          </div>
          <OnayZinciriCheckboxes defaultSelected={[2]} hint="Bu birimde bir belge/evrak hangi sırayla onaylanır." />
          <Field
            label="Açıklama"
            htmlFor="aciklama_birim"
            hint="Bu birim ne tür başvurulara bakar? Boş bırakılırsa yönlendirme asistanı bu birimi otomatik bulamaz."
          >
            <Textarea id="aciklama_birim" name="aciklama" rows={3} className={inputClasses} />
          </Field>
          <SheetFooter className="px-0">
            <SubmitButton>
              <Plus size={18} aria-hidden="true" />
              Birim Ekle
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
