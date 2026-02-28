import { supabase } from "@/integrations/supabase/client";

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
  console.log("[importFunnel] Função chamada, arquivo:", file.name, "tamanho:", file.size);
  const text = await file.text();
  console.log("[importFunnel] JSON lido, primeiros 200 chars:", text.slice(0, 200));
  const data: ExportData = JSON.parse(text);

  if (!data.funnel || !data.items) {
    throw new Error("Arquivo inválido: estrutura incompleta (funnel, items).");
  }

  // Normalize: accept assets at root level OR nested under .assets
  const assets = {
    messages: data.assets?.messages ?? (data as any).mensagens ?? (data as any).messages ?? [],
    audios: data.assets?.audios ?? (data as any).audios ?? [],
    medias: data.assets?.medias ?? (data as any).midias ?? (data as any).medias ?? [],
    documents: data.assets?.documents ?? (data as any).docs ?? (data as any).documentos ?? (data as any).documents ?? [],
  };

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Erro de autenticação: ${authError.message}`);
  if (!user) throw new Error("Usuário não autenticado.");
  const userId = user.id;

  console.log("[importFunnel] Usuário:", userId);
  console.log("[importFunnel] Assets normalizados:", {
    messages: assets.messages?.length ?? 0,
    audios: assets.audios?.length ?? 0,
    medias: assets.medias?.length ?? 0,
    documents: assets.documents?.length ?? 0,
  });

  const idMap: Record<string, string> = {};

  // Insert messages
  if (assets.messages?.length) {
    const rows = assets.messages.map((a: any) => {
      const newId = crypto.randomUUID();
      idMap[a.id] = newId;
      return { id: newId, name: a.name, content: a.content ?? null, user_id: userId };
    });
    console.log("[importFunnel] Inserindo messages:", rows.length, rows);
    const { data: inserted, error } = await supabase.from("messages").insert(rows).select();
    if (error) {
      console.error("[importFunnel] Erro ao inserir messages:", error);
      throw new Error(`Erro ao importar mensagens: ${error.message}`);
    }
    console.log("[importFunnel] Messages inseridas com sucesso:", inserted?.length);
  }

  // Insert audios
  if (assets.audios?.length) {
    const rows = assets.audios.map((a: any) => {
      const newId = crypto.randomUUID();
      idMap[a.id] = newId;
      return { id: newId, name: a.name, storage_path: a.storage_path ?? null, mime: a.mime ?? null, bytes: a.bytes ?? null, user_id: userId };
    });
    console.log("[importFunnel] Inserindo audios:", rows.length, rows);
    const { data: inserted, error } = await supabase.from("audios").insert(rows).select();
    if (error) {
      console.error("[importFunnel] Erro ao inserir audios:", error);
      throw new Error(`Erro ao importar áudios: ${error.message}`);
    }
    console.log("[importFunnel] Audios inseridos com sucesso:", inserted?.length);
  }

  // Insert medias
  if (assets.medias?.length) {
    const rows = assets.medias.map((a: any) => {
      const newId = crypto.randomUUID();
      idMap[a.id] = newId;
      return { id: newId, name: a.name, storage_path: a.storage_path ?? null, mime: a.mime ?? null, bytes: a.bytes ?? null, user_id: userId };
    });
    console.log("[importFunnel] Inserindo medias:", rows.length, rows);
    const { data: inserted, error } = await supabase.from("medias").insert(rows).select();
    if (error) {
      console.error("[importFunnel] Erro ao inserir medias:", error);
      throw new Error(`Erro ao importar mídias: ${error.message}`);
    }
    console.log("[importFunnel] Medias inseridas com sucesso:", inserted?.length);
  }

  // Insert documents
  if (assets.documents?.length) {
    const rows = assets.documents.map((a: any) => {
      const newId = crypto.randomUUID();
      idMap[a.id] = newId;
      return { id: newId, name: a.name, storage_path: a.storage_path ?? null, mime: a.mime ?? null, bytes: a.bytes ?? null, user_id: userId };
    });
    console.log("[importFunnel] Inserindo documents:", rows.length, rows);
    const { data: inserted, error } = await supabase.from("documents").insert(rows).select();
    if (error) {
      console.error("[importFunnel] Erro ao inserir documents:", error);
      throw new Error(`Erro ao importar documentos: ${error.message}`);
    }
    console.log("[importFunnel] Documents inseridos com sucesso:", inserted?.length);
  }

  console.log("[importFunnel] idMap completo:", idMap);

  // Create funnel
  const newFunnelId = crypto.randomUUID();
  const { error: funnelErr } = await supabase.from("funnels").insert({
    id: newFunnelId,
    name: data.funnel.name,
    favorite: data.funnel.favorite ?? false,
    user_id: userId,
  });
  if (funnelErr) {
    console.error("[importFunnel] Erro ao criar funil:", funnelErr);
    throw new Error(`Erro ao criar funil: ${funnelErr.message}`);
  }
  console.log("[importFunnel] Funil criado:", newFunnelId);

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
    console.log("[importFunnel] Inserindo funnel_items:", itemRows.length, itemRows);
    const { error } = await supabase.from("funnel_items").insert(itemRows);
    if (error) {
      console.error("[importFunnel] Erro ao criar funnel_items:", error);
      throw new Error(`Erro ao criar itens do funil: ${error.message}`);
    }
    console.log("[importFunnel] Funnel items criados com sucesso");
  }

  // Backup record
  await supabase.from("backups").insert({
    name: `Import: ${data.funnel.name}`,
    user_id: userId,
    source: "funnel-import",
    funnel_id: newFunnelId,
    status: "ready",
  });

  console.log("[importFunnel] Importação concluída com sucesso!");
  return newFunnelId;
}
