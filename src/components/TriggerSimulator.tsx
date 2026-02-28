import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Zap, FlaskConical, Check, X, Users, UserCheck } from "lucide-react";
import {
  type TriggerData,
  type TriggerMatchResult,
  findMatchingTriggers,
  evaluateTrigger,
} from "@/utils/triggerEngine";

interface TriggerWithFunnelName extends TriggerData {
  funnel_name?: string;
}

interface TriggerSimulatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggers: TriggerWithFunnelName[];
}

export function TriggerSimulator({ open, onOpenChange, triggers }: TriggerSimulatorProps) {
  const [testMessage, setTestMessage] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [isSavedContact, setIsSavedContact] = useState(true);
  const [allResults, setAllResults] = useState<(TriggerMatchResult & { funnel_name?: string })[] | null>(null);

  const handleSimulate = () => {
    if (!testMessage.trim()) return;

    // Avalia TODOS os triggers (ativos) para mostrar quais passam e quais não
    const activeTriggers = triggers.filter((t) => {
      if (!t.enabled) return false;
      if (isGroup && !t.send_to_groups) return false;
      if (t.saved_contacts_only && !isSavedContact) return false;
      return true;
    });

    const results = activeTriggers.map((t) => {
      const result = evaluateTrigger(t, testMessage.trim());
      const trigger = triggers.find((tr) => tr.id === t.id);
      return { ...result, funnel_name: trigger?.funnel_name };
    });

    setAllResults(results);
  };

  const matchedCount = allResults?.filter((r) => r.matched).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Simulador de Gatilhos
          </DialogTitle>
          <DialogDescription>
            Simula exatamente a mesma lógica que será usada quando o WhatsApp estiver conectado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context toggles */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">Grupo</span>
              <Switch checked={isGroup} onCheckedChange={setIsGroup} className="scale-75" />
            </div>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">Contato salvo</span>
              <Switch checked={isSavedContact} onCheckedChange={setIsSavedContact} className="scale-75" />
            </div>
          </div>

          {/* Message input */}
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Oi, quero saber mais..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSimulate();
              }}
            />
            <Button onClick={handleSimulate} disabled={!testMessage.trim()}>
              <Zap className="h-4 w-4 mr-1" /> Simular
            </Button>
          </div>

          {allResults !== null && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">
                {matchedCount > 0 ? (
                  <span className="text-primary">
                    ✅ {matchedCount} gatilho{matchedCount > 1 ? "s" : ""} disparado{matchedCount > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Nenhum gatilho disparado</span>
                )}
              </div>

              {allResults.map((r) => (
                <div
                  key={r.triggerId}
                  className={`border rounded-lg p-3 space-y-1 ${
                    r.matched ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {r.matched ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm text-foreground">{r.triggerName}</span>
                    {r.funnel_name && (
                      <Badge variant="outline" className="text-xs ml-auto">
                        → {r.funnel_name}
                      </Badge>
                    )}
                    {r.matched && r.delaySeconds > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        ⏱ {r.delaySeconds}s
                      </Badge>
                    )}
                  </div>
                  {r.matched && r.matchedConditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 ml-6">
                      {r.matchedConditions.map((mc, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {mc.type}: "{mc.keyword}"
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
