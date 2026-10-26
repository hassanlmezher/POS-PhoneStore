-- AlterTable (volatile default: every existing ticket gets its own random token)
ALTER TABLE "Ticket" ADD COLUMN     "trackToken" TEXT NOT NULL DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_trackToken_key" ON "Ticket"("trackToken");
