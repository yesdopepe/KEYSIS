"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useCallback,
  type KeyboardEvent,
} from "react";
import {
  ListBullets,
  ListNumbers,
  Paragraph as ParagrafIkonu,
  TextH,
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  ArrowCounterClockwise,
  ArrowClockwise,
  FloppyDisk,
  CheckCircle,
  Plus,
  Calendar,
  Minus,
  Eraser,
  CaretDown,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Quotes,
  TextAa,
} from "@phosphor-icons/react/ssr";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { govdeBloklariniAyir, type ResmiBelge } from "@/lib/belgeler/resmi-belge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type BlokTuru = "paragraf" | "baslik" | "baslik3" | "liste" | "numarali_liste" | "alinti";

export const YAZI_TIPLERI = [
  {
    id: "times",
    ad: "Times New Roman",
    etiket: "Times New Roman (Resmi Standart)",
    font: '"Times New Roman", Times, "Tinos", "Liberation Serif", serif',
  },
  {
    id: "arial",
    ad: "Arial",
    etiket: "Arial (Resmi Alternatif)",
    font: 'Arial, Helvetica, "Liberation Sans", sans-serif',
  },
  {
    id: "calibri",
    ad: "Calibri",
    etiket: "Calibri (Modern Ofis)",
    font: 'Calibri, "Carlito", "Segoe UI", sans-serif',
  },
  {
    id: "georgia",
    ad: "Georgia",
    etiket: "Georgia (Klasik Serif)",
    font: 'Georgia, "DejaVu Serif", serif',
  },
  {
    id: "tinos",
    ad: "Tinos",
    etiket: "Tinos (Metrik Serif)",
    font: '"Tinos", "Times New Roman", Times, serif',
  },
];

function bosParagraf(): HTMLElement {
  const p = document.createElement("p");
  p.className = "mb-3 text-justify leading-[1.5] [text-indent:10mm]";
  p.appendChild(document.createElement("br"));
  return p;
}

