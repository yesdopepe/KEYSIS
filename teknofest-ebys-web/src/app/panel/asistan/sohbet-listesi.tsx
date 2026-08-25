"use client";

import { useMemo } from "react";
import { AIChatHistory, type Conversation } from "@/components/ui/ai-chat-history";
import { sohbetAdiniDegistir, sohbetiKaldir } from "./actions";

export interface SohbetOzeti {
  id: string;
  baslik: string;
  guncellemeZamani: Date;
}

/**
 * Clean & Refined Chat History Sidebar Component
 * Powered by AIChatHistory design system
 */
export function SohbetListesi({
  sohbetler,
  aktifId,
  onSecim,
}: {
  sohbetler: SohbetOzeti[];
  aktifId?: string;
  onSecim?: () => void;
}) {
  const conversations: Conversation[] = useMemo(
    () =>
      sohbetler.map((s) => ({
        id: s.id,
        title: s.baslik,
        lastMessageAt: new Date(s.guncellemeZamani),
      })),
    [sohbetler]
  );

  const handleRename = async (id: string, newName: string) => {
    const formData = new FormData();
    formData.set("baslik", newName);
    await sohbetAdiniDegistir(id, formData);
  };

  const handleDelete = async (id: string) => {
    await sohbetiKaldir(id);
  };

  return (
    <AIChatHistory
      conversations={conversations}
      activeConversationId={aktifId}
      onSelect={onSecim}
      onRename={handleRename}
      onDelete={handleDelete}
      className="h-full border-none shadow-none bg-transparent p-3"
    />
  );
}
