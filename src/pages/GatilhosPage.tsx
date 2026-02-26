import { useState } from "react";
import { useAssets, TriggerCondition, Trigger } from "@/contexts/AssetsContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Zap,
  X,
  Users,
  UserCheck,
  CaseSensitive,
  Clock,
  GitBranch,
  Trash2,
} from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";

export default function GatilhosPage() {
  const { triggers, setTriggers } = useAssets();
  const [selected, setSelected] = useState<string | null>("1");
  
  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addConditions, setAddConditions] = useState<TriggerCondition[]>([
    { type: "contém", keywords: [] },
  ]);
  const [addKeywordInputs, setAddKeywordInputs] = useState<string[]>([""]);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editConditions, setEditConditions] = useState<TriggerCondition[]>([]);
  const [editKeywordInputs, setEditKeywordInputs] = useState<string[]>([]);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selectedTrigger = triggers.find((t) => t.id === selected);

  // ---- Add ----
  const handleOpenAdd = () => {
    setAddName("");
    setAddConditions([{ type: "contém", keywords: [] }]);
    setAddKeywordInputs([""]);
    setAddOpen(true);
  };

  const handleAddCondition = () => {
    setAddConditions([...addConditions, { type: "contém", keywords: [] }]);
    setAddKeywordInputs([...addKeywordInputs, ""]);
  };

  const handleRemoveAddCondition = (idx: number) => {
    setAddConditions(addConditions.filter((_, i) => i !== idx));
    setAddKeywordInputs(addKeywordInputs.filter((_, i) => i !== idx));
  };

  const handleAddKeyword = (idx: number) => {
    const kw = addKeywordInputs[idx]?.trim();
    if (kw && !addConditions[idx].keywords.includes(kw)) {
      const updated = [...addConditions];
      updated[idx] = { ...updated[idx], keywords: [...updated[idx].keywords, kw] };
      setAddConditions(updated);
      const inputs = [...addKeywordInputs];
      inputs[idx] = "";
      setAddKeywordInputs(inputs);
    }
  };

  const handleRemoveAddKeyword = (condIdx: number, kw: string) => {
    const updated = [...addConditions];
    updated[condIdx] = {
      ...updated[condIdx],
      keywords: updated[condIdx].keywords.filter((k) => k !== kw),
    };
    setAddConditions(updated);
  };

  const handleSaveAdd = () => {
    if (!addName.trim()) return;
    const newId = Date.now().toString();
    const newTrigger: Trigger = {
      id: newId,
      name: addName.trim(),
      enabled: true,
      conditions: addConditions.filter((c) => c.keywords.length > 0),
      funnelName: "",
      delay: "0 segundos",
      sendToGroups: false,
      savedContactsOnly: false,
      ignoreCase: true,
    };
    setTriggers([...triggers, newTrigger]);
    setSelected(newId);
    setAddOpen(false);
    toast({ title: "Gatilho criado com sucesso!" });
  };

  // ---- Edit ----
  const handleOpenEdit = () => {
    if (!selectedTrigger) return;
    setEditName(selectedTrigger.name);
    setEditConditions(selectedTrigger.conditions.map((c) => ({ ...c, keywords: [...c.keywords] })));
    setEditKeywordInputs(selectedTrigger.conditions.map(() => ""));
    setEditModalOpen(true);
  };

  const handleEditAddCondition = () => {
    setEditConditions([...editConditions, { type: "contém", keywords: [] }]);
    setEditKeywordInputs([...editKeywordInputs, ""]);
  };

  const handleRemoveEditCondition = (idx: number) => {
    setEditConditions(editConditions.filter((_, i) => i !== idx));
    setEditKeywordInputs(editKeywordInputs.filter((_, i) => i !== idx));
  };

  const handleEditKeyword = (idx: number) => {
    const kw = editKeywordInputs[idx]?.trim();
    if (kw && !editConditions[idx].keywords.includes(kw)) {
      const updated = [...editConditions];
      updated[idx] = { ...updated[idx], keywords: [...updated[idx].keywords, kw] };
      setEditConditions(updated);
      const inputs = [...editKeywordInputs];
      inputs[idx] = "";
      setEditKeywordInputs(inputs);
    }
  };

  const handleRemoveEditKeyword = (condIdx: number, kw: string) => {
    const updated = [...editConditions];
    updated[condIdx] = {
      ...updated[condIdx],
      keywords: updated[condIdx].keywords.filter((k) => k !== kw),
    };
    setEditConditions(updated);
  };

  const handleSaveEdit = () => {
    if (!selectedTrigger || !editName.trim()) return;
    setTriggers(
      triggers.map((t) =>
        t.id === selectedTrigger.id
          ? { ...t, name: editName.trim(), conditions: editConditions }
          : t
      )
    );
    setEditModalOpen(false);
    toast({ title: "Gatilho atualizado!" });
  };

  // ---- Delete ----
  const handleDelete = () => {
    if (!selectedTrigger) return;
    setTriggers(triggers.filter((t) => t.id !== selectedTrigger.id));
    setSelected(null);
    setDeleteOpen(false);
    toast({ title: "Gatilho excluído!" });
  };

  // ---- Favorite ----
  const handleFavorite = (id: string) => {
    setTriggers(triggers.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)));
  };

  // ---- Toggle enabled ----
  const handleToggleEnabled = (id: string) => {
    setTriggers(triggers.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  // ---- Condition row component ----
  const renderConditionEditor = (
    conditions: TriggerCondition[],
    keywordInputs: string[],
    setConditions: (c: TriggerCondition[]) => void,
    setKeywordInputs: (k: string[]) => void,
    onAddKeyword: (idx: number) => void,
    onRemoveKeyword: (condIdx: number, kw: string) => void,
    onRemoveCondition: (idx: number) => void
  ) => (
    <div className="space-y-3">
      {conditions.map((cond, idx) => (
        <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Select
              value={cond.type}
              onValueChange={(val) => {
                const updated = [...conditions];
                updated[idx] = { ...updated[idx], type: val };
                setConditions(updated);
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contém">Se a mensagem contém (alguma)</SelectItem>
                <SelectItem value="igual a">Se a mensagem for igual a (alguma)</SelectItem>
                <SelectItem value="começa com">Se a mensagem começa com (alguma)</SelectItem>
                <SelectItem value="não contém">Se a mensagem não contém (nenhuma)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onRemoveCondition(idx)}
            >
              Remover condição
            </Button>
          </div>

          <div className="text-xs text-center text-primary font-medium">
            Para mais de uma palavra-chave aperte ⏎ ENTER
          </div>

          {cond.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cond.keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="gap-1 text-xs pr-1">
                  {kw}
                  <button onClick={() => onRemoveKeyword(idx, kw)} className="hover:text-destructive">
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
                onAddKeyword(idx);
              }
            }}
            rows={3}
          />
        </div>
      ))}
    </div>
  );

  return (
    <MainLayout title="Gatilhos">
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Left */}
        <div className="w-80 flex-shrink-0 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar gatilho..." className="pl-9 h-9" />
            </div>
            <Button onClick={handleOpenAdd} className="w-full h-9 text-sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {triggers.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full flex items-center gap-2 p-2.5 rounded-md text-left text-sm transition-colors group ${
                  selected === t.id ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground"
                }`}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab" />
                <Switch
                  checked={t.enabled}
                  className="scale-75"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleEnabled(t.id);
                  }}
                />
                <span className="flex-1 truncate">{t.name}</span>
                <Heart
                  className={`h-3.5 w-3.5 flex-shrink-0 cursor-pointer ${
                    t.favorite ? "fill-primary text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavorite(t.id);
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right */}
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
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                  >
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
                  {selectedTrigger.conditions.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge variant="outline" className="text-xs">Se a mensagem {c.type}</Badge>
                      {c.keywords.map((kw) => (
                        <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Funnel */}
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Funil vinculado: <strong>{selectedTrigger.funnelName}</strong></span>
                </div>

                {/* Delay */}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Atraso: <strong>{selectedTrigger.delay}</strong></span>
                </div>

                {/* Rules */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground">Regras</h4>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Enviar para grupos</span>
                    <Switch
                      checked={selectedTrigger.sendToGroups}
                      className="ml-auto scale-75"
                      onCheckedChange={() =>
                        setTriggers(triggers.map((t) =>
                          t.id === selectedTrigger.id ? { ...t, sendToGroups: !t.sendToGroups } : t
                        ))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Apenas contatos salvos</span>
                    <Switch
                      checked={selectedTrigger.savedContactsOnly}
                      className="ml-auto scale-75"
                      onCheckedChange={() =>
                        setTriggers(triggers.map((t) =>
                          t.id === selectedTrigger.id ? { ...t, savedContactsOnly: !t.savedContactsOnly } : t
                        ))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <CaseSensitive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Ignorar maiúsculas/minúsculas</span>
                    <Switch
                      checked={selectedTrigger.ignoreCase}
                      className="ml-auto scale-75"
                      onCheckedChange={() =>
                        setTriggers(triggers.map((t) =>
                          t.id === selectedTrigger.id ? { ...t, ignoreCase: !t.ignoreCase } : t
                        ))
                      }
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

      {/* Add Trigger Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar gatilho 1/2</DialogTitle>
            <DialogDescription>Configure o nome e as condições de disparo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input
                placeholder="Título do gatilho"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
              {!addName.trim() && (
                <span className="text-xs text-destructive mt-1">Campo obrigatório</span>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Condições de disparo ({addConditions.length})
              </label>
              {renderConditionEditor(
                addConditions,
                addKeywordInputs,
                setAddConditions,
                setAddKeywordInputs,
                handleAddKeyword,
                handleRemoveAddKeyword,
                handleRemoveAddCondition
              )}
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={handleAddCondition}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar outra condição
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAdd} disabled={!addName.trim()}>Próximo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Trigger Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar gatilho 1/2</DialogTitle>
            <DialogDescription>Configure as condições de disparo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome do gatilho</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Condições de disparo ({editConditions.length})
              </label>
              {renderConditionEditor(
                editConditions,
                editKeywordInputs,
                setEditConditions,
                setEditKeywordInputs,
                handleEditKeyword,
                handleRemoveEditKeyword,
                handleRemoveEditCondition
              )}
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={handleEditAddCondition}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar outra condição
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Próximo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir gatilho"
        itemName={selectedTrigger?.name}
        onConfirm={handleDelete}
      />
    </MainLayout>
  );
}
