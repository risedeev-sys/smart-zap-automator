import { useState, useMemo } from "react";
import { useAssets } from "@/contexts/AssetsContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  GripVertical,
  Heart,
  Pencil,
  Trash2,
  Copy,
  MessageSquare,
  Mic,
  Image,
  FileText,
  Clock,
  GitBranch,
} from "lucide-react";

interface FunnelItem {
  id: string;
  type: "mensagem" | "audio" | "midia" | "documento";
  name: string;
  delayMin: number;
  delaySec: number;
}

interface Funnel {
  id: string;
  name: string;
  favorite?: boolean;
  items: FunnelItem[];
}

const initialFunnels: Funnel[] = [
  {
    id: "1",
    name: "Funil de boas-vindas",
    favorite: true,
    items: [
      { id: "i1", type: "mensagem", name: "Boas-vindas", delayMin: 0, delaySec: 0 },
      { id: "i2", type: "audio", name: "Áudio de boas-vindas", delayMin: 0, delaySec: 30 },
      { id: "i3", type: "mensagem", name: "Agradecimento pós-compra", delayMin: 1, delaySec: 0 },
    ],
  },
  {
    id: "2",
    name: "Funil pós-venda",
    items: [
      { id: "i4", type: "mensagem", name: "Agradecimento pós-compra", delayMin: 0, delaySec: 0 },
    ],
  },
];

const typeIcons = {
  mensagem: MessageSquare,
  audio: Mic,
  midia: Image,
  documento: FileText,
};

const typeLabels = {
  mensagem: "Mensagem",
  audio: "Áudio",
  midia: "Mídia",
  documento: "Documento",
};

