CREATE INDEX IF NOT EXISTS idx_item_images_lost_item_id
ON public.item_images (lost_item_id);

CREATE INDEX IF NOT EXISTS idx_item_images_found_item_id
ON public.item_images (found_item_id);