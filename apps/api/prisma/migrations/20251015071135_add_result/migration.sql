-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "report_id" TEXT,
    "match" JSONB NOT NULL,
    "report" JSONB NOT NULL,
    "file_id" TEXT,
    "bytes" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Result_user_id_created_at_idx" ON "Result"("user_id", "created_at" DESC);
