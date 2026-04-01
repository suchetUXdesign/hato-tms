-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DEVELOPER', 'REVIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('HS', 'HH', 'LIFF', 'MERCHANT', 'FLEX', 'COMMON');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('TRANSLATED', 'PENDING', 'IN_REVIEW');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('TH', 'EN');

-- CreateEnum
CREATE TYPE "CRStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DEVELOPER',
    "api_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "namespaces" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "description" TEXT,
    "platforms" "Platform"[] DEFAULT ARRAY[]::"Platform"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "namespaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_keys" (
    "id" TEXT NOT NULL,
    "namespace_id" TEXT NOT NULL,
    "key_name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "KeyStatus" NOT NULL DEFAULT 'PENDING',
    "platforms" "Platform"[] DEFAULT ARRAY[]::"Platform"[],
    "created_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_values" (
    "id" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "value" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CRStatus" NOT NULL DEFAULT 'DRAFT',
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cr_reviewers" (
    "id" TEXT NOT NULL,
    "change_request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cr_reviewers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cr_items" (
    "id" TEXT NOT NULL,
    "change_request_id" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT NOT NULL,
    "comment" TEXT,

    CONSTRAINT "cr_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "diff" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_api_token_key" ON "users"("api_token");

-- CreateIndex
CREATE UNIQUE INDEX "namespaces_path_key" ON "namespaces"("path");

-- CreateIndex
CREATE INDEX "translation_keys_status_idx" ON "translation_keys"("status");

-- CreateIndex
CREATE INDEX "translation_keys_deleted_at_idx" ON "translation_keys"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "translation_keys_namespace_id_key_name_key" ON "translation_keys"("namespace_id", "key_name");

-- CreateIndex
CREATE INDEX "translation_values_key_id_locale_idx" ON "translation_values"("key_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "translation_values_key_id_locale_version_key" ON "translation_values"("key_id", "locale", "version");

-- CreateIndex
CREATE INDEX "change_requests_status_idx" ON "change_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cr_reviewers_change_request_id_user_id_key" ON "cr_reviewers"("change_request_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "translation_keys" ADD CONSTRAINT "translation_keys_namespace_id_fkey" FOREIGN KEY ("namespace_id") REFERENCES "namespaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_keys" ADD CONSTRAINT "translation_keys_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_values" ADD CONSTRAINT "translation_values_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "translation_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_values" ADD CONSTRAINT "translation_values_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cr_reviewers" ADD CONSTRAINT "cr_reviewers_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cr_reviewers" ADD CONSTRAINT "cr_reviewers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cr_items" ADD CONSTRAINT "cr_items_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cr_items" ADD CONSTRAINT "cr_items_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "translation_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