export default function FunisPage() {
  const { mensagens, audios, midias, documentos } = useAssets();
  const [funnels, setFunnels] = useState<Funnel[]>(initialFunnels);
  const [selected, setSelected] = useState<string | null>("1");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ title: string; name: string; type: "funnel" | "item"; itemId?: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState("");
  const [editFunnelOpen, setEditFunnelOpen] = useState(false);
  const [editFunnelName, setEditFunnelName] = useState("");
  const [addItemTab, setAddItemTab] = useState<string>("mensagem");
  const [addItemSelectedId, setAddItemSelectedId] = useState<string>("");
  const [addItemDelayMin, setAddItemDelayMin] = useState(0);
  const [addItemDelaySec, setAddItemDelaySec] = useState(0);

  const assetsByType = useMemo(() => ({
    mensagem: mensagens,
    audio: audios,
    midia: midias,
    documento: documentos,
  }), [mensagens, audios, midias, documentos]);
  const selectedFunnel = funnels.find((f) => f.id === selected);

  const handleEditFunnel = () => {
    if (!selected || !editFunnelName.trim()) return;
    setFunnels((prev) => prev.map((f) => f.id === selected ? { ...f, name: editFunnelName.trim() } : f));
    setEditFunnelOpen(false);
  };

  const handleDuplicateFunnel = () => {
    if (!selectedFunnel) return;
    const id = Date.now().toString();
    setFunnels((prev) => [...prev, { ...selectedFunnel, id, name: `${selectedFunnel.name} (cópia)`, items: selectedFunnel.items.map((i) => ({ ...i, id: `${i.id}-${id}` })) }]);
    setSelected(id);
  };

  const handleFavoriteFunnel = () => {
    if (!selected) return;
    setFunnels((prev) => prev.map((f) => f.id === selected ? { ...f, favorite: !f.favorite } : f));
  };

  const totalTime = (items: FunnelItem[]) => {
    const totalSec = items.reduce((acc, i) => acc + i.delayMin * 60 + i.delaySec, 0);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min} min e ${sec}s`;
  };

  const handleAddFunnel = () => {
    if (!newFunnelName.trim()) return;
    const id = Date.now().toString();
    setFunnels((prev) => [...prev, { id, name: newFunnelName.trim(), items: [] }]);
    setSelected(id);
    setNewFunnelName("");
    setAddOpen(false);
  };

  return (
    <MainLayout title="Funis">
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Left */}
        <div className="w-80 flex-shrink-0 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar funil..." className="pl-9 h-9" />
            </div>
            <Button className="w-full h-9 text-sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {funnels.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f.id)}
                className={`w-full flex items-center gap-2 p-2.5 rounded-md text-left text-sm transition-colors group ${
                  selected === f.id ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground"
                }`}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{totalTime(f.items)}</span>
                </div>
                <div className="flex gap-0.5">
                  {[...new Set(f.items.map((i) => i.type))].map((type) => {
                    const Icon = typeIcons[type];
                    return <Icon key={type} className="h-3 w-3 text-muted-foreground" />;
                  })}
                </div>
                <Heart
                  className={`h-3.5 w-3.5 flex-shrink-0 ${
                    f.favorite ? "fill-primary text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden flex flex-col">
          {selectedFunnel ? (
            <>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">{selectedFunnel.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteTarget({ title: "Excluir funil", name: selectedFunnel.name, type: "funnel" }); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDuplicateFunnel}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditFunnelName(selectedFunnel.name); setEditFunnelOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFavoriteFunnel}>
                    <Heart className={`h-4 w-4 ${selectedFunnel.favorite ? "fill-primary text-primary" : ""}`} />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <Button variant="outline" size="sm" onClick={() => { setAddItemTab("mensagem"); setAddItemSelectedId(""); setAddItemDelayMin(0); setAddItemDelaySec(0); setEditModalOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar item
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                {selectedFunnel.items.map((item, idx) => {
                  const Icon = typeIcons[item.type];
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                      <span className="text-xs text-muted-foreground font-mono w-5">{idx + 1}</span>
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Icon className="h-3 w-3" />
                        {typeLabels[item.type]}
                      </Badge>
                      <span className="flex-1 text-sm truncate">{item.name}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Enviando após {item.delayMin}m {item.delaySec}s
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditModalOpen(true)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteTarget({ title: "Excluir item do funil", name: item.name, type: "item", itemId: item.id }); setDeleteOpen(true); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Selecione um funil para visualizar
            </div>
          )}
        </div>
      </div>

      {/* Modal Adicionar Funil */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar funil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Título</label>
              <Input placeholder="Título do funil" value={newFunnelName} onChange={(e) => setNewFunnelName(e.target.value)} />
              {!newFunnelName.trim() && <p className="text-xs text-destructive mt-1">Campo não pode ser vazio.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddFunnel} disabled={!newFunnelName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Funil */}
      <Dialog open={editFunnelOpen} onOpenChange={setEditFunnelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar funil</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Título</label>
              <Input value={editFunnelName} onChange={(e) => setEditFunnelName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFunnelOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditFunnel} disabled={!editFunnelName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add item modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar item ao funil</DialogTitle>
            <DialogDescription>Selecione o tipo e configure o delay.</DialogDescription>
          </DialogHeader>
          <Tabs value={addItemTab} onValueChange={(v) => { setAddItemTab(v); setAddItemSelectedId(""); }}>
            <TabsList className="w-full">
              <TabsTrigger value="mensagem" className="flex-1">Mensagem</TabsTrigger>
              <TabsTrigger value="audio" className="flex-1">Áudio</TabsTrigger>
              <TabsTrigger value="midia" className="flex-1">Mídia</TabsTrigger>
              <TabsTrigger value="documento" className="flex-1">Documento</TabsTrigger>
            </TabsList>
            {["mensagem", "audio", "midia", "documento"].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Selecionar item</label>
                  <Select value={addItemSelectedId} onValueChange={setAddItemSelectedId}>
                    <SelectTrigger><SelectValue placeholder="Escolha um item..." /></SelectTrigger>
                    <SelectContent>
                      {(assetsByType[tab as keyof typeof assetsByType] || []).length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum item cadastrado</div>
                      ) : (
                        (assetsByType[tab as keyof typeof assetsByType] || []).map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-foreground mb-1 block">Minutos</label>
                    <Input type="number" value={addItemDelayMin} onChange={(e) => setAddItemDelayMin(Number(e.target.value))} min="0" />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-foreground mb-1 block">Segundos</label>
                    <Input type="number" value={addItemDelaySec} onChange={(e) => setAddItemDelaySec(Number(e.target.value))} min="0" max="59" />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button
              disabled={!addItemSelectedId}
              onClick={() => {
                if (!selected || !addItemSelectedId) return;
                const assets = assetsByType[addItemTab as keyof typeof assetsByType] || [];
                const asset = assets.find(a => a.id === addItemSelectedId);
                if (!asset) return;
                const newItem: FunnelItem = {
                  id: Date.now().toString(),
                  type: addItemTab as FunnelItem["type"],
                  name: asset.name,
                  delayMin: addItemDelayMin,
                  delaySec: addItemDelaySec,
                };
                setFunnels(prev => prev.map(f => f.id === selected ? { ...f, items: [...f.items, newItem] } : f));
                setEditModalOpen(false);
              }}
            >Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deleteTarget?.title ?? "Excluir item"}
        itemName={deleteTarget?.name}
        onConfirm={() => {
          if (deleteTarget?.type === "funnel" && selected) {
            setFunnels((prev) => prev.filter((f) => f.id !== selected));
            setSelected(null);
          } else if (deleteTarget?.type === "item" && deleteTarget.itemId && selected) {
            setFunnels((prev) =>
              prev.map((f) =>
                f.id === selected
                  ? { ...f, items: f.items.filter((i) => i.id !== deleteTarget.itemId) }
                  : f
              )
            );
          }
          setDeleteOpen(false);
        }}
      />
    </MainLayout>
  );
}
