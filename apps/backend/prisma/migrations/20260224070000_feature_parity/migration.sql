-- Bring database schema in sync with prisma/schema.prisma

-- Users: add role for admin/user split
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

-- Reports: add admin resolution text
ALTER TABLE "reports" ADD COLUMN "resolution" TEXT;

-- Messages: add media metadata fields
ALTER TABLE "messages" ADD COLUMN "media_url" TEXT;
ALTER TABLE "messages" ADD COLUMN "file_name" TEXT;
ALTER TABLE "messages" ADD COLUMN "file_size" INTEGER;
ALTER TABLE "messages" ADD COLUMN "mime_type" TEXT;

-- Soul relief module
CREATE TABLE IF NOT EXISTS "soul_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "topic" TEXT NOT NULL DEFAULT 'general',
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'AI',
  "admin_id" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "soul_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "soul_messages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "session_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'user',
  "content" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "soul_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "soul_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "soul_sessions_user_id_created_at_idx" ON "soul_sessions" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "soul_messages_session_id_created_at_idx" ON "soul_messages" ("session_id", "created_at");

-- Admin audit module
CREATE TABLE IF NOT EXISTS "admin_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "admin_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "target_id" TEXT,
  "detail" TEXT,
  "ip" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "admin_logs_admin_id_created_at_idx" ON "admin_logs" ("admin_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_logs_action_created_at_idx" ON "admin_logs" ("action", "created_at");

-- Dynamic feed module
CREATE TABLE IF NOT EXISTS "dynamics" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'post',
  "content" TEXT NOT NULL,
  "image_url" TEXT,
  "mood" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'public',
  "likes" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dynamics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "dynamic_comments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dynamic_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dynamic_comments_dynamic_id_fkey" FOREIGN KEY ("dynamic_id") REFERENCES "dynamics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dynamic_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "dynamic_likes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dynamic_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dynamic_likes_dynamic_id_fkey" FOREIGN KEY ("dynamic_id") REFERENCES "dynamics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dynamic_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "dynamics_created_at_idx" ON "dynamics" ("created_at");
CREATE INDEX IF NOT EXISTS "dynamics_user_id_created_at_idx" ON "dynamics" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "dynamic_comments_dynamic_id_created_at_idx" ON "dynamic_comments" ("dynamic_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "dynamic_likes_dynamic_id_user_id_key" ON "dynamic_likes" ("dynamic_id", "user_id");

-- Operational message slots
CREATE TABLE IF NOT EXISTS "operational_messages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '推荐',
  "image_url" TEXT,
  "link_url" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);
