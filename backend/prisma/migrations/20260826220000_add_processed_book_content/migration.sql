-- CreateEnum
CREATE TYPE "BookProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Book"
ADD COLUMN "sourceFileId" TEXT,
ADD COLUMN "processingStatus" "BookProcessingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "processingError" TEXT,
ADD COLUMN "wordCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BookSection" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookId" TEXT NOT NULL,
    CONSTRAINT "BookSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_userId_sourceFileId_key" ON "Book"("userId", "sourceFileId");
CREATE UNIQUE INDEX "BookSection_bookId_position_key" ON "BookSection"("bookId", "position");
CREATE INDEX "BookSection_bookId_idx" ON "BookSection"("bookId");

-- AddForeignKey
ALTER TABLE "BookSection" ADD CONSTRAINT "BookSection_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
