import { ReactNode } from "react";
import { Search, Plus, GripVertical, Heart, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ListItem {
  id: string;
  name: string;
  favorite?: boolean;
  subtitle?: string;
}

interface TwoColumnLayoutProps {
  items: ListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  searchPlaceholder?: string;
  children: ReactNode;
  emptyDetail?: ReactNode;
  renderItemExtra?: (item: ListItem) => ReactNode;
}

export function TwoColumnLayout({
  items,
  selectedId,
  onSelect,
  onAdd,
  searchPlaceholder = "Buscar...",
  children,
  emptyDetail,
  renderItemExtra,
}: TwoColumnLayoutProps) {
  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)]">
      {/* Left column */}
      <div className="w-80 flex-shrink-0 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={searchPlaceholder} className="pl-9 h-9" />
          </div>
          <Button onClick={onAdd} className="w-full h-9 text-sm">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum item cadastrado.
            </div>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full flex items-center gap-2 p-2.5 rounded-md text-left text-sm transition-colors group ${
                selectedId === item.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab" />
              <span className="flex-1 truncate">{item.name}</span>
              {renderItemExtra?.(item)}
              <Heart
                className={`h-3.5 w-3.5 flex-shrink-0 ${
                  item.favorite ? "fill-primary text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                }`}
              />
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Right column */}
      <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden">
        {selectedId ? children : emptyDetail ?? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Selecione um item para visualizar
          </div>
        )}
      </div>
    </div>
  );
}
