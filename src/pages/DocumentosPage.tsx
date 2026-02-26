import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TwoColumnLayout, ListItem } from "@/components/layout/TwoColumnLayout";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Copy, Pencil, Heart, FileText, Upload } from "lucide-react";

const initialDocs: ListItem[] = [];

export default function DocumentosPage() {
  const [docs, setDocs] = useState<ListItem[]>(initialDocs);
  const [selected, setSelected] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedItem = docs.find((m) => m.id === selected);

  const handleDelete = () => {
    if (selected) {
      setDocs((prev) => prev.filter((m) => m.id !== selected));
      setSelected(null);
      setDeleteOpen(false);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const id = Date.now().toString();
    setDocs((prev) => [...prev, { id, name: newName.trim() }]);
    setSelected(id);
    setNewName("");
    setAddOpen(false);
  };

  return (
    <MainLayout title="Documentos">
      <TwoColumnLayout
        items={docs}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => setAddOpen(true)}
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
                <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Heart className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Preview do documento</p>
              </div>
            </div>
          </div>
        )}
      </TwoColumnLayout>

      {/* Modal Adicionar Documento */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input placeholder="Nome do documento" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Para inserir o documento, clique aqui ou arraste o arquivo para esta área.</p>
              </div>
              <p className="text-xs text-destructive mt-1">Campo obrigatório</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir documento"
        itemName={selectedItem?.name}
        onConfirm={handleDelete}
      />
    </MainLayout>
  );
}
