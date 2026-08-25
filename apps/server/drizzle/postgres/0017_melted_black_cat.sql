DROP INDEX "users_handle_key";--> statement-breakpoint
ALTER TABLE "server_memberships" ADD COLUMN "handle" text;--> statement-breakpoint
WITH candidates AS (
    SELECT
        sm.id,
        lower(u.handle) AS handle,
        row_number() OVER (PARTITION BY sm.server_id, lower(u.handle) ORDER BY sm.joined_at, sm.id) AS position
    FROM server_memberships sm
    INNER JOIN users u ON u.id = sm.user_id
    WHERE sm.revoked_at IS NULL
      AND u.handle ~ '^[a-z0-9][a-z0-9-]{1,30}$'
      AND lower(u.handle) NOT IN ('agent', 'agents', 'all', 'busy', 'cove', 'everyone', 'grotto', 'here', 'human', 'humans', 'idle', 'system')
      AND NOT EXISTS (
          SELECT 1 FROM agents a
          WHERE a.server_id = sm.server_id
            AND a.retired_at IS NULL
            AND lower(a.handle) = lower(u.handle)
      )
)
UPDATE server_memberships sm
SET handle = candidates.handle
FROM candidates
WHERE sm.id = candidates.id AND candidates.position = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "server_memberships_server_handle_key" ON "server_memberships" USING btree ("server_id",lower("handle")) WHERE "server_memberships"."revoked_at" is null and "server_memberships"."handle" is not null;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "handle";--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_handle_grammar" CHECK ("agents"."handle" ~ '^[a-z0-9][a-z0-9-]{1,30}$' and (("agents"."factory_kind" = 'cove' and "agents"."handle" = 'cove') or lower("agents"."handle") not in ('agent', 'agents', 'all', 'busy', 'cove', 'everyone', 'grotto', 'here', 'human', 'humans', 'idle', 'system')));--> statement-breakpoint
ALTER TABLE "server_memberships" ADD CONSTRAINT "server_memberships_handle_grammar" CHECK ("server_memberships"."handle" is null or ("server_memberships"."handle" ~ '^[a-z0-9][a-z0-9-]{1,30}$' and lower("server_memberships"."handle") not in ('agent', 'agents', 'all', 'busy', 'cove', 'everyone', 'grotto', 'here', 'human', 'humans', 'idle', 'system')));--> statement-breakpoint
CREATE FUNCTION enforce_participant_handle_namespace() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    lock_handle text;
BEGIN
    lock_handle := lower(NEW.handle);
    IF TG_OP = 'UPDATE' AND lock_handle IS NULL THEN
        lock_handle := lower(OLD.handle);
    END IF;
    IF lock_handle IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(NEW.server_id || ':' || lock_handle, 0));
    END IF;

    IF TG_TABLE_NAME = 'server_memberships' THEN
        IF NEW.revoked_at IS NOT NULL THEN
            NEW.handle := NULL;
        ELSIF NEW.handle IS NOT NULL AND EXISTS (
            SELECT 1 FROM agents a
            WHERE a.server_id = NEW.server_id
              AND a.retired_at IS NULL
              AND lower(a.handle) = lower(NEW.handle)
        ) THEN
            RAISE EXCEPTION 'participant handle is already taken'
                USING ERRCODE = '23505', CONSTRAINT = 'participant_handles_server_handle_key';
        END IF;
    ELSIF NEW.retired_at IS NULL AND EXISTS (
        SELECT 1 FROM server_memberships sm
        WHERE sm.server_id = NEW.server_id
          AND sm.revoked_at IS NULL
          AND sm.handle IS NOT NULL
          AND lower(sm.handle) = lower(NEW.handle)
    ) THEN
        RAISE EXCEPTION 'participant handle is already taken'
            USING ERRCODE = '23505', CONSTRAINT = 'participant_handles_server_handle_key';
    END IF;

    RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER server_memberships_participant_handle_namespace
BEFORE INSERT OR UPDATE OF handle, revoked_at ON server_memberships
FOR EACH ROW EXECUTE FUNCTION enforce_participant_handle_namespace();--> statement-breakpoint
CREATE TRIGGER agents_participant_handle_namespace
BEFORE INSERT OR UPDATE OF handle, retired_at ON agents
FOR EACH ROW EXECUTE FUNCTION enforce_participant_handle_namespace();
