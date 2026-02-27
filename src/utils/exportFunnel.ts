import { supabase } from "@/integrations/supabase/client";

const assetTables: Record<string, string> = {
  mensagem: "messages",
  audio: "audios",
  midia: "medias",
  documento: "documents",
};

export async function exportFunnel(funnelId: string): Promise<void> {
  // 1. Fetch funnel
  const { data: funnel, error: funnelErr } = await supabase
    .from("funnels")
    .select("id, name, favorite")
    .eq("id", funnelId)
    .single();

  if (funnelErr || !funnel) throw new Error("Funil não encontrado");

  // 2. Fetch items
  const { data: items, error: itemsErr } = await supabase
    .from("funnel_items")
    .select("id, type, asset_id, delay_min, delay_sec, position")
    .eq("funnel_id", funnelId)
    .order("position", { ascending: true });

  if (itemsErr) throw new Error("Erro ao buscar itens do funil");

  // 3. Group asset IDs by type
  const idsByType: Record<string, string[]> = {};
  for (const item of items ?? []) {
    const table = assetTables[item.type];
    if (!table) continue;
    if (!idsByType[table]) idsByType[table] = [];
    if (!idsByType[table].includes(item.asset_id)) {
      idsByType[table].push(item.asset_id);
    }
  }

  // 4. Fetch assets in parallel
  const assets: Record<string, any[]> = {
    messages: [],
    audios: [],
    medias: [],
    documents: [],
  };

  const queries = Object.entries(idsByType).map(async ([table, ids]) => {
    if (ids.length === 0) return;
    const { data } = await supabase.from(table as any).select("*").in("id", ids);
    if (data) assets[table] = data;
  });

  await Promise.all(queries);

  // 5. Build export object
  const exportData = {
    version: 1,
    createdAt: new Date().toISOString(),
    funnel,
    items: items ?? [],
    assets,
  };

  // 6. Download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const sanitizedName = funnel.name.replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
  const fileName = `backup-${sanitizedName}.json`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
