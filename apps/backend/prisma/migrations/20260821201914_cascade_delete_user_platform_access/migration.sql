-- DropForeignKey
ALTER TABLE "UserPlatformAccess" DROP CONSTRAINT "UserPlatformAccess_userId_fkey";

-- AddForeignKey
ALTER TABLE "UserPlatformAccess" ADD CONSTRAINT "UserPlatformAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
