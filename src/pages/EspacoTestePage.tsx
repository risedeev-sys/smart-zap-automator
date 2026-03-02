import { useState, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  MessageSquare,
  Mic,
  Image,
  FileText,
  GitBranch,
  Smile,
  Phone,
  Video,
  MoreVertical,
  Search,
  CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findMatchingTriggers, type TriggerData } from "@/utils/triggerEngine";
import { AssetConfirmDialog } from "@/components/FunnelConfirmDialog";
import { getAppSettings } from "@/pages/ConfiguracoesPage";
import { toast } from "sonner";
import { WhatsAppAudioPlayer } from "@/components/WhatsAppAudioPlayer";
import { useRealWhatsApp } from "@/hooks/use-real-whatsapp";
import { RealModePanel } from "@/components/RealModePanel";

interface ChatMessage {
  id: string;
  text: string;
  type: "sent" | "received" | "system";
  timestamp: Date;
  assetType?: string;
  assetName?: string;
  fileUrl?: string;
  fileType?: string;
}

interface AssetButton {
  id: string;
  name: string;
  type: "mensagem" | "audio" | "midia" | "documento" | "funil";
  content?: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  status: string;
  lastMessage?: string;
  lastTime?: string;
  unread?: number;
}

const INITIAL_CONTACTS: Contact[] = [
  { id: "1", name: "Contato de Teste", phone: "+55 11 99999-9999", avatar: "👤", status: "online", lastMessage: "Oi, tudo bem?", lastTime: "agora", unread: 1 },
  { id: "2", name: "Maria Silva", phone: "+55 21 98888-7777", avatar: "👩", status: "online", lastMessage: "Oi, tudo bem?", lastTime: "10:30", unread: 2 },
  { id: "3", name: "João Santos", phone: "+55 31 97777-6666", avatar: "👨", status: "visto por último às 09:15", lastMessage: "Obrigado pela informação!", lastTime: "09:15", unread: 0 },
  { id: "4", name: "Ana Oliveira", phone: "+55 41 96666-5555", avatar: "👩‍💼", status: "online", lastMessage: "Vou verificar aqui", lastTime: "ontem", unread: 0 },
  { id: "5", name: "Carlos Pereira", phone: "+55 51 95555-4444", avatar: "👨‍💻", status: "visto por último às 18:40", lastMessage: "Pode me enviar o catálogo?", lastTime: "ontem", unread: 1 },
  { id: "6", name: "Juliana Costa", phone: "+55 61 94444-3333", avatar: "👩‍🎓", status: "digitando...", lastMessage: "Qual o valor?", lastTime: "seg", unread: 3 },
  { id: "7", name: "Pedro Almeida", phone: "+55 71 93333-2222", avatar: "🧑", status: "online", lastMessage: "Fechado!", lastTime: "seg", unread: 0 },
  { id: "8", name: "Grupo Vendas", phone: "5 participantes", avatar: "👥", status: "5 participantes", lastMessage: "Carlos: Meta batida! 🎉", lastTime: "dom", unread: 12 },
];

// Pre-built received messages for contacts with unread
const UNREAD_MESSAGES: Record<string, string[]> = {
  "1": ["Oi, tudo bem?"],
  "2": ["Oi, tudo bem?", "Você tem disponibilidade hoje?"],
  "5": ["Pode me enviar o catálogo?"],
  "6": ["Olá!", "Vi seu anúncio", "Qual o valor?"],
  "8": ["Pedro: Bom dia pessoal", "Ana: Boa!", "Carlos: Meta batida! 🎉", "João: 🔥🔥", "Pedro: Vamos comemorar!", "Ana: Partiu!", "Carlos: 🎯", "João: Excelente trabalho!", "Pedro: Time top!", "Ana: Arrasamos", "Carlos: Próxima meta já!", "João: Bora! 💪"],
};

const typeIcons: Record<string, typeof MessageSquare> = {
  mensagem: MessageSquare,
  audio: Mic,
  midia: Image,
  documento: FileText,
  funil: GitBranch,
};

const typeColors: Record<string, string> = {
  mensagem: "bg-purple-600 hover:bg-purple-700 text-white",
  audio: "bg-teal-600 hover:bg-teal-700 text-white",
  midia: "bg-pink-600 hover:bg-pink-700 text-white",
  documento: "bg-rose-600 hover:bg-rose-700 text-white",
  funil: "bg-emerald-600 hover:bg-emerald-700 text-white",
};

const welcomeMessage = (name: string): ChatMessage => ({
  id: "welcome",
  text: `Conversa com ${name}. Digite uma mensagem para testar seus gatilhos, ou clique nos botões abaixo para enviar ativos.`,
  type: "system",
  timestamp: new Date(),
});

