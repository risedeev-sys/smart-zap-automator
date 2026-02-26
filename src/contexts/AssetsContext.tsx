import { createContext, useContext, useState, ReactNode } from "react";

export interface AssetItem {
  id: string;
  name: string;
}

interface AssetsContextType {
  mensagens: AssetItem[];
  setMensagens: (items: AssetItem[]) => void;
  audios: AssetItem[];
  setAudios: (items: AssetItem[]) => void;
  midias: AssetItem[];
  setMidias: (items: AssetItem[]) => void;
  documentos: AssetItem[];
  setDocumentos: (items: AssetItem[]) => void;
}

const AssetsContext = createContext<AssetsContextType | null>(null);

export function AssetsProvider({ children }: { children: ReactNode }) {
  const [mensagens, setMensagens] = useState<AssetItem[]>([
    { id: "1", name: "Boas-vindas" },
    { id: "2", name: "Agradecimento pós-compra" },
    { id: "3", name: "Lembrete de pagamento" },
  ]);
  const [audios, setAudios] = useState<AssetItem[]>([
    { id: "1", name: "Áudio de boas-vindas" },
  ]);
  const [midias, setMidias] = useState<AssetItem[]>([]);
  const [documentos, setDocumentos] = useState<AssetItem[]>([]);

  return (
    <AssetsContext.Provider value={{ mensagens, setMensagens, audios, setAudios, midias, setMidias, documentos, setDocumentos }}>
      {children}
    </AssetsContext.Provider>
  );
}

export function useAssets() {
  const ctx = useContext(AssetsContext);
  if (!ctx) throw new Error("useAssets must be used within AssetsProvider");
  return ctx;
}
