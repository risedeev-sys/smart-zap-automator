import { createLogger } from "../_shared/logger.ts";
import { handleCors } from "../_shared/cors.ts";
import { sanitizeString, sanitizeUUID } from "../_shared/sanitizer.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

const log = createLogger("AssetsManager");

// Valid tables
const VALID_TABLES = ["audios", "medias", "documents"];

Deno.serve(async (req: Request) => {
    // 1. CORS Preflight & Headers
    const corsResult = handleCors(req);
    if (corsResult instanceof Response) return corsResult;
    const corsHeaders = corsResult.headers;

    const createSuccess = (data: any) => new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const createError = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    try {
        // Only accept POST
        if (req.method !== "POST") return createError("Method not allowed", 405);

        // 2. Auth via JWT
        let supabase;
        try {
            supabase = getSupabaseClient(req);
        } catch {
            return createError("Unauthorized", 401);
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            log.warn("Auth failed", { error: authError?.message });
            return createError("Unauthorized", 401);
        }

        // 3. Parse and Sanitize Input
        const body = await req.json().catch(() => null);
        if (!body) return createError("Invalid JSON body", 400);

        const action = sanitizeString(body.action);
        const table = sanitizeString(body.table);
        // assetId will not be required for 'list' action
        const assetId = body.asset_id ? sanitizeUUID(body.asset_id) : null;

        if (!VALID_TABLES.includes(table)) return createError("Invalid table");
        if (!assetId && action !== "list") return createError("Invalid asset_id");

        log.info(`Asset Action requested: ${action}`, { table, assetId, uid: user.id });

        // ACTION: LIST
        if (action === "list") {
            const { data, error } = await supabase
                .from(table)
                .select("*")
                .eq("user_id", user.id) // Enforce tenant isolation strictly
                .order("created_at", { ascending: true });

            if (error) throw error;
            return createSuccess({ data });
        }

        // ACTION: DELETE
        if (action === "delete") {
            // 1. Fetch record to get storage_path
            const { data: original, error: fetchErr } = await supabase.from(table).select("storage_path").eq("id", assetId).single();
            if (fetchErr) throw fetchErr;

            // 2. Delete from DB
            const { error: deleteErr } = await supabase.from(table).delete().eq("id", assetId);
            if (deleteErr) throw deleteErr;

            // 3. Delete from Storage if it had a path
            let storageWarning = null;
            if (original?.storage_path) {
                const { error: storageErr } = await supabase.storage.from("assets").remove([original.storage_path]);
                if (storageErr) {
                    log.warn("Failed to delete storage file, but DB record removed", { err: storageErr.message });
                    storageWarning = storageErr.message;
                }
            }

            return createSuccess({ message: "Asset deleted", storageWarning });
        }

        // ACTION: TOGGLE FAVORITE
        if (action === "toggle_favorite") {
            // Get current state
            const { data: current, error: fetchErr } = await supabase.from(table).select("favorite").eq("id", assetId).single();
            if (fetchErr) throw fetchErr;

            const { data, error } = await supabase
                .from(table)
                .update({ favorite: !current.favorite })
                .eq("id", assetId)
                .select()
                .single();

            if (error) throw error;
            return createSuccess({ message: "Favorite toggled", data });
        }

        // ACTION: RENAME
        if (action === "rename") {
            const newName = sanitizeString(body.new_name, 255);
            if (!newName) return createError("Invalid or empty new_name");

            const { data, error } = await supabase
                .from(table)
                .update({ name: newName })
                .eq("id", assetId)
                .select()
                .single();

            if (error) throw error;
            return createSuccess({ message: "Asset renamed", data });
        }

        // ACTION: DUPLICATE (Full physical clone to avoid ghost records)
        if (action === "duplicate") {
            // 1. Fetch original record
            const { data: original, error: fetchErr } = await supabase.from(table).select("*").eq("id", assetId).single();
            if (fetchErr || !original) throw fetchErr || new Error("Record not found");

            // 2. Insert new record to get a fresh UUID
            const newName = sanitizeString(`${original.name} (cópia)`, 255);

            // To clone properly, we need the storage path
            const oldStoragePath = original.storage_path; // e.g., "uid/audios/uuid.ogg"

            if (!oldStoragePath) {
                // If it implies it's a text/link only, just clone the DB row
                original.id = undefined;
                original.created_at = undefined;
                original.name = newName;

                const { data: clonedRow, error: cloneErr } = await supabase.from(table).insert(original).select().single();
                if (cloneErr) throw cloneErr;
                return createSuccess({ message: "Asset duplicated (No file)", data: clonedRow });
            }

            // Generate a new fake UUID just for the path or use crypto
            const newAssetId = crypto.randomUUID();
            const extension = oldStoragePath.split('.').pop();
            const newStoragePath = `${user.id}/${table}/${newAssetId}.${extension}`;

            // 3. Clone file in Storage physically (this guarantees true isolation!)
            const { error: storageErr } = await supabase.storage.from("assets").copy(oldStoragePath, newStoragePath);
            if (storageErr) {
                log.error("Storage Copy Failed", { err: storageErr.message });
                throw new Error("Failed to clone file in storage");
            }

            // 4. Create new DB record pointing to new file
            const newRecord = {
                ...original,
                id: newAssetId,
                created_at: undefined, // Let DB generate
                name: newName,
                storage_path: newStoragePath
            };

            const { data: finalRecord, error: insertErr } = await supabase.from(table).insert(newRecord).select().single();
            if (insertErr) {
                // Rollback storage if DB fails
                await supabase.storage.from("assets").remove([newStoragePath]);
                throw insertErr;
            }

            return createSuccess({ message: "Asset fully duplicated", data: finalRecord });
        }

        return createError("Unknown Action", 400);
    } catch (error: any) {
        log.error("Edge Function Exception", { err: error.message, stack: error.stack });
        return createError(error.message || "Internal Server Error", 500);
    }
});
