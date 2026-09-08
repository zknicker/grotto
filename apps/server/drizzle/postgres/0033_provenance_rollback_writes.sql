-- The pre-snapshot Server remains a supported rollback target. Resolve its
-- omitted fields from real records; never relax the snapshot's NOT NULL contract.
CREATE FUNCTION public.message_cause_rollback_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
    source_anchor text;
    source_fired_at timestamptz;
    source_owner text;
    source_title text;
    source_summary text;
    cadence text;
    minutes bigint;
BEGIN
    IF NEW.kind = 'trigger_fire' THEN
        SELECT t.anchor_chat_id, f.received_at, t.owner_agent_id, t.title,
               CASE t.kind WHEN 'webhook' THEN 'Webhook' ELSE t.kind END
        INTO source_anchor, source_fired_at, source_owner, source_title, source_summary
        FROM public.triggers t JOIN public.trigger_fires f
          ON f.server_id = t.server_id AND f.trigger_id = t.id
        WHERE t.server_id = NEW.server_id AND t.id = NEW.trigger_id
          AND f.id = NEW.trigger_fire_id;
    ELSIF NEW.kind = 'reminder_fire' THEN
        SELECT r.anchor_chat_id, f.fired_at, r.owner_agent_id, r.title, r.repeat
        INTO source_anchor, source_fired_at, source_owner, source_title, cadence
        FROM public.reminders r JOIN public.reminder_fires f
          ON f.server_id = r.server_id AND f.reminder_id = r.id
        WHERE r.server_id = NEW.server_id AND r.id = NEW.reminder_id
          AND f.id = NEW.reminder_fire_id;
        source_summary := CASE
            WHEN cadence IS NULL THEN 'One time'
            WHEN cadence ~ '^daily@[0-9]{2}:[0-9]{2}$'
                THEN 'Every day at ' || substring(cadence from '([0-9]{2}:[0-9]{2})$')
            WHEN cadence ~ '^weekly:[a-z,]+@[0-9]{2}:[0-9]{2}$'
                THEN 'Every ' || (
                    SELECT string_agg(d.name, ', ' ORDER BY d.index)
                    FROM (VALUES
                        ('sun', 0, 'Sunday'), ('mon', 1, 'Monday'), ('tue', 2, 'Tuesday'),
                        ('wed', 3, 'Wednesday'), ('thu', 4, 'Thursday'),
                        ('fri', 5, 'Friday'), ('sat', 6, 'Saturday')
                    ) AS d(token, index, name)
                    WHERE d.token = ANY(string_to_array(
                        substring(cadence from '^weekly:([a-z,]+)@'), ','))
                ) || ' at ' || substring(cadence from '([0-9]{2}:[0-9]{2})$')
            ELSE cadence
        END;
        IF cadence ~ '^every:[0-9]+[mhd]$' THEN
            minutes := substring(cadence from '^every:([0-9]+)')::bigint *
                CASE right(cadence, 1) WHEN 'm' THEN 1 WHEN 'h' THEN 60 ELSE 1440 END;
            source_summary := 'Every ' || CASE
                WHEN minutes % 1440 = 0 THEN
                    CASE WHEN minutes = 1440 THEN 'day' ELSE (minutes / 1440) || ' days' END
                WHEN minutes % 60 = 0 THEN
                    CASE WHEN minutes = 60 THEN 'hour' ELSE (minutes / 60) || ' hours' END
                WHEN minutes = 1 THEN 'minute'
                ELSE minutes || ' minutes'
            END;
        END IF;
    END IF;
    IF source_fired_at IS NULL THEN
        RAISE EXCEPTION 'Cannot resolve message cause snapshot from its Server fire'
            USING ERRCODE = '23503';
    END IF;
    NEW.anchor_chat_id := coalesce(NEW.anchor_chat_id, source_anchor);
    NEW.fired_at := coalesce(NEW.fired_at, source_fired_at);
    NEW.owner_agent_id := coalesce(NEW.owner_agent_id, source_owner);
    NEW.title := coalesce(NEW.title, source_title);
    NEW.summary := coalesce(NEW.summary, source_summary);
    RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER message_cause_rollback_snapshot
BEFORE INSERT ON public.message_causes
FOR EACH ROW WHEN (
    NEW.fired_at IS NULL OR NEW.owner_agent_id IS NULL
    OR NEW.title IS NULL OR NEW.summary IS NULL
)
EXECUTE FUNCTION public.message_cause_rollback_snapshot();
