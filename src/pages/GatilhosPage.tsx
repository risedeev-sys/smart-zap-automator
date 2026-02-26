import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";

interface Trigger {
  id: string;
  name: string;
  enabled: boolean;
  favorite?: boolean;
  conditions: { type: string; keywords: string[] }[];
  funnelName: string;
  delay: string;
  sendToGroups: boolean;
  savedContactsOnly: boolean;
  ignoreCase: boolean;
}

const mockTriggers: Trigger[] = [
  {
    id: "1",
    name: "Gatilho de boas-vindas",
    enabled: true,
    favorite: true,
    conditions: [{ type: "contém", keywords: ["oi", "olá", "bom dia"] }],
    funnelName: "Funil de boas-vindas",
    delay: "5 segundos",
    sendToGroups: false,
    savedContactsOnly: false,
    ignoreCase: true,
  },
  {
    id: "2",
    name: "Gatilho pós-venda",
    enabled: false,
    conditions: [{ type: "igual a", keywords: ["comprei"] }],
    funnelName: "Funil pós-venda",
    delay: "0 segundos",
    sendToGroups: false,
    savedContactsOnly: true,
    ignoreCase: true,
  },
];

export default function GatilhosPage() {
  const [selected, setSelected] = useState<string | null>("1");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editKeywords, setEditKeywords] = useState<string[]>(["oi", "olá"]);
  const [keywordInput, setKeywordInput] = useState("");

  const selectedTrigger = mockTriggers.find((t) => t.id === selected);

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !editKeywords.includes(kw)) {
      setEditKeywords([...editKeywords, kw]);
      setKeywordInput("");
    }
  };

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
            <Button className="w-full h-9 text-sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {mockTriggers.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full flex items-center gap-2 p-2.5 rounded-md text-left text-sm transition-colors group ${
                  selected === t.id ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground"
                }`}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab" />
                <Switch checked={t.enabled} className="scale-75" />
                <span className="flex-1 truncate">{t.name}</span>
                <Heart
                  className={`h-3.5 w-3.5 flex-shrink-0 ${
                    t.favorite ? "fill-primary text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  }`}
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
                <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
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
                    <Switch checked={selectedTrigger.sendToGroups} className="ml-auto scale-75" />
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Apenas contatos salvos</span>
                    <Switch checked={selectedTrigger.savedContactsOnly} className="ml-auto scale-75" />
                  </div>
                  <div className="flex items-center gap-2">
                    <CaseSensitive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Ignorar maiúsculas/minúsculas</span>
                    <Switch checked={selectedTrigger.ignoreCase} className="ml-auto scale-75" />
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

      {/* Edit Trigger Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar gatilho 1/2</DialogTitle>
            <DialogDescription>Configure as condições de disparo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome do gatilho</label>
              <Input defaultValue={selectedTrigger?.name ?? ""} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Condição</label>
              <Select defaultValue="contém">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="igual">Se a mensagem for igual a (alguma)</SelectItem>
                  <SelectItem value="contém">Se a mensagem contém (alguma)</SelectItem>
                  <SelectItem value="começa">Se a mensagem começa com (alguma)</SelectItem>
                  <SelectItem value="não contém">Se a mensagem não contém (nenhuma)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Palavras-chave</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editKeywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1 text-xs pr-1">
                    {kw}
                    <button
                      onClick={() => setEditKeywords(editKeywords.filter((k) => k !== kw))}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Digite e pressione ENTER..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
              />
            </div>
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar outra condição
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => setEditModalOpen(false)}>Próximo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
