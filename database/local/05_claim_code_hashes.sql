BEGIN;

CREATE SCHEMA IF NOT EXISTS foundit_private;

REVOKE ALL ON SCHEMA foundit_private FROM PUBLIC;

CREATE TABLE foundit_private.lost_item_claim_codes (
    lost_item_id UUID PRIMARY KEY
        REFERENCES public.lost_items(id)
        ON DELETE CASCADE,

    code_hash TEXT NOT NULL
        CHECK (code_hash ~ '^[0-9a-f]{64}$'),

    hash_version TEXT NOT NULL DEFAULT 'sha256-v1'
        CHECK (hash_version = 'sha256-v1'),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL
ON TABLE foundit_private.lost_item_claim_codes
FROM PUBLIC;

COMMIT;