import { supabase } from "@/integrations/supabase/client";

type AssetTable = "audios" | "medias" | "documents";

interface UploadResult {
  storagePath: string;
}

/**
 * Uploads a file to Supabase Storage (assets bucket) and updates
 * the corresponding record's storage_path, mime, and bytes.
 */
export async function uploadAssetFile(
  table: AssetTable,
  recordId: string,
  file: File,
  userId: string,
): Promise<UploadResult> {
  const ext = file.name.split(".").pop() ?? "";
  const storagePath = `${userId}/${table}/${recordId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("assets")
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (uploadErr) throw new Error(`Erro no upload: ${uploadErr.message}`);

  const { error: updateErr } = await supabase
    .from(table)
    .update({
      storage_path: storagePath,
      mime: file.type || null,
      bytes: file.size || null,
    })
    .eq("id", recordId);

  if (updateErr) throw new Error(`Erro ao atualizar registro: ${updateErr.message}`);

  return { storagePath };
}
