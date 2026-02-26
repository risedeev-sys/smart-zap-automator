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

interface AssetsContextType {
  mensagens: AssetItem[];
  setMensagens: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  audios: AssetItem[];
  setAudios: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  midias: AssetItem[];
  setMidias: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  documentos: AssetItem[];
  setDocumentos: React.Dispatch<React.SetStateAction<AssetItem[]>>;
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
