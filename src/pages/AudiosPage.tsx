import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Trash2, Copy, Pencil, Heart, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AudioItem extends ListItem {
  fileName?: string;
  fileUrl?: string;
}

const initialAudios: AudioItem[] = [
  { id: "1", name: "Áudio de boas-vindas", favorite: false },
];

export default function AudiosPage() {
  const [audios, setAudios] = useState<AudioItem[]>(initialAudios);
  const [selected, setSelected] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [forwarded, setForwarded] = useState(false);
  const [singleView, setSingleView] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { toast } = useToast();

  const selectedItem = audios.find((m) => m.id === selected);

  const handleDelete = () => {
    if (selected) {
      setAudios((prev) => prev.filter((m) => m.id !== selected));
      setSelected(null);
      setDeleteOpen(false);
    }
  };

  const handleAdd = () => {
    if (!newName.trim() || !uploadFile) return;
    const id = Date.now().toString();
    const fileUrl = URL.createObjectURL(uploadFile);
    setAudios((prev) => [...prev, { id, name: newName.trim(), fileName: uploadFile.name, fileUrl }]);
    setSelected(id);
    setNewName("");
    setForwarded(false);
    setSingleView(false);
    setUploadFile(null);
    setAddOpen(false);
    toast({ title: "Áudio adicionado!" });
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
        items={audios}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => { setUploadFile(null); setNewName(""); setAddOpen(true); }}
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
                <div className="w-full max-w-md space-y-3 text-center">
                  <Mic className="h-12 w-12 mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">{selectedItem.fileName}</p>
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

      {/* Modal Adicionar */}
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
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || !uploadFile}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
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
