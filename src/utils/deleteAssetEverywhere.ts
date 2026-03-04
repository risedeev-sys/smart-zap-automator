import { supabase } from "@/integrations/supabase/client";

export type AssetType = "mensagem" | "audio" | "midia" | "documento";

const TABLE_BY_ASSET_TYPE: Record<AssetType, "messages" | "audios" | "medias" | "documents"> = {
  mensagem: "messages",
  audio: "audios",
  midia: "medias",
  documento: "documents",
};

const FILE_ASSET_TABLES = new Set(["audios", "medias", "documents"] as const);
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface DeleteAssetEverywhereParams {
  assetType: AssetType;
  assetId: string;
}

interface DeleteAssetEverywhereResult {
  storageWarning?: string;
}

export async function deleteAssetEverywhere({
  assetType,
  assetId,
}: DeleteAssetEverywhereParams): Promise<DeleteAssetEverywhereResult> {
  if (!UUID_REGEX.test(assetId)) {
    return {};
  }

  const table = TABLE_BY_ASSET_TYPE[assetType];

  let storagePath: string | null = null;
  if (FILE_ASSET_TABLES.has(table)) {
    const { data } = await supabase
      .from(table as "audios" | "medias" | "documents")
      .select("storage_path")
      .eq("id", assetId)
      .maybeSingle();

    storagePath = (data as { storage_path: string | null } | null)?.storage_path ?? null;
  }

  const [refsResult, assetResult] = await Promise.all([
    supabase.from("funnel_items").delete().eq("type", assetType).eq("asset_id", assetId),
    supabase.from(table).delete().eq("id", assetId),
  ]);

  if (refsResult.error) {
    throw new Error(`Erro ao remover referências em funis: ${refsResult.error.message}`);
  }

  if (assetResult.error) {
    throw new Error(`Erro ao excluir asset: ${assetResult.error.message}`);
  }

  if (!storagePath) {
    return {};
  }

  const { error: storageError } = await supabase.storage.from("assets").remove([storagePath]);
  if (storageError) {
    return { storageWarning: storageError.message };
  }

  return {};
}
