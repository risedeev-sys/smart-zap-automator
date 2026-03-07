import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAssets, AssetItem } from "@/contexts/AssetsContext";
import { TwoColumnLayout, ListItem } from "@/components/layout/TwoColumnLayout";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FileUploadZone } from "@/components/FileUploadZone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Copy, Pencil, Heart, Mic, Download, Info, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadAssetFile } from "@/utils/uploadAssetFile";
import { deleteAssetEverywhere } from "@/utils/deleteAssetEverywhere";
import { convertAudioToOgg } from "@/utils/convertAudioToOgg";

export default function AudiosPage() {
  const { audios, setAudios } = useAssets();

  const [selected, setSelected] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [forwarded, setForwarded] = useState(false);
  const [singleView, setSingleView] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchAudios = useCallback(async () => {
    const { data, error } = await supabase
      .from("audios")
      .select("id, name, storage_path, metadata")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar áudios", description: error.message, variant: "destructive" });
      return;
    }

    const rows: AssetItem[] = await Promise.all(
      (data ?? []).map(async (row: any) => {
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
        let fileUrl: string | undefined;
        if (row.storage_path) {
          const { data: urlData } = await supabase.storage
            .from("assets")
            .createSignedUrl(row.storage_path, 3600);
          fileUrl = urlData?.signedUrl;
        }
        return {
          id: row.id,
          name: row.name,
          fileName: typeof row.storage_path === "string" ? row.storage_path.split("/").pop() : undefined,
          forwarded: metadata.forwarded === true,
          singleView: metadata.singleView === true || metadata.single_view === true,
          fileUrl,
        };
      })
    );

    setAudios(rows);
    setSelected((prev) => {
      if (!rows.length) return null;
      if (!prev) return rows[0].id;
      return rows.some((item) => item.id === prev) ? prev : rows[0].id;
    });
  }, [setAudios, toast]);

  useEffect(() => {
    fetchAudios();
  }, [fetchAudios]);

  const listItems: ListItem[] = audios.map(a => ({ id: a.id, name: a.name, favorite: a.favorite }));

  const handleReorder = (reordered: ListItem[]) => {
    const idOrder = reordered.map(r => r.id);
    setAudios(prev => {
      const map = new Map(prev.map(m => [m.id, m]));
      return idOrder.map(id => map.get(id)!).filter(Boolean);
    });
  };
  const selectedItem = audios.find((m) => m.id === selected);

  const handleDelete = async () => {
    if (!selected) return;

    try {
      const { storageWarning } = await deleteAssetEverywhere({ assetType: "audio", assetId: selected, assetName: selectedItem?.name });
      await fetchAudios();
      setDeleteOpen(false);
      toast({
        title: "Áudio excluído!",
        description: storageWarning ? `Arquivo removido do cadastro, mas houve falha ao limpar storage: ${storageWarning}` : undefined,
      });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const handleAdd = async () => {
    if (isSaving) return;
    if (!newName.trim() || !uploadFile) return;

    setIsSaving(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para salvar o áudio.",
          variant: "destructive",
        });
        return;
      }

      // 0. Convert short audio to OGG/Opus for faster WhatsApp delivery
      // Long audios are uploaded as-is to avoid blocking the UI for minutes.
      let fileToUpload: File;
      try {
        fileToUpload = await convertAudioToOgg(uploadFile);
      } catch {
        fileToUpload = uploadFile;
      }

      // 1. Insert record in Supabase
      const { data: record, error } = await supabase
        .from("audios")
        .insert({ name: newName.trim(), user_id: user.id, metadata: { singleView, forwarded } })
        .select("id, name")
        .single();
      if (error || !record) {
        toast({ title: "Erro ao criar áudio", description: error?.message, variant: "destructive" });
        return;
      }

      // 2. Upload converted file to bucket & update storage_path
      try {
        await uploadAssetFile("audios", record.id, fileToUpload, user.id);
      } catch (e: any) {
        toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
        return;
      }

      const fileUrl = URL.createObjectURL(uploadFile);
      setAudios((prev) => [...prev, { id: record.id, name: newName.trim(), fileName: uploadFile.name, fileUrl, forwarded, singleView }]);
      setSelected(record.id);
      setNewName("");
      setForwarded(false);
      setSingleView(false);
      setUploadFile(null);
      setAddOpen(false);
      toast({ title: "Áudio adicionado!" });
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = () => {
    if (!selectedItem) return;
    setEditName(selectedItem.name);
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!selected || !editName.trim()) return;
    setAudios((prev) => prev.map((m) => m.id === selected ? { ...m, name: editName.trim() } : m));
    setEditOpen(false);
    toast({ title: "Áudio atualizado" });
  };

  const handleDuplicate = () => {
    if (!selectedItem) return;
    const id = Date.now().toString();
    setAudios((prev) => [...prev, { ...selectedItem, id, name: `${selectedItem.name} (cópia)` }]);
    setSelected(id);
    toast({ title: "Áudio duplicado" });
  };

  const handleFavorite = () => {
    if (!selected) return;
    setAudios((prev) => prev.map((m) => m.id === selected ? { ...m, favorite: !m.favorite } : m));
  };

  return (
    <MainLayout title="Áudios">
      <TwoColumnLayout
        items={listItems}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => { setUploadFile(null); setNewName(""); setAddOpen(true); }}
        onReorder={handleReorder}
        searchPlaceholder="Buscar áudio..."
        emptyDetail={
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Mic className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm">Selecione um áudio para visualizar ou adicione um novo.</p>
          </div>
        }
      >
        {selectedItem && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border gap-2 overflow-hidden">
              <h3 className="font-semibold text-lg text-foreground truncate min-w-0 flex-1">{selectedItem.name}</h3>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-destructive/10 hover:bg-destructive/20" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => {
                  if (selectedItem.fileUrl) {
                    const a = document.createElement("a");
                    a.href = selectedItem.fileUrl;
                    a.download = selectedItem.fileName || "audio";
                    a.click();
                  }
                }}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={openEdit}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={handleFavorite}>
                  <Heart className={`h-4 w-4 ${selectedItem.favorite ? "fill-primary text-primary" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="flex-1 flex flex-col p-6">
              <div className="space-y-1.5 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mic className="h-4 w-4 flex-shrink-0" />
                  <span>{selectedItem.forwarded ? "Enviando como encaminhado" : "Enviando como gravado"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  <span>{selectedItem.singleView ? "Enviando como visualização única" : "Não enviando como visualização única"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span>Não mencionando em grupos</span>
                </div>
              </div>
              {selectedItem.fileUrl ? (
                <div className="w-full max-w-lg">
                  <audio controls className="w-full" src={selectedItem.fileUrl} />
                </div>
              ) : (
                <div className="w-full max-w-md bg-muted/50 rounded-lg p-6 text-center">
                  <Mic className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum arquivo de áudio</p>
                </div>
              )}
            </div>
          </div>
        )}
      </TwoColumnLayout>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar áudio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input placeholder="Nome do áudio" value={newName} onChange={(e) => setNewName(e.target.value)} />
              {!newName.trim() && <p className="text-xs text-destructive mt-1">Campo obrigatório</p>}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={forwarded} onCheckedChange={setForwarded} />
                <span className="text-sm text-foreground">Enviar áudio como <strong>encaminhado</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={singleView} onCheckedChange={setSingleView} />
                <span className="text-sm text-foreground">Enviar áudio como <strong>visualização única</strong></span>
              </div>
            </div>
            <div>
              <FileUploadZone
                accept=".ogg,.mp3,.wav,.m4a"
                acceptLabel='".ogg", ".mp3", ".wav" e ".m4a"'
                file={uploadFile}
                onFileChange={setUploadFile}
                icon="audio"
              />
              {!uploadFile && <p className="text-xs text-destructive mt-1">Campo obrigatório</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={isSaving || !newName.trim() || !uploadFile}>{isSaving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar áudio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={!editName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Excluir áudio" itemName={selectedItem?.name} onConfirm={handleDelete} />
    </MainLayout>
  );
}
