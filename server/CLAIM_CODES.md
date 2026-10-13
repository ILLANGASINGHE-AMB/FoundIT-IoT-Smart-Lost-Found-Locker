# Claim codes — local implementation

## Creation
POST /api/lost-items creates the lost report and its claim-code
record in one PostgreSQL transaction.

The creation response includes claim_code.
The frontend displays it until dismissed or the page is left.
List and details endpoints never return it.

## Storage
Table: foundit_private.lost_item_claim_codes
Report reference: lost_item_id
Hash column: code_hash
Hash version: sha256-v1

Existing reports created before this feature have no claim code.

## Code format and hashing
Codes contain 16 cryptographically random bytes, represented as
32 uppercase hexadecimal characters, displayed in groups of four
separated by hyphens.

Before hashing:
1. Remove hyphens and whitespace.
2. Convert to uppercase.
3. Require exactly 32 hexadecimal characters.

Hash the normalized UTF-8 string using SHA-256.
Store the digest as lowercase hexadecimal.

The shared backend helper is server/utils/claimCodes.cjs.

## Verification integration — still pending
Verification must happen on the backend.

- Authenticate the user and check ownership of the lost report.
- Check that the proposed match belongs to that report.
- Compare against the hash for that specific lost_item_id.
- Use a constant-time comparison of equal-length hash buffers.
- Limit verification attempts.
- Never log submitted codes or return stored hashes.
- A matching code is one verification step, not proof of item ownership.

The claims workflow must define when a verified code is consumed,
how repeat requests are handled, and how lost codes are replaced.

## Current limitation
The local API uses DEV_USER_ID, not real authentication.
Code recovery/reissue and verification are not implemented.
If the creation response is lost, the report may be saved without
the user receiving the code; recovery handling is still required.
