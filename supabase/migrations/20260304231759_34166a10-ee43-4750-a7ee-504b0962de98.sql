
-- Delete all duplicate/orphaned medias that user tried to delete
-- Keep only medias that are currently referenced by funnel_items
DELETE FROM medias 
WHERE id NOT IN (
  SELECT DISTINCT asset_id FROM funnel_items WHERE type = 'midia'
)
AND name IN (
  'Video da comunidade', 'video da comunidade', 'video',
  'AA', 'aaa', 'aaaa', 'nbhgff', 'a',
  'midia tst vizu unica',
  'AA (cópia)', 'AA (cópia) (cópia)', 'AA (cópia) (cópia) (cópia)',
  'AA (cópia) (cópia) (cópia) (cópia) (cópia)',
  'AA (cópia) (cópia) (cópia) (cópia) (cópia) (cópia)',
  'AA (cópia) (cópia) (cópia) (cópia) (cópia) (cópia) (cópia)',
  'AA (cópia) (cópia) (cópia) (cópia) (cópia) (cópia) (cópia) (cópia)',
  'AA (cópia) (cópia) (cópia) (cópia) (cópia) (cópia) (cópia) (cópia) (cópia)'
);
