import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { useAssets, type AssetItem, type Funnel, type Trigger } from "@/contexts/AssetsContext";
import { useToast } from "@/hooks/use-toast";
import { detectAndConvertZapVoice } from "@/utils/zapVoiceConverter";

export default function BackupsPage() {
  const { mensagens, setMensagens, audios, setAudios, midias, setMidias, documentos, setDocumentos, funnels, setFunnels, triggers, setTriggers } = useAssets();
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
  const [replaceAll, setReplaceAll] = useState(false);
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

  const handleExport = () => {
    const data: Record<string, unknown> = { version: 1, createdAt: new Date().toISOString() };

    if (exportAll || exportSections.mensagens) data.mensagens = mensagens;
    if (exportAll || exportSections.audios) data.audios = audios;
    if (exportAll || exportSections.midias) data.midias = midias;
    if (exportAll || exportSections.documentos) data.documentos = documentos;
    if (exportAll || exportSections.funis) data.funis = funnels;
    if (exportAll || exportSections.gatilhos) data.gatilhos = triggers;

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

      if (replaceAll) {
        // Replace mode: use IDs as-is
        if (data.mensagens) setMensagens(data.mensagens);
        if (data.audios) setAudios(data.audios);
        if (data.midias) setMidias(data.midias);
        if (data.documentos) setDocumentos(data.documentos);
        if (data.funis) setFunnels(data.funis);
        if (data.gatilhos) setTriggers(data.gatilhos);
      } else {
        // Append mode: remap all IDs to avoid conflicts
        const idMap: Record<string, string> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const remap = (items: any[]): any[] =>
          items.map((item) => {
            const newId = crypto.randomUUID();
            idMap[item.id] = newId;
            return { ...item, id: newId };
          });

        const remappedMensagens = data.mensagens ? remap(data.mensagens) : [];
        const remappedAudios = data.audios ? remap(data.audios) : [];
        const remappedMidias = data.midias ? remap(data.midias) : [];
        const remappedDocumentos = data.documentos ? remap(data.documentos) : [];

        if (remappedMensagens.length) setMensagens((prev) => [...prev, ...remappedMensagens]);
        if (remappedAudios.length) setAudios((prev) => [...prev, ...remappedAudios]);
        if (remappedMidias.length) setMidias((prev) => [...prev, ...remappedMidias]);
        if (remappedDocumentos.length) setDocumentos((prev) => [...prev, ...remappedDocumentos]);

        // Remap funnels: new funnel IDs, new item IDs, updated assetIds
        if (data.funis) {
          const remappedFunnels = (data.funis as Funnel[]).map((funnel) => ({
            ...funnel,
            id: crypto.randomUUID(),
            items: funnel.items.map((item) => ({
              ...item,
              id: crypto.randomUUID(),
              assetId: idMap[item.assetId] || item.assetId,
            })),
          }));
          setFunnels((prev) => [...prev, ...remappedFunnels]);
        }

        // Remap triggers
        if (data.gatilhos) {
          const remappedTriggers = (data.gatilhos as Trigger[]).map((trigger) => ({
            ...trigger,
            id: crypto.randomUUID(),
          }));
          setTriggers((prev) => [...prev, ...remappedTriggers]);
        }
      }

      // Validate funnel asset references
      if (data.funis) {
        const allAssetIds = new Set([
          ...mensagens.map((m) => m.id),
          ...audios.map((a) => a.id),
          ...midias.map((m) => m.id),
          ...documentos.map((d) => d.id),
          ...(data.mensagens || []).map((m: { id: string }) => m.id),
          ...(data.audios || []).map((a: { id: string }) => a.id),
          ...(data.midias || []).map((m: { id: string }) => m.id),
          ...(data.documentos || []).map((d: { id: string }) => d.id),
        ]);

        const missingCategories = new Set<string>();
        for (const funnel of data.funis as Funnel[]) {
          for (const item of funnel.items) {
            if (!allAssetIds.has(item.assetId)) {
              const labels: Record<string, string> = { mensagem: "Mensagens", audio: "Áudios", midia: "Mídias", documento: "Documentos" };
              missingCategories.add(labels[item.type] || item.type);
            }
          }
        }

        if (missingCategories.size > 0) {
          toast({
            title: "Atenção: assets ausentes",
            description: `Alguns funis referenciam itens não encontrados em: ${[...missingCategories].join(", ")}. Esses itens podem aparecer como "(item removido)".`,
            variant: "destructive",
          });
        }
      }

      // Summary toast
      const counts: string[] = [];
      if (data.mensagens?.length) counts.push(`${data.mensagens.length} mensagens`);
      if (data.audios?.length) counts.push(`${data.audios.length} áudios`);
      if (data.midias?.length) counts.push(`${data.midias.length} mídias`);
      if (data.documentos?.length) counts.push(`${data.documentos.length} documentos`);
      if (data.funis?.length) counts.push(`${data.funis.length} funis`);
      if (data.gatilhos?.length) counts.push(`${data.gatilhos.length} gatilhos`);

      setImportSuccess(true);
      setImportFile(null);
      toast({
        title: wasZapVoice ? "Backup do Zap Voice importado com sucesso!" : "Backup importado com sucesso!",
        description: counts.length ? `Importado: ${counts.join(", ")}` : undefined,
      });
    } catch {
      toast({ title: "Erro ao importar", description: "O arquivo não é um backup válido.", variant: "destructive" });
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Substituir todos os itens existentes</span>
                <Switch checked={replaceAll} onCheckedChange={setReplaceAll} />
              </div>

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
                  Ao importar, os itens do backup serão adicionados à sua conta. Ative a opção acima para substituir todos os itens existentes.
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
