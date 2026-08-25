"use client";

import { useRef, type ChangeEvent, type KeyboardEvent } from "react";
import {
  Paperclip,
  WarningCircle,
  FileText,
  Image as ImageIkon,
} from "@phosphor-icons/react/ssr";
import {
  PromptInput,
  PromptInputBody,
  PromptInputHeader,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
} from "@/components/ai-elements/attachments";
import type { YuklenenEk } from "@/app/panel/asistan/asistan-sohbet";
import type { ChatStatus } from "ai";

const KABUL_EDILEN = "image/*,.pdf,.docx,.xlsx,.pptx,.txt,.md,.csv";

export interface SohbetKomposeriProps {
  deger: string;
  degistir: (deger: string) => void;
  gonder: () => void;
  durdur: () => void;
  mesgul: boolean;
  durum: ChatStatus;
  ekler: YuklenenEk[];
  ekSil?: (id: string) => void;
  dosyaSecildi: (e: ChangeEvent<HTMLInputElement>) => void;
  ekYukleniyor: boolean;
  ekHatasi: string | null;
}

export function SohbetKomposeri({
  deger,
  degistir,
  gonder,
  durdur,
  mesgul,
  durum,
  ekler,
  ekSil,
  dosyaSecildi,
  ekYukleniyor,
  ekHatasi,
}: SohbetKomposeriProps) {
  const dosyaRef = useRef<HTMLInputElement>(null);
  const gonderilebilir = deger.trim().length > 0 && !mesgul;

  function gonderildi() {
    if (gonderilebilir) gonder();
  }

  function tusaBasildi(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !gonderilebilir) {
      e.preventDefault();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {ekHatasi && (
        <div role="alert" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/10 rounded-lg">
          <WarningCircle size={14} weight="fill" aria-hidden="true" className="shrink-0" />
          <span>{ekHatasi}</span>
        </div>
      )}

      <input
        ref={dosyaRef}
        type="file"
        id="asistan-ek"
        className="sr-only"
        onChange={dosyaSecildi}
        accept={KABUL_EDILEN}
      />

      <PromptInput
        onSubmit={gonderildi}
        inputGroupClassName="rounded-[26px] border border-border/80 bg-card p-1 shadow-lg shadow-black/[0.04] transition-all focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 dark:bg-card dark:border-border dark:shadow-none"
      >
        <PromptInputBody>
          {ekler.length > 0 && (
            <PromptInputHeader className="px-3 pt-2 pb-1 border-b border-border/40">
              <Attachments variant="inline">
                {ekler.map((ek) => (
                  <Attachment
                    key={ek.id}
                    data={{
                      id: ek.id,
                      type: "file",
                      filename: ek.ad,
                      mediaType: ek.mimeTur,
                      url: ek.url,
                    }}
                    onRemove={ekSil ? () => ekSil(ek.id) : undefined}
                  >
                    <AttachmentPreview
                      fallbackIcon={
                        ek.tur === "gorsel" ? (
                          <ImageIkon size={14} className="text-primary" />
                        ) : (
                          <FileText size={14} className="text-primary" />
                        )
                      }
                    />
                    <AttachmentInfo />
                    {ekSil && <AttachmentRemove label="Eki kaldır" />}
                  </Attachment>
                ))}
              </Attachments>
            </PromptInputHeader>
          )}

          <PromptInputTextarea
            id="asistan-girdi"
            aria-label="Asistana sorun"
            value={deger}
            onChange={(e) => degistir(e.target.value)}
            onKeyDown={tusaBasildi}
            onPaste={() => {}}
            placeholder="Kurum belgelerine dayalı bir soru sorun veya belge taslağı isteyin…"
            className="min-h-[3rem] max-h-48 px-3.5 py-2.5 text-[0.9375rem] leading-6"
          />

          <PromptInputFooter className="px-2 pb-1 pt-0">
            <PromptInputTools>
              <PromptInputButton
                onClick={() => dosyaRef.current?.click()}
                disabled={ekYukleniyor || mesgul}
                aria-label="Dosya veya görsel ekle"
                tooltip={ekYukleniyor ? "Yükleniyor…" : "Belge veya görsel ekle"}
                className="size-8 rounded-full hover:bg-muted/80"
              >
                <Paperclip size={16} aria-hidden="true" />
              </PromptInputButton>
            </PromptInputTools>

            <PromptInputSubmit
              variant="primary"
              status={durum}
              onStop={durdur}
              disabled={!gonderilebilir && !mesgul}
              aria-label={mesgul ? "Yanıtı durdur" : "Gönder"}
              className="size-8 rounded-full"
            />
          </PromptInputFooter>
        </PromptInputBody>
      </PromptInput>

      <p className="px-1 text-center text-[0.6875rem] text-muted-foreground">
        Kurum Asistanı hata yapabilir; önemli kurumsal kararları ve mevzuat maddelerini kaynaktan doğrulayın.
      </p>
    </div>
  );
}
