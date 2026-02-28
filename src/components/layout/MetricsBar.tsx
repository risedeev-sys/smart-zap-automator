import { useEffect, useState } from "react";
import { MessageSquare, Mic, Image, FileText, GitBranch, Send, Clock, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MetricItem {
  label: string;
  value: number;
  max: number;
  icon: React.ComponentType<{ className?: string }>;
}

export function MetricsBar() {
  const [counts, setCounts] = useState({
    messages: 0,
    audios: 0,
    medias: 0,
    documents: 0,
    funnels: 0,
    triggers: 0,
    flows: 0,
  });

  useEffect(() => {
    const fetchCounts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [messages, audios, medias, documents, funnels, triggers, flows] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("audios").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("medias").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("funnels").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("triggers").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("flows").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      setCounts({
        messages: messages.count ?? 0,
        audios: audios.count ?? 0,
        medias: medias.count ?? 0,
        documents: documents.count ?? 0,
        funnels: funnels.count ?? 0,
        triggers: triggers.count ?? 0,
        flows: flows.count ?? 0,
      });
    };

    fetchCounts();

    // Re-fetch when navigating back or when data changes
    const interval = setInterval(fetchCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  const metrics: MetricItem[] = [
    { label: "Mensagens", value: counts.messages, max: 20, icon: MessageSquare },
    { label: "Áudios", value: counts.audios, max: 20, icon: Mic },
    { label: "Mídias", value: counts.medias, max: 20, icon: Image },
    { label: "Documentos", value: counts.documents, max: 20, icon: FileText },
    { label: "Funis", value: counts.funnels, max: 5, icon: GitBranch },
    { label: "Disparos", value: counts.triggers, max: 2, icon: Send },
    { label: "Agendados", value: 0, max: 5, icon: Clock },
    { label: "Fluxos", value: counts.flows, max: 5, icon: Workflow },
  ];

  return (
    <div className="border-b border-border bg-card px-4 py-2 flex-shrink-0">
      <div className="flex gap-3 overflow-x-auto scrollbar-none">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-xs whitespace-nowrap flex-shrink-0"
          >
            <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-semibold text-foreground">
              {m.value}/{m.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
