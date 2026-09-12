-- Existing installations keep their rows while adopting the canonical column names.
DO $$
DECLARE
    candidate record;
    target_name text;
BEGIN
    FOR candidate IN
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agents'
          AND column_name ~ '^effective_[a-z]+_agent_(applied_at|status|version)$'
          AND column_name !~ '^effective_haus_agent_'
    LOOP
        target_name := regexp_replace(candidate.column_name, '^effective_[a-z]+_agent_', 'effective_haus_agent_');
        EXECUTE format('ALTER TABLE public.agents RENAME COLUMN %I TO %I', candidate.column_name, target_name);
    END LOOP;

    FOR candidate IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.agents'::regclass
          AND conname ~ '^agents_[a-z]+_agent_status$'
          AND conname <> 'agents_haus_agent_status'
    LOOP
        EXECUTE format('ALTER TABLE public.agents RENAME CONSTRAINT %I TO agents_haus_agent_status', candidate.conname);
    END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE agents DROP CONSTRAINT agents_handle_grammar;
--> statement-breakpoint
ALTER TABLE agents ADD CONSTRAINT agents_handle_grammar CHECK (
    handle ~ '^[a-z0-9][a-z0-9-]{1,30}$' AND (
        (factory_kind = 'cove' AND handle = 'cove') OR
        lower(handle) NOT IN ('agent', 'agents', 'all', 'busy', 'cove', 'everyone', 'haus', 'here', 'human', 'humans', 'idle', 'system')
    )
);
--> statement-breakpoint
ALTER TABLE server_memberships DROP CONSTRAINT server_memberships_handle_grammar;
--> statement-breakpoint
ALTER TABLE server_memberships ADD CONSTRAINT server_memberships_handle_grammar CHECK (
    handle IS NULL OR (handle ~ '^[a-z0-9][a-z0-9-]{1,30}$' AND
        lower(handle) NOT IN ('agent', 'agents', 'all', 'busy', 'cove', 'everyone', 'haus', 'here', 'human', 'humans', 'idle', 'system'))
);
