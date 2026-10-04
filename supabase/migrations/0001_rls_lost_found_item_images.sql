-- 0001_rls_lost_found_item_images.sql
-- Lost & Found RLS policies and indexes (Member 2 scope)

-- Enable RLS on tables (assumes tables exist; if not, add CREATE TABLEs as needed)
ALTER TABLE lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE found_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;

-- LOST_ITEMS
-- INSERT: auth users only, user_id = auth.uid()
DROP POLICY IF EXISTS "lost_items_insert_auth" ON lost_items;
CREATE POLICY "lost_items_insert_auth" ON lost_items
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- SELECT: owner sees all (including private_ownership_info); non-owner sees non-private fields only
-- Note: We cannot use column-level SELECT restrictions in a single simple policy for all columns;
-- instead we allow SELECT and rely on the application to select explicit columns, or create separate views.
-- For RLS, the policy controls rows; to exclude columns for non-owners, application must avoid selecting:
--   private_ownership_info, identifier_hmac, claim_code_hash for non-owners.
DROP POLICY IF EXISTS "lost_items_select_owner" ON lost_items;
CREATE POLICY "lost_items_select_owner" ON lost_items
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lost_items_select_public" ON lost_items;
CREATE POLICY "lost_items_select_public" ON lost_items
  FOR SELECT
  USING (true);

-- UPDATE: owner (limited while status='LOST'); admin all. No DELETE (use status='CANCELLED')
-- Simplified: allow owner to update rows where status = 'LOST' (app enforces limited fields);
-- admins: if using role 'service_role' via auth or a custom claim, adjust. Using uid check + app logic is fine.
DROP POLICY IF EXISTS "lost_items_update_owner" ON lost_items;
CREATE POLICY "lost_items_update_owner" ON lost_items
  FOR UPDATE
  USING (user_id = auth.uid() AND status = 'LOST')
  WITH CHECK (user_id = auth.uid());

-- Optional admin: uncomment if you have is_admin() helper
-- DROP POLICY IF EXISTS "lost_items_update_admin" ON lost_items;
-- CREATE POLICY "lost_items_update_admin" ON lost_items
--   FOR UPDATE
--   USING (public.is_admin(auth.uid()))
--   WITH CHECK (public.is_admin(auth.uid()));

-- DELETE: prevent deletion
DROP POLICY IF EXISTS "lost_items_no_delete" ON lost_items;
CREATE POLICY "lost_items_no_delete" ON lost_items
  FOR DELETE
  USING (false);

-- FOUND_ITEMS
ALTER TABLE found_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "found_items_insert_auth" ON found_items;
CREATE POLICY "found_items_insert_auth" ON found_items
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND finder_id = auth.uid());

DROP POLICY IF EXISTS "found_items_select_owner" ON found_items;
CREATE POLICY "found_items_select_owner" ON found_items
  FOR SELECT
  USING (finder_id = auth.uid());

DROP POLICY IF EXISTS "found_items_select_public" ON found_items;
CREATE POLICY "found_items_select_public" ON found_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "found_items_update_owner" ON found_items;
CREATE POLICY "found_items_update_owner" ON found_items
  FOR UPDATE
  USING (finder_id = auth.uid())
  WITH CHECK (finder_id = auth.uid());

DROP POLICY IF EXISTS "found_items_no_delete" ON found_items;
CREATE POLICY "found_items_no_delete" ON found_items
  FOR DELETE
  USING (false);

-- ITEM_IMAGES
DROP POLICY IF EXISTS "item_images_select_public" ON item_images;
CREATE POLICY "item_images_select_public" ON item_images
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "item_images_insert_auth" ON item_images;
CREATE POLICY "item_images_insert_auth" ON item_images
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND uploader_id = auth.uid());

DROP POLICY IF EXISTS "item_images_delete_owner" ON item_images;
CREATE POLICY "item_images_delete_owner" ON item_images
  FOR DELETE
  USING (auth.role() = 'authenticated' AND uploader_id = auth.uid());

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON lost_items(status);
CREATE INDEX IF NOT EXISTS idx_lost_items_user_id ON lost_items(user_id);
CREATE INDEX IF NOT EXISTS idx_found_items_status ON found_items(status);
CREATE INDEX IF NOT EXISTS idx_found_items_finder_id ON found_items(finder_id);
CREATE INDEX IF NOT EXISTS idx_item_images_item ON item_images(lost_item_id) WHERE lost_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_images_found_item ON item_images(found_item_id) WHERE found_item_id IS NOT NULL;
