-- AlterTable
ALTER TABLE "Platform" ADD COLUMN     "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "redirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[];

