import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GitBranch, Clock, User, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface FunnelConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelName: string;
  itemCount: number;
  estimatedDuration: string;
  onConfirm: () => void;
}

export function FunnelConfirmDialog({
  open,
  onOpenChange,
  funnelName,
  itemCount,
  estimatedDuration,
  onConfirm,
}: FunnelConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirmação de envio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">Destinatário:</span>
            <span className="text-sm text-muted-foreground">Contato de Teste</span>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">Funil:</span>
            <span className="text-sm text-muted-foreground">{funnelName}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">Duração:</span>
            <span className="text-sm text-muted-foreground">{estimatedDuration}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium ml-7">Itens:</span>
            <span className="text-sm text-muted-foreground">{itemCount} ativo(s)</span>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>Enviar funil</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
