
-- Clean orphaned funnel_items whose assets no longer exist
DELETE FROM funnel_items fi
WHERE fi.type = 'mensagem' AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.id = fi.asset_id);

DELETE FROM funnel_items fi
WHERE fi.type = 'audio' AND NOT EXISTS (SELECT 1 FROM audios a WHERE a.id = fi.asset_id);

DELETE FROM funnel_items fi
WHERE fi.type = 'midia' AND NOT EXISTS (SELECT 1 FROM medias m WHERE m.id = fi.asset_id);

DELETE FROM funnel_items fi
WHERE fi.type = 'documento' AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = fi.asset_id);

-- Create a function to automatically clean orphaned funnel_items
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_funnel_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM funnel_items
  WHERE asset_id = OLD.id;
  RETURN OLD;
END;
$$;

-- Triggers on each asset table to cascade delete funnel_items
DROP TRIGGER IF EXISTS trg_cleanup_funnel_items_messages ON messages;
CREATE TRIGGER trg_cleanup_funnel_items_messages
  AFTER DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION cleanup_orphaned_funnel_items();

DROP TRIGGER IF EXISTS trg_cleanup_funnel_items_audios ON audios;
CREATE TRIGGER trg_cleanup_funnel_items_audios
  AFTER DELETE ON audios
  FOR EACH ROW EXECUTE FUNCTION cleanup_orphaned_funnel_items();

DROP TRIGGER IF EXISTS trg_cleanup_funnel_items_medias ON medias;
CREATE TRIGGER trg_cleanup_funnel_items_medias
  AFTER DELETE ON medias
  FOR EACH ROW EXECUTE FUNCTION cleanup_orphaned_funnel_items();

DROP TRIGGER IF EXISTS trg_cleanup_funnel_items_documents ON documents;
CREATE TRIGGER trg_cleanup_funnel_items_documents
  AFTER DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION cleanup_orphaned_funnel_items();
