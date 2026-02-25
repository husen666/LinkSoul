-- Feed attachments: music/location/link
ALTER TABLE "dynamics" ADD COLUMN "music" TEXT;
ALTER TABLE "dynamics" ADD COLUMN "location" TEXT;
ALTER TABLE "dynamics" ADD COLUMN "link" TEXT;

-- Poll options for feed dynamics
CREATE TABLE IF NOT EXISTS "dynamic_poll_options" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dynamic_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "votes" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dynamic_poll_options_dynamic_id_fkey" FOREIGN KEY ("dynamic_id") REFERENCES "dynamics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- User vote records (one vote per user per dynamic)
CREATE TABLE IF NOT EXISTS "dynamic_poll_votes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dynamic_id" TEXT NOT NULL,
  "option_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dynamic_poll_votes_dynamic_id_fkey" FOREIGN KEY ("dynamic_id") REFERENCES "dynamics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dynamic_poll_votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "dynamic_poll_options" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dynamic_poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "dynamic_poll_options_dynamic_id_sort_order_idx"
  ON "dynamic_poll_options" ("dynamic_id", "sort_order");
CREATE INDEX IF NOT EXISTS "dynamic_poll_votes_option_id_idx"
  ON "dynamic_poll_votes" ("option_id");
CREATE UNIQUE INDEX IF NOT EXISTS "dynamic_poll_votes_dynamic_id_user_id_key"
  ON "dynamic_poll_votes" ("dynamic_id", "user_id");
