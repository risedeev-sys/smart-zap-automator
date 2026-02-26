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
} from "lucide-react";

const totalItems = [
  { label: "Mensagens", count: 3, icon: MessageSquare },
  { label: "Áudios", count: 1, icon: Mic },
  { label: "Mídias", count: 0, icon: Image },
  { label: "Documentos", count: 0, icon: FileText },
  { label: "Funis", count: 2, icon: GitBranch },
  { label: "Gatilhos", count: 1, icon: Zap },
  { label: "Fluxos", count: 0, icon: Workflow },
];

export default function Index() {
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

        <Card className="border-primary/20 bg-accent/30">
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

      {/* Evolution API Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp (Evolution API)</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Instância: rise-zap-01</p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
              <WifiOff className="h-3 w-3" />
              Desconectado
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 min-h-[160px]">
              <div className="text-center text-muted-foreground">
                <QrCode className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">QR Code aparecerá aqui</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:w-48">
              <Button className="w-full">Conectar</Button>
              <Button variant="outline" className="w-full">Reconectar</Button>
              <div className="mt-2 rounded-md bg-muted p-3 text-xs text-muted-foreground flex-1 min-h-[60px]">
                <p className="font-medium mb-1">Logs</p>
                <p className="opacity-60">Nenhum evento recente.</p>
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
