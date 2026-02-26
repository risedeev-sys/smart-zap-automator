import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TwoColumnLayout, ListItem } from "@/components/layout/TwoColumnLayout";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Copy, Pencil, Heart, Image, Upload } from "lucide-react";

const initialMidias: ListItem[] = [];

export default function MidiasPage() {
  const [midias, setMidias] = useState<ListItem[]>(initialMidias);
  const [selected, setSelected] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [singleView, setSingleView] = useState(false);

  const selectedItem = midias.find((m) => m.id === selected);

  const handleDelete = () => {
    if (selected) {
      setMidias((prev) => prev.filter((m) => m.id !== selected));
      setSelected(null);
      setDeleteOpen(false);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const id = Date.now().toString();
    setMidias((prev) => [...prev, { id, name: newName.trim() }]);
    setSelected(id);
    setNewName("");
    setNewCaption("");
    setSingleView(false);
    setAddOpen(false);
  };

  return (
    <MainLayout title="Mídias">
      <TwoColumnLayout
        items={midias}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => setAddOpen(true)}
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
                <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Heart className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                <Image className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Preview da mídia</p>
              </div>
            </div>
          </div>
        )}
      </TwoColumnLayout>

      {/* Modal Adicionar Mídia */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar mídia</DialogTitle>
          </DialogHeader>
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
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Para inserir uma mídia, clique aqui ou arraste o arquivo para esta área.</p>
                <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .png, .jpg, .mp4</p>
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
        title="Excluir mídia"
        itemName={selectedItem?.name}
        onConfirm={handleDelete}
      />
    </MainLayout>
  );
}
