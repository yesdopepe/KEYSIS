"use client";

import { DownloadSimple, CaretDown, FilePdf, FileDoc, FileArrowDown } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BELGE_FORMATLARI } from "@/lib/belgeler/formatlar";

const ETIKETLER = {
  pdf: { ad: "PDF", Ikon: FilePdf, aciklama: "Yazdırılabilir PDF" },
  docx: { ad: "Word (DOCX)", Ikon: FileDoc, aciklama: "Düzenlenebilir Word belgesi" },
  udf: { ad: "UYAP (UDF)", Ikon: FileArrowDown, aciklama: "UYAP Doküman Formatı" },
} as const;

/**
 * The same three export links as IndirmeButonlari, collapsed into one
 * menu. Used where the download is a secondary action sharing a toolbar
 * with the document's own controls, and three full-width buttons would
 * dominate the header.
 */
export function IndirmeMenusu({ temelHref, size = "sm" }: { temelHref: string; size?: "sm" | "md" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size={size} />}>
        <DownloadSimple size={16} aria-hidden="true" />
        İndir
        <CaretDown size={12} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {BELGE_FORMATLARI.map((format) => {
          const { ad, Ikon, aciklama } = ETIKETLER[format];
          return (
            <DropdownMenuItem
              key={format}
              className="gap-2 px-2 py-1.5"
              render={<a href={`${temelHref}?format=${format}`} />}
            >
              <Ikon size={18} className="text-primary" aria-hidden="true" />
              <span className="flex flex-col">
                <span className="font-medium">{ad}</span>
                <span className="text-xs text-muted-foreground">{aciklama}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
