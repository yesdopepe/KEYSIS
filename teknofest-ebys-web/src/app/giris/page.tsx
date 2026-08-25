"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Buildings, SignIn, Warning } from "@phosphor-icons/react/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/Field";
import { girisYap } from "./actions";

export default function GirisSayfasi() {
  const [state, formAction, isPending] = useActionState(girisYap, null);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-primary text-on-primary">
            <Buildings size={20} weight="fill" aria-hidden="true" />
          </span>
          <Link href="/" className="font-heading text-sm font-semibold text-muted-foreground hover:text-foreground">
            e-Başvuru
          </Link>
        </div>
        <h1 className="font-heading text-xl font-semibold text-foreground">Personel Girişi</h1>

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
            Demo: memur_fen / mudur_fen / baskan_fen (şifre: ebys123)
          </p>
        </form>
      </Card>
    </main>
  );
}
