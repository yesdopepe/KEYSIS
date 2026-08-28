"use client";

import { useActionState } from "react";
import { SignIn, Warning } from "@phosphor-icons/react/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/Field";
import { Logo } from "@/components/Logo";
import { girisYap } from "./actions";

export default function GirisSayfasi() {
  const [state, formAction, isPending] = useActionState(girisYap, null);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center justify-center text-center">
          <Logo variant="full" size="2xl" className="max-w-[240px]" />
        </div>
        <h1 className="font-heading text-xl font-semibold text-foreground text-center">Personel Girişi</h1>

        <form action={formAction} className="mt-5 space-y-4">
          <Field label="Kullanıcı Adı" htmlFor="kullanici-adi" required>
            <input id="kullanici-adi" name="kullanici_adi" required autoFocus className={inputClasses} />
          </Field>

          <Field label="Şifre" htmlFor="sifre" required>
            <input id="sifre" name="sifre" type="password" required className={inputClasses} />
          </Field>

          {state?.hata && (
            <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <Warning size={16} aria-hidden="true" />
              {state.hata}
            </p>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            <SignIn size={18} aria-hidden="true" />
            {isPending ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Demo (MEB): memur_meb / mudur_meb / baskan_meb
            <br />
            Demo (Valilik): memur_elazig / mudur_elazig / baskan_elazig
            <br />
            (şifre: keysis123)
          </p>
        </form>
      </Card>
    </main>
  );
}
