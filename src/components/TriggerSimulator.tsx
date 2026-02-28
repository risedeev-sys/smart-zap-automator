import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Zap, FlaskConical, Check, X } from "lucide-react";

interface TriggerRow {
  id: string;
  name: string;
  enabled: boolean;
  conditions: { type: string; keywords: string[] }[];
  ignore_case: boolean;
  funnel_name?: string;
}

interface SimulatorResult {
  trigger: TriggerRow;
  matched: boolean;
  matchedConditions: { type: string; keyword: string }[];
}

function evaluateTrigger(trigger: TriggerRow, message: string): SimulatorResult {
  const msg = trigger.ignore_case ? message.toLowerCase() : message;
  const matchedConditions: { type: string; keyword: string }[] = [];
  let allPass = true;

  for (const cond of trigger.conditions) {
    const keywords = cond.keywords.map((k) =>
      trigger.ignore_case ? k.toLowerCase() : k
    );

    let condPass = false;
    switch (cond.type) {
      case "contém":
        for (const kw of keywords) {
          if (msg.includes(kw)) {
            matchedConditions.push({ type: cond.type, keyword: kw });
            condPass = true;
          }
        }
        break;
      case "igual a":
        for (const kw of keywords) {
          if (msg === kw) {
            matchedConditions.push({ type: cond.type, keyword: kw });
            condPass = true;
          }
        }
        break;
      case "começa com":
        for (const kw of keywords) {
          if (msg.startsWith(kw)) {
            matchedConditions.push({ type: cond.type, keyword: kw });
            condPass = true;
          }
        }
        break;
      case "não contém":
        condPass = keywords.every((kw) => !msg.includes(kw));
        if (condPass) {
          matchedConditions.push({ type: cond.type, keyword: "(nenhuma)" });
        }
        break;
      default:
        condPass = false;
    }

    if (!condPass) {
      allPass = false;
    }
  }

  return { trigger, matched: allPass && trigger.conditions.length > 0, matchedConditions };
}

interface TriggerSimulatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggers: TriggerRow[];
}

export function TriggerSimulator({ open, onOpenChange, triggers }: TriggerSimulatorProps) {
  const [testMessage, setTestMessage] = useState("");
  const [results, setResults] = useState<SimulatorResult[] | null>(null);

  const handleSimulate = () => {
    if (!testMessage.trim()) return;
    const activeTriggers = triggers.filter((t) => t.enabled);
    const simResults = activeTriggers.map((t) => evaluateTrigger(t, testMessage.trim()));
    setResults(simResults);
  };

  const matchedCount = results?.filter((r) => r.matched).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Simulador de Gatilhos
          </DialogTitle>
          <DialogDescription>
            Digite uma mensagem de teste para ver quais gatilhos seriam disparados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {results !== null && (
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

              {results.map((r) => (
                <div
                  key={r.trigger.id}
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
                    <span className="font-medium text-sm text-foreground">{r.trigger.name}</span>
                    {r.trigger.funnel_name && (
                      <Badge variant="outline" className="text-xs ml-auto">
                        → {r.trigger.funnel_name}
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
