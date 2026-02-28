import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Key, Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ApiKeysPage() {
  return (
    <MainLayout title="Chaves API">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center border-dashed border-2 border-border">
          <CardHeader className="pb-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
              <Key className="h-8 w-8 text-orange-400" />
            </div>
            <CardTitle className="text-xl">Configuração de Chaves API</CardTitle>
            <Badge variant="secondary" className="mx-auto mt-2 gap-1.5">
              <Construction className="h-3 w-3" />
              Em desenvolvimento
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Em breve você poderá configurar suas chaves da <strong>Evolution API</strong>, <strong>OpenAI</strong>, <strong>ElevenLabs</strong> e outros serviços diretamente por aqui.
            </p>
            <p className="text-muted-foreground text-xs mt-4 opacity-60">
              Este módulo está em produção e será liberado nas próximas atualizações.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
