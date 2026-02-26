import { createContext, useContext, useState, ReactNode } from "react";

export interface AssetItem {
  id: string;
  name: string;
  favorite?: boolean;
  content?: string;
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  forwarded?: boolean;
  singleView?: boolean;
}

export interface FunnelItem {
  id: string;
  type: "mensagem" | "audio" | "midia" | "documento";
  assetId: string;
  delayMin: number;
  delaySec: number;
}

export interface Funnel {
  id: string;
  name: string;
  favorite?: boolean;
  items: FunnelItem[];
}

export interface TriggerCondition {
  type: string;
  keywords: string[];
}

export interface Trigger {
  id: string;
  name: string;
  enabled: boolean;
  favorite?: boolean;
  conditions: TriggerCondition[];
  funnelName: string;
  delay: string;
  sendToGroups: boolean;
  savedContactsOnly: boolean;
  ignoreCase: boolean;
}

interface AssetsContextType {
  mensagens: AssetItem[];
  setMensagens: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  audios: AssetItem[];
  setAudios: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  midias: AssetItem[];
  setMidias: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  documentos: AssetItem[];
  setDocumentos: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  funnels: Funnel[];
  setFunnels: React.Dispatch<React.SetStateAction<Funnel[]>>;
  triggers: Trigger[];
  setTriggers: React.Dispatch<React.SetStateAction<Trigger[]>>;
}

const AssetsContext = createContext<AssetsContextType | null>(null);

export function AssetsProvider({ children }: { children: ReactNode }) {
  const [mensagens, setMensagens] = useState<AssetItem[]>([
    { id: "1", name: "Boas-vindas", favorite: true, content: "Olá! Seja bem-vindo(a)! 👋\nFicamos felizes em te atender. Como posso ajudar?" },
    { id: "2", name: "Agradecimento pós-compra", content: "Muito obrigado pela sua compra! 🎉\nQualquer dúvida, estamos à disposição." },
    { id: "3", name: "Lembrete de pagamento", content: "Olá! Este é um lembrete amigável sobre seu pagamento pendente. 💰" },
  ]);
  const [audios, setAudios] = useState<AssetItem[]>([
    { id: "1", name: "Áudio de boas-vindas" },
  ]);
  const [midias, setMidias] = useState<AssetItem[]>([]);
  const [documentos, setDocumentos] = useState<AssetItem[]>([]);

  const [funnels, setFunnels] = useState<Funnel[]>([
    {
      id: "1",
      name: "Funil de boas-vindas",
      favorite: true,
      items: [
        { id: "i1", type: "mensagem", assetId: "1", delayMin: 0, delaySec: 0 },
        { id: "i2", type: "audio", assetId: "1", delayMin: 0, delaySec: 30 },
        { id: "i3", type: "mensagem", assetId: "2", delayMin: 1, delaySec: 0 },
      ],
    },
    {
      id: "2",
      name: "Funil pós-venda",
      items: [
        { id: "i4", type: "mensagem", assetId: "2", delayMin: 0, delaySec: 0 },
      ],
    },
  ]);

  const [triggers, setTriggers] = useState<Trigger[]>([
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
  ]);

  return (
    <AssetsContext.Provider value={{ mensagens, setMensagens, audios, setAudios, midias, setMidias, documentos, setDocumentos, funnels, setFunnels, triggers, setTriggers }}>
      {children}
    </AssetsContext.Provider>
  );
}

export function useAssets() {
  const ctx = useContext(AssetsContext);
  if (!ctx) throw new Error("useAssets must be used within AssetsProvider");
  return ctx;
}
