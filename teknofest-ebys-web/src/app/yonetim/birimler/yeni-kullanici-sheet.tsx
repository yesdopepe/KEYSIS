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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SubmitButton } from "../_components/submit-button";
import { kullaniciOlusturAction } from "./actions";

const ROL_YOK = "__yok__";

export function YeniKullaniciSheet({
  kurumId,
  birimId,
  roller,
}: {
  kurumId: string;
  birimId: string;
  roller: { id: string; ad: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus size={16} aria-hidden="true" />
        Kullanıcı Ekle
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Yeni kullanıcı ekle</SheetTitle>
          <SheetDescription>Bu birime yeni bir personel hesabı tanımlayın.</SheetDescription>
        </SheetHeader>
        <form
          key={String(open)}
          action={async (formData) => {
            const rol = formData.get("rol_id");
            if (rol === ROL_YOK) formData.set("rol_id", "");
            await kullaniciOlusturAction(kurumId, birimId, formData);
            setOpen(false);
          }}
          className="space-y-4 px-4"
        >
          <Field label="Kullanıcı adı" htmlFor="kullanici_adi" required>
            <Input id="kullanici_adi" name="kullanici_adi" required className={inputClasses} />
          </Field>
          <Field label="Şifre" htmlFor="sifre" required>
            <Input id="sifre" name="sifre" type="password" required className={inputClasses} />
          </Field>
          <Field label="Ad Soyad" htmlFor="ad_soyad" required>
            <Input id="ad_soyad" name="ad_soyad" required className={inputClasses} />
          </Field>
          <Field label="Rol" htmlFor="rol_id" hint="Rol seçilirse hiyerarşi seviyesi ve unvan rolden alınır.">
            <Select
              name="rol_id"
              defaultValue={ROL_YOK}
              items={{ [ROL_YOK]: "(rol yok — elle belirle)", ...Object.fromEntries(roller.map((r) => [r.id, r.ad])) }}
            >
              <SelectTrigger id="rol_id" className={cn(inputClasses, "w-full justify-between font-normal")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROL_YOK}>(rol yok — elle belirle)</SelectItem>
                {roller.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.ad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hiyerarşi seviyesi" htmlFor="hiyerarsi_seviyesi" hint="Rol seçilmediyse kullanılır.">
              <Select
                name="hiyerarsi_seviyesi"
                defaultValue="1"
                items={{ "1": "1 — Memur", "2": "2 — Şube Müdürü", "3": "3 — Daire Başkanı" }}
              >
                <SelectTrigger id="hiyerarsi_seviyesi" className={cn(inputClasses, "w-full justify-between font-normal")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Memur</SelectItem>
                  <SelectItem value="2">2 — Şube Müdürü</SelectItem>
                  <SelectItem value="3">3 — Daire Başkanı</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Unvan" htmlFor="unvan" hint="Rol seçilmediyse kullanılır.">
              <Input id="unvan" name="unvan" placeholder="Memur" className={inputClasses} />
            </Field>
          </div>
          <SheetFooter className="px-0">
            <SubmitButton>
              <Plus size={18} aria-hidden="true" />
              Kullanıcı Ekle
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
