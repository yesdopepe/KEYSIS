import { FilePdf, FileDoc, FileArrowDown } from "@phosphor-icons/react/ssr";
import { BELGE_FORMATLARI } from "@/lib/belgeler/formatlar";

const ETIKETLER = {
  pdf: { ad: "PDF", Ikon: FilePdf, aciklama: "Yazdırılabilir PDF olarak indir" },
  docx: { ad: "Word (DOCX)", Ikon: FileDoc, aciklama: "Word belgesi olarak indir" },
  udf: { ad: "UYAP (UDF)", Ikon: FileArrowDown, aciklama: "UYAP Doküman Formatında indir" },
} as const;

/**
 * Download links for a document. Plain anchors rather than buttons — the
 * export routes stream a file, so letting the browser handle the navigation
 * avoids buffering the whole document in memory on the client.
 */
export function IndirmeButonlari({ temelHref }: { temelHref: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">İndir:</span>
      {BELGE_FORMATLARI.map((format) => {
        const { ad, Ikon, aciklama } = ETIKETLER[format];
        return (
          <a
            key={format}
            href={`${temelHref}?format=${format}`}
            title={aciklama}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Ikon size={18} aria-hidden="true" />
            {ad}
          </a>
        );
      })}
    </div>
  );
}
