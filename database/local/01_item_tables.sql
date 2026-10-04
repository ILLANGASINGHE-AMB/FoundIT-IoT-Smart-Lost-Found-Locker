-- FoundIT:  local database draft.
-- Run once in an empty PostgreSQL database.


BEGIN;

CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE public.lost_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    category_id UUID NOT NULL
        REFERENCES public.categories(id),

    location_id UUID NOT NULL
        REFERENCES public.locations(id),

    title TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    color TEXT,
    description TEXT NOT NULL,
    date_lost DATE NOT NULL,

    status TEXT NOT NULL DEFAULT 'LOST'
        CHECK (status IN ('LOST', 'RESOLVED', 'CANCELLED')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.found_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finder_id UUID NOT NULL,

    category_id UUID NOT NULL
        REFERENCES public.categories(id),

    location_id UUID NOT NULL
        REFERENCES public.locations(id),

    title TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    color TEXT,
    description TEXT NOT NULL,
    date_found DATE NOT NULL,

    status TEXT NOT NULL DEFAULT 'FOUND'
        CHECK (
            status IN (
                'FOUND',
                'RETURNED',
                'UNCLAIMED_EXPIRED',
                'CLOSED'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lost_item_id UUID
        REFERENCES public.lost_items(id),

    found_item_id UUID
        REFERENCES public.found_items(id),

    uploader_id UUID NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        (lost_item_id IS NOT NULL AND found_item_id IS NULL)
        OR
        (lost_item_id IS NULL AND found_item_id IS NOT NULL)
    )
);

COMMIT;