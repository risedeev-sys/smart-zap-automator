import { useState, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Users,
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
  isGroup?: boolean;
  profilePicUrl?: string;
  lastTimestamp?: number;
  lastMessageSignature?: string;
  lastMessageFromMe?: boolean;
}

// Generate consistent color from name/phone
const AVATAR_COLORS = [
  "bg-emerald-600", "bg-sky-600", "bg-violet-600", "bg-amber-600",
  "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600",
  "bg-cyan-600", "bg-fuchsia-600", "bg-lime-600", "bg-pink-600",
];

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || "?").toUpperCase();
}

function formatSmartTime(timestamp: number | string | undefined): string {
  if (!timestamp) return "";
  const date = typeof timestamp === "number" 
    ? new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000)
    : new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "ontem";
  } else if (diffDays < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toUnixSeconds(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 9999999999 ? Math.floor(value / 1000) : value;
  }

  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber > 9999999999 ? Math.floor(asNumber / 1000) : asNumber;
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  return 0;
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

const INITIAL_CONTACTS: Contact[] = [
  { id: "1", name: "Darck", phone: "556192039398", avatar: "", status: "online", lastMessage: "Oi, tudo bem?", lastTime: "agora", unread: 1 },
  { id: "2", name: "Rise community", phone: "5511972734906", avatar: "", status: "online", lastMessage: "Como vai?", lastTime: "10:30", unread: 0 },
];

const welcomeMessage = (name: string): ChatMessage => ({
  id: "welcome",
  text: `Conversa com ${name}. Digite uma mensagem para testar seus gatilhos, ou clique nos botões abaixo para enviar ativos.`,
  type: "system",
  timestamp: new Date(),
});
const UNREAD_MESSAGES: Record<string, string[]> = {
  "1": ["Oi, tudo bem?"],
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
    // Auto-fill target phone when selecting a real contact
    if (realWA.realMode) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact?.phone) {
        realWA.setTargetPhone(contact.phone.replace(/\D/g, ""));
      }
    }
  };

  const activeContact = contacts.find((c) => c.id === activeContactId) ?? contacts[0] ?? { id: "0", name: "Carregando...", phone: "", avatar: "", status: "", lastMessage: "", lastTime: "" } as Contact;
  const messages = chatHistory[activeContact.id] ?? [];
  const activeContactIdRef = useRef(activeContactId);

  useEffect(() => {
    activeContactIdRef.current = activeContactId;
  }, [activeContactId]);
  const [inputText, setInputText] = useState("");
  const [assetButtons, setAssetButtons] = useState<AssetButton[]>([]);
  const [triggers, setTriggers] = useState<TriggerData[]>([]);
  const [assetNameCache, setAssetNameCache] = useState<Record<string, string>>({});
  const [pendingAsset, setPendingAsset] = useState<{ id: string; name: string; type: string; itemCount?: number; duration?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedPollMessageSignaturesRef = useRef<Set<string>>(new Set());
  const processedRealtimeMessageSignaturesRef = useRef<Set<string>>(new Set());
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

  // Fetch real WhatsApp chats when real mode is active
  const [loadingChats, setLoadingChats] = useState(false);
  useEffect(() => {
    if (!realWA.realMode || !realWA.selectedInstanceId) {
      setContacts(INITIAL_CONTACTS);
      setChatHistory((prev) => {
        const initial: Record<string, ChatMessage[]> = {};
        INITIAL_CONTACTS.forEach((c) => {
          initial[c.id] = prev[c.id] ?? [welcomeMessage(c.name)];
        });
        return initial;
      });
      setActiveContactId("1");
      return;
    }

    let cancelled = false;
    let initialSyncDone = false;
    const lastSeenSignatureByPhone = new Map<string, string>();

    void supabase.functions
      .invoke("whatsapp-manage", {
        body: { action: "instance-ensure-webhooks", instance_id: realWA.selectedInstanceId },
      })
      .catch((err) => {
        console.warn("ensure-webhooks error:", err);
      });

    const syncChats = async () => {
      const shouldShowLoading = !initialSyncDone;
      if (shouldShowLoading) setLoadingChats(true);

      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-manage", {
          body: { action: "fetch-chats", instance_id: realWA.selectedInstanceId },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);

        const normalizedContacts: Contact[] = ((data as any[]) ?? []).map((chat: any) => {
          const remoteJid = chat.remoteJid || "";
          const phone = (typeof remoteJid === "string" ? remoteJid.split("@")[0] : "") || "";
          const timestamp = toUnixSeconds(chat.timestamp) || toUnixSeconds(chat.updatedAt);
          const stableId = `real-${phone || remoteJid || crypto.randomUUID()}`;
          const lastMessage = chat.lastMessage || "";
          const lastMessageId = typeof chat.lastMessageId === "string" ? chat.lastMessageId : "";
          const lastMessageFromMe = chat.lastMessageFromMe === true;
          const lastMessageTimestamp = toUnixSeconds(chat.lastMessageTimestamp);
          const signatureTimestamp = lastMessageTimestamp || timestamp || 0;
          const lastMessageSignature = lastMessageId || `${lastMessage}::${signatureTimestamp}`;

          return {
            id: stableId,
            name: chat.name || phone,
            phone,
            avatar: "",
            status: chat.isGroup ? "grupo" : "",
            lastMessage,
            lastTime: formatSmartTime(timestamp),
            unread: chat.unreadCount || 0,
            isGroup: chat.isGroup || false,
            profilePicUrl: chat.profilePicUrl || "",
            lastTimestamp: timestamp,
            lastMessageSignature,
            lastMessageFromMe,
          };
        }).filter((c) => {
          // Only show allowed contacts
          const allowedPhones = ["556192039398", "5511972734906"];
          return allowedPhones.includes(c.phone);
        });

        if (normalizedContacts.length === 0) {
          if (!initialSyncDone) {
            toast.info("Nenhuma conversa encontrada nessa instância");
          }
          return;
        }

        setContacts((prevContacts) => {
          const prevById = new Map(prevContacts.map((c) => [c.id, c]));
          const seenIds = new Set<string>();
          const incomingMessages: Array<{
            contactId: string;
            contactName: string;
            text: string;
            timestamp: number;
          }> = [];

          const mergedContacts: Contact[] = normalizedContacts.map((incoming) => {
            const previous = prevById.get(incoming.id);
            const previousTimestamp = previous?.lastTimestamp ?? 0;
            const currentTimestamp = incoming.lastTimestamp ?? 0;
            const previousSignature = previous?.lastMessageSignature ?? lastSeenSignatureByPhone.get(incoming.phone) ?? "";
            const currentSignature = incoming.lastMessageSignature ?? `${incoming.lastMessage || ""}::${currentTimestamp}`;
            const hasNewIncomingMessage =
              initialSyncDone &&
              !!incoming.lastMessage &&
              !incoming.lastMessageFromMe &&
              currentSignature !== previousSignature;
            const pollMessageKey = `${incoming.id}::${currentSignature}`;

            if (incoming.phone && currentSignature) {
              lastSeenSignatureByPhone.set(incoming.phone, currentSignature);
            }

            if (hasNewIncomingMessage && !processedPollMessageSignaturesRef.current.has(pollMessageKey)) {
              processedPollMessageSignaturesRef.current.add(pollMessageKey);
              incomingMessages.push({
                contactId: incoming.id,
                contactName: incoming.name,
                text: incoming.lastMessage || "",
                timestamp: currentTimestamp,
              });
            }

            seenIds.add(incoming.id);

            return {
              ...previous,
              ...incoming,
              unread: hasNewIncomingMessage
                ? (previous?.unread ?? 0) + (incoming.id === activeContactIdRef.current ? 0 : 1)
                : (incoming.unread ?? previous?.unread ?? 0),
              lastTimestamp: Math.max(previousTimestamp, currentTimestamp),
              lastMessageSignature: currentSignature || previous?.lastMessageSignature,
            };
          });

          // Keep any extra dynamic chats that are not in top 20 from API
          prevContacts.forEach((contact) => {
            if (contact.id.startsWith("real-") && !seenIds.has(contact.id)) {
              mergedContacts.push(contact);
            }
          });

          if (incomingMessages.length > 0) {
            setChatHistory((prevHistory) => {
              const nextHistory = { ...prevHistory };

              incomingMessages.forEach((incomingMsg) => {
                const contactHistory = nextHistory[incomingMsg.contactId] ?? [welcomeMessage(incomingMsg.contactName)];
                const messageDate =
                  incomingMsg.timestamp > 0
                    ? new Date(
                        incomingMsg.timestamp > 9999999999
                          ? incomingMsg.timestamp
                          : incomingMsg.timestamp * 1000
                      )
                    : new Date();

                const alreadyExists = contactHistory.some(
                  (m) =>
                    m.type === "received" &&
                    m.text === incomingMsg.text &&
                    Math.abs(m.timestamp.getTime() - messageDate.getTime()) < 2000
                );

                if (!alreadyExists) {
                  nextHistory[incomingMsg.contactId] = [
                    ...contactHistory,
                    {
                      id: `poll-${incomingMsg.contactId}-${messageDate.getTime()}`,
                      text: incomingMsg.text,
                      type: "received" as const,
                      timestamp: messageDate,
                    },
                  ];
                }
              });

              return nextHistory;
            });

          // Only process triggers in simulation mode — in real mode the backend webhook handles it
          if (!realWA.realMode) {
            incomingMessages.forEach((incomingMsg) => {
              if (incomingMsg.text) {
                void processIncomingMessage(incomingMsg.text);
              }
            });
          }
          }

          return mergedContacts;
        });

        if (!initialSyncDone && normalizedContacts.length > 0) {
          const firstContact = normalizedContacts[0];
          setActiveContactId((current) => (current && current !== "1" ? current : firstContact.id));
          if (firstContact.phone) {
            realWA.setTargetPhone(firstContact.phone);
          }

          setChatHistory((prev) => {
            const next = { ...prev };
            normalizedContacts.forEach((contact) => {
              if (!next[contact.id]) {
                next[contact.id] = [welcomeMessage(contact.name)];
              }
            });
            return next;
          });
        }

        initialSyncDone = true;
      } catch (err: any) {
        if (!cancelled) {
          console.error("fetch-chats error:", err);
          toast.error("Erro ao buscar conversas", { description: err.message });
        }
      } finally {
        if (shouldShowLoading && !cancelled) {
          setLoadingChats(false);
        }
      }
    };

    void syncChats();
    const intervalId = window.setInterval(() => {
      void syncChats();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [realWA.realMode, realWA.selectedInstanceId]);

  // Subscribe to real-time incoming messages
  useEffect(() => {
    if (!realWA.realMode || !realWA.selectedInstanceId) return;

    const channel = supabase
      .channel("incoming-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_incoming_messages",
        },
        (payload) => {
          const msg = payload.new as any;
          if (msg.instance_id !== realWA.selectedInstanceId) return;

          const remoteJid = msg.remote_jid || "";
          const phone = (typeof remoteJid === "string" ? remoteJid.split("@")[0] : "") || "";
          const normalizedPhone = phone.replace(/\D/g, "");
          const senderName = msg.sender_name || phone;
          const isGroup = remoteJid.endsWith("@g.us");
          const messageText = msg.message_text || "";

          // Only allow messages from permitted contacts
          const allowedPhones = ["556192039398", "5511972734906"];
          if (!allowedPhones.includes(normalizedPhone)) return;
          const messageId = msg.id || crypto.randomUUID();
          const messageTimestamp = new Date(msg.created_at || Date.now());
          const messageUnixTimestamp =
            toUnixSeconds(msg.timestamp || msg.created_at) ||
            Math.floor(messageTimestamp.getTime() / 1000);
          const messageSignature = `${messageText}::${messageUnixTimestamp}`;
          const realtimeMessageKey = `${normalizedPhone || phone}::${messageSignature}`;

          if (processedRealtimeMessageSignaturesRef.current.has(realtimeMessageKey)) return;
          processedRealtimeMessageSignaturesRef.current.add(realtimeMessageKey);
          if (processedRealtimeMessageSignaturesRef.current.size > 3000) {
            processedRealtimeMessageSignaturesRef.current.clear();
          }

          setContacts((prevContacts) => {
            let matchingContact = prevContacts.find(
              (c) => c.phone.replace(/\D/g, "") === normalizedPhone
            );

            // If contact doesn't exist yet, create it dynamically
            if (!matchingContact) {
              const contactPhone = normalizedPhone || phone;
              const newContactId = `real-dynamic-${contactPhone}`;
              const newContact: Contact = {
                id: newContactId,
                name: senderName,
                phone: contactPhone,
                avatar: "",
                status: isGroup ? "grupo" : "",
                lastMessage: messageText,
                lastTime: formatSmartTime(messageUnixTimestamp),
                unread: 1,
                isGroup,
                lastTimestamp: messageUnixTimestamp,
                lastMessageSignature: messageSignature,
              };

              // Add welcome + incoming message to chat history
              setChatHistory((prev) => ({
                ...prev,
                [newContactId]: [
                  welcomeMessage(senderName),
                  {
                    id: messageId,
                    text: messageText,
                    type: "received" as const,
                    timestamp: messageTimestamp,
                  },
                ],
              }));

              return [newContact, ...prevContacts];
            }

            // Contact exists — add message to chat history
            setChatHistory((prev) => ({
              ...prev,
              [matchingContact!.id]: [
                ...(prev[matchingContact!.id] ?? []),
                {
                  id: messageId,
                  text: messageText,
                  type: "received" as const,
                  timestamp: messageTimestamp,
                },
              ],
            }));

            // Update last message and unread count
            return prevContacts.map((c) =>
              c.id === matchingContact!.id
                ? {
                    ...c,
                    lastMessage: messageText,
                    lastTime: formatSmartTime(messageUnixTimestamp),
                    unread: (c.unread ?? 0) + (c.id === activeContactIdRef.current ? 0 : 1),
                    lastTimestamp: messageUnixTimestamp,
                    lastMessageSignature: messageSignature,
                  }
                : c
            );
          });

          // Only process triggers in simulation mode — in real mode the backend webhook handles it
          if (!realWA.realMode && messageText) {
            processIncomingMessage(messageText);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realWA.realMode, realWA.selectedInstanceId]);

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
      let metadata: any = {};

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
          metadata = (asset as any).metadata ?? {};
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
          const isViewOnce = isTruthyFlag(metadata?.singleView) || isTruthyFlag(metadata?.single_view);
          await realWA.sendRealMessage({
            mediaUrl: fileUrl,
            mediaType: mediaTypeMap[item.type] ?? "image",
            caption: content || undefined,
            viewOnce: isViewOnce,
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
    let metadata: any = {};

    const table = assetTables[asset.type];
    if (table) {
      const { data } = await supabase.from(table as any).select("*").eq("id", asset.id).single();
      if (data) {
        content = (data as any).content ?? "";
        fileUrl = await getStorageUrl((data as any).storage_path ?? null);
        mime = (data as any).mime ?? null;
        metadata = (data as any).metadata ?? {};
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
      const isViewOnce = isTruthyFlag(metadata?.singleView) || isTruthyFlag(metadata?.single_view);
      await realWA.sendRealMessage({
        mediaUrl: fileUrl,
        mediaType: mediaTypeMap[asset.type] ?? "image",
        caption: content || metadata?.caption || undefined,
        viewOnce: isViewOnce,
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
        {/* Contact list sidebar - WhatsApp Web style */}
        <div className="w-[300px] border-r border-border flex flex-col flex-shrink-0" style={{ backgroundColor: 'hsl(var(--card))' }}>
          {/* Search */}
          <div className="px-3 py-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar ou começar uma nova conversa"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-9 h-[35px] text-[13px] border-0 bg-muted/40 rounded-lg"
              />
            </div>
          </div>

          {/* Contact list */}
          <ScrollArea className="flex-1">
            {filteredContacts.map((contact) => {
              const isActive = contact.id === activeContactId;
              const hasUnread = (contact.unread ?? 0) > 0;
              const colorClass = hashColor(contact.name + contact.phone);
              const initials = getInitials(contact.name);

              return (
                <button
                  key={contact.id}
                  onClick={() => handleSelectContact(contact.id)}
                  className={`w-full flex items-center gap-3 px-3 py-[10px] text-left transition-colors hover:bg-muted/40 ${
                    isActive ? "bg-muted/60" : ""
                  }`}
                >
                  {/* Avatar */}
                  <Avatar className="h-[49px] w-[49px] flex-shrink-0">
                    {contact.profilePicUrl ? (
                      <AvatarImage src={contact.profilePicUrl} alt={contact.name} />
                    ) : null}
                    <AvatarFallback className={`${colorClass} text-white text-sm font-medium`}>
                      {contact.isGroup ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        initials
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 border-b border-border/30 pb-[10px]">
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-normal text-foreground truncate">{contact.name}</p>
                      <span className={`text-[11px] flex-shrink-0 ml-2 ${hasUnread ? "text-emerald-500 font-medium" : "text-muted-foreground"}`}>
                        {contact.lastTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[13px] text-muted-foreground truncate pr-2">
                        {contact.lastMessage}
                      </p>
                      {hasUnread && (
                        <span className="flex-shrink-0 h-[20px] min-w-[20px] rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center px-1">
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
          <div className="flex items-center justify-between px-4 py-[10px] bg-muted/50 border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {activeContact.profilePicUrl ? (
                  <AvatarImage src={activeContact.profilePicUrl} alt={activeContact.name} />
                ) : null}
                <AvatarFallback className={`${hashColor(activeContact.name + activeContact.phone)} text-white text-sm font-medium`}>
                  {activeContact.isGroup ? (
                    <Users className="h-5 w-5" />
                  ) : (
                    getInitials(activeContact.name)
                  )}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[15px] font-medium text-foreground">{activeContact.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {activeContact.isGroup ? activeContact.status : activeContact.phone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Search className="h-5 w-5 cursor-pointer hover:text-foreground transition-colors" />
              <Phone className="h-5 w-5 cursor-pointer hover:text-foreground transition-colors" />
              <Video className="h-5 w-5 cursor-pointer hover:text-foreground transition-colors" />
              <MoreVertical className="h-5 w-5 cursor-pointer hover:text-foreground transition-colors" />
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
