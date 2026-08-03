-- SecureChat: realtime publication, member-scoped RLS, mention/DM notifications
-- 1) Add hc_* tables to the Supabase realtime publication so chat is live
-- 2) Replace company-wide FOR ALL policies with member-scoped policies
-- 3) Auto-notify mentioned users + DM partners (in-app + queued email)

-- ============================================================
-- 1. REALTIME PUBLICATION
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'hc_channels','hc_channel_members','hc_messages','hc_reactions',
    'hc_read_receipts','hc_files','hc_announcements','hc_chat_tasks','hc_knowledge'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- Full row payloads for live edits/deletes
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hc_messages','hc_files','hc_channels']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 2. HELPER FUNCTIONS (bypass RLS to avoid recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_hc_channel_member(p_channel uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM hc_channel_members m
    WHERE m.channel_id = p_channel AND m.user_id = p_user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hc_channel_admin(p_channel uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM hc_channel_members m
    WHERE m.channel_id = p_channel AND m.user_id = p_user AND m.role IN ('owner','admin')
  );
$$;

-- ============================================================
-- 3. MEMBER-SCOPED RLS
-- ============================================================

-- hc_channels: everyone sees public channels; only members see private/DMs
DROP POLICY IF EXISTS hc_channels_all ON hc_channels;
DROP POLICY IF EXISTS hc_channels_select ON hc_channels;
CREATE POLICY hc_channels_select ON hc_channels FOR SELECT
  USING (company_id = public.user_company_id()
         AND (public.is_hc_channel_member(id) OR (NOT COALESCE(is_private,false))));
DROP POLICY IF EXISTS hc_channels_insert ON hc_channels;
CREATE POLICY hc_channels_insert ON hc_channels FOR INSERT
  WITH CHECK (company_id = public.user_company_id());
DROP POLICY IF EXISTS hc_channels_update ON hc_channels;
CREATE POLICY hc_channels_update ON hc_channels FOR UPDATE
  USING (public.is_super_admin() OR public.is_hc_channel_admin(id));
DROP POLICY IF EXISTS hc_channels_delete ON hc_channels;
CREATE POLICY hc_channels_delete ON hc_channels FOR DELETE
  USING (public.is_super_admin() OR public.is_hc_channel_admin(id));

-- hc_channel_members: users manage only their own membership rows
DROP POLICY IF EXISTS hc_channel_members_all ON hc_channel_members;
DROP POLICY IF EXISTS hc_channel_members_select ON hc_channel_members;
CREATE POLICY hc_channel_members_select ON hc_channel_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_super_admin());
DROP POLICY IF EXISTS hc_channel_members_insert ON hc_channel_members;
-- Channel creators may add members (private/DM channels need both parties);
-- anyone may add themselves to a channel they belong to.
CREATE POLICY hc_channel_members_insert ON hc_channel_members FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM hc_channels c
        WHERE c.id = hc_channel_members.channel_id
          AND (NOT COALESCE(c.is_private, false) OR c.created_by = auth.uid())
      )
    )
  );
DROP POLICY IF EXISTS hc_channel_members_update ON hc_channel_members;
CREATE POLICY hc_channel_members_update ON hc_channel_members FOR UPDATE
  USING (user_id = auth.uid() AND company_id = public.user_company_id());
DROP POLICY IF EXISTS hc_channel_members_delete ON hc_channel_members;
CREATE POLICY hc_channel_members_delete ON hc_channel_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_super_admin());

-- hc_messages: read/insert by members; edit own; delete by admins/super admin
DROP POLICY IF EXISTS hc_messages_all ON hc_messages;
DROP POLICY IF EXISTS hc_messages_select ON hc_messages;
CREATE POLICY hc_messages_select ON hc_messages FOR SELECT
  USING (public.is_super_admin() OR public.is_hc_channel_member(channel_id));
DROP POLICY IF EXISTS hc_messages_insert ON hc_messages;
CREATE POLICY hc_messages_insert ON hc_messages FOR INSERT
  WITH CHECK (company_id = public.user_company_id() AND public.is_hc_channel_member(channel_id));
