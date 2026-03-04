import { supabase } from "@/integrations/supabase/client";

interface ExportSections {
  mensagens: boolean;
  audios: boolean;
  midias: boolean;
  documentos: boolean;
  funis: boolean;
  gatilhos: boolean;
}

/**
 * Fetches ALL user data directly from Supabase and builds a complete backup object.
 * This ensures the export is always accurate regardless of local UI state.
 */
export async function exportFullBackup(sections: ExportSections): Promise<Record<string, unknown>> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Erro de autenticação: ${authError.message}`);
  if (!user) throw new Error("Usuário não autenticado.");

  const backup: Record<string, unknown> = {
    version: 2,
    createdAt: new Date().toISOString(),
    source: "risezap",
  };

  // Fetch assets in parallel
  const [messagesRes, audiosRes, mediasRes, documentsRes] = await Promise.all([
    sections.mensagens
      ? supabase.from("messages").select("id, name, content").order("created_at", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    sections.audios
      ? supabase.from("audios").select("id, name, storage_path, mime, bytes, metadata").order("created_at", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    sections.midias
      ? supabase.from("medias").select("id, name, storage_path, mime, bytes, metadata").order("created_at", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    sections.documentos
      ? supabase.from("documents").select("id, name, storage_path, mime, bytes").order("created_at", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (messagesRes.error) throw new Error(`Erro ao buscar mensagens: ${messagesRes.error.message}`);
  if (audiosRes.error) throw new Error(`Erro ao buscar áudios: ${audiosRes.error.message}`);
  if (mediasRes.error) throw new Error(`Erro ao buscar mídias: ${mediasRes.error.message}`);
  if (documentsRes.error) throw new Error(`Erro ao buscar documentos: ${documentsRes.error.message}`);

  if (sections.mensagens) backup.mensagens = messagesRes.data ?? [];
  if (sections.audios) backup.audios = audiosRes.data ?? [];
  if (sections.midias) backup.midias = mediasRes.data ?? [];
  if (sections.documentos) backup.documentos = documentsRes.data ?? [];

  // Funnels: fetch funnels + their items
  if (sections.funis) {
    const { data: funnels, error: fErr } = await supabase
      .from("funnels")
      .select("id, name, favorite")
      .order("created_at", { ascending: true });

    if (fErr) throw new Error(`Erro ao buscar funis: ${fErr.message}`);

    const funnelIds = (funnels ?? []).map((f) => f.id);

    let allItems: Array<{
      id: string;
      funnel_id: string;
      type: string;
      asset_id: string;
      delay_min: number;
      delay_sec: number;
      position: number;
    }> = [];

    if (funnelIds.length > 0) {
      const { data: items, error: iErr } = await supabase
        .from("funnel_items")
        .select("id, funnel_id, type, asset_id, delay_min, delay_sec, position")
        .in("funnel_id", funnelIds)
        .order("position", { ascending: true });

      if (iErr) throw new Error(`Erro ao buscar itens de funis: ${iErr.message}`);
      allItems = (items ?? []) as typeof allItems;
    }

    // Group items by funnel_id
    const itemsByFunnel = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const list = itemsByFunnel.get(item.funnel_id) ?? [];
      list.push(item);
      itemsByFunnel.set(item.funnel_id, list);
    }

    backup.funis = (funnels ?? []).map((funnel) => ({
      id: funnel.id,
      name: funnel.name,
      favorite: funnel.favorite,
      items: (itemsByFunnel.get(funnel.id) ?? []).map((item) => ({
        type: item.type,
        asset_id: item.asset_id,
        delay_min: item.delay_min,
        delay_sec: item.delay_sec,
        position: item.position,
      })),
    }));
  }

  // Triggers
  if (sections.gatilhos) {
    const { data: triggers, error: tErr } = await supabase
      .from("triggers")
      .select("id, name, enabled, favorite, conditions, funnel_id, delay_seconds, send_to_groups, saved_contacts_only, ignore_case, position")
      .order("position", { ascending: true });

    if (tErr) throw new Error(`Erro ao buscar gatilhos: ${tErr.message}`);
    backup.gatilhos = triggers ?? [];
  }

  return backup;
}
