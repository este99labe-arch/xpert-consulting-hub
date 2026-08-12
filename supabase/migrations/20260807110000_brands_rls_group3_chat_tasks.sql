-- Fase 5, grupo 3: chat y tareas.
--
-- Dos particularidades frente a los grupos anteriores:
--
-- 1) El chat tiene VARIAS políticas de SELECT (asignado, miembro, vía tarea).
--    En RLS se combinan con OR, así que dejar una sin la condición de marca
--    abriría por ahí todo lo que las otras cierran. Se tocan todas.
--
-- 2) Varias políticas de tareas no miran la cuenta sino la propiedad
--    (created_by, assigned_to, author_id). También reciben la condición de
--    marca: que a alguien le asignen una tarea no debería saltarse la
--    frontera. Si tiene que trabajar en esa marca, se le da acceso a la marca.
--
-- Las políticas de MASTER_ADMIN que cruzan cuentas siguen intactas.

CREATE OR REPLACE FUNCTION public.can_access_conversation(_conv uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _conv IS NULL OR EXISTS (SELECT 1 FROM public.chat_conversations c
    WHERE c.id = _conv AND public.can_access_brand(c.brand_id));
$function$;

CREATE OR REPLACE FUNCTION public.can_access_task(_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _task IS NULL OR EXISTS (SELECT 1 FROM public.reminders r
    WHERE r.id = _task AND public.can_access_brand(r.brand_id));
$function$;

CREATE OR REPLACE FUNCTION public.can_access_board_brand(_board uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _board IS NULL OR EXISTS (SELECT 1 FROM public.task_boards b
    WHERE b.id = _board AND public.can_access_brand(b.brand_id));
$function$;

REVOKE EXECUTE ON FUNCTION public.can_access_conversation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_board_brand(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_board_brand(uuid) TO authenticated;

DROP POLICY chat_conv_manage ON public.chat_conversations;
CREATE POLICY chat_conv_manage ON public.chat_conversations FOR ALL
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_brand(brand_id))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_brand(brand_id));

DROP POLICY chat_conv_select ON public.chat_conversations;
CREATE POLICY chat_conv_select ON public.chat_conversations FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')
              OR assigned_to = auth.uid())
         AND public.can_access_brand(brand_id));

DROP POLICY chat_conv_select_member ON public.chat_conversations;
CREATE POLICY chat_conv_select_member ON public.chat_conversations FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND EXISTS (SELECT 1 FROM public.chat_conversation_members m
                      WHERE m.conversation_id = chat_conversations.id AND m.user_id = auth.uid())
         AND public.can_access_brand(brand_id));

DROP POLICY chat_conv_select_via_task ON public.chat_conversations;
CREATE POLICY chat_conv_select_via_task ON public.chat_conversations FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND EXISTS (SELECT 1 FROM public.reminders r
                      WHERE r.chat_conversation_id = chat_conversations.id AND r.assigned_to = auth.uid())
         AND public.can_access_brand(brand_id));

DROP POLICY chat_conv_update_assigned ON public.chat_conversations;
CREATE POLICY chat_conv_update_assigned ON public.chat_conversations FOR UPDATE
  USING (account_id = public.get_user_account_id(auth.uid())
         AND assigned_to = auth.uid() AND public.can_access_brand(brand_id))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND public.can_access_brand(brand_id));

DROP POLICY chat_msg_select ON public.chat_messages;
CREATE POLICY chat_msg_select ON public.chat_messages FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN')
              OR EXISTS (SELECT 1 FROM public.chat_conversations c
                          WHERE c.id = chat_messages.conversation_id AND c.assigned_to = auth.uid()))
         AND public.can_access_conversation(conversation_id));

DROP POLICY chat_msg_select_member ON public.chat_messages;
CREATE POLICY chat_msg_select_member ON public.chat_messages FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND EXISTS (SELECT 1 FROM public.chat_conversation_members m
                      WHERE m.conversation_id = chat_messages.conversation_id AND m.user_id = auth.uid())
         AND public.can_access_conversation(conversation_id));

DROP POLICY chat_msg_select_via_task ON public.chat_messages;
CREATE POLICY chat_msg_select_via_task ON public.chat_messages FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND EXISTS (SELECT 1 FROM public.reminders r
                      WHERE r.chat_conversation_id = chat_messages.conversation_id AND r.assigned_to = auth.uid())
         AND public.can_access_conversation(conversation_id));

DROP POLICY "Managers manage conv members" ON public.chat_conversation_members;
CREATE POLICY "Managers manage conv members" ON public.chat_conversation_members FOR ALL
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_conversation(conversation_id))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_conversation(conversation_id));

DROP POLICY "Users view own conv membership" ON public.chat_conversation_members;
CREATE POLICY "Users view own conv membership" ON public.chat_conversation_members FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND user_id = auth.uid() AND public.can_access_conversation(conversation_id));

DROP POLICY "Managers can manage account reminders" ON public.reminders;
CREATE POLICY "Managers can manage account reminders" ON public.reminders FOR ALL
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_brand(brand_id));

DROP POLICY "Managers can view account reminders" ON public.reminders;
CREATE POLICY "Managers can view account reminders" ON public.reminders FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_brand(brand_id));

