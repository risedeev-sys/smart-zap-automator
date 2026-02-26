import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload, Download, AlertTriangle, FileJson } from "lucide-react";

export default function BackupsPage() {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportAll, setExportAll] = useState(true);

  return (
    <MainLayout title="Backups">
      <Tabs defaultValue="importar" className="max-w-2xl mx-auto">
        <TabsList className="w-full">
          <TabsTrigger value="importar" className="flex-1">Importar backup</TabsTrigger>
          <TabsTrigger value="gerar" className="flex-1">Gerar backup</TabsTrigger>
        </TabsList>

        <TabsContent value="importar" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Importar backup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Substituir todos os itens existentes</span>
                <Switch />
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Arraste seu arquivo <strong>.json</strong> aqui ou clique para selecionar
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  Ao importar, os itens do backup serão adicionados à sua conta. Ative a opção acima para substituir todos os itens existentes.
                </p>
              </div>

              <Button className="w-full">
                <Upload className="h-4 w-4 mr-2" /> Importar backup
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gerar" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gerar backup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                <FileJson className="h-8 w-8 mb-2 text-primary" />
                <p>
                  Gere um backup completo em formato <strong>.json</strong> com todas as suas mensagens, áudios, mídias, documentos, funis e gatilhos.
                </p>
              </div>
              <Button className="w-full" onClick={() => setExportModalOpen(true)}>
                <Download className="h-4 w-4 mr-2" /> Gerar backup
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmação de exportação</DialogTitle>
            <DialogDescription>Configure o backup antes de exportar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome do backup</label>
              <Input defaultValue={`backup-rise-zap-${new Date().toISOString().slice(0, 10)}`} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Exportar tudo</span>
              <Switch checked={exportAll} onCheckedChange={setExportAll} />
            </div>
            {!exportAll && (
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                Seleção parcial será habilitada aqui (mensagens, áudios, mídias, documentos, funis, gatilhos).
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => setExportModalOpen(false)}>
              <Download className="h-4 w-4 mr-1" /> Exportar backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
