import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GitBranch, Clock, User, AlertTriangle, MessageSquare, Mic, Image, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const typeLabels: Record<string, { icon: typeof MessageSquare; label: string }> = {
  funil: { icon: GitBranch, label: "Funil" },
  mensagem: { icon: MessageSquare, label: "Mensagem" },
  audio: { icon: Mic, label: "Áudio" },
  midia: { icon: Image, label: "Mídia" },
  documento: { icon: FileText, label: "Documento" },
};

interface AssetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetName: string;
  assetType: string;
  itemCount?: number;
  estimatedDuration?: string;
  onConfirm: () => void;
}

export function AssetConfirmDialog({
  open,
  onOpenChange,
  assetName,
  assetType,
  itemCount,
  estimatedDuration,
  onConfirm,
}: AssetConfirmDialogProps) {
  const typeInfo = typeLabels[assetType] ?? { icon: FileText, label: assetType };
  const TypeIcon = typeInfo.icon;
  const isFunnel = assetType === "funil";

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
            <TypeIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">{typeInfo.label}:</span>
            <span className="text-sm text-muted-foreground">{assetName}</span>
          </div>
          {isFunnel && (
            <>
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
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>Enviar {typeInfo.label.toLowerCase()}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