DROP POLICY "Users can view own reminders" ON public.reminders;
CREATE POLICY "Users can view own reminders" ON public.reminders FOR SELECT
  USING (created_by = auth.uid() AND public.can_access_brand(brand_id));

DROP POLICY "Users view assigned reminders" ON public.reminders;
CREATE POLICY "Users view assigned reminders" ON public.reminders FOR SELECT
  USING (assigned_to = auth.uid() AND public.can_access_brand(brand_id));

DROP POLICY "Users can update own reminders" ON public.reminders;
CREATE POLICY "Users can update own reminders" ON public.reminders FOR UPDATE
  USING (created_by = auth.uid() AND public.can_access_brand(brand_id));

DROP POLICY "Users can delete own reminders" ON public.reminders;
CREATE POLICY "Users can delete own reminders" ON public.reminders FOR DELETE
  USING (created_by = auth.uid() AND public.can_access_brand(brand_id));

DROP POLICY "Users can insert own reminders" ON public.reminders;
CREATE POLICY "Users can insert own reminders" ON public.reminders FOR INSERT
  WITH CHECK (created_by = auth.uid()
              AND account_id = public.get_user_account_id(auth.uid())
              AND public.can_access_brand(brand_id));

DROP POLICY "Users view accessible board reminders" ON public.reminders;
CREATE POLICY "Users view accessible board reminders" ON public.reminders FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid()) AND column_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.task_columns c
                      WHERE c.id = reminders.column_id AND public.can_access_task_board(c.board_id, auth.uid()))
         AND public.can_access_brand(brand_id));

DROP POLICY "Users update accessible board reminders" ON public.reminders;
CREATE POLICY "Users update accessible board reminders" ON public.reminders FOR UPDATE
  USING (account_id = public.get_user_account_id(auth.uid()) AND column_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.task_columns c
                      WHERE c.id = reminders.column_id AND public.can_access_task_board(c.board_id, auth.uid()))
         AND public.can_access_brand(brand_id))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid()) AND public.can_access_brand(brand_id));

DROP POLICY "Managers manage boards" ON public.task_boards;
CREATE POLICY "Managers manage boards" ON public.task_boards FOR ALL
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_brand(brand_id))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_brand(brand_id));

DROP POLICY "Users view accessible boards" ON public.task_boards;
CREATE POLICY "Users view accessible boards" ON public.task_boards FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND public.can_access_task_board(id, auth.uid())
         AND public.can_access_brand(brand_id));

DROP POLICY "Managers manage account task columns" ON public.task_columns;
CREATE POLICY "Managers manage account task columns" ON public.task_columns FOR ALL
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_board_brand(board_id))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_board_brand(board_id));

DROP POLICY "Users view accessible task columns" ON public.task_columns;
CREATE POLICY "Users view accessible task columns" ON public.task_columns FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (board_id IS NULL OR public.can_access_task_board(board_id, auth.uid()))
         AND public.can_access_board_brand(board_id));

DROP POLICY "Managers manage board membership" ON public.task_board_members;
CREATE POLICY "Managers manage board membership" ON public.task_board_members FOR ALL
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_board_brand(board_id))
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
         AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_board_brand(board_id));

DROP POLICY "Users view own board membership" ON public.task_board_members;
CREATE POLICY "Users view own board membership" ON public.task_board_members FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid())
         AND (user_id = auth.uid() OR public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))
         AND public.can_access_board_brand(board_id));

DROP POLICY "Users view account task comments" ON public.task_comments;
CREATE POLICY "Users view account task comments" ON public.task_comments FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid()) AND public.can_access_task(task_id));

DROP POLICY "Users insert own task comments" ON public.task_comments;
CREATE POLICY "Users insert own task comments" ON public.task_comments FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
              AND author_id = auth.uid() AND public.can_access_task(task_id));

DROP POLICY "Authors update own comments" ON public.task_comments;
CREATE POLICY "Authors update own comments" ON public.task_comments FOR UPDATE
  USING (author_id = auth.uid() AND public.can_access_task(task_id))
  WITH CHECK (author_id = auth.uid() AND public.can_access_task(task_id));

DROP POLICY "Authors or managers delete comments" ON public.task_comments;
CREATE POLICY "Authors or managers delete comments" ON public.task_comments FOR DELETE
  USING ((author_id = auth.uid()
          OR (account_id = public.get_user_account_id(auth.uid())
              AND (public.has_role(auth.uid(),'MANAGER') OR public.has_role(auth.uid(),'MASTER_ADMIN'))))
         AND public.can_access_task(task_id));

DROP POLICY "Users can view account task links" ON public.task_links;
CREATE POLICY "Users can view account task links" ON public.task_links FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid()) AND public.can_access_task(task_id));

DROP POLICY "Users can insert account task links" ON public.task_links;
CREATE POLICY "Users can insert account task links" ON public.task_links FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id(auth.uid())
              AND created_by = auth.uid() AND public.can_access_task(task_id));

DROP POLICY "Users can delete account task links" ON public.task_links;
CREATE POLICY "Users can delete account task links" ON public.task_links FOR DELETE
  USING (account_id = public.get_user_account_id(auth.uid()) AND public.can_access_task(task_id));

DROP POLICY "Users view account task activity" ON public.task_activity;
CREATE POLICY "Users view account task activity" ON public.task_activity FOR SELECT
  USING (account_id = public.get_user_account_id(auth.uid()) AND public.can_access_task(task_id));
