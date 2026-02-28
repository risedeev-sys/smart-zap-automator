import { useState, useEffect } from "react";
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

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTestMessage("");
      setAllResults(null);
    }
  }, [open]);

  const handleSimulate = () => {
    if (!testMessage.trim()) return;

    // Filter by rules first, then evaluate
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

  const matched = allResults?.filter((r) => r.matched) ?? [];
  const notMatched = allResults?.filter((r) => !r.matched) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Simulador de Gatilhos
          </DialogTitle>
          <DialogDescription>
            Simula exatamente a mesma lógica usada quando o WhatsApp estiver conectado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context toggles */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-foreground">Grupo</span>
              <Switch checked={isGroup} onCheckedChange={setIsGroup} className="scale-75" />
            </div>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-foreground">Contato salvo</span>
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
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSimulate();
                }
              }}
              autoFocus
            />
            <Button type="button" onClick={handleSimulate} disabled={!testMessage.trim()}>
              <Zap className="h-4 w-4 mr-1" /> Simular
            </Button>
          </div>

          {allResults !== null && (
            <div className="space-y-3">
              {/* Matched */}
              {matched.length > 0 ? (
                <>
                  <div className="text-sm font-medium text-primary">
                    ✅ {matched.length} gatilho{matched.length > 1 ? "s" : ""} disparado{matched.length > 1 ? "s" : ""}
                  </div>
                  {matched.map((r) => (
                    <div
                      key={r.triggerId}
                      className="border border-primary/50 bg-primary/5 rounded-lg p-3 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-medium text-sm text-foreground">{r.triggerName}</span>
                        {r.funnel_name && r.funnel_name !== "Nenhum" && (
                          <Badge variant="outline" className="text-xs ml-auto">
                            → {r.funnel_name}
                          </Badge>
                        )}
                        {r.delaySeconds > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            ⏱ {r.delaySeconds}s
                          </Badge>
                        )}
                      </div>
                      {r.matchedConditions.length > 0 && (
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
                </>
              ) : (
                <div className="text-sm font-medium text-muted-foreground">
                  Nenhum gatilho disparado para essa mensagem.
                </div>
              )}

              {/* Not matched (collapsed) */}
              {notMatched.length > 0 && (
                <details className="text-sm">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    {notMatched.length} gatilho{notMatched.length > 1 ? "s" : ""} não disparado{notMatched.length > 1 ? "s" : ""}
                  </summary>
                  <div className="mt-2 space-y-1">
                    {notMatched.map((r) => (
                      <div
                        key={r.triggerId}
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/30"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{r.triggerName}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
