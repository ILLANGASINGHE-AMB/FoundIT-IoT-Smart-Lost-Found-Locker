BEGIN;

ALTER TABLE public.lost_items
ADD CONSTRAINT lost_items_title_not_blank
CHECK (length(trim(title)) > 0),

ADD CONSTRAINT lost_items_description_not_blank
CHECK (length(trim(description)) > 0);

ALTER TABLE public.found_items
ADD CONSTRAINT found_items_title_not_blank
CHECK (length(trim(title)) > 0),

ADD CONSTRAINT found_items_description_not_blank
CHECK (length(trim(description)) > 0);

COMMIT;