DROP POLICY IF EXISTS hc_messages_update ON hc_messages;
CREATE POLICY hc_messages_update ON hc_messages FOR UPDATE
  USING (public.is_super_admin() OR public.is_hc_channel_admin(channel_id) OR sender_id = auth.uid());
DROP POLICY IF EXISTS hc_messages_delete ON hc_messages;
CREATE POLICY hc_messages_delete ON hc_messages FOR DELETE
  USING (public.is_super_admin() OR public.is_hc_channel_admin(channel_id));

-- hc_files: members of the channel (or uploader) can read; uploader manages
DROP POLICY IF EXISTS hc_files_all ON hc_files;
DROP POLICY IF EXISTS hc_files_select ON hc_files;
CREATE POLICY hc_files_select ON hc_files FOR SELECT
  USING (public.is_super_admin()
         OR uploader_id = auth.uid()
         OR (channel_id IS NOT NULL AND public.is_hc_channel_member(channel_id)));
DROP POLICY IF EXISTS hc_files_insert ON hc_files;
CREATE POLICY hc_files_insert ON hc_files FOR INSERT
  WITH CHECK (company_id = public.user_company_id()
              AND (channel_id IS NULL OR public.is_hc_channel_member(channel_id)));
DROP POLICY IF EXISTS hc_files_update ON hc_files;
CREATE POLICY hc_files_update ON hc_files FOR UPDATE
  USING (public.is_super_admin() OR uploader_id = auth.uid());
DROP POLICY IF EXISTS hc_files_delete ON hc_files;
CREATE POLICY hc_files_delete ON hc_files FOR DELETE
  USING (public.is_super_admin() OR uploader_id = auth.uid());

-- hc_reactions: members of the message's channel; users manage their own
DROP POLICY IF EXISTS hc_reactions_all ON hc_reactions;
DROP POLICY IF EXISTS hc_reactions_select ON hc_reactions;
CREATE POLICY hc_reactions_select ON hc_reactions FOR SELECT
  USING (public.is_super_admin()
         OR public.is_hc_channel_member((SELECT m.channel_id FROM hc_messages m WHERE m.id = hc_reactions.message_id)));
DROP POLICY IF EXISTS hc_reactions_insert ON hc_reactions;
CREATE POLICY hc_reactions_insert ON hc_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid()
              AND public.is_hc_channel_member((SELECT m.channel_id FROM hc_messages m WHERE m.id = hc_reactions.message_id)));
DROP POLICY IF EXISTS hc_reactions_update ON hc_reactions;
CREATE POLICY hc_reactions_update ON hc_reactions FOR UPDATE
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS hc_reactions_delete ON hc_reactions;
CREATE POLICY hc_reactions_delete ON hc_reactions FOR DELETE
  USING (user_id = auth.uid() OR public.is_super_admin());

-- hc_read_receipts: own receipts only
DROP POLICY IF EXISTS hc_read_receipts_all ON hc_read_receipts;
DROP POLICY IF EXISTS hc_read_receipts_select ON hc_read_receipts;
CREATE POLICY hc_read_receipts_select ON hc_read_receipts FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS hc_read_receipts_insert ON hc_read_receipts;
CREATE POLICY hc_read_receipts_insert ON hc_read_receipts FOR INSERT
  WITH CHECK (user_id = auth.uid() AND company_id = public.user_company_id());
DROP POLICY IF EXISTS hc_read_receipts_update ON hc_read_receipts;
CREATE POLICY hc_read_receipts_update ON hc_read_receipts FOR UPDATE
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS hc_read_receipts_delete ON hc_read_receipts;
CREATE POLICY hc_read_receipts_delete ON hc_read_receipts FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 4. MENTION + DM NOTIFICATION TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.hc_notify_message_recipients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- @email mentions -> specific users
  FOR v_recipient IN
    SELECT id FROM user_profiles
    WHERE company_id = NEW.company_id
      AND is_active = true
      AND lower(email) IN (
        SELECT lower(t) FROM regexp_matches(NEW.body, '@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})', 'g') AS m(t)
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_hc_notify_recipients ON hc_messages;
CREATE TRIGGER tr_hc_notify_recipients
  AFTER INSERT ON hc_messages
  FOR EACH ROW EXECUTE FUNCTION public.hc_notify_message_recipients();
