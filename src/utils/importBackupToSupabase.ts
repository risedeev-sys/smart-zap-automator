import { supabase } from "@/integrations/supabase/client";

/**
 * Persists a full backup's assets (messages, audios, medias, documents)
 * and funnels into Supabase, with ID remapping.
 */
export async function importBackupToSupabase(rawData: Record<string, any>): Promise<{
  counts: Record<string, number>;
}> {
  console.log("[importBackupToSupabase] Iniciado");

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Erro de autenticação: ${authError.message}`);
  if (!user) throw new Error("Usuário não autenticado.");
  const userId = user.id;

  const idMap: Record<string, string> = {};
  const counts: Record<string, number> = {};

  // Helper: insert assets into a table
  async function insertAssets(
    key: string,
    table: string,
    items: any[] | undefined,
    buildRow: (item: any, newId: string) => Record<string, any>,
  ) {
    if (!items?.length) return;
    const rows = items.map((item) => {
      const newId = crypto.randomUUID();
      idMap[item.id] = newId;
      return buildRow(item, newId);
    });
    console.log(`[importBackupToSupabase] Inserindo ${rows.length} em ${table}`, rows);
    const { data: inserted, error } = await supabase.from(table as any).insert(rows).select();
    if (error) {
      console.error(`[importBackupToSupabase] Erro em ${table}:`, error);
      throw new Error(`Erro ao importar ${key}: ${error.message}`);
    }
    counts[key] = inserted?.length ?? 0;
    console.log(`[importBackupToSupabase] ${table}: ${counts[key]} inseridos`);
  }

  // Messages
  await insertAssets("mensagens", "messages", rawData.mensagens, (item, newId) => ({
    id: newId, name: item.name, content: item.content ?? null, user_id: userId,
  }));

  // Audios
  await insertAssets("audios", "audios", rawData.audios, (item, newId) => ({
    id: newId, name: item.name, storage_path: item.storage_path ?? null,
    mime: item.mime ?? item.fileType ?? null, bytes: item.bytes ?? null, user_id: userId,
  }));

  // Medias
  await insertAssets("midias", "medias", rawData.midias, (item, newId) => ({
    id: newId, name: item.name, storage_path: item.storage_path ?? null,
    mime: item.mime ?? item.fileType ?? null, bytes: item.bytes ?? null, user_id: userId,
  }));

  // Documents
  await insertAssets("documentos", "documents", rawData.documentos, (item, newId) => ({
    id: newId, name: item.name, storage_path: item.storage_path ?? null,
    mime: item.mime ?? item.fileType ?? null, bytes: item.bytes ?? null, user_id: userId,
  }));

  // Funnels
  if (rawData.funis?.length) {
    for (const funnel of rawData.funis) {
      const newFunnelId = crypto.randomUUID();
      const { error: fErr } = await supabase.from("funnels").insert({
        id: newFunnelId, name: funnel.name, favorite: funnel.favorite ?? false, user_id: userId,
      });
      if (fErr) {
        console.error("[importBackupToSupabase] Erro ao criar funil:", fErr);
        throw new Error(`Erro ao criar funil: ${fErr.message}`);
      }

      const funnelItems = funnel.items as any[] | undefined;
      if (funnelItems?.length) {
        const itemRows = funnelItems.map((item: any, idx: number) => ({
          funnel_id: newFunnelId,
          user_id: userId,
          type: item.type,
          asset_id: idMap[item.assetId] ?? idMap[item.asset_id] ?? item.assetId ?? item.asset_id,
          delay_min: item.delayMin ?? item.delay_min ?? 0,
          delay_sec: item.delaySec ?? item.delay_sec ?? 0,
          position: item.position ?? idx,
        }));
        const { error: iErr } = await supabase.from("funnel_items").insert(itemRows);
        if (iErr) {
          console.error("[importBackupToSupabase] Erro funnel_items:", iErr);
          throw new Error(`Erro ao criar itens do funil: ${iErr.message}`);
        }
      }
    }
    counts["funis"] = rawData.funis.length;
    console.log(`[importBackupToSupabase] ${rawData.funis.length} funis criados`);
  }

  console.log("[importBackupToSupabase] Concluído. Counts:", counts);
  return { counts };
}
