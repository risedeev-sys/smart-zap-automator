import { useState, useEffect, useCallback } from "react";
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
import { Trash2, Copy, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { deleteAssetEverywhere } from "@/utils/deleteAssetEverywhere";

interface MessageRow {
  id: string;
  name: string;
  content: string;
}

export default function MensagensPage() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newText, setNewText] = useState("");
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, name, content")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar mensagens", description: error.message, variant: "destructive" });
    } else {
      setMessages(data ?? []);
      if (!selected && data && data.length > 0) {
        setSelected(data[0].id);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const listItems: ListItem[] = messages.map(m => ({ id: m.id, name: m.name }));
  const selectedItem = messages.find((m) => m.id === selected);

  const handleDelete = async () => {
    if (!selected) return;

    try {
      await deleteAssetEverywhere({ assetType: "mensagem", assetId: selected });
      setMessages((prev) => prev.filter((m) => m.id !== selected));
      setSelected(null);
      setDeleteOpen(false);
      toast({ title: "Mensagem excluída!" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("messages")
      .insert({ name: newName.trim(), content: newText.trim(), user_id: user.id })
      .select("id, name, content")
      .single();

    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    } else if (data) {
      setMessages(prev => [...prev, data]);
      setSelected(data.id);
      setNewName("");
      setNewText("");
      setAddOpen(false);
    }
  };

  const handleEdit = async () => {
    if (!selected || !editName.trim()) return;
    const { error } = await supabase
      .from("messages")
      .update({ name: editName.trim(), content: editText })
      .eq("id", selected);

    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      setMessages(prev => prev.map(m => m.id === selected ? { ...m, name: editName.trim(), content: editText } : m));
      setEditOpen(false);
      toast({ title: "Mensagem atualizada" });
    }
  };

  const openEdit = () => {
    if (!selectedItem) return;
    setEditName(selectedItem.name);
    setEditText(selectedItem.content ?? "");
    setEditOpen(true);
  };

  const handleDuplicate = async () => {
    if (!selectedItem) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("messages")
      .insert({ name: `${selectedItem.name} (cópia)`, content: selectedItem.content, user_id: user.id })
      .select("id, name, content")
      .single();

    if (error) {
      toast({ title: "Erro ao duplicar", description: error.message, variant: "destructive" });
    } else if (data) {
      setMessages(prev => [...prev, data]);
      setSelected(data.id);
      toast({ title: "Mensagem duplicada" });
    }
  };

  const handleReorder = (reordered: ListItem[]) => {
    const idOrder = reordered.map(r => r.id);
    setMessages(prev => {
      const map = new Map(prev.map(m => [m.id, m]));
      return idOrder.map(id => map.get(id)!).filter(Boolean);
    });
  };

  if (loading) {
    return (
      <MainLayout title="Mensagens">
        <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>
      </MainLayout>
    );
  }

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
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleDuplicate}><Copy className="h-5 w-5 text-primary" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={openEdit}><Pencil className="h-5 w-5 text-primary" /></Button>
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newName.trim()}>Salvar</Button>
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
