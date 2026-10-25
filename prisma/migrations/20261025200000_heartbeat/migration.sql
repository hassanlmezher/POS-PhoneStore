-- Keep-alive marker for the daily /api/keepalive ping (keeps a free Supabase project from pausing).
CREATE TABLE "Heartbeat" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Heartbeat_pkey" PRIMARY KEY ("id")
);

-- Not reachable through Supabase's public REST API; the app connects as the table owner.
ALTER TABLE "Heartbeat" ENABLE ROW LEVEL SECURITY;