function initSingleRootDocument(root: HTMLElement, model: ResmiBelge, defaultValue: string) {
  root.innerHTML = "";

  // 1. Antet (T.C., Kurum, Birim) — only for a document an institution issues.
  // A dilekçe is the citizen's own text, so it gets no letterhead: the
  // placeholder used to render as a real institution name on screen and in
  // every export.
  if (model.kurumAdi) {
    const tc = document.createElement("p");
    tc.className = "text-center font-bold text-[12pt] tracking-widest uppercase mb-0.5 text-zinc-950";
    tc.textContent = "T.C.";
    root.appendChild(tc);

    const kurum = document.createElement("p");
    kurum.className = "text-center font-bold text-[12pt] uppercase tracking-wider mb-0.5 text-zinc-950";
    kurum.textContent = model.kurumAdi;
    root.appendChild(kurum);

    if (model.birimAdi) {
      const birim = document.createElement("p");
      birim.className = "text-center font-normal text-[11pt] text-zinc-900 mb-6";
      birim.textContent = model.birimAdi;
      root.appendChild(birim);
    }
  }

  // 2. Sayı, Tarih & Konu
  const metaContainer = document.createElement("div");
  metaContainer.className = "my-6 space-y-1.5 text-[11pt] text-zinc-950 border-b border-zinc-200 pb-3";

  const sayiTarih = document.createElement("div");
  sayiTarih.className = "flex justify-between items-baseline";
  const tarihHtml = `<span><strong>Tarih :</strong> ${model.tarih || new Date().toLocaleDateString("tr-TR")}</span>`;
  sayiTarih.innerHTML = model.sayi
    ? `<span><strong>Sayı :</strong> ${model.sayi}</span>${tarihHtml}`
    : `<span></span>${tarihHtml}`;
  metaContainer.appendChild(sayiTarih);

  const konuP = document.createElement("p");
  konuP.className = "font-semibold text-zinc-950";
  konuP.innerHTML = `<strong>Konu :</strong> ${model.konu ?? ""}`;
  metaContainer.appendChild(konuP);
  root.appendChild(metaContainer);

  // 3. Hitap
  const hitapP = document.createElement("p");
  hitapP.className = "text-center font-bold text-[12pt] uppercase tracking-wider my-6 text-zinc-950";
  hitapP.textContent = model.hitap || "İLGİLİ MAKAMA";
  root.appendChild(hitapP);

  // 4. Gövde Metni Blokları — wrapped in a marked container so
  // documentToData can serialize *only* the body back out, not the
  // surrounding antet/meta/hitap/imza/ekler chrome appended around it.
  const govdeBody = document.createElement("div");
  govdeBody.setAttribute("data-govde-body", "");
  const metin = defaultValue || model.govdeMetni;
  const bloklar = govdeBloklariniAyir(metin);
  if (bloklar.length === 0) {
    govdeBody.appendChild(bosParagraf());
  } else {
    for (const blok of bloklar) {
      if (blok.tur === "baslik") {
        const h2 = document.createElement("h2");
        h2.className = "font-bold text-[12pt] uppercase mt-5 mb-2 text-zinc-950 [text-indent:0]";
        h2.textContent = blok.metin;
        govdeBody.appendChild(h2);
      } else if (blok.tur === "liste") {
        const ul = document.createElement("ul");
        ul.className = "list-disc pl-[12mm] my-2.5 space-y-1 [text-indent:0]";
        for (const oge of blok.ogeler) {
          const li = document.createElement("li");
          li.textContent = oge;
          ul.appendChild(li);
        }
        govdeBody.appendChild(ul);
      } else {
        const p = document.createElement("p");
        p.className = "mb-3 text-justify leading-[1.5] [text-indent:10mm] text-zinc-950";
        p.textContent = blok.metin;
        govdeBody.appendChild(p);
      }
    }
  }
  root.appendChild(govdeBody);

  // 5. İmza Bloğu — only where someone actually signs on behalf of an
  // institution. A dilekçe closes with the petitioner's own name block inside
  // the body, so an extra "(İmza) / Ad SOYAD / Unvan" here just contradicted it.
  if (model.imza) {
    const imzaContainer = document.createElement("div");
    imzaContainer.className = "mt-12 text-right select-text";
    const imzaYazi = document.createElement("p");
    imzaYazi.className = "italic text-[10pt] text-zinc-400 select-none mb-1";
    imzaYazi.textContent = "(İmza)";
    imzaContainer.appendChild(imzaYazi);

    const adSoyad = document.createElement("p");
    adSoyad.className = "font-bold text-[12pt] text-zinc-950";
    adSoyad.textContent = model.imza.adSoyad;
    imzaContainer.appendChild(adSoyad);

    const unvan = document.createElement("p");
    unvan.className = "text-[11pt] text-zinc-800";
    unvan.textContent = model.imza.unvan;
    imzaContainer.appendChild(unvan);
    root.appendChild(imzaContainer);
  }

  // 6. Ekler (varsa)
  if (model.ekler && model.ekler.length > 0) {
    const eklerContainer = document.createElement("div");
    eklerContainer.className = "mt-8 border-t border-zinc-300 pt-2 text-[11pt]";
    const ekBaslik = document.createElement("p");
    ekBaslik.className = "font-bold mb-1 text-zinc-950";
    ekBaslik.textContent = "EKLER :";
    eklerContainer.appendChild(ekBaslik);

    const ol = document.createElement("ol");
    ol.className = "list-decimal pl-6 space-y-0.5 text-zinc-900";
    for (const ek of model.ekler) {
      const li = document.createElement("li");
      li.textContent = ek;
      ol.appendChild(li);
    }
    eklerContainer.appendChild(ol);
    root.appendChild(eklerContainer);
  }
}

