-- Data-only migration. Existing accounts are now granted platform access the moment an admin
-- adds them, instead of receiving an invitation link. This applies that rule to invitations
-- created before the change: every live (unused, unexpired) invitation whose address already
-- belongs to an account becomes a membership with the invited role, and the invitation is
-- retired. Without it, those users stay locked out until someone re-adds them.

INSERT INTO "UserPlatformAccess" ("id", "userId", "platformId", "role", "createdAt")
SELECT gen_random_uuid()::text, u."id", i."platformId", i."role", CURRENT_TIMESTAMP
FROM "Invitation" i
JOIN "User" u ON u."email" = i."email"
WHERE i."isUsed" = false
  AND i."expiresAt" > CURRENT_TIMESTAMP
ON CONFLICT ("userId", "platformId") DO NOTHING;

UPDATE "Invitation" i
SET "isUsed" = true
FROM "User" u
WHERE u."email" = i."email"
  AND i."isUsed" = false
  AND i."expiresAt" > CURRENT_TIMESTAMP;
