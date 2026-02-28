import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Construction, Phone, CalendarDays, EyeOff, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ApiKeysPage() {
  return (
    <MainLayout title="Instâncias">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg w-full border-dashed border-2 border-border">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Gerenciamento de Números</CardTitle>
            <Badge variant="secondary" className="mx-auto mt-2 gap-1.5">
              <Construction className="h-3 w-3" />
              Em desenvolvimento
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview card mockup */}
            <Card className="border border-border bg-muted/30 opacity-60 pointer-events-none select-none">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">Minha Instância</span>
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <span>••••••••••••••••••••••••••</span>
                  <EyeOff className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-emerald-500 font-medium">Conectado (ativo)</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>01/01/2026</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>+55 11 99999-9999</span>
                </div>
              </CardContent>
            </Card>

            <p className="text-muted-foreground text-sm leading-relaxed text-center">
              Em breve você poderá <strong>conectar</strong>, <strong>desconectar</strong> e <strong>gerenciar</strong> seus números do WhatsApp diretamente por aqui.
            </p>
            <p className="text-muted-foreground text-xs text-center opacity-60">
              Este módulo está em produção e será liberado nas próximas atualizações.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
