"use client";

import { useState } from "react";
import { Plus, PencilSimple } from "@phosphor-icons/react/ssr";
import type { roller } from "@/lib/db/schema";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SubmitButton } from "../_components/submit-button";
import { rolOlusturAction, rolGuncelleAction } from "./actions";

type Rol = typeof roller.$inferSelect;

const ONAY_YOK = "__yok__";

/** Handles both "Yeni Rol" (no `rol` prop) and per-row "Düzenle" (with `rol`). */
export function RolDialog({ rol }: { rol?: Rol }) {
  const [open, setOpen] = useState(false);
  const duzenlemeModu = rol != null;
  const idOnek = rol?.id ?? "yeni";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {duzenlemeModu ? (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <PencilSimple size={14} aria-hidden="true" />
          Düzenle
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus size={18} aria-hidden="true" />
          Yeni Rol
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{duzenlemeModu ? "Rolü düzenle" : "Yeni rol ekle"}</DialogTitle>
          <DialogDescription>
            Bir rolü düzenlemek, ona atanmış her kullanıcının onay seviyesini ve unvanını da günceller.
          </DialogDescription>
        </DialogHeader>
        <form
          key={String(open)}
          action={async (formData) => {
            const seviye = formData.get("onay_seviyesi");
            if (seviye === ONAY_YOK) formData.set("onay_seviyesi", "");
            if (duzenlemeModu) {
              await rolGuncelleAction(rol.id, formData);
            } else {
              await rolOlusturAction(formData);
            }
            setOpen(false);
          }}
          className="space-y-4"
        >
          <Field label="Rol adı" htmlFor={`ad-${idOnek}`} required>
            <Input id={`ad-${idOnek}`} name="ad" defaultValue={rol?.ad} required className={inputClasses} />
          </Field>
          <Field label="Açıklama" htmlFor={`aciklama-${idOnek}`}>
            <Input id={`aciklama-${idOnek}`} name="aciklama" defaultValue={rol?.aciklama ?? ""} className={inputClasses} />
          </Field>
          <Field
            label="Onay seviyesi"
            htmlFor={`onay_seviyesi-${idOnek}`}
            hint="Bu rol bir onay zincirinde hangi seviyeyi temsil eder — boş bırakılırsa bu rol hiçbir şeyi onaylayamaz."
          >
            <Select
              name="onay_seviyesi"
              defaultValue={rol?.onaySeviyesi != null ? String(rol.onaySeviyesi) : ONAY_YOK}
              items={{ [ONAY_YOK]: "(onaylamaz)", "1": "1 — Memur", "2": "2 — Şube Müdürü", "3": "3 — Daire Başkanı" }}
            >
              <SelectTrigger id={`onay_seviyesi-${idOnek}`} className={cn(inputClasses, "w-full justify-between font-normal")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ONAY_YOK}>(onaylamaz)</SelectItem>
                <SelectItem value="1">1 — Memur</SelectItem>
                <SelectItem value="2">2 — Şube Müdürü</SelectItem>
                <SelectItem value="3">3 — Daire Başkanı</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <Checkbox name="mevzuat_yonetimi" defaultChecked={rol?.mevzuatYonetimi} />
              Mevzuat yönetimi
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <Checkbox name="bilgi_tabani_yonetimi" defaultChecked={rol?.bilgiTabaniYonetimi} />
              Kurum bilgi tabanı yönetimi
            </label>
          </div>
          <DialogFooter>
            <SubmitButton>{duzenlemeModu ? "Değişiklikleri Kaydet" : "Rol Ekle"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