function documentToData(root: HTMLElement): {
  govdeMetni: string;
  baslik?: string;
  tamMetin: string;
} {
  let konu: string | undefined;
  for (const el of Array.from(root.querySelectorAll("p, span, div"))) {
    const text = el.textContent || "";
    if (/^Konu\s*:\s*/i.test(text)) {
      konu = text.replace(/^Konu\s*:\s*/i, "").trim();
      break;
    }
  }

  const parcalar: string[] = [];
  let serbestMetin = "";
  const serbestMetniKapat = () => {
    const t = serbestMetin.trim();
    if (t) parcalar.push(t);
    serbestMetin = "";
  };

  // Only the marked body container round-trips into govdeMetni — the
  // antet/meta/hitap/imza/ekler chrome around it is always re-derived from
  // `model` on load (see initSingleRootDocument) and must never be captured
  // back into the body text, or it duplicates into it on every save.
  const govdeBody = root.querySelector<HTMLElement>("[data-govde-body]") ?? root;
  for (const cocuk of Array.from(govdeBody.childNodes)) {
    if (cocuk.nodeType === Node.TEXT_NODE) {
      serbestMetin += cocuk.textContent ?? "";
      continue;
    }
    if (!(cocuk instanceof HTMLElement)) continue;
    if (cocuk.tagName === "BR") continue;

    serbestMetniKapat();
    if (cocuk.tagName === "H2") {
      const metin = cocuk.textContent?.trim() ?? "";
      if (metin) parcalar.push(`## ${metin}`);
    } else if (cocuk.tagName === "H3") {
      const metin = cocuk.textContent?.trim() ?? "";
      if (metin) parcalar.push(`### ${metin}`);
    } else if (cocuk.tagName === "BLOCKQUOTE") {
      const metin = cocuk.textContent?.trim() ?? "";
      if (metin) parcalar.push(`> ${metin}`);
    } else if (cocuk.tagName === "UL") {
      const satirlar = Array.from(cocuk.children)
        .map((li) => li.textContent?.trim() ?? "")
        .filter((satir) => satir.length > 0)
        .map((satir) => `- ${satir}`);
      if (satirlar.length > 0) parcalar.push(satirlar.join("\n"));
    } else if (cocuk.tagName === "OL") {
      const satirlar = Array.from(cocuk.children)
        .map((li) => li.textContent?.trim() ?? "")
        .filter((satir) => satir.length > 0)
        .map((satir, idx) => `${idx + 1}. ${satir}`);
      if (satirlar.length > 0) parcalar.push(satirlar.join("\n"));
    } else {
      const metin = cocuk.textContent?.trim() ?? "";
      if (metin) parcalar.push(metin);
    }
  }
  serbestMetniKapat();

  return {
    govdeMetni: parcalar.join("\n\n"),
    baslik: konu,
    tamMetin: root.innerText,
  };
}

function ustSeviyeMi(el: HTMLElement | null, root: HTMLElement): boolean {
  return el === root || (el instanceof HTMLElement && el.hasAttribute("data-govde-body"));
}

function suankiBlok(root: HTMLElement): HTMLElement | null {
  const secim = window.getSelection();
  if (!secim || secim.rangeCount === 0) return null;
  let dugum: Node | null = secim.getRangeAt(0).startContainer;
  while (dugum && !ustSeviyeMi(dugum.parentElement, root)) {
    dugum = dugum.parentElement;
  }
  return dugum instanceof HTMLElement && root.contains(dugum) ? dugum : null;
}

function blokTuruOku(blok: HTMLElement | null): BlokTuru | null {
  if (!blok) return null;
  if (blok.tagName === "H2") return "baslik";
  if (blok.tagName === "H3") return "baslik3";
  if (blok.tagName === "UL") return "liste";
  if (blok.tagName === "OL") return "numarali_liste";
  if (blok.tagName === "BLOCKQUOTE") return "alinti";
  return "paragraf";
}

