import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAssets, AssetItem } from "@/contexts/AssetsContext";
import { TwoColumnLayout, ListItem } from "@/components/layout/TwoColumnLayout";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Copy, Pencil, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MensagensPage() {
  const { mensagens, setMensagens } = useAssets();

  const [selected, setSelected] = useState<string | null>("1");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newText, setNewText] = useState("");
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const { toast } = useToast();

  const listItems: ListItem[] = mensagens.map(m => ({ id: m.id, name: m.name, favorite: m.favorite }));

  const handleReorder = (reordered: ListItem[]) => {
    const idOrder = reordered.map(r => r.id);
    setMensagens(prev => {
      const map = new Map(prev.map(m => [m.id, m]));
      return idOrder.map(id => map.get(id)!).filter(Boolean);
    });
  };
  const selectedItem = mensagens.find((m) => m.id === selected);

  const handleDelete = () => {
    if (selected) {
      setMensagens((prev) => prev.filter((m) => m.id !== selected));
      setSelected(null);
      setDeleteOpen(false);
    }
  };

  const handleAdd = () => {
    if (!newName.trim() || !newText.trim()) return;
    const id = Date.now().toString();
    setMensagens((prev) => [...prev, { id, name: newName.trim(), content: newText.trim() }]);
    setSelected(id);
    setNewName("");
    setNewText("");
    setAddOpen(false);
  };

  const handleEdit = () => {
    if (!selected || !editName.trim()) return;
    setMensagens((prev) => prev.map((m) => m.id === selected ? { ...m, name: editName.trim(), content: editText } : m));
    setEditOpen(false);
    toast({ title: "Mensagem atualizada" });
  };

  const openEdit = () => {
    if (!selectedItem) return;
    setEditName(selectedItem.name);
    setEditText(selectedItem.content ?? "");
    setEditOpen(true);
  };

  const handleDuplicate = () => {
    if (!selectedItem) return;
    const id = Date.now().toString();
    setMensagens((prev) => [...prev, { ...selectedItem, id, name: `${selectedItem.name} (cópia)` }]);
    setSelected(id);
    toast({ title: "Mensagem duplicada" });
  };

  const handleFavorite = () => {
    if (!selected) return;
    setMensagens((prev) => prev.map((m) => m.id === selected ? { ...m, favorite: !m.favorite } : m));
  };

  return (
    <MainLayout title="Mensagens">
      <TwoColumnLayout
        items={listItems}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => setAddOpen(true)}
        onReorder={handleReorder}
        searchPlaceholder="Buscar mensagem..."
      >
        {selectedItem && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-lg text-foreground">{selectedItem.name}</h3>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setDeleteOpen(true)}><Trash2 className="h-5 w-5 text-destructive" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleDuplicate}><Copy className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={openEdit}><Pencil className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleFavorite}>
                  <Heart className={`h-5 w-5 ${selectedItem.favorite ? "fill-primary text-primary" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-5">
              <div className="whitespace-pre-wrap text-base text-foreground bg-muted/50 rounded-lg p-5">
                {selectedItem.content ?? ""}
              </div>
            </div>
          </div>
        )}
      </TwoColumnLayout>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar mensagem</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input placeholder="Nome da mensagem" value={newName} onChange={(e) => setNewName(e.target.value)} />
              {!newName.trim() && <p className="text-xs text-destructive mt-1">Campo obrigatório</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Texto</label>
              <Textarea placeholder="Texto da mensagem" value={newText} onChange={(e) => setNewText(e.target.value)} rows={5} />
              {!newText.trim() && <p className="text-xs text-destructive mt-1">Campo obrigatório</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || !newText.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar mensagem</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Texto</label>
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={!editName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Excluir mensagem" itemName={selectedItem?.name} onConfirm={handleDelete} />
    </MainLayout>
  );
}
