import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
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

const initialMessages: ListItem[] = [
  { id: "1", name: "Boas-vindas", favorite: true },
  { id: "2", name: "Agradecimento pós-compra" },
  { id: "3", name: "Lembrete de pagamento" },
];

const mockContents: Record<string, string> = {
  "1": "Olá! Seja bem-vindo(a)! 👋\nFicamos felizes em te atender. Como posso ajudar?",
  "2": "Muito obrigado pela sua compra! 🎉\nQualquer dúvida, estamos à disposição.",
  "3": "Olá! Este é um lembrete amigável sobre seu pagamento pendente. 💰",
};

export default function MensagensPage() {
  const [messages, setMessages] = useState<ListItem[]>(initialMessages);
  const [contents, setContents] = useState<Record<string, string>>(mockContents);
  const [selected, setSelected] = useState<string | null>("1");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newText, setNewText] = useState("");

  const selectedItem = messages.find((m) => m.id === selected);

  const handleDelete = () => {
    if (selected) {
      setMessages((prev) => prev.filter((m) => m.id !== selected));
      setSelected(null);
      setDeleteOpen(false);
    }
  };

  const handleAdd = () => {
    if (!newName.trim() || !newText.trim()) return;
    const id = Date.now().toString();
    setMessages((prev) => [...prev, { id, name: newName.trim() }]);
    setContents((prev) => ({ ...prev, [id]: newText.trim() }));
    setSelected(id);
    setNewName("");
    setNewText("");
    setAddOpen(false);
  };

  return (
    <MainLayout title="Mensagens">
      <TwoColumnLayout
        items={messages}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => setAddOpen(true)}
        searchPlaceholder="Buscar mensagem..."
      >
        {selectedItem && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">{selectedItem.name}</h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Heart className={`h-4 w-4 ${selectedItem.favorite ? "fill-primary text-primary" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <div className="whitespace-pre-wrap text-sm text-foreground bg-muted/50 rounded-lg p-4">
                {contents[selected!] ?? ""}
              </div>
            </div>
          </div>
        )}
      </TwoColumnLayout>

      {/* Modal Adicionar Mensagem */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar mensagem</DialogTitle>
          </DialogHeader>
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

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir mensagem"
        itemName={selectedItem?.name}
        onConfirm={handleDelete}
      />
    </MainLayout>
  );
}
