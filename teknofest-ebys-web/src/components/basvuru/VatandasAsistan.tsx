"use client";

import { useState, useRef, useEffect, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import {
  Sparkle,
  PaperPlaneTilt,
  Buildings,
  FileText,
  CopySimple,
  CheckCircle,
  ArrowRight,
  ArrowsClockwise,
  StopCircle,
  Scales,
  Paperclip,
  User,
  Robot,
} from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { eksikYerTutucular, yerTutuculariDoldur } from "@/lib/basvuru/eksiklik";

const HAZIR_SORULAR = [
  {
    ikon: "🚧",
    baslik: "Yol ve Kaldırım Onarımı",
    soru: "Sokağımızdaki kaldırım ve yol bozuk. Fen İşleri Müdürlüğüne nasıl resmi bir dilekçe yazabilirim ve hangi bilgileri eklemeliyim?",
  },
  {
    ikon: "🏗️",
    baslik: "İmar & Ruhsatsız Yapı",
    soru: "Mahallemizde ruhsatsız ve güvenliksiz bir inşaat faaliyeti var. İmar ve Şehircilik Müdürlüğüne şikayet dilekçesi hazırlamak istiyorum.",
  },
  {
    ikon: "🔊",
    baslik: "Gürültü ve Çevre Şikayeti",
    soru: "Yakındaki bir işletmenin gece saatlerindeki yüksek gürültüsü için Zabıta veya Çevre Müdürlüğüne resmi şikayet dilekçesi oluşturur musun?",
  },
  {
    ikon: "🤝",
    baslik: "Sosyal Yardım Talebi",
    soru: "Belediyenin sosyal yardım ve yakacak desteğine başvurmak istiyorum. Dilekçemde hangi kanun ve şartlara değinmeliyim?",
  },
  {
    ikon: "🏛️",
    baslik: "Hangi Kuruma Başvurmalıyım?",
    soru: "Apartmanımızın önündeki ağacın budanması ve elektrik tellerine temas etmesi durumunda belediyeye mi yoksa elektrik idaresine mi başvurmalıyım?",
  },
];

/**
 * Extracts a dilekçe draft from assistant text if wrapped in ```dilekce ... ```
 */
function dilekceAyikla(metin: string): string | null {
  const match = metin.match(/```(?:dilekce|Dilekce|DİLEKÇE)?\s*([\s\S]*?)```/);
  if (match && match[1] && match[1].trim().length > 30) {
    return match[1].trim();
  }
  return null;
}

/**
 * One drafted petition, with the gaps the model left in it turned into inputs.
 *
 * The draft comes back with markers where the model could not know the answer
 * ("Tarih: [EK BİLGİ GEREKLİ: Tarih]"). Those used to travel to the başvuru
 * form and on into a filed evrak untouched, so the record showed a marker where
 * the citizen's name should be. Now nothing leaves this card until every gap is
 * filled, and the answers are written into the text itself — the preview above
 * the inputs shows the document the citizen will actually send.
 */
function DilekceTaslagiKarti({
  metin,
  kopyalandiMi,
  onKopyala,
  onAktar,
}: {
  metin: string;
  kopyalandiMi: boolean;
  onKopyala: (metin: string) => void;
  onAktar: (metin: string) => void;
}) {
  const [cevaplar, setCevaplar] = useState<Record<string, string>>({});

  const eksikler = useMemo(() => eksikYerTutucular(metin), [metin]);
  const nihaiMetin = useMemo(
    () => yerTutuculariDoldur(metin, cevaplar).metin,
    [metin, cevaplar]
  );
  const kalanlar = useMemo(() => eksikYerTutucular(nihaiMetin), [nihaiMetin]);
  const gonderilebilir = kalanlar.length === 0;

  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-b from-card to-muted/20 p-4 sm:p-5 shadow-sm space-y-3.5">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <FileText size={18} weight="fill" />
          Hazırlanan Resmi Dilekçe Taslağı
        </div>
        <Badge ton={gonderilebilir ? "basari" : "uyari"} className="text-2xs">
          {gonderilebilir ? "Resmi Standart" : `${kalanlar.length} bilgi eksik`}
        </Badge>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 font-mono text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap text-foreground shadow-2xs">
        {nihaiMetin}
      </div>

      {eksikler.length > 0 && (
        <div className="rounded-xl border border-warning-border bg-warning-bg/60 p-3.5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Gönderebilmek için doldurmanız gereken bilgiler
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bu alanlar dilekçenizin zorunlu kısımları; yazdıkça metne işlenir.
            </p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {eksikler.map((eksik) => (
              <label key={eksik.alan} className="block">
                <span className="block text-xs font-semibold text-foreground">{eksik.alan}</span>
                <Input
                  value={cevaplar[eksik.alan] ?? ""}
                  onChange={(e) =>
                    setCevaplar((onceki) => ({ ...onceki, [eksik.alan]: e.target.value }))
                  }
                  placeholder={eksik.soru}
                  className="mt-1 h-9 bg-card"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onKopyala(nihaiMetin)}
          className="gap-1.5 text-xs"
        >
          {kopyalandiMi ? (
            <>
              <CheckCircle size={15} className="text-success" />
              Kopyalandı
            </>
          ) : (
            <>
              <CopySimple size={15} />
              Metni Kopyala
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={!gonderilebilir}
          onClick={() => onAktar(nihaiMetin)}
          title={
            gonderilebilir
              ? undefined
              : "Önce eksik bilgileri doldurun; eksik dilekçe başvuruya aktarılamaz."
          }
          className="gap-2 text-xs font-semibold shadow-xs"
        >
          Dilekçeyi Başvuru Formuna Aktar
          <ArrowRight size={15} weight="bold" />
        </Button>
      </div>
    </div>
  );
}

export function VatandasAsistan() {
  const router = useRouter();
  const [kopyalandi, setKopyalandi] = useState<string | null>(null);
  const mesajlarSonuRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    regenerate,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/basvuru/asistan",
    }),
  });

  const yukleniyor = status === "streaming" || status === "submitted";
  const [girdi, setGirdi] = useState("");

  useEffect(() => {
    mesajlarSonuRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function formuGonder(e: FormEvent) {
    e.preventDefault();
    if (!girdi.trim() || yukleniyor) return;
    sendMessage({ text: girdi.trim() });
    setGirdi("");
  }

  function hazirSoruSor(soruMetni: string) {
    if (yukleniyor) return;
    sendMessage({ text: soruMetni });
  }

  function dilekceyiKopyala(metin: string, id: string) {
    navigator.clipboard?.writeText(metin);
    setKopyalandi(id);
    setTimeout(() => setKopyalandi(null), 2000);
  }

  function basvuruyaAktar(dilekceMetni: string) {
    // Store in sessionStorage and navigate
    if (typeof window !== "undefined") {
      sessionStorage.setItem("otomatik_dilekce_metni", dilekceMetni);
    }
    router.push(`/basvuru?kaynak=asistan`);
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Header Banner */}
      <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
              <Sparkle size={24} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-lg sm:text-xl font-bold text-foreground">
                  Dilekçe & Kurum Danışmanı
                </h1>
                <Badge ton="notr" className="text-2xs">7/24 Rehber</Badge>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Talebinizi anlatın; yetkili kurumu öğrenin, 3071 sayılı Kanuna uygun resmi dilekçenizi hazırlayın ve tek tıkla başvuruya aktarın.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card/80 border border-border px-3 py-1.5 rounded-lg shadow-2xs">
              <Scales size={15} className="text-primary" />
              3071 Sayılı Kanun Uyumlu
            </span>
          </div>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-6 min-h-[360px]">
        {messages.length === 0 ? (
          <div className="space-y-6 py-4">
            <div className="text-center max-w-md mx-auto space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-primary">
                <Buildings size={26} aria-hidden="true" />
              </div>
              <h2 className="font-heading text-base font-semibold text-foreground">
                Nasıl yardımcı olabilirim?
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Karşılaştığınız belediye, imar, çevre, yol veya sosyal hizmet konusunu yazabilir veya aşağıdaki sık kullanılan senaryolardan birini seçebilirsiniz.
              </p>
            </div>

            {/* Quick Prompt Cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {HAZIR_SORULAR.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => hazirSoruSor(h.soru)}
                  className="flex items-start gap-3 p-3.5 text-left rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all group cursor-pointer"
                >
                  <span className="text-xl shrink-0 select-none">{h.ikon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {h.baslik}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {h.soru}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m: UIMessage) => {
            const isUser = m.role === "user";
            const textContent = m.parts
              ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("\n") || "";

            const taslakDilekce = !isUser ? dilekceAyikla(textContent) : null;
            const temizMetin = taslakDilekce
              ? textContent.replace(/```(?:dilekce|Dilekce|DİLEKÇE)?\s*[\s\S]*?```/g, "").trim()
              : textContent;

            return (
              <div
                key={m.id}
                className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-2xs mt-1">
                    <Robot size={18} aria-hidden="true" />
                  </span>
                )}

                <div className={`max-w-[88%] sm:max-w-[80%] space-y-3`}>
                  <div
                    className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-primary text-on-primary rounded-tr-xs"
                        : "bg-card border border-border text-foreground rounded-tl-xs shadow-2xs"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{temizMetin || textContent}</div>
                  </div>

                  {/* If assistant generated a formal petition draft */}
                  {taslakDilekce && (
                    <DilekceTaslagiKarti
                      metin={taslakDilekce}
                      kopyalandiMi={kopyalandi === m.id}
                      onKopyala={(metin) => dilekceyiKopyala(metin, m.id)}
                      onAktar={basvuruyaAktar}
                    />
                  )}
                </div>

                {isUser && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground shadow-2xs mt-1">
                    <User size={18} aria-hidden="true" />
                  </span>
                )}
              </div>
            );
          })
        )}

        {yukleniyor && (
          <div className="flex items-center gap-3 text-muted-foreground text-xs py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary animate-pulse">
              <Sparkle size={18} weight="fill" />
            </span>
            <span className="flex items-center gap-2">
              Mevzuat ve kurum yetkileri taranıyor, yanıt hazırlanıyor...
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive-border bg-destructive-bg p-3.5 text-xs text-destructive flex items-center justify-between gap-2">
            <span>{error.message || "Bir bağlantı hatası oluştu."}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => regenerate()}
              className="text-xs h-7"
            >
              <ArrowsClockwise size={14} />
              Tekrar Dene
            </Button>
          </div>
        )}

        <div ref={mesajlarSonuRef} />
      </div>

      {/* Input Composer */}
      <div className="border-t border-border pt-3.5 bg-background sticky bottom-0">
        <form onSubmit={formuGonder} className="relative flex items-center gap-2">
          <textarea
            rows={2}
            value={girdi}
            onChange={(e) => setGirdi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                formuGonder(e);
              }
            }}
            placeholder="Talebinizi, şikayetinizi veya sormak istediğiniz konuyu yazın... (Enter ile gönder)"
            className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            disabled={yukleniyor}
          />

          <div className="flex items-center gap-1.5 self-end pb-1.5">
            {yukleniyor ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={stop}
                className="h-10 px-3 text-xs gap-1.5"
              >
                <StopCircle size={16} />
                Durdur
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!girdi.trim() || yukleniyor}
                className="h-10 px-4 gap-1.5"
              >
                <PaperPlaneTilt size={16} weight="fill" />
                <span className="hidden sm:inline">Gönder</span>
              </Button>
            )}
          </div>
        </form>
        <p className="mt-2 text-center text-2xs text-muted-foreground">
          Yapay zekâ asistanı bilgilendirme amaçlıdır; oluşturulan dilekçeyi göndermeden önce bilgilerinizi kontrol ediniz.
        </p>
      </div>
    </div>
  );
}
