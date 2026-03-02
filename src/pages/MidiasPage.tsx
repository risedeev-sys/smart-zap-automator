import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAssets, AssetItem } from "@/contexts/AssetsContext";
import { TwoColumnLayout, ListItem } from "@/components/layout/TwoColumnLayout";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FileUploadZone } from "@/components/FileUploadZone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Copy, Pencil, Heart, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadAssetFile } from "@/utils/uploadAssetFile";

export default function MidiasPage() {
  const { midias, setMidias } = useAssets();

  const [selected, setSelected] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [singleView, setSingleView] = useState(false);
  const [editName, setEditName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { toast } = useToast();

  const listItems: ListItem[] = midias.map(m => ({ id: m.id, name: m.name, favorite: m.favorite }));

  const handleReorder = (reordered: ListItem[]) => {
    const idOrder = reordered.map(r => r.id);
    setMidias(prev => {
      const map = new Map(prev.map(m => [m.id, m]));
      return idOrder.map(id => map.get(id)!).filter(Boolean);
    });
  };
  const selectedItem = midias.find((m) => m.id === selected);

  const handleDelete = () => {
    if (selected) {
      setMidias((prev) => prev.filter((m) => m.id !== selected));
      setSelected(null);
      setDeleteOpen(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !uploadFile) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: record, error } = await supabase
      .from("medias")
      .insert({ name: newName.trim(), user_id: user.id, metadata: { singleView, caption: newCaption.trim() } })
      .select("id, name")
      .single();
    if (error || !record) {
      toast({ title: "Erro ao criar mídia", description: error?.message, variant: "destructive" });
      return;
    }

    try {
      await uploadAssetFile("medias", record.id, uploadFile, user.id);
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    }

    const fileUrl = URL.createObjectURL(uploadFile);
    const fileType = uploadFile.type;
    setMidias((prev) => [...prev, { id: record.id, name: newName.trim(), fileName: uploadFile.name, fileUrl, fileType }]);
    setSelected(record.id);
    setNewName("");
    setNewCaption("");
    setSingleView(false);
    setUploadFile(null);
    setAddOpen(false);
    toast({ title: "Mídia adicionada!" });
  };

  const openEdit = () => {
    if (!selectedItem) return;
    setEditName(selectedItem.name);
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!selected || !editName.trim()) return;
    setMidias((prev) => prev.map((m) => m.id === selected ? { ...m, name: editName.trim() } : m));
    setEditOpen(false);
    toast({ title: "Mídia atualizada" });
  };

  const handleDuplicate = () => {
    if (!selectedItem) return;
    const id = Date.now().toString();
    setMidias((prev) => [...prev, { ...selectedItem, id, name: `${selectedItem.name} (cópia)` }]);
    setSelected(id);
    toast({ title: "Mídia duplicada" });
  };

  const handleFavorite = () => {
    if (!selected) return;
    setMidias((prev) => prev.map((m) => m.id === selected ? { ...m, favorite: !m.favorite } : m));
  };

  const isVideo = (type?: string) => type?.startsWith("video/");

  return (
    <MainLayout title="Mídias">
      <TwoColumnLayout
        items={listItems}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => { setUploadFile(null); setNewName(""); setNewCaption(""); setAddOpen(true); }}
        onReorder={handleReorder}
        searchPlaceholder="Buscar mídia..."
        emptyDetail={
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Image className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm">Nenhuma mídia cadastrada. Clique em "+ Adicionar" para começar.</p>
          </div>
        }
      >
        {selectedItem && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">{selectedItem.name}</h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDuplicate}><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openEdit}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFavorite}>
                  <Heart className={`h-4 w-4 ${selectedItem.favorite ? "fill-primary text-primary" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              {selectedItem.fileUrl ? (
                <div className="w-full max-w-lg">
                  {isVideo(selectedItem.fileType) ? (
                    <video controls className="w-full rounded-lg" src={selectedItem.fileUrl} />
                  ) : (
                    <img src={selectedItem.fileUrl} alt={selectedItem.name} className="w-full rounded-lg object-contain max-h-[60vh]" />
                  )}
                  <p className="text-xs text-muted-foreground mt-2 text-center">{selectedItem.fileName}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum arquivo de mídia</p>
                </div>
              )}
            </div>
          </div>
        )}
      </TwoColumnLayout>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar mídia</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input placeholder="Nome da mídia" value={newName} onChange={(e) => setNewName(e.target.value)} />
              {!newName.trim() && <p className="text-xs text-destructive mt-1">Campo obrigatório.</p>}
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={singleView} onCheckedChange={setSingleView} />
              <span className="text-sm text-foreground">Enviar mídia como <strong>visualização única</strong></span>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Legenda da mídia</label>
              <Textarea placeholder="Legenda da mídia" value={newCaption} onChange={(e) => setNewCaption(e.target.value)} rows={4} />
            </div>
            <div>
              <FileUploadZone
                accept=".png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi"
                acceptLabel='".png", ".jpg", ".gif", ".webp", ".mp4"'
                file={uploadFile}
                onFileChange={setUploadFile}
                icon="image"
              />
              {!uploadFile && <p className="text-xs text-destructive mt-1">Campo obrigatório</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || !uploadFile}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar mídia</DialogTitle></DialogHeader>
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

      <DeleteConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Excluir mídia" itemName={selectedItem?.name} onConfirm={handleDelete} />
    </MainLayout>
  );
}
