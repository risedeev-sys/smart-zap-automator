import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TwoColumnLayout, ListItem } from "@/components/layout/TwoColumnLayout";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Trash2, Copy, Pencil, Heart } from "lucide-react";

const mockMessages: ListItem[] = [
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
  const [selected, setSelected] = useState<string | null>("1");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selectedItem = mockMessages.find((m) => m.id === selected);

  return (
    <MainLayout title="Mensagens">
      <TwoColumnLayout
        items={mockMessages}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => {}}
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
                {mockContents[selected!] ?? ""}
              </div>
            </div>
          </div>
        )}
      </TwoColumnLayout>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir mensagem"
        itemName={selectedItem?.name}
        onConfirm={() => setDeleteOpen(false)}
      />
    </MainLayout>
  );
}
