"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isDataUIPart, isToolUIPart, type UIMessage } from "ai";
import Link from "next/link";
import { SohbetCanvasDuzeni } from "@/components/belge/SohbetCanvasDuzeni";
import { BelgeCanliTaslak, type BelgeCanliTaslakVerisi } from "@/components/belge/BelgeCanliTaslak";
import { BelgeTuvaliIstemci } from "@/components/belge/BelgeTuvaliIstemci";
import {
  Sparkle,
  MagnifyingGlass,
  Scales,
  FilePlus,
  WarningCircle,
  Paperclip,
  ArrowsClockwise,
  NotePencil,
  PaperPlaneTilt,
  Compass,
  LinkSimple,
  Copy,
  Check,
} from "@phosphor-icons/react/ssr";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationDownload,
} from "@/components/ai-elements/conversation";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@/components/ai-elements/sources";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Attachments,
  Attachment,
  AttachmentPreview,
} from "@/components/ai-elements/attachments";
import { AracAdimlari, type AracAdimi } from "@/components/sohbet/arac-adimlari";
import { SohbetKomposeri } from "@/components/sohbet/sohbet-komposeri";
import { SohbetKarsilamasi, OrnekSorular } from "@/components/sohbet/sohbet-karsilamasi";

const ARAC_ETIKETLERI: Record<string, { ad: string; Ikon: typeof MagnifyingGlass }> = {
  "tool-kurumBelgelerindeAra": { ad: "Kurum belgelerinde arandı", Ikon: MagnifyingGlass },
  "tool-mevzuatAra": { ad: "Mevzuatta arandı", Ikon: Scales },
  "tool-sohbetEkindeAra": { ad: "Sohbet ekinde arandı", Ikon: Paperclip },
  "tool-belgeTaslagiHazirla": { ad: "Belge taslağı oluşturuldu", Ikon: FilePlus },
  "tool-evrakYenidenAnalizEt": { ad: "Evrak yeniden analiz edildi", Ikon: ArrowsClockwise },
  "tool-evrakTaslakOnerisiOlustur": { ad: "Yazı önerisi hazırlandı", Ikon: NotePencil },
  "tool-belgeRevizyonuOner": { ad: "Belge revizyonu önerildi", Ikon: NotePencil },
  "tool-belgeyiOnayaGonder": { ad: "Belge onaya gönderildi", Ikon: PaperPlaneTilt },
  "tool-belgeyiSiniflandir": { ad: "Kurum/birim önerisi hazırlandı", Ikon: Compass },
  "tool-evrakYanitAdayiBul": { ad: "Evrak adayları listelendi", Ikon: LinkSimple },
};

export interface YuklenenEk {
  id: string;
  ad: string;
  tur: "gorsel" | "belge";
  mimeTur: string;
  url: string;
}

export interface AsistanSohbetProps {
  sohbetId: string;
  baslangicMesajlari?: UIMessage[];
  baslangicEkleri?: YuklenenEk[];
  yeniMi: boolean;
  belgeId?: string;
  belgeNode?: ReactNode;
  belgeBasligi?: string;
}

function baglantiCoz(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const kayit = output as Record<string, unknown>;
  if (kayit.basarili !== true) return null;
  return typeof kayit.baglanti === "string" ? kayit.baglanti : null;
}

function belgeSonucuCoz(output: unknown): { belgeId: string; surum: number } | null {
  if (typeof output !== "object" || output === null) return null;
  const kayit = output as Record<string, unknown>;
  if (kayit.basarili !== true) return null;
  if (typeof kayit.belgeId !== "string" || typeof kayit.surum !== "number") return null;
  return { belgeId: kayit.belgeId, surum: kayit.surum };
}

interface KaynakMaddesi {
  id: string;
  baslik: string;
  baglanti?: string;
}

