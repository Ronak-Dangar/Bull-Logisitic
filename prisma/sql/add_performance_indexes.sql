-- Performance indexes (mirrors @@index entries in schema.prisma; names match Prisma's so db push sees no drift).
-- CONCURRENTLY: builds without blocking writes, so it's safe on the live DB. Must run outside a transaction.
-- Run: psql "<DATABASE_URL without the ?schema=public suffix>" -f prisma/sql/add_performance_indexes.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS "master_requests_cm_id_created_at_idx" ON "master_requests"("cm_id", "created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "master_requests_status_idx" ON "master_requests"("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "master_requests_created_at_idx" ON "master_requests"("created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "child_pickups_parent_id_stop_sequence_idx" ON "child_pickups"("parent_id", "stop_sequence");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "child_pickups_center_id_idx" ON "child_pickups"("center_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "delivery_details_status_idx" ON "delivery_details"("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "delivery_details_created_at_idx" ON "delivery_details"("created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "request_messages_master_req_id_created_at_idx" ON "request_messages"("master_req_id", "created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "activity_logs_entity_type_entity_id_created_at_idx" ON "activity_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "activity_logs_created_at_idx" ON "activity_logs"("created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "urgent_approvals_master_req_id_status_idx" ON "urgent_approvals"("master_req_id", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "urgent_approvals_status_created_at_idx" ON "urgent_approvals"("status", "created_at");
