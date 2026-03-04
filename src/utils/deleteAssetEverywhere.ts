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
}: DeleteAssetEverywhereParams): Promise<DeleteAssetEverywhereResult> {
  if (!UUID_REGEX.test(assetId)) {
    return {};
  }

  const table = TABLE_BY_ASSET_TYPE[assetType];
  let row: AssetRow;
  let rows: Array<{ id: string; storage_path?: string | null }> = [];

  if (table === "messages") {
    const { data: targetRow, error: targetError } = await supabase
      .from("messages")
      .select("id, name, user_id")
      .eq("id", assetId)
      .maybeSingle();

    if (targetError) {
      throw new Error(`Erro ao buscar asset para exclusão: ${targetError.message}`);
    }

    if (!targetRow) {
      return {};
    }

    row = targetRow as unknown as AssetRow;

    const { data: rowsWithSameName, error: rowsError } = await supabase
      .from("messages")
      .select("id")
      .eq("user_id", row.user_id)
      .eq("name", row.name);

    if (rowsError) {
      throw new Error(`Erro ao buscar duplicatas para exclusão: ${rowsError.message}`);
    }

    rows = ((rowsWithSameName ?? []) as unknown as Array<{ id: string }>).map((item) => ({ id: item.id }));
  } else {
    const fileTable = table as "audios" | "medias" | "documents";

    const { data: targetRow, error: targetError } = await supabase
      .from(fileTable)
      .select("id, name, user_id, storage_path")
      .eq("id", assetId)
      .maybeSingle();

    if (targetError) {
      throw new Error(`Erro ao buscar asset para exclusão: ${targetError.message}`);
    }

    if (!targetRow) {
      return {};
    }

    row = targetRow as unknown as AssetRow;

    const { data: rowsWithSameName, error: rowsError } = await supabase
      .from(fileTable)
      .select("id, storage_path")
      .eq("user_id", row.user_id)
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
