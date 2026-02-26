import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAssets, AssetItem } from "@/contexts/AssetsContext";
import { TwoColumnLayout, ListItem } from "@/components/layout/TwoColumnLayout";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { FileUploadZone } from "@/components/FileUploadZone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Copy, Pencil, Heart, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DocumentosPage() {
  const { documentos, setDocumentos } = useAssets();

  const [selected, setSelected] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { toast } = useToast();

  const listItems: ListItem[] = documentos.map(d => ({ id: d.id, name: d.name, favorite: d.favorite }));

  const handleReorder = (reordered: ListItem[]) => {
    const idOrder = reordered.map(r => r.id);
    setDocumentos(prev => {
      const map = new Map(prev.map(m => [m.id, m]));
      return idOrder.map(id => map.get(id)!).filter(Boolean);
    });
  };
  const selectedItem = documentos.find((m) => m.id === selected);

  const handleDelete = () => {
    if (selected) {
      setDocumentos((prev) => prev.filter((m) => m.id !== selected));
      setSelected(null);
      setDeleteOpen(false);
    }
  };

  const handleAdd = () => {
    if (!newName.trim() || !uploadFile) return;
    const id = Date.now().toString();
    const fileUrl = URL.createObjectURL(uploadFile);
    setDocumentos((prev) => [...prev, { id, name: newName.trim(), fileName: uploadFile.name, fileUrl }]);
    setSelected(id);
    setNewName("");
    setUploadFile(null);
    setAddOpen(false);
    toast({ title: "Documento adicionado!" });
  };

  const openEdit = () => {
    if (!selectedItem) return;
    setEditName(selectedItem.name);
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!selected || !editName.trim()) return;
    setDocumentos((prev) => prev.map((m) => m.id === selected ? { ...m, name: editName.trim() } : m));
    setEditOpen(false);
    toast({ title: "Documento atualizado" });
  };

  const handleDuplicate = () => {
    if (!selectedItem) return;
    const id = Date.now().toString();
    setDocumentos((prev) => [...prev, { ...selectedItem, id, name: `${selectedItem.name} (cópia)` }]);
    setSelected(id);
    toast({ title: "Documento duplicado" });
  };

  const handleFavorite = () => {
    if (!selected) return;
    setDocumentos((prev) => prev.map((m) => m.id === selected ? { ...m, favorite: !m.favorite } : m));
  };

  return (
    <MainLayout title="Documentos">
      <TwoColumnLayout
        items={listItems}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => { setUploadFile(null); setNewName(""); setAddOpen(true); }}
        onReorder={handleReorder}
        searchPlaceholder="Buscar documento..."
        emptyDetail={
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm">Nenhum documento cadastrado. Clique em "+ Adicionar" para começar.</p>
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
                <div className="w-full max-w-md text-center space-y-3">
                  <FileText className="h-16 w-16 mx-auto text-primary" />
                  <p className="text-sm font-medium text-foreground">{selectedItem.fileName}</p>
                  <a
                    href={selectedItem.fileUrl}
                    download={selectedItem.fileName}
                    className="inline-block text-sm text-primary underline hover:text-primary/80"
                  >
                    Baixar documento
                  </a>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum arquivo</p>
                </div>
              )}
            </div>
          </div>
        )}
      </TwoColumnLayout>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar documento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input placeholder="Nome do documento" value={newName} onChange={(e) => setNewName(e.target.value)} />
              {!newName.trim() && <p className="text-xs text-destructive mt-1">Campo obrigatório</p>}
            </div>
            <div>
              <FileUploadZone
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                acceptLabel='".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".txt"'
                file={uploadFile}
                onFileChange={setUploadFile}
                icon="document"
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
          <DialogHeader><DialogTitle>Editar documento</DialogTitle></DialogHeader>
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

      <DeleteConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Excluir documento" itemName={selectedItem?.name} onConfirm={handleDelete} />
    </MainLayout>
  );
}
