import { ReactNode, useState, useMemo } from "react";
import { Search, Plus, GripVertical, Heart, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDragReorder } from "@/hooks/use-drag-reorder";

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
  onReorder?: (items: ListItem[]) => void;
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
  onReorder,
  searchPlaceholder = "Buscar...",
  children,
  emptyDetail,
  renderItemExtra,
}: TwoColumnLayoutProps) {
  const [search, setSearch] = useState("");
  const { getDragProps } = useDragReorder(items, onReorder ?? (() => {}));

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="flex gap-4 h-[calc(100vh-10rem)]">
      {/* Left column */}
      <div className="w-96 flex-shrink-0 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-4 border-b border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-10 h-11 text-base"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={onAdd} className="w-full h-11 text-base">
            <Plus className="h-5 w-5 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-base text-muted-foreground">
              {search.trim() ? "Nenhum resultado encontrado." : "Nenhum item cadastrado."}
            </div>
          )}
          {filteredItems.map((item) => {
            const originalIndex = items.indexOf(item);
            const dragProps = onReorder ? getDragProps(originalIndex) : { className: "" };
            const { className: dragClassName, ...restDragProps } = dragProps;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                {...restDragProps}
                className={`w-full flex items-center gap-3 p-3 rounded-md text-left text-base transition-colors group border ${
                  selectedId === item.id
                    ? "bg-accent text-accent-foreground border-primary/50"
                    : "hover:bg-muted text-foreground border-transparent"
                } ${dragClassName}`}
              >
                <GripVertical className={`h-4 w-4 text-primary/50 flex-shrink-0 cursor-grab ${onReorder ? "opacity-50 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
                <span className="flex-1 truncate">{item.name}</span>
                {renderItemExtra?.(item)}
                <Heart
                  className={`h-4 w-4 flex-shrink-0 ${
                    item.favorite ? "fill-primary text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  }`}
                />
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </button>
            );
          })}
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
