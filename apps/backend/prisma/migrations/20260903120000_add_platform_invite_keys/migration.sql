-- CreateTable
CREATE TABLE "PlatformInviteKey" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformInviteKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInviteKey_keyHash_key" ON "PlatformInviteKey"("keyHash");

-- CreateIndex
CREATE INDEX "PlatformInviteKey_platformId_revokedAt_idx" ON "PlatformInviteKey"("platformId", "revokedAt");

-- AddForeignKey
ALTER TABLE "PlatformInviteKey" ADD CONSTRAINT "PlatformInviteKey_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformInviteKey" ADD CONSTRAINT "PlatformInviteKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

