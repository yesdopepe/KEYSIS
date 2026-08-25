"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  messageCount?: number;
  isArchived?: boolean;
  isActive?: boolean;
}

export interface AIChatHistoryProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelect?: (conversationId: string) => void;
  onNewConversation?: () => void;
  onRename?: (conversationId: string, newTitle: string) => Promise<void> | void;
  onDelete?: (conversationId: string) => Promise<void> | void;
  className?: string;
  showSearch?: boolean;
  showNewButton?: boolean;
}

function formatDateTR(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() - 7);
  const thisMonth = new Date(today);
  thisMonth.setDate(thisMonth.getDate() - 30);

  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (dateOnly.getTime() === today.getTime()) {
    return "Bugün";
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return "Dün";
  }
  if (dateOnly.getTime() >= thisWeek.getTime()) {
    return "Son 7 Gün";
  }
  if (dateOnly.getTime() >= thisMonth.getTime()) {
    return "Son 30 Gün";
  }

  return "Daha Eski";
}

function groupConversationsByDate(conversations: Conversation[]): {
  label: string;
  conversations: Conversation[];
}[] {
  const groups: Record<string, Conversation[]> = {};

  conversations.forEach((conv) => {
    const label = conv.lastMessageAt ? formatDateTR(new Date(conv.lastMessageAt)) : "Daha Eski";
    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(conv);
  });

  const orderedLabels = ["Bugün", "Dün", "Son 7 Gün", "Son 30 Gün", "Daha Eski"];
  const result: { label: string; conversations: Conversation[] }[] = [];

  orderedLabels.forEach((label) => {
    if (groups[label] && groups[label].length > 0) {
      result.push({ label, conversations: groups[label] });
    }
  });

  return result;
}

export function AIChatHistory({
  conversations,
  activeConversationId,
  onSelect,
  onNewConversation,
  onRename,
  onDelete,
  className,
  showSearch = true,
  showNewButton = true,
}: AIChatHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (conv) =>
        conv.title.toLowerCase().includes(query) ||
        conv.lastMessage?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const groupedConversations = useMemo(
    () => groupConversationsByDate(filteredConversations),
    [filteredConversations]
  );

  const handleRenameStart = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditValue(conversation.title);
  };

  const handleRenameSubmit = (conversationId: string) => {
    if (onRename && editValue.trim()) {
      startTransition(async () => {
        await onRename(conversationId, editValue.trim());
      });
    }
    setEditingId(null);
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleDeleteConfirm = () => {
    if (deleteTargetId && onDelete) {
      const id = deleteTargetId;
      startTransition(async () => {
        await onDelete(id);
      });
    }
    setDeleteTargetId(null);
  };

  const targetDeleteConv = conversations.find((c) => c.id === deleteTargetId);

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3 p-3", className)}>
      {/* Top Header & New Conversation Button */}
      <div className="flex flex-col gap-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="font-heading text-sm font-semibold text-foreground">
              Sohbet Geçmişi
            </span>
            <span className="text-[11px] text-muted-foreground">
              {conversations.length} kayıtlı sohbet
            </span>
          </div>

          {showNewButton && (
            onNewConversation ? (
              <Button
                size="sm"
                onClick={onNewConversation}
                type="button"
                className="h-8 px-2.5 text-xs gap-1.5 rounded-lg font-medium shrink-0"
              >
                <Plus className="size-3.5" />
                <span>Yeni</span>
              </Button>
            ) : (
              <Link
                href="/panel/asistan"
                onClick={() => onSelect?.("")}
                className={buttonClasses("primary", "sm", "h-8 min-h-0 px-2.5 text-xs gap-1.5 rounded-lg font-medium shrink-0 inline-flex items-center justify-center")}
              >
                <Plus className="size-3.5" />
                <span>Yeni</span>
              </Link>
            )
          )}
        </div>

        {/* Search Bar */}
        {showSearch && (
          <InputGroup className="h-8 rounded-lg bg-background/50 border-border/70 focus-within:border-primary">
            <InputGroupAddon>
              <Search className="size-3.5 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sohbetlerde ara…"
              type="search"
              value={searchQuery}
              className="text-xs h-7 py-1"
            />
          </InputGroup>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto -mx-1 px-1">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <MessageSquare className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium text-xs text-foreground">
                {searchQuery ? "Eşleşen sohbet bulunamadı" : "Henüz kayıtlı sohbet yok"}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {searchQuery
                  ? "Farklı bir arama terimi deneyin"
                  : "Yeni bir konuşma başlatabilirsiniz"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {groupedConversations.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-xs py-1">
                  <h3 className="font-bold text-muted-foreground/80 text-[10px] uppercase tracking-wider px-1.5">
                    {group.label}
                  </h3>
                </div>
                <div className="flex flex-col gap-1">
                  {group.conversations.map((conversation) => {
                    const isActive = conversation.id === activeConversationId;
                    const isEditing = editingId === conversation.id;

                    return (
                      <div
                        key={conversation.id}
                        className={cn(
                          "group relative flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-all duration-150",
                          isActive
                            ? "border-primary/40 bg-primary/10 text-primary shadow-2xs font-medium"
                            : "border-transparent bg-transparent hover:border-border/60 hover:bg-muted/50 text-foreground"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              autoFocus
                              className="w-full rounded-md border border-primary bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                              onBlur={() => handleRenameSubmit(conversation.id)}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleRenameSubmit(conversation.id);
                                } else if (e.key === "Escape") {
                                  handleRenameCancel();
                                }
                              }}
                              value={editValue}
                            />
                          ) : (
                            <Link
                              href={`/panel/asistan/${conversation.id}`}
                              onClick={() => onSelect?.(conversation.id)}
                              className="flex flex-col gap-0.5 text-left w-full"
                            >
                              <span className="truncate text-xs font-medium leading-tight">
                                {conversation.title}
                              </span>
                              {conversation.lastMessage && (
                                <span className="truncate text-[11px] text-muted-foreground/90 leading-tight">
                                  {conversation.lastMessage}
                                </span>
                              )}
                            </Link>
                          )}
                        </div>

                        {/* Actions dropdown */}
                        {!isEditing && (
                          <div className="shrink-0 flex items-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button
                                    type="button"
                                    aria-label={`"${conversation.title}" işlemleri`}
                                    className={cn(
                                      "flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100",
                                      isActive && "opacity-100"
                                    )}
                                  />
                                }
                              >
                                <MoreVertical className="size-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuGroup>
                                  {onRename && (
                                    <DropdownMenuItem
                                      onClick={() => handleRenameStart(conversation)}
                                      className="gap-2 text-xs cursor-pointer"
                                    >
                                      <Pencil className="size-3.5 text-muted-foreground" />
                                      <span>Yeniden Adlandır</span>
                                    </DropdownMenuItem>
                                  )}
                                  {onDelete && (
                                    <DropdownMenuItem
                                      onClick={() => setDeleteTargetId(conversation.id)}
                                      variant="destructive"
                                      className="gap-2 text-xs cursor-pointer"
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>Sil</span>
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sohbeti silmek istiyor musunuz?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{targetDeleteConv?.title ?? ""}&rdquo; sohbeti ve içindeki tüm mesajlar kalıcı olarak silinecektir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel render={<Button variant="outline" size="sm" />}>
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleDeleteConfirm}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AIChatHistory;
