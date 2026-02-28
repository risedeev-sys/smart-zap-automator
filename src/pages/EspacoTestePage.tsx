import { useState, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Check,
  CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findMatchingTriggers, type TriggerData } from "@/utils/triggerEngine";
import { AssetConfirmDialog } from "@/components/FunnelConfirmDialog";
import { getAppSettings } from "@/pages/ConfiguracoesPage";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  text: string;
  type: "sent" | "received" | "system";
  timestamp: Date;
  assetType?: string;
  assetName?: string;
  fileUrl?: string;
  fileType?: string; // mime type
}

interface AssetButton {
  id: string;
  name: string;
  type: "mensagem" | "audio" | "midia" | "documento" | "funil";
  content?: string;
}

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

export default function EspacoTestePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      text: "Bem-vindo ao Espaço de Teste! Simule conversas do WhatsApp aqui. Digite uma mensagem para testar seus gatilhos, ou clique nos botões abaixo para enviar ativos.",
      type: "system",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [assetButtons, setAssetButtons] = useState<AssetButton[]>([]);
  const [triggers, setTriggers] = useState<TriggerData[]>([]);
  const [funnelItems, setFunnelItems] = useState<Record<string, any[]>>({});
  const [assetNameCache, setAssetNameCache] = useState<Record<string, string>>({});
  const [pendingAsset, setPendingAsset] = useState<{ id: string; name: string; type: string; itemCount?: number; duration?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const assetTables: Record<string, string> = {
    mensagem: "messages",
    audio: "audios",
    midia: "medias",
    documento: "documents",
  };

  // Fetch all assets + triggers
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

    // Funnels first
    (funnelRes.data ?? []).forEach((f: any) => {
      buttons.push({ id: f.id, name: f.name, type: "funil" });
    });

    // Messages
    (msgRes.data ?? []).forEach((m: any) => {
      buttons.push({ id: m.id, name: m.name, type: "mensagem", content: m.content });
      nameCache[m.id] = m.name;
    });

    // Audios
    (audioRes.data ?? []).forEach((a: any) => {
      buttons.push({ id: a.id, name: a.name, type: "audio" });
      nameCache[a.id] = a.name;
    });

    // Medias
    (mediaRes.data ?? []).forEach((m: any) => {
      buttons.push({ id: m.id, name: m.name, type: "midia" });
      nameCache[m.id] = m.name;
    });

    // Documents
    (docRes.data ?? []).forEach((d: any) => {
      buttons.push({ id: d.id, name: d.name, type: "documento" });
      nameCache[d.id] = d.name;
    });

    setAssetButtons(buttons);
    setAssetNameCache(nameCache);

    // Triggers
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

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (msg: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
    ]);
  };

  const getStorageUrl = (storagePath: string | null) => {
    if (!storagePath) return null;
    const { data } = supabase.storage.from("assets").getPublicUrl(storagePath);
    return data?.publicUrl ?? null;
  };

  // Fetch funnel items and execute sequentially
  const executeFunnel = async (funnelId: string, funnelName: string) => {
    addMessage({
      text: `⚡ Funil "${funnelName}" disparado`,
      type: "system",
    });

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
          fileUrl = getStorageUrl((asset as any).storage_path ?? null);
          mime = (asset as any).mime ?? null;
        }
      }

      const typeLabel = item.type === "mensagem" ? "💬 Mensagem" : item.type === "audio" ? "🎵 Áudio" : item.type === "midia" ? "📷 Mídia" : "📄 Documento";

      addMessage({
        text: `📨 ${typeLabel} "${assetName}" disparada`,
        type: "system",
      });

      addMessage({
        text: content || `${assetName}`,
        type: "sent",
        assetType: item.type,
        assetName,
        fileUrl: fileUrl ?? undefined,
        fileType: mime ?? undefined,
      });
    }

    toast.success("Envio do funil iniciado com sucesso", {
      description: `Funil "${funnelName}" com ${items.length} ativo(s)`,
    });
  };

  // Process incoming message through trigger engine
  const processIncomingMessage = async (text: string) => {
    const matched = findMatchingTriggers(triggers, text, {
      isGroup: false,
      isSavedContact: true,
    });

    if (matched.length === 0) return;

    for (const result of matched) {
      if (result.funnelId) {
        // Get funnel name
        const funnel = assetButtons.find(
          (b) => b.type === "funil" && b.id === result.funnelId
        );
        const funnelName = funnel?.name ?? "Desconhecido";

        const delay = result.delaySeconds * 1000;
        if (delay > 0) {
          addMessage({
            text: `⏱ Aguardando ${result.delaySeconds}s antes de disparar "${funnelName}"...`,
            type: "system",
          });
          await new Promise((r) => setTimeout(r, Math.min(delay, 5000)));
        }

        await executeFunnel(result.funnelId, funnelName);
      } else {
        addMessage({
          text: `⚡ Gatilho "${result.triggerName}" disparou, mas não tem funil vinculado.`,
          type: "system",
        });
      }
    }
  };

  // Send user message (simulates incoming from contact)
  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");

    addMessage({ text, type: "received" });

    // Process through triggers
    await processIncomingMessage(text);
  };

  // Helper to calculate funnel duration
  const calcFunnelDuration = (items: any[]) => {
    const totalSec = items.reduce((acc: number, item: any) => acc + item.delay_min * 60 + item.delay_sec, 0);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min} min e ${sec} seg`;
  };

  // Send asset directly
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
    const typeLabel =
      asset.type === "mensagem" ? "💬 Mensagem" : asset.type === "audio" ? "🎵 Áudio" : asset.type === "midia" ? "📷 Mídia" : "📄 Documento";

    let content = "";
    let fileUrl: string | null = null;
    let mime: string | null = null;

    const table = assetTables[asset.type];
    if (table) {
      const { data } = await supabase.from(table as any).select("*").eq("id", asset.id).single();
      if (data) {
        content = (data as any).content ?? "";
        fileUrl = getStorageUrl((data as any).storage_path ?? null);
        mime = (data as any).mime ?? null;
      }
    }

    addMessage({ text: `📨 ${typeLabel} "${asset.name}" disparada`, type: "system" });
    addMessage({
      text: content || asset.name,
      type: "sent",
      assetType: asset.type,
      assetName: asset.name,
      fileUrl: fileUrl ?? undefined,
      fileType: mime ?? undefined,
    });
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

  return (
    <MainLayout title="Espaço de Teste">
      <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto border border-border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-lg">👤</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Contato de Teste</p>
              <p className="text-xs text-muted-foreground">+55 11 99999-9999 · online</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search className="h-5 w-5" />
            <Phone className="h-5 w-5" />
            <Video className="h-5 w-5" />
            <MoreVertical className="h-5 w-5" />
          </div>
        </div>

        {/* Chat area */}
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
                  {msg.assetType && (
                    <Badge variant="secondary" className="text-[10px] mb-1">
                      {msg.assetType === "mensagem"
                        ? "💬 Mensagem"
                        : msg.assetType === "audio"
                        ? "🎵 Áudio"
                        : msg.assetType === "midia"
                        ? "📷 Mídia"
                        : "📄 Documento"}
                      : {msg.assetName}
                    </Badge>
                  )}
                  {/* Render file content based on type */}
                  {msg.fileUrl && msg.assetType === "audio" && (
                    <audio controls className="w-full max-w-[250px] my-1" src={msg.fileUrl} />
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
                  {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
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
            placeholder="Digite uma mensagem (simula mensagem recebida)"
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