export default function EspacoTestePage() {
  const [activeContactId, setActiveContactId] = useState<string>("1");
  const [contactSearch, setContactSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>(() => {
    const initial: Record<string, ChatMessage[]> = {};
    INITIAL_CONTACTS.forEach((c) => {
      const msgs: ChatMessage[] = [welcomeMessage(c.name)];
      // Add unread messages as received
      const unread = UNREAD_MESSAGES[c.id];
      if (unread) {
        unread.forEach((text, i) => {
          msgs.push({
            id: `unread-${c.id}-${i}`,
            text,
            type: "received",
            timestamp: new Date(Date.now() - (unread.length - i) * 60000),
          });
        });
      }
      initial[c.id] = msgs;
    });
    return initial;
  });

  const handleSelectContact = (contactId: string) => {
    setActiveContactId(contactId);
    // Clear unread badge
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, unread: 0 } : c))
    );
  };

  const activeContact = contacts.find((c) => c.id === activeContactId)!;
  const messages = chatHistory[activeContactId] ?? [];

  const [inputText, setInputText] = useState("");
  const [assetButtons, setAssetButtons] = useState<AssetButton[]>([]);
  const [triggers, setTriggers] = useState<TriggerData[]>([]);
  const [assetNameCache, setAssetNameCache] = useState<Record<string, string>>({});
  const [pendingAsset, setPendingAsset] = useState<{ id: string; name: string; type: string; itemCount?: number; duration?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const realWA = useRealWhatsApp();

  const assetTables: Record<string, string> = {
    mensagem: "messages",
    audio: "audios",
    midia: "medias",
    documento: "documents",
  };

  const fetchData = useCallback(async () => {
    const [msgRes, audioRes, mediaRes, docRes, funnelRes, triggerRes] = await Promise.all([
      supabase.from("messages").select("id, name, content").order("created_at"),
      supabase.from("audios").select("id, name").order("created_at"),
      supabase.from("medias").select("id, name").order("created_at"),
      supabase.from("documents").select("id, name").order("created_at"),
      supabase.from("funnels").select("id, name").order("created_at"),
      supabase.from("triggers").select("*").order("position"),
    ]);

    const buttons: AssetButton[] = [];
    const nameCache: Record<string, string> = {};

    (funnelRes.data ?? []).forEach((f: any) => {
      buttons.push({ id: f.id, name: f.name, type: "funil" });
    });
    (msgRes.data ?? []).forEach((m: any) => {
      buttons.push({ id: m.id, name: m.name, type: "mensagem", content: m.content });
      nameCache[m.id] = m.name;
    });
    (audioRes.data ?? []).forEach((a: any) => {
      buttons.push({ id: a.id, name: a.name, type: "audio" });
      nameCache[a.id] = a.name;
    });
    (mediaRes.data ?? []).forEach((m: any) => {
      buttons.push({ id: m.id, name: m.name, type: "midia" });
      nameCache[m.id] = m.name;
    });
    (docRes.data ?? []).forEach((d: any) => {
      buttons.push({ id: d.id, name: d.name, type: "documento" });
      nameCache[d.id] = d.name;
    });

    setAssetButtons(buttons);
    setAssetNameCache(nameCache);

    const triggerRows: TriggerData[] = (triggerRes.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled ?? true,
      conditions: (r.conditions as any[]) ?? [],
      ignore_case: r.ignore_case ?? true,
      funnel_id: r.funnel_id,
      delay_seconds: r.delay_seconds ?? 0,
      send_to_groups: r.send_to_groups ?? false,
      saved_contacts_only: r.saved_contacts_only ?? false,
    }));
    setTriggers(triggerRows);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (msg: Omit<ChatMessage, "id" | "timestamp">) => {
    setChatHistory((prev) => ({
      ...prev,
      [activeContactId]: [
        ...(prev[activeContactId] ?? []),
        { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
      ],
    }));
  };

  const getStorageUrl = async (storagePath: string | null): Promise<string | null> => {
    if (!storagePath) return null;
    const { data } = await supabase.storage.from("assets").createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  };

  const executeFunnel = async (funnelId: string, funnelName: string) => {
    const { data: items } = await supabase
      .from("funnel_items")
      .select("*")
      .eq("funnel_id", funnelId)
      .order("position");

    if (!items?.length) {
      addMessage({ text: `Funil "${funnelName}" está vazio.`, type: "system" });
      return;
    }

    for (const item of items) {
      const delay = (item.delay_min * 60 + item.delay_sec) * 1000;
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, Math.min(delay, 5000)));
      }

      const table = assetTables[item.type];
      let assetName = assetNameCache[item.asset_id] ?? "(ativo)";
      let content = "";
      let fileUrl: string | null = null;
      let mime: string | null = null;

      if (table) {
        const { data: asset } = await supabase
          .from(table as any)
          .select("*")
          .eq("id", item.asset_id)
          .single();
        if (asset) {
          assetName = (asset as any).name;
          content = (asset as any).content ?? "";
          fileUrl = await getStorageUrl((asset as any).storage_path ?? null);
          mime = (asset as any).mime ?? null;
        }
      }

      addMessage({
        text: content || `${assetName}`,
        type: "sent",
        assetType: item.type,
        assetName,
        fileUrl: fileUrl ?? undefined,
        fileType: mime ?? undefined,
      });

      // Real send for funnel items
      if (realWA.realMode && realWA.isReady) {
        if (fileUrl) {
          const mediaTypeMap: Record<string, "image" | "video" | "audio" | "document"> = {
            audio: "audio",
            midia: mime?.startsWith("video") ? "video" : "image",
            documento: "document",
          };
          await realWA.sendRealMessage({
            mediaUrl: fileUrl,
            mediaType: mediaTypeMap[item.type] ?? "image",
            caption: content || undefined,
          });
        } else if (content) {
          await realWA.sendRealMessage({ text: content });
        }
      }
    }

    toast.success("Envio do funil iniciado com sucesso", {
      description: `Funil "${funnelName}" com ${items.length} ativo(s)`,
    });
  };

  const processIncomingMessage = async (text: string) => {
    const matched = findMatchingTriggers(triggers, text, {
      isGroup: false,
      isSavedContact: true,
    });

    if (matched.length === 0) return;

    for (const result of matched) {
      if (result.funnelId) {
        const funnel = assetButtons.find(
          (b) => b.type === "funil" && b.id === result.funnelId
        );
        const funnelName = funnel?.name ?? "Desconhecido";

        const delay = result.delaySeconds * 1000;
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, Math.min(delay, 5000)));
        }

        await executeFunnel(result.funnelId, funnelName);
      }
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");

    if (realWA.realMode && realWA.isReady) {
      addMessage({ text, type: "sent" });
      await realWA.sendRealMessage({ text });
    } else {
      addMessage({ text, type: "received" });
      await processIncomingMessage(text);
    }
  };

  const calcFunnelDuration = (items: any[]) => {
    const totalSec = items.reduce((acc: number, item: any) => acc + item.delay_min * 60 + item.delay_sec, 0);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min} min e ${sec} seg`;
  };

  const handleAssetClick = async (asset: AssetButton) => {
    const settings = getAppSettings();
    if (asset.type === "funil") {
      if (settings.confirmFunnelSend) {
        const { data: items } = await supabase
          .from("funnel_items")
          .select("*")
          .eq("funnel_id", asset.id)
          .order("position");
        const itemList = items ?? [];
        setPendingAsset({
          id: asset.id,
          name: asset.name,
          type: "funil",
          itemCount: itemList.length,
          duration: calcFunnelDuration(itemList),
        });
      } else {
        await executeFunnel(asset.id, asset.name);
      }
    } else {
      if (settings.confirmFunnelSend) {
        setPendingAsset({ id: asset.id, name: asset.name, type: asset.type });
      } else {
        await sendAsset(asset);
      }
    }
  };

  const sendAsset = async (asset: AssetButton) => {
    let content = "";
    let fileUrl: string | null = null;
    let mime: string | null = null;

    const table = assetTables[asset.type];
    if (table) {
      const { data } = await supabase.from(table as any).select("*").eq("id", asset.id).single();
      if (data) {
        content = (data as any).content ?? "";
        fileUrl = await getStorageUrl((data as any).storage_path ?? null);
        mime = (data as any).mime ?? null;
      }
    }

    addMessage({
      text: content || asset.name,
      type: "sent",
      assetType: asset.type,
      assetName: asset.name,
      fileUrl: fileUrl ?? undefined,
      fileType: mime ?? undefined,
    });

    // Real send
    if (realWA.realMode && realWA.isReady && fileUrl) {
      const mediaTypeMap: Record<string, "image" | "video" | "audio" | "document"> = {
        audio: "audio",
        midia: mime?.startsWith("video") ? "video" : "image",
        documento: "document",
      };
      await realWA.sendRealMessage({
        mediaUrl: fileUrl,
        mediaType: mediaTypeMap[asset.type] ?? "image",
        caption: content || undefined,
      });
    } else if (realWA.realMode && realWA.isReady && content) {
      await realWA.sendRealMessage({ text: content });
    }
  };

  const handleConfirmAsset = async () => {
    if (!pendingAsset) return;
    const { id, name, type } = pendingAsset;
    setPendingAsset(null);
    if (type === "funil") {
      await executeFunnel(id, name);
    } else {
      await sendAsset({ id, name, type } as AssetButton);
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone.includes(contactSearch)
  );

  return (
    <MainLayout title="Espaço de Teste">
      <div className="flex h-[calc(100vh-12rem)] max-w-5xl mx-auto border border-border rounded-lg overflow-hidden bg-card">
        {/* Contact list sidebar */}
        <div className="w-72 border-r border-border flex flex-col bg-card flex-shrink-0">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar contato..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-9 h-9 text-sm border-0 bg-muted/50"
              />
            </div>
          </div>

          {/* Contact list */}
          <ScrollArea className="flex-1">
            {filteredContacts.map((contact) => {
              const isActive = contact.id === activeContactId;
              return (
                <button
                  key={contact.id}
                  onClick={() => handleSelectContact(contact.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border/50 ${
                    isActive ? "bg-muted/70" : ""
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{contact.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{contact.lastTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
                      {(contact.unread ?? 0) > 0 && (
                        <span className="ml-1 flex-shrink-0 h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                          {contact.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Real mode panel */}
          <RealModePanel
            realMode={realWA.realMode}
            onRealModeChange={realWA.setRealMode}
            instances={realWA.instances}
            selectedInstanceId={realWA.selectedInstanceId}
            onInstanceChange={realWA.handleInstanceChange}
            targetPhone={realWA.targetPhone}
            onTargetPhoneChange={realWA.setTargetPhone}
            isReady={realWA.isReady}
            sending={realWA.sending}
          />
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-lg">{activeContact.avatar}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{activeContact.name}</p>
                <p className="text-xs text-muted-foreground">{activeContact.phone} · {activeContact.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-5 w-5" />
              <Phone className="h-5 w-5" />
              <Video className="h-5 w-5" />
              <MoreVertical className="h-5 w-5" />
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-2"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23888' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.type === "sent"
                    ? "justify-end"
                    : msg.type === "received"
                    ? "justify-start"
                    : "justify-center"
                }`}
              >
                {msg.type === "system" ? (
                  <div className="bg-muted/80 text-muted-foreground text-xs px-3 py-1.5 rounded-lg max-w-md text-center">
                    {msg.text}
                  </div>
                ) : (
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                      msg.type === "sent"
                        ? "bg-primary/15 text-foreground rounded-br-none"
                        : "bg-card text-foreground border border-border rounded-bl-none"
                    }`}
                  >
                    {msg.fileUrl && msg.assetType === "audio" && (
                      <WhatsAppAudioPlayer src={msg.fileUrl} />
                    )}
                    {msg.fileUrl && msg.assetType === "midia" && msg.fileType?.startsWith("video") && (
                      <video controls className="w-full max-w-[250px] rounded my-1" src={msg.fileUrl} />
                    )}
                    {msg.fileUrl && msg.assetType === "midia" && !msg.fileType?.startsWith("video") && (
                      <img src={msg.fileUrl} alt={msg.assetName} className="w-full max-w-[250px] rounded my-1" />
                    )}
                    {msg.fileUrl && msg.assetType === "documento" && (
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-muted/50 rounded p-2 my-1 text-xs text-primary hover:underline">
                        <FileText className="h-4 w-4" />
                        {msg.assetName}
                      </a>
                    )}
                    {msg.text && (!msg.fileUrl || msg.assetType === "mensagem") && (
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(msg.timestamp)}
                      </span>
                      {msg.type === "sent" && (
                        <CheckCheck className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Asset buttons bar */}
          {assetButtons.length > 0 && (
            <div className="border-t border-border bg-muted/30 px-3 py-2">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {assetButtons.map((asset) => {
                  const Icon = typeIcons[asset.type] || FileText;
                  return (
                    <button
                      key={`${asset.type}-${asset.id}`}
                      onClick={() => handleAssetClick(asset)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${typeColors[asset.type]}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {asset.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-border bg-muted/50">
            <Smile className="h-6 w-6 text-muted-foreground cursor-pointer flex-shrink-0" />
            <Input
              placeholder={realWA.realMode ? "Digite uma mensagem para enviar via WhatsApp" : "Digite uma mensagem (simula mensagem recebida)"}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 border-0 bg-background shadow-none"
            />
            <Button
              size="icon"
              className="rounded-full h-10 w-10 flex-shrink-0"
              onClick={handleSend}
              disabled={!inputText.trim()}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <AssetConfirmDialog
        open={!!pendingAsset}
        onOpenChange={(open) => !open && setPendingAsset(null)}
        assetName={pendingAsset?.name ?? ""}
        assetType={pendingAsset?.type ?? ""}
        itemCount={pendingAsset?.itemCount}
        estimatedDuration={pendingAsset?.duration}
        onConfirm={handleConfirmAsset}
      />
    </MainLayout>
  );
}
