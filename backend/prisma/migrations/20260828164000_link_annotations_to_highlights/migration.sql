ALTER TABLE "Annotation"
ADD COLUMN "highlightId" TEXT;

CREATE UNIQUE INDEX "Annotation_highlightId_key"
ON "Annotation"("highlightId");

ALTER TABLE "Annotation"
ADD CONSTRAINT "Annotation_highlightId_fkey"
FOREIGN KEY ("highlightId") REFERENCES "Highlight"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
