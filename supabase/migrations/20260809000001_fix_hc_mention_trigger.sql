-- SecureChat: fix "Send failed" on every message
--
-- Root cause: hc_notify_message_recipients() (AFTER INSERT trigger on
-- hc_messages) referenced regexp_matches() output - which is SETOF text[] -
-- as a scalar column:  lower(t) FROM regexp_matches(...) AS m(t)
-- This fails with  ERROR 42883: function lower(text[]) does not exist  on
-- EVERY message insert (the mention scan is unconditional), so the whole
-- INSERT ... RETURNING aborts and the client shows "Send failed".
--
-- Fix: index the array element with (regexp_matches(...))[1] and only run the
-- mention scan when the body actually contains an email-shaped @mention.

CREATE OR REPLACE FUNCTION public.hc_notify_message_recipients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_channel_type varchar;
  v_channel_name varchar;
  v_recipient uuid;
  v_tenant uuid;
  v_email_enabled boolean;
  v_outbox uuid;
  v_snippet text;
BEGIN
  -- Skip bot/system/announcement messages (they have their own flows)
  IF NEW.message_type IN ('bot','system','announcement') THEN RETURN NEW; END IF;
  IF NEW.sender_id IS NULL THEN RETURN NEW; END IF;

  SELECT channel_type, name INTO v_channel_type, v_channel_name
  FROM hc_channels WHERE id = NEW.channel_id;

  SELECT tenant_id INTO v_tenant FROM companies WHERE id = NEW.company_id;

  v_snippet := left(coalesce(NEW.body,''), 160);
  -- Maintain channel metadata (message_count, last_message_at) server-side
  UPDATE hc_channels SET
    last_message_at = COALESCE(NEW.delivered_at, NEW.created_at, NOW()),
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE id = NEW.channel_id;

  -- DM channels: notify the other participant(s)
  IF v_channel_type = 'dm' THEN
    FOR v_recipient IN
      SELECT m.user_id FROM hc_channel_members m
      WHERE m.channel_id = NEW.channel_id AND m.user_id <> NEW.sender_id
    LOOP
      INSERT INTO notifications
        (company_id, user_id, type, title, message, link, category, priority, channels,
         source_module, source_event, entity_type, entity_id, created_by, is_read)
      VALUES
        (NEW.company_id, v_recipient, 'info',
         format('New message from %s', coalesce(NEW.sender_name,'Someone')),
         v_snippet, '/dashboard/chat', 'chat', 'normal', ARRAY['in_app','email']::text[],
         'chat', 'message.dm', 'hc_channel', NEW.channel_id, NEW.sender_id, false);

      IF v_tenant IS NOT NULL THEN
        SELECT coalesce(email_enabled, true) INTO v_email_enabled
        FROM notification_preferences
        WHERE company_id = NEW.company_id AND user_id = v_recipient;
        IF v_email_enabled IS NOT FALSE THEN
          INSERT INTO email_outbox
            (company_id, provider, to_addresses, subject, status, payload, sent_by)
          VALUES
            (NEW.company_id, 'resend', ARRAY[(SELECT email FROM user_profiles WHERE id = v_recipient)],
             format('New message from %s', coalesce(NEW.sender_name,'Someone')),
             'queued',
             jsonb_build_object('channel_id', NEW.channel_id, 'notification_type', 'chat_dm', 'snippet', v_snippet),
             NEW.sender_id)
          RETURNING id INTO v_outbox;

          INSERT INTO job_queue (company_id, tenant_id, job_type, payload, status, attempts, max_attempts, priority)
          VALUES (NEW.company_id, v_tenant, 'email.send',
                  jsonb_build_object('to', (SELECT email FROM user_profiles WHERE id = v_recipient),
                                     'subject', format('New message from %s', coalesce(NEW.sender_name,'Someone')),
                                     'body', v_snippet,
                                     'outbox_id', v_outbox),
                  'pending', 0, 5, 50);
        END IF;
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- @channel / @here / @all -> everyone in the channel
  IF NEW.body ~* '@(channel|here|all)\b' THEN
    FOR v_recipient IN
      SELECT m.user_id FROM hc_channel_members m
      WHERE m.channel_id = NEW.channel_id AND m.user_id <> NEW.sender_id
    LOOP
      INSERT INTO notifications
        (company_id, user_id, type, title, message, link, category, priority, channels,
         source_module, source_event, entity_type, entity_id, created_by, is_read)
      VALUES
        (NEW.company_id, v_recipient, 'info',
         format('@%s in #%s', lower(substring(NEW.body from '@(channel|here|all)')), coalesce(v_channel_name,'chat')),
         v_snippet, '/dashboard/chat', 'chat', 'normal', ARRAY['in_app']::text[],
         'chat', 'message.mention', 'hc_channel', NEW.channel_id, NEW.sender_id, false);
    END LOOP;
    RETURN NEW;
  END IF;

  -- @email mentions -> specific users (only when body has an email-shaped mention)
  IF NEW.body ~* '@[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' THEN
    FOR v_recipient IN
      SELECT id FROM user_profiles
      WHERE company_id = NEW.company_id
        AND is_active = true
        AND lower(email) IN (
          SELECT lower((regexp_matches(NEW.body, '@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})', 'g'))[1])
        )
        AND id <> NEW.sender_id
    LOOP
      INSERT INTO notifications
        (company_id, user_id, type, title, message, link, category, priority, channels,
         source_module, source_event, entity_type, entity_id, created_by, is_read)
      VALUES
        (NEW.company_id, v_recipient, 'info',
         format('%s mentioned you in #%s', coalesce(NEW.sender_name,'Someone'), coalesce(v_channel_name,'chat')),
         v_snippet, '/dashboard/chat', 'chat', 'normal', ARRAY['in_app','email']::text[],
         'chat', 'message.mention', 'hc_channel', NEW.channel_id, NEW.sender_id, false);

      IF v_tenant IS NOT NULL THEN
        SELECT coalesce(email_enabled, true) INTO v_email_enabled
        FROM notification_preferences
        WHERE company_id = NEW.company_id AND user_id = v_recipient;
        IF v_email_enabled IS NOT FALSE THEN
          INSERT INTO email_outbox
            (company_id, provider, to_addresses, subject, status, payload, sent_by)
          VALUES
            (NEW.company_id, 'resend', ARRAY[(SELECT email FROM user_profiles WHERE id = v_recipient)],
             format('%s mentioned you in #%s', coalesce(NEW.sender_name,'Someone'), coalesce(v_channel_name,'chat')),
             'queued',
             jsonb_build_object('channel_id', NEW.channel_id, 'notification_type', 'chat_mention', 'snippet', v_snippet),
             NEW.sender_id)
          RETURNING id INTO v_outbox;

          INSERT INTO job_queue (company_id, tenant_id, job_type, payload, status, attempts, max_attempts, priority)
          VALUES (NEW.company_id, v_tenant, 'email.send',
                  jsonb_build_object('to', (SELECT email FROM user_profiles WHERE id = v_recipient),
                                     'subject', format('%s mentioned you in #%s', coalesce(NEW.sender_name,'Someone'), coalesce(v_channel_name,'chat')),
                                     'body', v_snippet,
                                     'outbox_id', v_outbox),
                  'pending', 0, 5, 50);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;