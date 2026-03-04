import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Plus, GripVertical, Heart, Pencil, Zap, X,
  Users, UserCheck, CaseSensitive, Clock, GitBranch, Trash2, FlaskConical,
} from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { TriggerSimulator } from "@/components/TriggerSimulator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TriggerCondition {
  type: string;
  keywords: string[];
}

interface TriggerRow {
  id: string;
  name: string;
  enabled: boolean;
  favorite: boolean;
  conditions: TriggerCondition[];
  funnel_id: string | null;
  delay_seconds: number;
  send_to_groups: boolean;
  saved_contacts_only: boolean;
  ignore_case: boolean;
  position: number;
}

interface FunnelOption {
  id: string;
  name: string;
}

export default function GatilhosPage() {
  const { toast } = useToast();
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  

  // Add form
  const [addName, setAddName] = useState("");
  const [addConditions, setAddConditions] = useState<TriggerCondition[]>([{ type: "contém", keywords: [] }]);
  const [addKeywordInputs, setAddKeywordInputs] = useState<string[]>([""]);
  const [addFunnelId, setAddFunnelId] = useState<string>("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editConditions, setEditConditions] = useState<TriggerCondition[]>([]);
  const [editKeywordInputs, setEditKeywordInputs] = useState<string[]>([]);
  const [editFunnelId, setEditFunnelId] = useState<string>("");

  const selectedTrigger = triggers.find((t) => t.id === selected);

  // Fetch
  const fetchData = useCallback(async () => {
    const [triggersRes, funnelsRes] = await Promise.all([
      supabase.from("triggers").select("*").order("position", { ascending: true }),
      supabase.from("funnels").select("id, name").order("name"),
    ]);

    if (triggersRes.error) {
      toast({ title: "Erro ao carregar gatilhos", description: triggersRes.error.message, variant: "destructive" });
    } else {
      const rows: TriggerRow[] = (triggersRes.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled ?? true,
        favorite: r.favorite ?? false,
        conditions: (r.conditions as TriggerCondition[]) ?? [],
        funnel_id: r.funnel_id,
        delay_seconds: r.delay_seconds ?? 0,
        send_to_groups: r.send_to_groups ?? false,
        saved_contacts_only: r.saved_contacts_only ?? false,
        ignore_case: r.ignore_case ?? true,
        position: r.position ?? 0,
      }));
      setTriggers(rows);
      if (!selected && rows.length > 0) setSelected(rows[0].id);
    }

    if (!funnelsRes.error) {
      setFunnels(funnelsRes.data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Helpers
  const getFunnelName = (funnelId: string | null) => {
    if (!funnelId) return "Nenhum";
    return funnels.find((f) => f.id === funnelId)?.name ?? "Desconhecido";
  };

  const formatDelay = (seconds: number) => {
    if (seconds === 0) return "Sem atraso";
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    const parts: string[] = [];
    if (min > 0) parts.push(`${min} min`);
    if (sec > 0) parts.push(`${sec}s`);
    return parts.join(" ");
  };

  // CRUD
  const normalizeConditions = (conditions: TriggerCondition[]): TriggerCondition[] => {
    return conditions
      .map((condition) => ({
        ...condition,
        keywords: condition.keywords.map((kw) => kw.trim()).filter(Boolean),
      }))
      .filter((condition) => condition.keywords.length > 0);
  };

  const handleSaveAdd = async () => {
    if (!addName.trim()) return;

    const normalizedConditions = normalizeConditions(addConditions);
    if (normalizedConditions.length === 0) {
      toast({
        title: "Adicione ao menos uma condição",
        description: "O gatilho precisa de pelo menos uma palavra-chave para disparar.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      name: addName.trim(),
      enabled: true,
      conditions: normalizedConditions as unknown as import("@/integrations/supabase/types").Json,
      funnel_id: addFunnelId || null,
      delay_seconds: 0,
      send_to_groups: false,
      saved_contacts_only: false,
      ignore_case: true,
      position: triggers.length,
      user_id: user.id,
    };

    const { data, error } = await supabase.from("triggers").insert([payload]).select().single();
    if (error) {
      toast({ title: "Erro ao criar gatilho", description: error.message, variant: "destructive" });
    } else {
      const row = mapRow(data);
      setTriggers((prev) => [...prev, row]);
      setSelected(row.id);
      setAddOpen(false);
      toast({ title: "Gatilho criado com sucesso!" });
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedTrigger || !editName.trim()) return;

    const normalizedConditions = normalizeConditions(editConditions);
    if (normalizedConditions.length === 0) {
      toast({
        title: "Adicione ao menos uma condição",
        description: "O gatilho precisa de pelo menos uma palavra-chave para disparar.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: editName.trim(),
      conditions: normalizedConditions as unknown as import("@/integrations/supabase/types").Json,
      funnel_id: editFunnelId || null,
    };
    const { error } = await supabase.from("triggers").update(payload).eq("id", selectedTrigger.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      setTriggers((prev) => prev.map((t) => t.id === selectedTrigger.id ? {
        ...t,
        name: payload.name,
        conditions: normalizedConditions,
        funnel_id: payload.funnel_id,
      } : t));
      setEditModalOpen(false);
      toast({ title: "Gatilho atualizado!" });
    }
  };

  const handleDelete = async () => {
    if (!selectedTrigger) return;
    const { error } = await supabase.from("triggers").delete().eq("id", selectedTrigger.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setTriggers((prev) => prev.filter((t) => t.id !== selectedTrigger.id));
      setSelected(null);
      setDeleteOpen(false);
      toast({ title: "Gatilho excluído!" });
    }
  };

  const handleToggleField = async (id: string, field: "enabled" | "favorite" | "send_to_groups" | "saved_contacts_only" | "ignore_case") => {
    const trigger = triggers.find((t) => t.id === id);
    if (!trigger) return;
    const newVal = !trigger[field];
    const { error } = await supabase.from("triggers").update({ [field]: newVal }).eq("id", id);
    if (!error) {
      setTriggers((prev) => prev.map((t) => t.id === id ? { ...t, [field]: newVal } : t));
    }
  };

  // Map raw DB row to TriggerRow
  const mapRow = (r: any): TriggerRow => ({
    id: r.id, name: r.name, enabled: r.enabled ?? true, favorite: r.favorite ?? false,
    conditions: (r.conditions as TriggerCondition[]) ?? [], funnel_id: r.funnel_id,
    delay_seconds: r.delay_seconds ?? 0, send_to_groups: r.send_to_groups ?? false,
    saved_contacts_only: r.saved_contacts_only ?? false, ignore_case: r.ignore_case ?? true,
    position: r.position ?? 0,
  });

  // Open modals
  const handleOpenAdd = () => {
    setAddName("");
    setAddConditions([{ type: "contém", keywords: [] }]);
    setAddKeywordInputs([""]);
    setAddFunnelId("");
    setAddOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedTrigger) return;
    setEditName(selectedTrigger.name);
    setEditConditions(selectedTrigger.conditions.map((c) => ({ ...c, keywords: [...c.keywords] })));
    setEditKeywordInputs(selectedTrigger.conditions.map(() => ""));
    setEditFunnelId(selectedTrigger.funnel_id ?? "");
    setEditModalOpen(true);
  };

  // Condition helpers (shared)
  const addKeyword = (
    idx: number,
    conditions: TriggerCondition[],
    setConditions: (c: TriggerCondition[]) => void,
    inputs: string[],
    setInputs: (k: string[]) => void
  ) => {
    const kw = inputs[idx]?.trim();
    if (kw && !conditions[idx].keywords.includes(kw)) {
      const updated = [...conditions];
      updated[idx] = { ...updated[idx], keywords: [...updated[idx].keywords, kw] };
      setConditions(updated);
      const newInputs = [...inputs];
      newInputs[idx] = "";
      setInputs(newInputs);
    }
  };

  const removeKeyword = (
    condIdx: number, kw: string,
    conditions: TriggerCondition[],
    setConditions: (c: TriggerCondition[]) => void
  ) => {
    const updated = [...conditions];
    updated[condIdx] = { ...updated[condIdx], keywords: updated[condIdx].keywords.filter((k) => k !== kw) };
    setConditions(updated);
  };

  // Condition editor
  const renderConditionEditor = (
    conditions: TriggerCondition[],
    keywordInputs: string[],
    setConditions: (c: TriggerCondition[]) => void,
    setKeywordInputs: (k: string[]) => void,
    addCond: () => void,
    removeCond: (idx: number) => void,
  ) => (
    <div className="space-y-3">
      {conditions.map((cond, idx) => (
        <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Select value={cond.type} onValueChange={(val) => {
              const updated = [...conditions];
              updated[idx] = { ...updated[idx], type: val };
              setConditions(updated);
            }}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contém">Se a mensagem contém (alguma)</SelectItem>
                <SelectItem value="igual a">Se a mensagem for igual a (alguma)</SelectItem>
                <SelectItem value="começa com">Se a mensagem começa com (alguma)</SelectItem>
                <SelectItem value="não contém">Se a mensagem não contém (nenhuma)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" onClick={() => removeCond(idx)}>Remover</Button>
          </div>
          <div className="text-xs text-center text-primary font-medium">
            Para mais de uma palavra-chave aperte ⏎ ENTER
          </div>
          {cond.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cond.keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="gap-1 text-xs pr-1">
                  {kw}
                  <button onClick={() => removeKeyword(idx, kw, conditions, setConditions)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <Textarea
            placeholder="Digite nova palavra-chave"
            value={keywordInputs[idx] || ""}
            onChange={(e) => {
              const inputs = [...keywordInputs];
              inputs[idx] = e.target.value;
              setKeywordInputs(inputs);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword(idx, conditions, setConditions, keywordInputs, setKeywordInputs);
              }
            }}
            rows={2}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addCond}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar outra condição
      </Button>
    </div>
  );

  // Funnel selector
  const renderFunnelSelect = (value: string, onChange: (v: string) => void) => (
    <div>
      <label className="text-sm font-medium text-foreground mb-1 block">Funil vinculado</label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="Selecione um funil" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Nenhum</SelectItem>
          {funnels.map((f) => (
            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const filteredTriggers = triggers.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <MainLayout title="Gatilhos">
        <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>
      </MainLayout>
    );
  }

  // Simulator data (add funnel name for display)
  const simulatorTriggers = triggers.map((t) => ({
    ...t,
    funnel_name: getFunnelName(t.funnel_id),
  }));

  return (
    <MainLayout title="Gatilhos">
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Left panel */}
        <div className="w-80 flex-shrink-0 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar gatilho..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleOpenAdd} className="flex-1 h-9 text-sm">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredTriggers.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full flex items-center gap-2 p-2.5 rounded-md text-left text-sm transition-colors group border ${
                  selected === t.id ? "bg-accent text-accent-foreground border-primary/50" : "hover:bg-muted text-foreground border-transparent"
                }`}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-50 group-hover:opacity-100 flex-shrink-0" />
                <Switch
                  checked={t.enabled}
                  className="scale-75"
                  onClick={(e) => { e.stopPropagation(); handleToggleField(t.id, "enabled"); }}
                />
                <span className="flex-1 truncate">{t.name}</span>
                <Heart
                  className={`h-3.5 w-3.5 flex-shrink-0 cursor-pointer ${
                    t.favorite ? "fill-primary text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={(e) => { e.stopPropagation(); handleToggleField(t.id, "favorite"); }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden flex flex-col">
          {selectedTrigger ? (
            <>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">{selectedTrigger.name}</h3>
                  <Badge variant={selectedTrigger.enabled ? "default" : "secondary"} className="text-xs">
                    {selectedTrigger.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Conditions */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Condições de disparo</h4>
                  {selectedTrigger.conditions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma condição configurada</p>
                  ) : (
                    selectedTrigger.conditions.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="outline" className="text-xs">Se a mensagem {c.type}</Badge>
                        {c.keywords.map((kw) => (
                          <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {/* Funnel */}
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Funil vinculado: <strong>{getFunnelName(selectedTrigger.funnel_id)}</strong></span>
                </div>

                {/* Delay */}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Atraso: <strong>{formatDelay(selectedTrigger.delay_seconds)}</strong></span>
                </div>

                {/* Rules */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground">Regras</h4>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Enviar para grupos</span>
                    <Switch
                      checked={selectedTrigger.send_to_groups}
                      className="ml-auto scale-75"
                      onCheckedChange={() => handleToggleField(selectedTrigger.id, "send_to_groups")}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Apenas contatos salvos</span>
                    <Switch
                      checked={selectedTrigger.saved_contacts_only}
                      className="ml-auto scale-75"
                      onCheckedChange={() => handleToggleField(selectedTrigger.id, "saved_contacts_only")}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <CaseSensitive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Ignorar maiúsculas/minúsculas</span>
                    <Switch
                      checked={selectedTrigger.ignore_case}
                      className="ml-auto scale-75"
                      onCheckedChange={() => handleToggleField(selectedTrigger.id, "ignore_case")}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Selecione um gatilho para visualizar
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar gatilho</DialogTitle>
            <DialogDescription>Configure o nome, condições e funil vinculado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input placeholder="Título do gatilho" value={addName} onChange={(e) => setAddName(e.target.value)} />
              {!addName.trim() && <span className="text-xs text-destructive mt-1">Campo obrigatório</span>}
            </div>
            {renderFunnelSelect(addFunnelId, setAddFunnelId)}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Condições de disparo ({addConditions.length})
              </label>
              {renderConditionEditor(
                addConditions, addKeywordInputs, setAddConditions, setAddKeywordInputs,
                () => { setAddConditions([...addConditions, { type: "contém", keywords: [] }]); setAddKeywordInputs([...addKeywordInputs, ""]); },
                (idx) => { setAddConditions(addConditions.filter((_, i) => i !== idx)); setAddKeywordInputs(addKeywordInputs.filter((_, i) => i !== idx)); },
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAdd} disabled={!addName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar gatilho</DialogTitle>
            <DialogDescription>Configure as condições de disparo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome do gatilho</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            {renderFunnelSelect(editFunnelId, setEditFunnelId)}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Condições de disparo ({editConditions.length})
              </label>
              {renderConditionEditor(
                editConditions, editKeywordInputs, setEditConditions, setEditKeywordInputs,
                () => { setEditConditions([...editConditions, { type: "contém", keywords: [] }]); setEditKeywordInputs([...editKeywordInputs, ""]); },
                (idx) => { setEditConditions(editConditions.filter((_, i) => i !== idx)); setEditKeywordInputs(editKeywordInputs.filter((_, i) => i !== idx)); },
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <DeleteConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Excluir gatilho" itemName={selectedTrigger?.name} onConfirm={handleDelete} />
    </MainLayout>
  );
}
