import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TwoColumnLayout, ListItem } from "@/components/layout/TwoColumnLayout";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Trash2, Copy, Pencil, Heart, FileText } from "lucide-react";

const mockDocs: ListItem[] = [];

export default function DocumentosPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const selectedItem = mockDocs.find((m) => m.id === selected);

  return (
    <MainLayout title="Documentos">
      <TwoColumnLayout
        items={mockDocs}
        selectedId={selected}
        onSelect={setSelected}
        onAdd={() => {}}
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

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir documento"
        itemName={selectedItem?.name}
        onConfirm={() => setDeleteOpen(false)}
      />
    </MainLayout>
  );
}
