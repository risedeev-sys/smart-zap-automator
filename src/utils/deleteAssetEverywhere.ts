import { supabase } from "@/integrations/supabase/client";

export type AssetType = "mensagem" | "audio" | "midia" | "documento";

const TABLE_BY_ASSET_TYPE: Record<AssetType, "messages" | "audios" | "medias" | "documents"> = {
  mensagem: "messages",
  audio: "audios",
  midia: "medias",
  documento: "documents",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface DeleteAssetEverywhereParams {
  assetType: AssetType;
  assetId: string;
  assetName?: string;
}

interface DeleteAssetEverywhereResult {
  storageWarning?: string;
}

type AssetRow = {
  id: string;
  name: string;
  user_id: string;
  storage_path?: string | null;
};

export async function deleteAssetEverywhere({
  assetType,
  assetId,
  assetName,
}: DeleteAssetEverywhereParams): Promise<DeleteAssetEverywhereResult> {
  const table = TABLE_BY_ASSET_TYPE[assetType];
  const normalizedAssetName = String(assetName || "").trim();
  const isUuidAssetId = UUID_REGEX.test(assetId);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw new Error(`Erro de autenticação ao excluir asset: ${authError.message}`);
  }
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const userId = user.id;
  let row: AssetRow;
  let rows: Array<{ id: string; storage_path?: string | null }> = [];

  if (!isUuidAssetId && !normalizedAssetName) {
    throw new Error("Não foi possível identificar o asset para exclusão (ID inválido sem nome).");
  }

  if (table === "messages") {
    let targetRow: AssetRow | null = null;

    if (isUuidAssetId) {
      const { data, error } = await supabase
        .from("messages")
        .select("id, name, user_id")
        .eq("id", assetId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao buscar asset para exclusão: ${error.message}`);
      }

      targetRow = (data as unknown as AssetRow) ?? null;
    }

    if (!targetRow && normalizedAssetName) {
      const { data, error } = await supabase
        .from("messages")
        .select("id, name, user_id")
        .eq("user_id", userId)
        .eq("name", normalizedAssetName)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao localizar asset por nome: ${error.message}`);
      }

      targetRow = (data as unknown as AssetRow) ?? null;
    }

    if (!targetRow && !normalizedAssetName) {
      return {};
    }

    row = targetRow ?? { id: assetId, name: normalizedAssetName, user_id: userId };

    const { data: rowsWithSameName, error: rowsError } = await supabase
      .from("messages")
      .select("id")
      .eq("user_id", userId)
      .eq("name", row.name);

    if (rowsError) {
      throw new Error(`Erro ao buscar duplicatas para exclusão: ${rowsError.message}`);
    }

    rows = ((rowsWithSameName ?? []) as unknown as Array<{ id: string }>).map((item) => ({ id: item.id }));
  } else {
    const fileTable = table as "audios" | "medias" | "documents";
    let targetRow: AssetRow | null = null;

    if (isUuidAssetId) {
      const { data, error } = await supabase
        .from(fileTable)
        .select("id, name, user_id, storage_path")
        .eq("id", assetId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao buscar asset para exclusão: ${error.message}`);
      }

      targetRow = (data as unknown as AssetRow) ?? null;
    }

    if (!targetRow && normalizedAssetName) {
      const { data, error } = await supabase
        .from(fileTable)
        .select("id, name, user_id, storage_path")
        .eq("user_id", userId)
        .eq("name", normalizedAssetName)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao localizar asset por nome: ${error.message}`);
      }

      targetRow = (data as unknown as AssetRow) ?? null;
    }

    if (!targetRow && !normalizedAssetName) {
      return {};
    }

    row = targetRow ?? { id: assetId, name: normalizedAssetName, user_id: userId };

    const { data: rowsWithSameName, error: rowsError } = await supabase
      .from(fileTable)
      .select("id, storage_path")
      .eq("user_id", userId)
      .eq("name", row.name);

    if (rowsError) {
      throw new Error(`Erro ao buscar duplicatas para exclusão: ${rowsError.message}`);
    }

    rows = (rowsWithSameName ?? []) as unknown as Array<{ id: string; storage_path?: string | null }>;
  }

  const idsToDelete = rows.map((item) => item.id);

  if (idsToDelete.length === 0) {
    return {};
  }

  const [refsResult, assetResult] = await Promise.all([
    supabase.from("funnel_items").delete().eq("type", assetType).in("asset_id", idsToDelete),
    supabase.from(table as any).delete().in("id", idsToDelete),
  ]);

  if (refsResult.error) {
    throw new Error(`Erro ao remover referências em funis: ${refsResult.error.message}`);
  }

  if (assetResult.error) {
    throw new Error(`Erro ao excluir asset: ${assetResult.error.message}`);
  }

  if (table === "messages") {
    return {};
  }

  const storagePaths = rows
    .map((item) => item.storage_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);

  if (storagePaths.length === 0) {
    return {};
  }

  const { error: storageError } = await supabase.storage.from("assets").remove(storagePaths);
  if (storageError) {
    return { storageWarning: storageError.message };
  }

  return {};
}
