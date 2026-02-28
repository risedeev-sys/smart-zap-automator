import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Smartphone,
  Plus,
  Wifi,
  WifiOff,
  Loader2,
  Trash2,
  RefreshCw,
  Phone,
  QrCode,
  Unplug,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
}

function statusBadge(status: string) {
  switch (status) {
    case "open":
      return (
        <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
          <Wifi className="h-3 w-3" /> Conectado
        </Badge>
      );
    case "connecting":
      return (
        <Badge variant="secondary" className="gap-1 text-yellow-600 border-yellow-500/30">
          <Loader2 className="h-3 w-3 animate-spin" /> Conectando
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
          <WifiOff className="h-3 w-3" /> Desconectado
        </Badge>
      );
  }
}

async function invokeManage(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("whatsapp-manage", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || "Erro na operação");
  return data;
}

export default function ApiKeysPage() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    try {
      const data = await invokeManage("instance-list");
      setInstances(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  // Poll for QR code updates when any instance is connecting
  useEffect(() => {
    const hasConnecting = instances.some((i) => i.status === "connecting");
    if (!hasConnecting) return;

    const interval = setInterval(fetchInstances, 3000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      toast.error("QR Code expirado. Clique em 'Conectar' para gerar um novo.");
    }, 60000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [instances, fetchInstances]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await invokeManage("instance-create", { instance_name: newName.trim() });
      toast.success("Instância criada com sucesso!");
      setNewName("");
      setDialogOpen(false);
      await fetchInstances();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar instância");
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (action: string, instanceId: string, successMsg: string) => {
    setActionLoading(instanceId);
    try {
      await invokeManage(action, { instance_id: instanceId });
      toast.success(successMsg);
      await fetchInstances();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na operação");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <MainLayout title="Instâncias">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gerenciamento de Números</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Conecte e gerencie suas instâncias do WhatsApp
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nova Instância
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Instância</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="instance-name">Nome da instância</Label>
                <Input
                  id="instance-name"
                  placeholder="ex: meu-whatsapp"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <p className="text-xs text-muted-foreground">
                  Use apenas letras, números e hífens. Sem espaços.
                </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : instances.length === 0 ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Card className="max-w-md w-full border-dashed border-2 border-border">
            <CardContent className="p-8 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma instância criada</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Crie sua primeira instância para conectar um número do WhatsApp.
              </p>
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Criar Instância
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {instances.map((inst) => (
            <Card key={inst.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{inst.instance_name}</CardTitle>
                      {inst.phone_number && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Phone className="h-3 w-3" />
                          <span>{inst.phone_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {statusBadge(inst.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* QR Code area */}
                {inst.status === "connecting" && inst.qr_code && (
                  <div className="flex justify-center p-4 rounded-lg border bg-white">
                    <img
                      src={inst.qr_code.startsWith("data:") ? inst.qr_code : `data:image/png;base64,${inst.qr_code}`}
                      alt="QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                )}

                {inst.status === "connecting" && !inst.qr_code && (
                  <div className="flex items-center justify-center p-8 rounded-lg border-2 border-dashed border-border bg-muted/30">
                    <div className="text-center text-muted-foreground">
                      <QrCode className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Aguardando QR Code...</p>
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {inst.status !== "open" && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={actionLoading === inst.id}
                      onClick={() => handleAction("instance-connect", inst.id, "QR Code gerado!")}
                    >
                      {actionLoading === inst.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wifi className="h-3.5 w-3.5" />
                      )}
                      Conectar
                    </Button>
                  )}

                  {inst.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={actionLoading === inst.id}
                      onClick={() => handleAction("instance-disconnect", inst.id, "Instância desconectada")}
                    >
                      {actionLoading === inst.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unplug className="h-3.5 w-3.5" />
                      )}
                      Desconectar
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={actionLoading === inst.id}
                    onClick={() => handleAction("instance-status", inst.id, "Status atualizado")}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Atualizar
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="gap-1.5 ml-auto">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir instância?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A instância "{inst.instance_name}" será removida permanentemente. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleAction("instance-delete", inst.id, "Instância excluída")}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </MainLayout>
  );
}
