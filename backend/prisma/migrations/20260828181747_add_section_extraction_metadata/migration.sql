-- AlterTable
ALTER TABLE "BookSection" ADD COLUMN     "extractionMethod" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN     "extractionQuality" DOUBLE PRECISION;