function imleciSonaTasi(el: HTMLElement) {
  const aralik = document.createRange();
  aralik.selectNodeContents(el);
  aralik.collapse(false);
  const secim = window.getSelection();
  secim?.removeAllRanges();
  secim?.addRange(aralik);
}

export interface GovdeEditoruProps {
  model: ResmiBelge;
  defaultValue: string;
  className?: string;
  onKaydet?: (data: { govdeMetni: string; baslik?: string }) => Promise<void> | void;
  readOnly?: boolean;
  olcek?: number;
  setOlcek?: (fn: (o: number) => number) => void;
}

/**
 * Natural Single-Root WYSIWYG Document Editor.
 * Standard Default Font: Times New Roman across ALL elements (including Headings H2/H3).
 * Snapshot-based Undo / Redo history stack.
 */
export function GovdeEditoru({
  model,
  defaultValue,
  className,
  onKaydet,
  readOnly = false,
  olcek = 1,
  setOlcek,
}: GovdeEditoruProps) {
  const kokRef = useRef<HTMLDivElement>(null);
  const [aktifBlok, setAktifBlok] = useState<BlokTuru | null>("paragraf");
  const [seciliYaziTipi, setSeciliYaziTipi] = useState("times");
  const [kelimeSayisi, setKelimeSayisi] = useState(0);
  const [karakterSayisi, setKarakterSayisi] = useState(0);
  const [kayitDurumu, setKayitDurumu] = useState<"kaydedildi" | "degisiklik_var" | "kaydediliyor">("kaydedildi");
  const [isPending, startTransition] = useTransition();

  // Custom Snapshot History Stack for Undo/Redo
  const gecmisRef = useRef<string[]>([]);
  const gecmisIndeksRef = useRef<number>(-1);
  const islemYapiliyorRef = useRef<boolean>(false);
  const debounceGecmisZamanlayici = useRef<NodeJS.Timeout | null>(null);

  const suankiFont = YAZI_TIPLERI.find((f) => f.id === seciliYaziTipi) || YAZI_TIPLERI[0];

  const anlikGoruntuKaydet = useCallback((aninda = false) => {
    const kok = kokRef.current;
    if (!kok || islemYapiliyorRef.current) return;

    const kaydet = () => {
      const html = kok.innerHTML;
      if (gecmisIndeksRef.current >= 0 && gecmisRef.current[gecmisIndeksRef.current] === html) {
        return;
      }
      const yeniGecmis = gecmisRef.current.slice(0, gecmisIndeksRef.current + 1);
      yeniGecmis.push(html);
      if (yeniGecmis.length > 50) yeniGecmis.shift();
      gecmisRef.current = yeniGecmis;
      gecmisIndeksRef.current = yeniGecmis.length - 1;
    };

    if (aninda) {
      if (debounceGecmisZamanlayici.current) clearTimeout(debounceGecmisZamanlayici.current);
      kaydet();
    } else {
      if (debounceGecmisZamanlayici.current) clearTimeout(debounceGecmisZamanlayici.current);
      debounceGecmisZamanlayici.current = setTimeout(kaydet, 300);
    }
  }, []);

  const geriAl = useCallback(() => {
    const kok = kokRef.current;
    if (!kok) return;

    if (gecmisIndeksRef.current > 0) {
      islemYapiliyorRef.current = true;
      gecmisIndeksRef.current -= 1;
      kok.innerHTML = gecmisRef.current[gecmisIndeksRef.current];
      islemYapiliyorRef.current = false;
      const text = kok.innerText || "";
      setKelimeSayisi(text.trim() ? text.trim().split(/\s+/).length : 0);
      setKarakterSayisi(text.length);
      setKayitDurumu("degisiklik_var");
      setAktifBlok(blokTuruOku(suankiBlok(kok)));
    } else {
      document.execCommand("undo");
    }
  }, []);

  const yinele = useCallback(() => {
    const kok = kokRef.current;
    if (!kok) return;

    if (gecmisIndeksRef.current < gecmisRef.current.length - 1) {
      islemYapiliyorRef.current = true;
      gecmisIndeksRef.current += 1;
      kok.innerHTML = gecmisRef.current[gecmisIndeksRef.current];
      islemYapiliyorRef.current = false;
      const text = kok.innerText || "";
      setKelimeSayisi(text.trim() ? text.trim().split(/\s+/).length : 0);
      setKarakterSayisi(text.length);
      setKayitDurumu("degisiklik_var");
      setAktifBlok(blokTuruOku(suankiBlok(kok)));
    } else {
      document.execCommand("redo");
    }
  }, []);

  // Initialize the single-root document once
  useEffect(() => {
    const kok = kokRef.current;
    if (!kok || kok.children.length > 0) return;
    initSingleRootDocument(kok, model, defaultValue);
    const text = kok.innerText || "";
    setKelimeSayisi(text.trim() ? text.trim().split(/\s+/).length : 0);
    setKarakterSayisi(text.length);
    gecmisRef.current = [kok.innerHTML];
    gecmisIndeksRef.current = 0;
  }, [model, defaultValue]);

  const guncelle = useCallback(() => {
    const kok = kokRef.current;
    if (!kok) return;
    const text = kok.innerText || "";
    setKelimeSayisi(text.trim() ? text.trim().split(/\s+/).length : 0);
    setKarakterSayisi(text.length);
    setKayitDurumu("degisiklik_var");
    anlikGoruntuKaydet(false);
  }, [anlikGoruntuKaydet]);

  const secimDegisti = useCallback(() => {
    const kok = kokRef.current;
    if (!kok) return;
    setAktifBlok(blokTuruOku(suankiBlok(kok)));
  }, []);

  const kaydet = useCallback(async () => {
    const kok = kokRef.current;
    if (!kok || !onKaydet || kayitDurumu === "kaydediliyor") return;
    setKayitDurumu("kaydediliyor");
    const data = documentToData(kok);
    startTransition(async () => {
      try {
        await onKaydet(data);
        setKayitDurumu("kaydedildi");
      } catch {
        setKayitDurumu("degisiklik_var");
      }
    });
  }, [onKaydet, kayitDurumu]);

  function tusaBasildi(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void kaydet();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      geriAl();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      yinele();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      document.execCommand("bold");
      guncelle();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      document.execCommand("italic");
      guncelle();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
      e.preventDefault();
      document.execCommand("underline");
      guncelle();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      const kok = kokRef.current;
      if (!kok) return;
      const blok = suankiBlok(kok);
      if (blok && (blok.tagName === "H2" || blok.tagName === "H3" || blok.tagName === "BLOCKQUOTE")) {
        e.preventDefault();
        const p = bosParagraf();
        blok.after(p);
        imleciSonaTasi(p);
        guncelle();
        anlikGoruntuKaydet(true);
        setAktifBlok("paragraf");
      }
    }
  }

  function turDegistir(hedef: BlokTuru) {
    const kok = kokRef.current;
    if (!kok) return;
    const blok = suankiBlok(kok);
    if (!blok) return;
    kok.focus();

    if (hedef === "liste" || hedef === "numarali_liste") {
      const tag = hedef === "numarali_liste" ? "OL" : "UL";
      if (blok.tagName === tag) return;
      const li = document.createElement("li");
      li.textContent = blok.textContent || "";
      const liste = document.createElement(tag);
      liste.appendChild(li);
      blok.replaceWith(liste);
      imleciSonaTasi(li);
    } else if (blok.tagName === "UL" || blok.tagName === "OL") {
      const ogeler = Array.from(blok.children);
      const tag = hedef === "baslik" ? "h2" : hedef === "baslik3" ? "h3" : hedef === "alinti" ? "blockquote" : "p";
      const parcalar = ogeler.map((li) => {
        const yeni = document.createElement(tag);
        yeni.textContent = li.textContent || "";
        return yeni;
      });
      for (const p of parcalar) blok.before(p);
      const son = parcalar.at(-1);
      blok.remove();
      if (son) imleciSonaTasi(son);
    } else {
      const tag = hedef === "baslik" ? "h2" : hedef === "baslik3" ? "h3" : hedef === "alinti" ? "blockquote" : "p";
      const yeni = document.createElement(tag);
      yeni.textContent = blok.textContent || "";
      blok.replaceWith(yeni);
      imleciSonaTasi(yeni);
    }

    guncelle();
    anlikGoruntuKaydet(true);
    secimDegisti();
  }

  function ekleIcerik(tur: "tarih" | "cizgi") {
    const kok = kokRef.current;
    if (!kok) return;
    kok.focus();
    if (tur === "tarih") {
      const bugun = new Date().toLocaleDateString("tr-TR");
      document.execCommand("insertText", false, bugun);
      guncelle();
      anlikGoruntuKaydet(true);
    } else if (tur === "cizgi") {
      document.execCommand("insertHorizontalRule");
      guncelle();
      anlikGoruntuKaydet(true);
    }
  }

  const blokEtiketi =
    aktifBlok === "baslik"
      ? "Başlık 2"
      : aktifBlok === "baslik3"
      ? "Başlık 3"
      : aktifBlok === "liste"
      ? "Madde İmleri"
      : aktifBlok === "numarali_liste"
      ? "Numaralı Liste"
      : aktifBlok === "alinti"
      ? "Alıntı"
      : "Paragraf";

  return (
    <div className={cn("flex flex-col gap-3 w-full", className)}>
      {/* Top Compact Ribbon Toolbar */}
      {!readOnly && (
        <div
          role="toolbar"
          aria-label="Belge Biçimlendirme Araç Çubuğu"
          className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-border/80 bg-card/95 p-1 shadow-sm backdrop-blur-md"
        >
          <div className="flex flex-wrap items-center gap-1">
            {/* 1. Undo / Redo */}
            <div className="flex items-center">
              <AracButonu
                etiket="Geri Al (Ctrl+Z)"
                Ikon={ArrowCounterClockwise}
                onClick={geriAl}
              />
              <AracButonu
                etiket="Yinele (Ctrl+Y)"
                Ikon={ArrowClockwise}
                onClick={yinele}
              />
            </div>

            <div className="mx-0.5 h-4 w-px bg-border/80" />

            {/* 2. Font Selector Dropdown (Times New Roman Default) */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer border border-border/50 bg-background/50"
                title="Yazı Tipi Seçin"
              >
                <TextAa size={13} className="text-primary shrink-0" />
                <span className="max-w-[95px] truncate">{suankiFont.ad}</span>
                <CaretDown size={10} className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  Yazı Tipi (Varsayılan: Times)
                </div>
                {YAZI_TIPLERI.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => setSeciliYaziTipi(f.id)}
                    className={cn("cursor-pointer", seciliYaziTipi === f.id && "bg-muted font-bold text-primary")}
                    style={{ fontFamily: f.font }}
                  >
                    {f.etiket}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="mx-0.5 h-4 w-px bg-border/80" />

            {/* 3. Block Style Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer border border-border/50 bg-background/50"
              >
                <ParagrafIkonu size={13} className="text-primary shrink-0" />
                <span className="max-w-[65px] truncate">{blokEtiketi}</span>
                <CaretDown size={10} className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  Metin Stili
                </div>
                <DropdownMenuItem onClick={() => turDegistir("paragraf")}>
                  <ParagrafIkonu className="size-3.5 mr-2 text-primary" /> Normal Paragraf
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => turDegistir("baslik")}>
                  <TextH className="size-3.5 mr-2 text-primary" /> Başlık 2 (H2)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => turDegistir("baslik3")}>
                  <TextH className="size-3 mr-2 text-primary" /> Başlık 3 (H3)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => turDegistir("alinti")}>
                  <Quotes className="size-3.5 mr-2 text-primary" /> Alıntı Bloğu
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="mx-0.5 h-4 w-px bg-border/80" />

            {/* 4. Inline Styles: Bold / Italic / Underline / Strike */}
            <div className="flex items-center">
              <AracButonu
                etiket="Kalın (Ctrl+B)"
                Ikon={TextB}
                onClick={() => {
                  document.execCommand("bold");
                  guncelle();
                  anlikGoruntuKaydet(true);
                }}
              />
              <AracButonu
                etiket="İtalik (Ctrl+I)"
                Ikon={TextItalic}
                onClick={() => {
                  document.execCommand("italic");
                  guncelle();
                  anlikGoruntuKaydet(true);
                }}
              />
              <AracButonu
                etiket="Altı Çizili (Ctrl+U)"
                Ikon={TextUnderline}
                onClick={() => {
                  document.execCommand("underline");
                  guncelle();
                  anlikGoruntuKaydet(true);
                }}
              />
              <AracButonu
                etiket="Üstü Çizili"
                Ikon={TextStrikethrough}
                onClick={() => {
                  document.execCommand("strikeThrough");
                  guncelle();
                  anlikGoruntuKaydet(true);
                }}
              />
            </div>

            <div className="mx-0.5 h-4 w-px bg-border/80" />

            {/* 5. Alignment Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-7 items-center gap-1 rounded-lg px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                title="Hizalama"
              >
                <TextAlignJustify size={14} />
                <CaretDown size={10} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36">
                <DropdownMenuItem onClick={() => { document.execCommand("justifyFull"); guncelle(); anlikGoruntuKaydet(true); }}>
                  <TextAlignJustify className="size-3.5 mr-2" /> İki Yana Yasla
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { document.execCommand("justifyLeft"); guncelle(); anlikGoruntuKaydet(true); }}>
                  <TextAlignLeft className="size-3.5 mr-2" /> Sola Hizala
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { document.execCommand("justifyCenter"); guncelle(); anlikGoruntuKaydet(true); }}>
                  <TextAlignCenter className="size-3.5 mr-2" /> Ortala
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { document.execCommand("justifyRight"); guncelle(); anlikGoruntuKaydet(true); }}>
                  <TextAlignRight className="size-3.5 mr-2" /> Sağa Hizala
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 6. List Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-7 items-center gap-1 rounded-lg px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                title="Listeler"
              >
                <ListBullets size={14} />
                <CaretDown size={10} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem onClick={() => turDegistir("liste")}>
                  <ListBullets className="size-3.5 mr-2 text-primary" /> Madde İmleri
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => turDegistir("numarali_liste")}>
                  <ListNumbers className="size-3.5 mr-2 text-primary" /> Numaralı Liste
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 7. Insert Dropdown (Date, Line, Clean) */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-7 items-center gap-1 rounded-lg px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                title="Ekle / Araçlar"
              >
                <Plus size={13} />
                <CaretDown size={10} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onClick={() => ekleIcerik("tarih")}>
                  <Calendar className="size-3.5 mr-2 text-primary" /> Güncel Tarihi Ekle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => ekleIcerik("cizgi")}>
                  <Minus className="size-3.5 mr-2 text-primary" /> Ayırıcı Çizgi
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { document.execCommand("removeFormat"); guncelle(); anlikGoruntuKaydet(true); }}>
                  <Eraser className="size-3.5 mr-2 text-destructive" /> Biçimlendirmeyi Temizle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right Toolbar: Zoom + Word count + Save button */}
          <div className="flex items-center gap-2">
            {setOlcek && (
              <div className="hidden md:flex items-center gap-0.5 border border-border/50 rounded-lg px-1 py-0.5 bg-background/50">
                <button
                  type="button"
                  onClick={() => setOlcek((o) => Math.max(0.6, Number((o - 0.1).toFixed(1))))}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                  title="Küçült"
                >
                  <MagnifyingGlassMinus size={12} />
                </button>
                <span className="text-[10px] font-mono font-medium px-1 text-foreground">
                  {Math.round(olcek * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setOlcek((o) => Math.min(1.4, Number((o + 0.1).toFixed(1))))}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                  title="Büyüt"
                >
                  <MagnifyingGlassPlus size={12} />
                </button>
              </div>
            )}

            <span className="text-[10px] text-muted-foreground hidden lg:inline-block">
              {kelimeSayisi} kelime · {karakterSayisi} karakter
            </span>

            {onKaydet && (
              <Button
                type="button"
                size="sm"
                variant={kayitDurumu === "degisiklik_var" ? "primary" : "outline"}
                disabled={kayitDurumu === "kaydedildi" || isPending}
                onClick={kaydet}
                className="h-7 text-xs gap-1.5 rounded-lg font-medium px-2.5"
              >
                {kayitDurumu === "kaydediliyor" || isPending ? (
                  <>
                    <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Kaydediliyor…</span>
                  </>
                ) : kayitDurumu === "degisiklik_var" ? (
                  <>
                    <FloppyDisk size={13} aria-hidden="true" />
                    <span>Kaydet</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={13} weight="fill" className="text-emerald-500" aria-hidden="true" />
                    <span className="text-muted-foreground">Kaydedildi</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* The Single-Root A4 Document Sheet */}
      <div className="overflow-x-auto rounded-xl bg-muted/40 p-3 sm:p-6 flex justify-center border border-border/60 min-h-[500px]">
        <div
          ref={kokRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={guncelle}
          onKeyDown={tusaBasildi}
          onKeyUp={secimDegisti}
          onMouseUp={secimDegisti}
          onFocus={secimDegisti}
          lang="tr"
          spellCheck
          aria-label="Resmi Belge"
          className={cn(
            "mx-auto w-full max-w-[210mm] min-h-[297mm] bg-white text-zinc-950 shadow-2xl ring-1 ring-black/10 rounded-xs transition-transform duration-200",
            "p-[18mm] sm:p-[22mm] md:p-[25mm]",
            "outline-none text-[12pt] leading-[1.5]",
            // Crucial: ensure ALL child elements, especially H1-H6 headings and paragraphs, strictly inherit document font (Times New Roman)
            "[&_*]:font-[inherit]",
            "[&_h1]:font-bold [&_h1]:text-[13pt] [&_h1]:uppercase [&_h1]:mt-5 [&_h1]:mb-2.5 [&_h1]:text-zinc-950",
            "[&_h2]:font-bold [&_h2]:text-[12pt] [&_h2]:uppercase [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-zinc-950",
            "[&_h3]:font-bold [&_h3]:text-[11.5pt] [&_h3]:uppercase [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-zinc-950",
            "[&_p]:mb-3 [&_p]:leading-[1.5]",
            "[&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-[12mm]",
            "[&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-[12mm]",
            "[&_hr]:my-5 [&_hr]:border-zinc-300",
            !readOnly && "cursor-text",
            readOnly && "cursor-default select-text"
          )}
          style={{
            transform: olcek !== 1 ? `scale(${olcek})` : undefined,
            transformOrigin: "top center",
            fontFamily: suankiFont.font,
            fontSize: "12pt",
            lineHeight: 1.5,
            color: "#000000",
          }}
        />
      </div>
    </div>
  );
}

function AracButonu({
  etiket,
  Ikon,
  onClick,
}: {
  etiket: string;
  Ikon: typeof TextH;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={etiket}
      title={etiket}
      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
    >
      <Ikon size={14} aria-hidden="true" />
    </button>
  );
}
