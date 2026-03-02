import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface Instance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

interface RealModePanelProps {
  realMode: boolean;
  onRealModeChange: (v: boolean) => void;
  instances: Instance[];
  selectedInstanceId: string;
  onInstanceChange: (id: string) => void;
  targetPhone: string;
  onTargetPhoneChange: (v: string) => void;
  isReady: boolean;
  sending: boolean;
}

export function RealModePanel({
  realMode,
  onRealModeChange,
  instances,
  selectedInstanceId,
  onInstanceChange,
  targetPhone,
  onTargetPhoneChange,
  isReady,
  sending,
}: RealModePanelProps) {
  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2">
      <div className="flex items-center gap-3">
        <Switch checked={realMode} onCheckedChange={onRealModeChange} />
        <span className="text-sm font-medium text-foreground">
          Envio Real via WhatsApp
        </span>
        {realMode && (
          <>
            {sending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {isReady ? (
              <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Wifi className="h-3 w-3" /> Pronto
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" /> Sem instância
              </Badge>
            )}
          </>
        )}
      </div>

      {realMode && (
        <div className="flex items-center gap-3 mt-2">
          <Select value={selectedInstanceId} onValueChange={onInstanceChange}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Instância..." />
            </SelectTrigger>
            <SelectContent>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.instance_name}
                  {inst.phone_number ? ` (${inst.phone_number})` : ""}
                </SelectItem>
              ))}
              {instances.length === 0 && (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Nenhuma instância conectada
                </div>
              )}
            </SelectContent>
          </Select>

          <Input
            placeholder="Número destino (ex: 5561999999999)"
            value={targetPhone}
            onChange={(e) => onTargetPhoneChange(e.target.value.replace(/\D/g, ""))}
            className="w-52 h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}
