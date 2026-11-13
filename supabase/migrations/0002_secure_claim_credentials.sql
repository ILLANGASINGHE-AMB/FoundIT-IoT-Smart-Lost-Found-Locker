create or replace function public.store_claim_secret(
    p_claim_id uuid,
    p_credential_hash text,
    p_credential_salt text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into private.claim_secrets (
        claim_id,
        credential_hash,
        credential_salt
    )
    values (
        p_claim_id,
        p_credential_hash,
        p_credential_salt
    );
end;
$$;

revoke all on function public.store_claim_secret(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.store_claim_secret(uuid, text, text)
to service_role;
