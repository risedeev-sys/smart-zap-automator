import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { importBackupToSupabase } from "@/utils/importBackupToSupabase";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload, Download, AlertTriangle, FileJson, CheckCircle2 } from "lucide-react";
import { useAssets, type AssetItem, type Funnel } from "@/contexts/AssetsContext";
import { useToast } from "@/hooks/use-toast";
import { detectAndConvertZapVoice } from "@/utils/zapVoiceConverter";

export default function BackupsPage() {
  const { mensagens, setMensagens, audios, setAudios, midias, setMidias, documentos, setDocumentos, funnels, setFunnels } = useAssets();
  const { toast } = useToast();

  // Export state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportAll, setExportAll] = useState(true);
  const [exportName, setExportName] = useState("");
  const [exportSections, setExportSections] = useState({
    mensagens: true,
    audios: true,
    midias: true,
    documentos: true,
    funis: true,
    gatilhos: true,
  });

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Export ---
  const openExportModal = () => {
    setExportName(`backup-rise-zap-${new Date().toISOString().slice(0, 10)}`);
    setExportAll(true);
    setExportSections({ mensagens: true, audios: true, midias: true, documentos: true, funis: true, gatilhos: true });
    setExportModalOpen(true);
  };

  const handleExport = async () => {
    const data: Record<string, unknown> = { version: 1, createdAt: new Date().toISOString() };

    if (exportAll || exportSections.mensagens) data.mensagens = mensagens;
    if (exportAll || exportSections.audios) data.audios = audios;
    if (exportAll || exportSections.midias) data.midias = midias;
    if (exportAll || exportSections.documentos) data.documentos = documentos;
    if (exportAll || exportSections.funis) data.funis = funnels;
    if (exportAll || exportSections.gatilhos) {
      const { data: triggersData } = await supabase.from("triggers").select("*");
      data.gatilhos = triggersData ?? [];
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName || "backup"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportModalOpen(false);
    toast({ title: "Backup exportado com sucesso!" });
  };

  // --- Import ---
  const handleFileSelect = (file: File | null) => {
    if (file && file.type === "application/json") {
      setImportFile(file);
      setImportSuccess(false);
    } else if (file) {
      toast({ title: "Arquivo inválido", description: "Selecione um arquivo .json", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    try {
      const text = await importFile.text();
      const rawData = JSON.parse(text);
      const { converted: data, wasZapVoice } = detectAndConvertZapVoice(rawData);

      // Persist to Supabase
      console.log("[BackupsPage] Chamando importBackupToSupabase...");
      const { counts } = await importBackupToSupabase(data);
      console.log("[BackupsPage] Persistência concluída:", counts);

      // Update local state with imported data (always replace)
      setMensagens(data.mensagens ?? []);
      setAudios(data.audios ?? []);
      setMidias(data.midias ?? []);
      setDocumentos(data.documentos ?? []);
      setFunnels(data.funis ?? []);
      // triggers are now handled by importBackupToSupabase directly

      // Summary toast
      const countStrs: string[] = [];
      if (counts.mensagens) countStrs.push(`${counts.mensagens} mensagens`);
      if (counts.audios) countStrs.push(`${counts.audios} áudios`);
      if (counts.midias) countStrs.push(`${counts.midias} mídias`);
      if (counts.documentos) countStrs.push(`${counts.documentos} documentos`);
      if (counts.funis) countStrs.push(`${counts.funis} funis`);

      setImportSuccess(true);
      setImportFile(null);
      toast({
        title: wasZapVoice ? "Backup do Zap Voice importado com sucesso!" : "Backup importado com sucesso!",
        description: countStrs.length ? `Persistido no Supabase: ${countStrs.join(", ")}` : undefined,
      });
    } catch (err: any) {
      console.error("[BackupsPage] Erro na importação:", err);
      toast({ title: "Erro ao importar", description: err.message || "O arquivo não é um backup válido.", variant: "destructive" });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const toggleSection = (key: keyof typeof exportSections) => {
    setExportSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                {importFile ? (
                  <>
                    <FileJson className="h-10 w-10 mx-auto text-primary mb-3" />
                    <p className="text-sm font-medium text-foreground">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique para trocar o arquivo</p>
                  </>
                ) : importSuccess ? (
                  <>
                    <CheckCircle2 className="h-10 w-10 mx-auto text-primary mb-3" />
                    <p className="text-sm text-primary font-medium">Backup importado com sucesso!</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Arraste seu arquivo <strong>.json</strong> aqui ou clique para selecionar
                    </p>
                  </>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  Ao importar, todos os seus dados atuais (mensagens, áudios, mídias, documentos e funis) serão <strong>substituídos</strong> pelos dados do backup.
                </p>
              </div>

              <Button className="w-full" onClick={handleImport} disabled={!importFile}>
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
              <Button className="w-full" onClick={openExportModal}>
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
              <Input value={exportName} onChange={(e) => setExportName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Exportar tudo</span>
              <Switch checked={exportAll} onCheckedChange={setExportAll} />
            </div>
            {!exportAll && (
              <div className="space-y-2 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground mb-2">Selecione o que deseja exportar:</p>
                {([
                  ["mensagens", "Mensagens"],
                  ["audios", "Áudios"],
                  ["midias", "Mídias"],
                  ["documentos", "Documentos"],
                  ["funis", "Funis"],
                  ["gatilhos", "Gatilhos"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`export-${key}`}
                      checked={exportSections[key]}
                      onCheckedChange={() => toggleSection(key)}
                    />
                    <label htmlFor={`export-${key}`} className="text-sm text-foreground cursor-pointer">{label}</label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Exportar backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
