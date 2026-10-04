CREATE INDEX idx_lost_items_status
    ON public.lost_items(status);

CREATE INDEX idx_lost_items_user_id
    ON public.lost_items(user_id);

CREATE INDEX idx_found_items_status
    ON public.found_items(status);

CREATE INDEX idx_found_items_finder_id
    ON public.found_items(finder_id);