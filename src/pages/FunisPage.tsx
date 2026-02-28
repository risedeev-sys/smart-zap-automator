import { useState, useEffect, useCallback, useMemo } from "react";
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
  Download,
  Upload,
  MessageSquare,
  Mic,
  Image,
  FileText,
  Clock,
  GitBranch,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportFunnel } from "@/utils/exportFunnel";
import { importFunnel } from "@/utils/importFunnel";
import { useRef } from "react";

const typeIcons: Record<string, typeof MessageSquare> = {
  mensagem: MessageSquare,
  audio: Mic,
  midia: Image,
  documento: FileText,
};

const typeLabels: Record<string, string> = {
  mensagem: "Mensagem",
  audio: "Áudio",
  midia: "Mídia",
  documento: "Documento",
};

const assetTables: Record<string, string> = {
  mensagem: "messages",
  audio: "audios",
  midia: "medias",
  documento: "documents",
};

interface FunnelRow {
  id: string;
  name: string;
  favorite: boolean;
}

interface FunnelItemRow {
  id: string;
  funnel_id: string;
  type: string;
  asset_id: string;
  delay_min: number;
  delay_sec: number;
  position: number;
}

interface AssetOption {
  id: string;
  name: string;
}

export default function FunisPage() {
  const [funnels, setFunnels] = useState<FunnelRow[]>([]);
  const [items, setItems] = useState<FunnelItemRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState("");
  const [editFunnelOpen, setEditFunnelOpen] = useState(false);
  const [editFunnelName, setEditFunnelName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ title: string; name: string; type: "funnel" | "item"; itemId?: string } | null>(null);

  // Item modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addItemTab, setAddItemTab] = useState("mensagem");
  const [addItemSelectedId, setAddItemSelectedId] = useState("");
  const [addItemDelayMin, setAddItemDelayMin] = useState(0);
  const [addItemDelaySec, setAddItemDelaySec] = useState(0);

  // Asset options for selects
  const [assetOptions, setAssetOptions] = useState<Record<string, AssetOption[]>>({
    mensagem: [], audio: [], midia: [], documento: [],
  });
  const [assetNameCache, setAssetNameCache] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const fetchFunnels = useCallback(async () => {
    const { data, error } = await supabase
      .from("funnels")
      .select("id, name, favorite")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar funis", description: error.message, variant: "destructive" });
    } else {
      setFunnels(data ?? []);
      if (!selected && data && data.length > 0) setSelected(data[0].id);
    }
    setLoading(false);
  }, []);

  const fetchItems = useCallback(async (funnelId: string) => {
    const { data, error } = await supabase
      .from("funnel_items")
      .select("id, funnel_id, type, asset_id, delay_min, delay_sec, position")
      .eq("funnel_id", funnelId)
      .order("position", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar itens", description: error.message, variant: "destructive" });
    } else {
      setItems(data ?? []);
      // Cache asset names
      const newCache: Record<string, string> = {};
      for (const item of data ?? []) {
        const table = assetTables[item.type];
        if (table && !assetNameCache[item.asset_id]) {
          const { data: asset } = await supabase.from(table as any).select("name").eq("id", item.asset_id).single();
          if (asset) newCache[item.asset_id] = (asset as any).name;
        }
      }
      if (Object.keys(newCache).length > 0) {
        setAssetNameCache(prev => ({ ...prev, ...newCache }));
      }
    }
  }, [assetNameCache]);

  const fetchAssetOptions = useCallback(async (type: string) => {
    const table = assetTables[type];
    if (!table) return;
    const { data } = await supabase.from(table as any).select("id, name").order("created_at", { ascending: true });
    if (data) {
      setAssetOptions(prev => ({ ...prev, [type]: (data as any[]).map(d => ({ id: d.id, name: d.name })) }));
    }
  }, []);

  useEffect(() => { fetchFunnels(); }, [fetchFunnels]);
  useEffect(() => { if (selected) fetchItems(selected); }, [selected]);

  const selectedFunnel = funnels.find(f => f.id === selected);
  const filteredFunnels = funnels.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const getAssetName = (assetId: string) => assetNameCache[assetId] ?? "(item removido)";

  const totalTime = (funnelItems: FunnelItemRow[]) => {
    const totalSec = funnelItems.reduce((acc, i) => acc + i.delay_min * 60 + i.delay_sec, 0);
    return `${Math.floor(totalSec / 60)} min e ${totalSec % 60}s`;
  };

  // --- CRUD ---
  const handleAddFunnel = async () => {
    if (!newFunnelName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("funnels")
      .insert({ name: newFunnelName.trim(), user_id: user.id })
      .select("id, name, favorite")
      .single();
    if (error) {
      toast({ title: "Erro ao criar funil", description: error.message, variant: "destructive" });
    } else if (data) {
      setFunnels(prev => [...prev, data]);
      setSelected(data.id);
      setNewFunnelName("");
      setAddOpen(false);
    }
  };

  const handleEditFunnel = async () => {
    if (!selected || !editFunnelName.trim()) return;
    const { error } = await supabase.from("funnels").update({ name: editFunnelName.trim() }).eq("id", selected);
    if (error) {
      toast({ title: "Erro ao editar", description: error.message, variant: "destructive" });
    } else {
      setFunnels(prev => prev.map(f => f.id === selected ? { ...f, name: editFunnelName.trim() } : f));
      setEditFunnelOpen(false);
    }
  };

  const handleDuplicateFunnel = async () => {
    if (!selectedFunnel) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("funnels")
      .insert({ name: `${selectedFunnel.name} (cópia)`, user_id: user.id })
      .select("id, name, favorite")
      .single();
    if (error) {
      toast({ title: "Erro ao duplicar", description: error.message, variant: "destructive" });
      return;
    }
    if (data && items.length > 0) {
      const newItems = items.map((i, idx) => ({
        funnel_id: data.id,
        user_id: user.id,
        type: i.type,
        asset_id: i.asset_id,
        delay_min: i.delay_min,
        delay_sec: i.delay_sec,
        position: idx,
      }));
      await supabase.from("funnel_items").insert(newItems as any);
    }
    if (data) {
      setFunnels(prev => [...prev, data]);
      setSelected(data.id);
    }
  };

  const handleFavoriteFunnel = async () => {
    if (!selectedFunnel) return;
    const newVal = !selectedFunnel.favorite;
    const { error } = await supabase.from("funnels").update({ favorite: newVal }).eq("id", selected!);
    if (!error) setFunnels(prev => prev.map(f => f.id === selected ? { ...f, favorite: newVal } : f));
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget?.type === "funnel" && selected) {
      const { error } = await supabase.from("funnels").delete().eq("id", selected);
      if (!error) {
        setFunnels(prev => prev.filter(f => f.id !== selected));
        setItems([]);
        setSelected(null);
      }
    } else if (deleteTarget?.type === "item" && deleteTarget.itemId) {
      const { error } = await supabase.from("funnel_items").delete().eq("id", deleteTarget.itemId);
      if (!error) setItems(prev => prev.filter(i => i.id !== deleteTarget.itemId));
    }
    setDeleteOpen(false);
  };

  const handleSaveItem = async () => {
    if (!selected || !addItemSelectedId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingItemId) {
      const { error } = await supabase.from("funnel_items").update({
        type: addItemTab,
        asset_id: addItemSelectedId,
        delay_min: addItemDelayMin,
        delay_sec: addItemDelaySec,
      }).eq("id", editingItemId);
      if (!error) {
        setItems(prev => prev.map(i => i.id === editingItemId ? { ...i, type: addItemTab, asset_id: addItemSelectedId, delay_min: addItemDelayMin, delay_sec: addItemDelaySec } : i));
        // update cache
        const opts = assetOptions[addItemTab] || [];
        const found = opts.find(a => a.id === addItemSelectedId);
        if (found) setAssetNameCache(prev => ({ ...prev, [addItemSelectedId]: found.name }));
      }
    } else {
      const position = items.length;
      const { data, error } = await supabase.from("funnel_items").insert({
        funnel_id: selected,
        user_id: user.id,
        type: addItemTab,
        asset_id: addItemSelectedId,
        delay_min: addItemDelayMin,
        delay_sec: addItemDelaySec,
        position,
      }).select("id, funnel_id, type, asset_id, delay_min, delay_sec, position").single();
      if (!error && data) {
        setItems(prev => [...prev, data]);
        const opts = assetOptions[addItemTab] || [];
        const found = opts.find(a => a.id === addItemSelectedId);
        if (found) setAssetNameCache(prev => ({ ...prev, [addItemSelectedId]: found.name }));
      }
    }
    setEditModalOpen(false);
  };

  const openAddItem = async () => {
    setEditingItemId(null);
    setAddItemTab("mensagem");
    setAddItemSelectedId("");
    setAddItemDelayMin(0);
    setAddItemDelaySec(0);
    await fetchAssetOptions("mensagem");
    setEditModalOpen(true);
  };

  const openEditItem = async (item: FunnelItemRow) => {
    setEditingItemId(item.id);
    setAddItemTab(item.type);
    setAddItemSelectedId("");
    setAddItemDelayMin(item.delay_min);
    setAddItemDelaySec(item.delay_sec);
    await fetchAssetOptions(item.type);
    setEditModalOpen(true);
  };

  if (loading) {
    return (
      <MainLayout title="Funis">
        <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Funis">
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Left */}
        <div className="w-80 flex-shrink-0 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar funil..." className="pl-9 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
             <Button className="w-full h-9 text-sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
            <Button variant="outline" className="w-full h-9 text-sm" disabled={importing} onClick={() => importInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> {importing ? "Importando..." : "Importar funil"}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = "";
                setImporting(true);
                try {
                  const newFunnelId = await importFunnel(file);
                  await fetchFunnels();
                  setSelected(newFunnelId);
                  toast({ title: "Funil importado com sucesso!" });
                } catch (err: any) {
                  toast({ title: "Erro ao importar funil", description: err.message, variant: "destructive" });
                } finally {
                  setImporting(false);
                }
              }}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredFunnels.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f.id)}
                className={`w-full flex items-center gap-2 p-2.5 rounded-md text-left text-sm transition-colors group ${
                  selected === f.id ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{f.name}</span>
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
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                    try {
                      await exportFunnel(selected!);
                      toast({ title: "Backup exportado com sucesso!" });
                    } catch (e: any) {
                      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
                    }
                  }}><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditFunnelName(selectedFunnel.name); setEditFunnelOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFavoriteFunnel}>
                    <Heart className={`h-4 w-4 ${selectedFunnel.favorite ? "fill-primary text-primary" : ""}`} />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <Button variant="outline" size="sm" onClick={openAddItem}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar item
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                {items.map((item, idx) => {
                  const Icon = typeIcons[item.type] || FileText;
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                      <span className="text-xs text-muted-foreground font-mono w-5">{idx + 1}</span>
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Icon className="h-3 w-3" />
                        {typeLabels[item.type] || item.type}
                      </Badge>
                      <span className="flex-1 text-sm truncate">{getAssetName(item.asset_id)}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Enviando após {item.delay_min}m {item.delay_sec}s
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteTarget({ title: "Excluir item do funil", name: getAssetName(item.asset_id), type: "item", itemId: item.id }); setDeleteOpen(true); }}>
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
          <DialogHeader><DialogTitle>Adicionar funil</DialogTitle></DialogHeader>
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

      {/* Add/Edit item modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItemId ? "Editar item do funil" : "Adicionar item ao funil"}</DialogTitle>
            <DialogDescription>Selecione o tipo e configure o delay.</DialogDescription>
          </DialogHeader>
          <Tabs value={addItemTab} onValueChange={(v) => { setAddItemTab(v); setAddItemSelectedId(""); fetchAssetOptions(v); }}>
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
                      {(assetOptions[tab] || []).length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum item cadastrado</div>
                      ) : (
                        (assetOptions[tab] || []).map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-foreground mb-1 block">Minutos</label>
                    <Input type="number" value={addItemDelayMin} onChange={(e) => setAddItemDelayMin(Math.min(60, Math.max(0, Number(e.target.value))))} min="0" max="60" />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-foreground mb-1 block">Segundos</label>
                    <Input type="number" value={addItemDelaySec} onChange={(e) => setAddItemDelaySec(Math.min(59, Math.max(0, Number(e.target.value))))} min="0" max="59" />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button disabled={!addItemSelectedId} onClick={handleSaveItem}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deleteTarget?.title ?? "Excluir item"}
        itemName={deleteTarget?.name}
        onConfirm={handleDeleteConfirm}
      />
    </MainLayout>
  );
}
