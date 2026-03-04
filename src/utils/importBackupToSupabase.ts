import { supabase } from "@/integrations/supabase/client";

/**
 * Persists a full backup into Supabase with proper ID remapping.
 * Handles: messages, audios, medias, documents, funnels+items, triggers.
 * All IDs are regenerated and cross-references are remapped.
 */
export async function importBackupToSupabase(rawData: Record<string, any>): Promise<{
  counts: Record<string, number>;
}> {
  console.log("[importBackupToSupabase] Iniciado");

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Erro de autenticação: ${authError.message}`);
  if (!user) throw new Error("Usuário não autenticado.");
  const userId = user.id;

  // Clean all user data
  console.log("[importBackupToSupabase] Limpando dados existentes do usuário...");
  const tablesToClean = ["funnel_items", "funnels", "triggers", "messages", "audios", "medias", "documents"] as const;
  for (const table of tablesToClean) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Erro ao limpar ${table}: ${error.message}`);
    console.log(`[importBackupToSupabase] ${table} limpo`);
  }

  const idMap: Record<string, string> = {};
  const funnelIdMap: Record<string, string> = {};
  const counts: Record<string, number> = {};

  // Helper: batch insert assets
  async function insertAssets(
    key: string,
    table: string,
    items: any[] | undefined,
    buildRow: (item: any, newId: string) => Record<string, any>,
  ) {
    if (!items?.length) return;
    const rows = items.map((item) => {
      const newId = crypto.randomUUID();
      if (item.id) idMap[item.id] = newId;
      return buildRow(item, newId);
    });
    const { data: inserted, error } = await supabase.from(table as any).insert(rows).select();
    if (error) throw new Error(`Erro ao importar ${key}: ${error.message}`);
    counts[key] = inserted?.length ?? 0;
    console.log(`[importBackupToSupabase] ${table}: ${counts[key]} inseridos`);
  }

  // Messages
  await insertAssets("mensagens", "messages", rawData.mensagens ?? rawData.messages, (item, newId) => ({
    id: newId,
    name: item.name,
    content: item.content ?? null,
    user_id: userId,
  }));

  // Audios (preserve metadata)
  await insertAssets("audios", "audios", rawData.audios, (item, newId) => ({
    id: newId,
    name: item.name,
    storage_path: item.storage_path ?? null,
    mime: item.mime ?? item.fileType ?? null,
    bytes: item.bytes ?? null,
    metadata: item.metadata ?? {},
    user_id: userId,
  }));

  // Medias (preserve metadata)
  await insertAssets("midias", "medias", rawData.midias ?? rawData.medias, (item, newId) => ({
    id: newId,
    name: item.name,
    storage_path: item.storage_path ?? null,
    mime: item.mime ?? item.fileType ?? null,
    bytes: item.bytes ?? null,
    metadata: item.metadata ?? {},
    user_id: userId,
  }));

  // Documents
  await insertAssets("documentos", "documents", rawData.documentos ?? rawData.docs ?? rawData.documents, (item, newId) => ({
    id: newId,
    name: item.name,
    storage_path: item.storage_path ?? null,
    mime: item.mime ?? item.fileType ?? null,
    bytes: item.bytes ?? null,
    user_id: userId,
  }));

  // Funnels + items
  const rawFunnels = rawData.funis ?? rawData.funnels;
  if (rawFunnels?.length) {
    for (const funnel of rawFunnels) {
      const newFunnelId = crypto.randomUUID();
      if (funnel.id) funnelIdMap[funnel.id] = newFunnelId;

      const { error: fErr } = await supabase.from("funnels").insert({
        id: newFunnelId,
        name: funnel.name,
        favorite: funnel.favorite ?? false,
        user_id: userId,
      });
      if (fErr) throw new Error(`Erro ao criar funil: ${fErr.message}`);

      const funnelItems = funnel.items as any[] | undefined;
      if (funnelItems?.length) {
        const itemRows = funnelItems.map((item: any, idx: number) => {
          const originalAssetId = item.assetId ?? item.asset_id;
          const remappedAssetId = idMap[originalAssetId] ?? originalAssetId;

          return {
            funnel_id: newFunnelId,
            user_id: userId,
            type: item.type,
            asset_id: remappedAssetId,
            delay_min: item.delayMin ?? item.delay_min ?? 0,
            delay_sec: item.delaySec ?? item.delay_sec ?? 0,
            position: item.position ?? idx,
          };
        });

        const { error: iErr } = await supabase.from("funnel_items").insert(itemRows);
        if (iErr) {
          console.error("[importBackupToSupabase] Erro funnel_items:", iErr);
          throw new Error(`Erro ao criar itens do funil: ${iErr.message}`);
        }
      }
    }
    counts["funis"] = rawFunnels.length;
    console.log(`[importBackupToSupabase] ${rawFunnels.length} funis criados`);
  }

  // Triggers (remap funnel_id!)
  const rawTriggers = rawData.gatilhos ?? rawData.triggers;
  if (rawTriggers?.length) {
    for (const trigger of rawTriggers) {
      const originalFunnelId = trigger.funnel_id ?? trigger.funnelId ?? null;
      const remappedFunnelId = originalFunnelId ? (funnelIdMap[originalFunnelId] ?? null) : null;

      const { error } = await supabase.from("triggers").insert({
        name: trigger.name,
        enabled: trigger.enabled ?? true,
        favorite: trigger.favorite ?? false,
        conditions: trigger.conditions ?? [],
        funnel_id: remappedFunnelId,
        delay_seconds: trigger.delay_seconds ?? trigger.delaySeconds ?? 0,
        send_to_groups: trigger.send_to_groups ?? trigger.sendToGroups ?? false,
        saved_contacts_only: trigger.saved_contacts_only ?? trigger.savedContactsOnly ?? false,
        ignore_case: trigger.ignore_case ?? trigger.ignoreCase ?? true,
        position: trigger.position ?? 0,
        user_id: userId,
      });
      if (error) {
        console.error("[importBackupToSupabase] Erro ao criar trigger:", error);
      }
    }
    counts["gatilhos"] = rawTriggers.length;
    console.log(`[importBackupToSupabase] ${rawTriggers.length} gatilhos criados`);
  }

  console.log("[importBackupToSupabase] Concluído. Counts:", counts);
  return { counts };
}
