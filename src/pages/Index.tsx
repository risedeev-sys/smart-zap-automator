import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wifi,
  WifiOff,
  QrCode,
  MessageSquare,
  Mic,
  Image,
  FileText,
  GitBranch,
  Zap,
  Workflow,
  BookOpen,
  Smartphone,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const totalItems = [
  { label: "Mensagens", count: 3, icon: MessageSquare },
  { label: "Áudios", count: 1, icon: Mic },
  { label: "Mídias", count: 0, icon: Image },
  { label: "Documentos", count: 0, icon: FileText },
  { label: "Funis", count: 2, icon: GitBranch },
  { label: "Gatilhos", count: 1, icon: Zap },
  { label: "Fluxos", count: 0, icon: Workflow },
];

interface Instance {
  id: string;
  instance_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
}

export default function Index() {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(true);
  const navigate = useNavigate();

  const fetchInstance = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `https://txnhtcyjzohxkfwdfrvh.supabase.co/functions/v1/whatsapp-manage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bmh0Y3lqem9oeGtmd2RmcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0MTEsImV4cCI6MjA4Nzc4MDQxMX0.vUFZYFr8OLaZczKjcj4I8HOpMLNNOX1yo3GhvwPuR9Y",
          },
          body: JSON.stringify({ action: "instance-list" }),
        }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setInstance(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInstance(false);
    }
  }, []);

  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  const isConnected = instance?.status === "open";

  return (
    <MainLayout title="Início">
      {/* Welcome */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Bem-vindo ao Rise Zap 👋</h2>
        <p className="text-muted-foreground mt-1">
          Gerencie suas automações de WhatsApp de forma simples e eficiente.
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="border-primary/20 bg-accent/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Guia rápido</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Configure suas mensagens, monte funis e ative gatilhos para automatizar seus atendimentos.
            </CardDescription>
          </CardContent>
        </Card>

        <Card
          className="border-primary/20 bg-accent/30 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/instancias")}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Conectar WhatsApp</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Conecte sua instância do WhatsApp via Evolution API para começar a enviar mensagens automatizadas.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Evolution API Card — real data */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp (Evolution API)</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {loadingInstance
                    ? "Carregando..."
                    : instance
                    ? `Instância: ${instance.instance_name}`
                    : "Nenhuma instância criada"}
                </p>
              </div>
            </div>
            {loadingInstance ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                <Wifi className="h-3 w-3" /> Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
                <WifiOff className="h-3 w-3" /> Desconectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 min-h-[160px]">
              {instance?.status === "connecting" && instance?.qr_code ? (
                <img
                  src={instance.qr_code.startsWith("data:") ? instance.qr_code : `data:image/png;base64,${instance.qr_code}`}
                  alt="QR Code"
                  className="w-40 h-40 object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {isConnected ? "Conectado ✓" : "QR Code aparecerá aqui"}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:w-48">
              <Button className="w-full" onClick={() => navigate("/instancias")}>
                {instance ? "Gerenciar" : "Criar Instância"}
              </Button>
              {instance?.phone_number && (
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Número</p>
                  <p>{instance.phone_number}</p>
                </div>
              )}
              <div className="mt-auto rounded-md bg-muted p-3 text-xs text-muted-foreground flex-1 min-h-[60px]">
                <p className="font-medium mb-1">Status</p>
                <p className="opacity-80">
                  {loadingInstance
                    ? "Verificando..."
                    : isConnected
                    ? "Instância conectada e pronta para enviar mensagens."
                    : instance
                    ? "Instância desconectada. Conecte para enviar mensagens."
                    : "Crie uma instância para começar."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total de itens cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {totalItems.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/50 text-center"
              >
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold text-foreground">{item.count}</span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
