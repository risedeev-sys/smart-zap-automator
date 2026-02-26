import { MessageSquare, Mic, Image, FileText, GitBranch, Send, Clock, Workflow } from "lucide-react";

const metrics = [
  { label: "Mensagens", value: 0, max: 20, icon: MessageSquare },
  { label: "Áudios", value: 0, max: 20, icon: Mic },
  { label: "Mídias", value: 0, max: 20, icon: Image },
  { label: "Documentos", value: 0, max: 20, icon: FileText },
  { label: "Funis", value: 2, max: 5, icon: GitBranch },
  { label: "Disparos", value: 0, max: 2, icon: Send },
  { label: "Agendados", value: 0, max: 5, icon: Clock },
  { label: "Fluxos", value: 0, max: 5, icon: Workflow },
];

export function MetricsBar() {
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
