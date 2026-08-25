"use client";

import { useState } from "react";
import { Trash } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { rolSilAction } from "./actions";

export function RolSilButton({ rolId, rolAdi }: { rolId: string; rolAdi: string }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Trash size={16} aria-hidden="true" />
        Sil
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>“{rolAdi}” rolünü sil</AlertDialogTitle>
          <AlertDialogDescription>
            Bu işlem geri alınamaz. Role hâlâ atanmış kullanıcı varsa silme işlemi reddedilir — önce onları başka
            bir role atamanız gerekir.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              await rolSilAction(rolId);
              setOpen(false);
            }}
          >
            Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
