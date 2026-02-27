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
  const [mensagens, setMensagens] = useState<AssetItem[]>([]);
  const [audios, setAudios] = useState<AssetItem[]>([]);
  const [midias, setMidias] = useState<AssetItem[]>([]);
  const [documentos, setDocumentos] = useState<AssetItem[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);

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
