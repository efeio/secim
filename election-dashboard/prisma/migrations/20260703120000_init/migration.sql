-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('draft', 'active', 'ended');

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'tr',
    "status" "PollStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#888888',
    "color2" TEXT,
    "photo_url" TEXT,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "province_code" TEXT NOT NULL,
    "device_token" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "polls_status_idx" ON "polls"("status");

-- CreateIndex
CREATE INDEX "candidates_poll_id_idx" ON "candidates"("poll_id");

-- CreateIndex
CREATE INDEX "votes_poll_id_province_code_idx" ON "votes"("poll_id", "province_code");

-- CreateIndex
CREATE INDEX "votes_poll_id_candidate_id_idx" ON "votes"("poll_id", "candidate_id");

-- CreateIndex
CREATE INDEX "votes_created_at_idx" ON "votes"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "votes_poll_id_device_token_key" ON "votes"("poll_id", "device_token");

-- CreateIndex
CREATE UNIQUE INDEX "votes_poll_id_ip_hash_key" ON "votes"("poll_id", "ip_hash");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
