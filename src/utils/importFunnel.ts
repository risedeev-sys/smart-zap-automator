import { supabase } from "@/integrations/supabase/client";

const assetTables: Record<string, string> = {
  mensagem: "messages",
  audio: "audios",
  midia: "medias",
  documento: "documents",
};

interface ExportData {
  version: number;
  funnel: { id: string; name: string; favorite: boolean };
  items: Array<{
    id: string;
    type: string;
    asset_id: string;
    delay_min: number;
    delay_sec: number;
    position: number;
  }>;
  assets: {
    messages: Array<{ id: string; name: string; content?: string | null }>;
    audios: Array<{ id: string; name: string; storage_path?: string | null; mime?: string | null; bytes?: number | null }>;
    medias: Array<{ id: string; name: string; storage_path?: string | null; mime?: string | null; bytes?: number | null }>;
    documents: Array<{ id: string; name: string; storage_path?: string | null; mime?: string | null; bytes?: number | null }>;
  };
}

export async function importFunnel(file: File): Promise<string> {
  const text = await file.text();
  const data: ExportData = JSON.parse(text);

  // Validate structure
  if (!data.funnel || !data.items || !data.assets) {
    throw new Error("Arquivo inválido: estrutura incompleta (funnel, items, assets).");
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");
  const userId = user.id;

  const idMap: Record<string, string> = {};

  // Insert messages
  if (data.assets.messages?.length) {
    const rows = data.assets.messages.map(a => {
      const newId = crypto.randomUUID();
      idMap[a.id] = newId;
      return { id: newId, name: a.name, content: a.content ?? null, user_id: userId };
    });
    const { error } = await supabase.from("messages").insert(rows);
    if (error) throw new Error(`Erro ao importar mensagens: ${error.message}`);
  }

  // Insert audios
  if (data.assets.audios?.length) {
    const rows = data.assets.audios.map(a => {
      const newId = crypto.randomUUID();
      idMap[a.id] = newId;
      return { id: newId, name: a.name, storage_path: a.storage_path ?? null, mime: a.mime ?? null, bytes: a.bytes ?? null, user_id: userId };
    });
    const { error } = await supabase.from("audios").insert(rows);
    if (error) throw new Error(`Erro ao importar áudios: ${error.message}`);
  }

  // Insert medias
  if (data.assets.medias?.length) {
    const rows = data.assets.medias.map(a => {
      const newId = crypto.randomUUID();
      idMap[a.id] = newId;
      return { id: newId, name: a.name, storage_path: a.storage_path ?? null, mime: a.mime ?? null, bytes: a.bytes ?? null, user_id: userId };
    });
    const { error } = await supabase.from("medias").insert(rows);
    if (error) throw new Error(`Erro ao importar mídias: ${error.message}`);
  }

  // Insert documents
  if (data.assets.documents?.length) {
    const rows = data.assets.documents.map(a => {
      const newId = crypto.randomUUID();
      idMap[a.id] = newId;
      return { id: newId, name: a.name, storage_path: a.storage_path ?? null, mime: a.mime ?? null, bytes: a.bytes ?? null, user_id: userId };
    });
    const { error } = await supabase.from("documents").insert(rows);
    if (error) throw new Error(`Erro ao importar documentos: ${error.message}`);
  }

  // Create funnel
  const newFunnelId = crypto.randomUUID();
  const { error: funnelErr } = await supabase.from("funnels").insert({
    id: newFunnelId,
    name: data.funnel.name,
    favorite: data.funnel.favorite ?? false,
    user_id: userId,
  });
  if (funnelErr) throw new Error(`Erro ao criar funil: ${funnelErr.message}`);

  // Create funnel items with remapped asset_id
  if (data.items.length) {
    const itemRows = data.items.map((item, idx) => ({
      funnel_id: newFunnelId,
      user_id: userId,
      type: item.type,
      asset_id: idMap[item.asset_id] ?? item.asset_id,
      delay_min: item.delay_min,
      delay_sec: item.delay_sec,
      position: item.position ?? idx,
    }));
    const { error } = await supabase.from("funnel_items").insert(itemRows);
    if (error) throw new Error(`Erro ao criar itens do funil: ${error.message}`);
  }

  // Optional: create backup record
  await supabase.from("backups").insert({
    name: `Import: ${data.funnel.name}`,
    user_id: userId,
    source: "funnel-import",
    funnel_id: newFunnelId,
    status: "ready",
  });

  return newFunnelId;
}
