"use client";

import { useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, inputClasses } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "../_components/submit-button";
import { kurumOlusturAction } from "./actions";

export function YeniKurumDialog() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus size={18} aria-hidden="true" />
        Yeni Kurum
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni kurum ekle</DialogTitle>
          <DialogDescription>Kurumun adını ve haberleşme kodunu girin.</DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          action={async (formData) => {
            await kurumOlusturAction(formData);
            setOpen(false);
            formRef.current?.reset();
          }}
          className="space-y-4"
        >
          <Field label="Kurum adı" htmlFor="ad" required>
            <Input id="ad" name="ad" required placeholder="örn. Örnek Belediye Başkanlığı" className={inputClasses} />
          </Field>
          <Field label="Haberleşme kodu" htmlFor="haberlesme_kodu" required hint="örn. B.10.1.TKH.0.73.00.00">
            <Input id="haberlesme_kodu" name="haberlesme_kodu" required className={inputClasses} />
          </Field>
          <Field label="Açıklama" htmlFor="aciklama" hint="İsteğe bağlı; bu kurum ve genel iş alanı hakkında kısa bilgi.">
            <Textarea id="aciklama" name="aciklama" rows={3} className={inputClasses} />
          </Field>
          <DialogFooter>
            <SubmitButton>
              <Plus size={18} aria-hidden="true" />
              Kurum Ekle
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