function parcalariAyir(mesaj: UIMessage) {
  const metinler: string[] = [];
  const gorselUrlleri: string[] = [];
  const adimlar: AracAdimi[] = [];
  const kaynaklar: KaynakMaddesi[] = [];
  const akilYurutmeler: string[] = [];

  mesaj.parts.forEach((part, i) => {
    if (part.type === "text") {
      metinler.push(part.text);
      return;
    }
    if (part.type === "file" && part.mediaType?.startsWith("image/")) {
      gorselUrlleri.push(part.url);
      return;
    }
    if (part.type === "reasoning" && typeof (part as { text?: string }).text === "string") {
      akilYurutmeler.push((part as { text: string }).text);
      return;
    }
    const etiket = ARAC_ETIKETLERI[part.type];
    if (!etiket || !isToolUIPart(part)) return;
    adimlar.push({
      anahtar: `${mesaj.id}-${i}`,
      ad: etiket.ad,
      Ikon: etiket.Ikon,
      baglanti: part.state === "output-available" ? baglantiCoz(part.output) : null,
      tamamlandiMi: part.state === "output-available" || part.state === "output-error",
    });

    if (part.state === "output-available" && typeof part.output === "object" && part.output !== null) {
      const out = part.output as Record<string, unknown>;
      if (Array.isArray(out.sonuclar)) {
        out.sonuclar.forEach((s: Record<string, unknown>, idx: number) => {
          const baslik = s.baslik || s.maddeBasligi || s.ad || s.madde;
          if (baslik) {
            kaynaklar.push({
              id: `${mesaj.id}-src-${i}-${idx}`,
              baslik: String(baslik),
              baglanti: typeof s.baglanti === "string" ? s.baglanti : undefined,
            });
          }
        });
      }
    }
  });

  return {
    metin: metinler.join("\n\n"),
    gorselUrlleri,
    adimlar,
    kaynaklar,
    akilYurutme: akilYurutmeler.join("\n\n"),
  };
}

function KopyaEylemi({ metin }: { metin: string }) {
  const [kopyalandi, setKopyalandi] = useState(false);

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(metin);
      setKopyalandi(true);
      window.setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      // Quiet fallback
    }
  }

  return (
    <MessageAction tooltip={kopyalandi ? "Kopyalandı" : "Yanıtı kopyala"} onClick={kopyala}>
      {kopyalandi ? <Check size={15} weight="bold" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
    </MessageAction>
  );
}

function SohbetBaglantisi({ href, children }: ComponentProps<"a">) {
  const hedef = href ?? "";
  if (hedef.startsWith("/")) {
    return (
      <Link href={hedef} className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary">
        {children}
      </Link>
    );
  }
  return <span className="underline decoration-dotted underline-offset-2">{children}</span>;
}

const SOHBET_BILESENLERI = { a: SohbetBaglantisi } as ComponentProps<typeof MessageResponse>["components"];

