import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

interface SendOptions {
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  caption?: string;
}

export function useRealWhatsApp() {
  const [realMode, setRealMode] = useState(false);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [targetPhone, setTargetPhone] = useState("");
  const [sending, setSending] = useState(false);

  const fetchInstances = useCallback(async () => {
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, phone_number, status")
      .eq("status", "open");

    const list = data ?? [];
    setInstances(list);

    if (list.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(list[0].id);
      if (list[0].phone_number) {
        setTargetPhone(list[0].phone_number.replace(/\D/g, ""));
      }
    }
  }, [selectedInstanceId]);

  useEffect(() => {
    if (realMode) fetchInstances();
  }, [realMode, fetchInstances]);

  const handleInstanceChange = (id: string) => {
    setSelectedInstanceId(id);
    const inst = instances.find((i) => i.id === id);
    if (inst?.phone_number) {
      setTargetPhone(inst.phone_number.replace(/\D/g, ""));
    }
  };

  const sendRealMessage = async (opts: SendOptions): Promise<boolean> => {
    if (!selectedInstanceId || !targetPhone) {
      toast.error("Selecione uma instância e informe o número destino");
      return false;
    }

    setSending(true);
    try {
      const body: Record<string, string> = {
        instance_id: selectedInstanceId,
        phone: targetPhone,
      };

      if (opts.mediaUrl) {
        body.media_url = opts.mediaUrl;
        body.media_type = opts.mediaType ?? "image";
        if (opts.caption) body.caption = opts.caption;
      } else {
        body.text = opts.text ?? "";
      }

      const { data, error } = await supabase.functions.invoke("whatsapp-send", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Mensagem enviada via WhatsApp!");
      return true;
    } catch (err: any) {
      toast.error("Falha ao enviar", { description: err.message ?? "Erro desconhecido" });
      return false;
    } finally {
      setSending(false);
    }
  };

  const isReady = realMode && !!selectedInstanceId && !!targetPhone;

  return {
    realMode,
    setRealMode,
    instances,
    selectedInstanceId,
    handleInstanceChange,
    targetPhone,
    setTargetPhone,
    sending,
    sendRealMessage,
    isReady,
  };
}