export function AsistanSohbet({
  sohbetId,
  baslangicMesajlari = [],
  baslangicEkleri = [],
  yeniMi,
  belgeId,
  belgeNode,
  belgeBasligi,
}: AsistanSohbetProps) {
  const router = useRouter();
  const { messages, sendMessage, regenerate, stop, status, error } = useChat({
    id: sohbetId,
    messages: baslangicMesajlari,
    transport: new DefaultChatTransport({ api: "/api/asistan" }),
  });

  const [input, setInput] = useState("");
  const [ekler, setEkler] = useState<YuklenenEk[]>(baslangicEkleri);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [ekHatasi, setEkHatasi] = useState<string | null>(null);
  const [aktifBelgeId, setAktifBelgeId] = useState<string | undefined>(belgeId);

  useEffect(() => {
    if (belgeId && belgeId !== aktifBelgeId) {
      setAktifBelgeId(belgeId);
    }
  }, [belgeId, aktifBelgeId]);

  const sonBelgeSurumRef = useRef<Map<string, number>>(new Map());
  const islenmisMesajIdRef = useRef<Set<string>>(new Set());

  const mesgul = status === "submitted" || status === "streaming";
  const bos = messages.length === 0;
  const sonMesajId = messages[messages.length - 1]?.id;

  const canliTaslak = useMemo<BelgeCanliTaslakVerisi | null>(() => {
    let son: BelgeCanliTaslakVerisi | null = null;
    for (const m of messages) {
      for (const part of m.parts) {
        if (isDataUIPart(part) && part.type === "data-belge-taslak") {
          son = part.data as BelgeCanliTaslakVerisi;
        }
      }
    }
    // Live stream preview is shown only while actively drafting ("yazılıyor").
    // As soon as it is "tamam", the document is saved in DB and BelgeTuvaliIstemci renders the full WYSIWYG editor.
    if (!son || son.durum !== "yazılıyor") return null;
    return son;
  }, [messages]);

  useEffect(() => {
    for (const m of messages) {
      for (const part of m.parts) {
        if (isDataUIPart(part) && part.type === "data-belge-taslak") {
          const data = part.data as BelgeCanliTaslakVerisi;
          if (data?.belgeId && data.durum === "tamam" && aktifBelgeId !== data.belgeId) {
            setAktifBelgeId(data.belgeId);
          }
        }
      }
    }
  }, [messages, aktifBelgeId]);

  useEffect(() => {
    if (yeniMi && status === "ready" && messages.length > 0) {
      const hedefUrl = aktifBelgeId
        ? `/panel/asistan/${sohbetId}?belge=${aktifBelgeId}`
        : `/panel/asistan/${sohbetId}`;
      router.replace(hedefUrl);
      return;
    }

    if (mesgul) return;
    const son = messages[messages.length - 1];
    if (!son || son.role !== "assistant" || islenmisMesajIdRef.current.has(son.id)) return;

    let hedefBelgeId: string | null = null;
    let hedefSurum = 0;
    for (const part of son.parts) {
      if (!isToolUIPart(part) || part.state !== "output-available") continue;
      const sonuc = belgeSonucuCoz(part.output);
      if (sonuc) {
        hedefBelgeId = sonuc.belgeId;
        hedefSurum = sonuc.surum;
      }
    }

    islenmisMesajIdRef.current.add(son.id);
    if (!hedefBelgeId) return;

    if (aktifBelgeId !== hedefBelgeId) {
      setAktifBelgeId(hedefBelgeId);
    }

    const oncekiSurum = sonBelgeSurumRef.current.get(hedefBelgeId);
    sonBelgeSurumRef.current.set(hedefBelgeId, hedefSurum);

    if (oncekiSurum === undefined) {
      router.replace(`/panel/asistan/${sohbetId}?belge=${hedefBelgeId}`, { scroll: false });
    } else if (oncekiSurum !== hedefSurum) {
      router.refresh();
    }
  }, [messages, mesgul, sohbetId, router, yeniMi, status, aktifBelgeId]);

  const canvasIcerik = useMemo(() => {
    if (canliTaslak && canliTaslak.durum === "yazılıyor") {
      return <BelgeCanliTaslak taslak={canliTaslak} />;
    }
    if (aktifBelgeId) {
      return <BelgeTuvaliIstemci key={aktifBelgeId} belgeId={aktifBelgeId} />;
    }
    return belgeNode ?? null;
  }, [canliTaslak, aktifBelgeId, belgeNode]);

  async function dosyaSecildi(e: ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    const girdi = e.target;

    setYukleniyor(true);
    setEkHatasi(null);
    try {
      const formData = new FormData();
      formData.append("sohbetId", sohbetId);
      formData.append("dosya", dosya);

      const res = await fetch("/api/sohbet/ek", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.hata ?? "Ek yüklenemedi.");
      setEkler((mevcut) => [...mevcut, data as YuklenenEk]);
    } catch (err) {
      setEkHatasi(err instanceof Error ? err.message : "Ek yüklenemedi.");
    } finally {
      setYukleniyor(false);
      girdi.value = "";
    }
  }

  function ekSil(id: string) {
    setEkler((mevcut) => mevcut.filter((ek) => ek.id !== id));
  }

  function gonder() {
    const metin = input.trim();
    if (!metin || mesgul) return;

    const gorseller = ekler
      .filter((ek) => ek.tur === "gorsel")
      .map((ek) => ({ type: "file" as const, url: ek.url, mediaType: ek.mimeTur }));

    sendMessage({ text: metin, files: gorseller });
    setInput("");
  }

  return (
    <SohbetCanvasDuzeni
      belgeBasligi={canliTaslak?.baslik ?? belgeBasligi}
      belgeAltBasligi={canliTaslak?.turAdi}
      otomatikAcilsinMi={Boolean(canliTaslak || aktifBelgeId)}
      canvasSlot={canvasIcerik}
      chatSlot={
        <div className="flex h-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col justify-end">
            {bos ? (
              <SohbetKarsilamasi />
            ) : (
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div className="absolute top-3 start-4 z-10">
                  <ConversationDownload messages={messages} />
                </div>
                <Conversation className="flex-1">
                  <ConversationContent className="mx-auto w-full max-w-[var(--sohbet-olcu)] gap-6 px-4 pt-4 pb-6">
                    {messages.map((mesaj) => {
                      const kullanici = mesaj.role === "user";
                      const { metin, gorselUrlleri, adimlar, kaynaklar, akilYurutme } = parcalariAyir(mesaj);
                      const yenilenebilir = !kullanici && mesaj.id === sonMesajId && !mesgul;

                      return (
                        <Message key={mesaj.id} from={mesaj.role} className="group/mesaj w-full">
                          <MessageContent>
                            {gorselUrlleri.length > 0 && (
                              <Attachments variant="grid" className="mb-2">
                                {gorselUrlleri.map((url) => (
                                  <Attachment
                                    key={url}
                                    data={{
                                      id: url,
                                      type: "file",
                                      filename: "Sohbet görseli",
                                      mediaType: "image/jpeg",
                                      url,
                                    }}
                                  >
                                    <AttachmentPreview />
                                  </Attachment>
                                ))}
                              </Attachments>
                            )}

                            {!kullanici && akilYurutme && (
                              <Reasoning isStreaming={mesgul && mesaj.id === sonMesajId}>
                                <ReasoningTrigger />
                                <ReasoningContent>{akilYurutme}</ReasoningContent>
                              </Reasoning>
                            )}

                            {!kullanici && <AracAdimlari adimlar={adimlar} />}

                            {!kullanici && kaynaklar.length > 0 && (
                              <Sources>
                                <SourcesTrigger count={kaynaklar.length} />
                                <SourcesContent>
                                  {kaynaklar.map((k) => (
                                    <Source key={k.id} href={k.baglanti} title={k.baslik} />
                                  ))}
                                </SourcesContent>
                              </Sources>
                            )}

                            {metin &&
                              (kullanici ? (
                                <p className="whitespace-pre-wrap">{metin}</p>
                              ) : (
                                <MessageResponse components={SOHBET_BILESENLERI}>
                                  {metin}
                                </MessageResponse>
                              ))}
                          </MessageContent>

                          {!kullanici && metin.trim() && (
                            <MessageActions className="opacity-0 transition-opacity group-hover/mesaj:opacity-100 focus-within:opacity-100">
                              <KopyaEylemi metin={metin} />
                              {yenilenebilir && (
                                <MessageAction
                                  tooltip="Yanıtı yeniden üret"
                                  onClick={() => void regenerate()}
                                >
                                  <ArrowsClockwise size={15} aria-hidden="true" />
                                </MessageAction>
                              )}
                            </MessageActions>
                          )}
                        </Message>
                      );
                    })}

                    {status === "submitted" && (
                      <div className="flex items-center gap-2.5 ps-1 text-sm text-muted-foreground">
                        <Sparkle
                          size={15}
                          weight="fill"
                          className="text-primary"
                          aria-hidden="true"
                        />
                        <span className="shimmer" role="status">
                          Kurum Asistanı yanıtlıyor…
                        </span>
                      </div>
                    )}
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 pb-3">
            <div className="mx-auto flex w-full max-w-[var(--sohbet-olcu)] flex-col">
              {error && (
                <Alert variant="destructive" className="mb-3">
                  <WarningCircle size={18} weight="fill" aria-hidden="true" />
                  <AlertDescription>Asistana ulaşılamadı: {error.message}</AlertDescription>
                </Alert>
              )}

              <SohbetKomposeri
                deger={input}
                degistir={setInput}
                gonder={gonder}
                durdur={stop}
                mesgul={mesgul}
                durum={status}
                ekler={ekler}
                ekSil={ekSil}
                dosyaSecildi={dosyaSecildi}
                ekYukleniyor={yukleniyor}
                ekHatasi={ekHatasi}
              />

              {bos && <OrnekSorular sec={setInput} />}
            </div>
          </div>

          {bos && <div className="flex-1" />}
        </div>
      }
    />
  );
}
