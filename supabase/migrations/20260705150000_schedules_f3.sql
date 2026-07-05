-- ============================================================
-- F3: sistema de horarios (plantillas + herencia/override) y festivos
-- Convención weekday: ISO 1=lunes … 7=domingo  (aplicada 2026-07-05)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.schedule_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name       text NOT NULL,
  kind       text NOT NULL DEFAULT 'PERSONALIZADO'
             CHECK (kind IN ('PARTIDA','INTENSIVA','MANANA','TARDE','NOCHE','ROTATIVO','PERSONALIZADO')),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, name)
);

CREATE TABLE IF NOT EXISTS public.schedule_template_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.schedule_templates(id) ON DELETE CASCADE,
  weekday     int  NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time  time NOT NULL,
  end_time    time NOT NULL
);

CREATE TABLE IF NOT EXISTS public.employee_schedule_overrides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  weekday    int  NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  day_off    boolean NOT NULL DEFAULT false,
  start_time time,
  end_time   time,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_holidays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_fk_schedule_templates_account ON public.schedule_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_fk_schedule_template_slots_template ON public.schedule_template_slots(template_id);
CREATE INDEX IF NOT EXISTS idx_eso_user ON public.employee_schedule_overrides(account_id, user_id);
CREATE INDEX IF NOT EXISTS idx_holidays_account_date ON public.company_holidays(account_id, holiday_date);

ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS schedule_template_id uuid REFERENCES public.schedule_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_fk_employee_profiles_schedule ON public.employee_profiles(schedule_template_id);

ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_template_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "st_select" ON public.schedule_templates FOR SELECT
  USING (account_id = public.get_user_account_id((select auth.uid())));
CREATE POLICY "st_manage" ON public.schedule_templates FOR ALL
  USING (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')));

CREATE POLICY "sts_select" ON public.schedule_template_slots FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.schedule_templates st
                 WHERE st.id = template_id
                   AND st.account_id = public.get_user_account_id((select auth.uid()))));
CREATE POLICY "sts_manage" ON public.schedule_template_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.schedule_templates st
                 WHERE st.id = template_id
                   AND st.account_id = public.get_user_account_id((select auth.uid()))
                   AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedule_templates st
                 WHERE st.id = template_id
                   AND st.account_id = public.get_user_account_id((select auth.uid()))
                   AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN'))));

CREATE POLICY "eso_select" ON public.employee_schedule_overrides FOR SELECT
  USING (account_id = public.get_user_account_id((select auth.uid()))
         AND (user_id = (select auth.uid())
              OR public.has_role((select auth.uid()),'MANAGER')
              OR public.has_role((select auth.uid()),'MASTER_ADMIN')));
CREATE POLICY "eso_manage" ON public.employee_schedule_overrides FOR ALL
  USING (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')));

CREATE POLICY "ch_select" ON public.company_holidays FOR SELECT
  USING (account_id = public.get_user_account_id((select auth.uid())));
CREATE POLICY "ch_manage" ON public.company_holidays FOR ALL
  USING (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')))
  WITH CHECK (account_id = public.get_user_account_id((select auth.uid()))
         AND (public.has_role((select auth.uid()),'MANAGER') OR public.has_role((select auth.uid()),'MASTER_ADMIN')));

-- Semilla: 5 plantillas estándar por cuenta (L-V)
DO $$
DECLARE acc record; t record; tpl uuid; wd int; s record;
BEGIN
  FOR acc IN SELECT id FROM public.accounts LOOP
    IF NOT EXISTS (SELECT 1 FROM public.schedule_templates WHERE account_id = acc.id) THEN
      FOR t IN SELECT * FROM (VALUES
        ('Jornada partida',   'PARTIDA',    '[["09:00","14:00"],["15:00","18:00"]]'::jsonb),
        ('Jornada intensiva', 'INTENSIVA',  '[["08:00","15:00"]]'::jsonb),
        ('Turno mañana',      'MANANA',     '[["06:00","14:00"]]'::jsonb),
        ('Turno tarde',       'TARDE',      '[["14:00","22:00"]]'::jsonb),
        ('Turno noche',       'NOCHE',      '[["22:00","06:00"]]'::jsonb)
      ) AS v(name, kind, slots) LOOP
        INSERT INTO public.schedule_templates (account_id, name, kind)
        VALUES (acc.id, t.name, t.kind) RETURNING id INTO tpl;
        FOR wd IN 1..5 LOOP
          FOR s IN SELECT value FROM jsonb_array_elements(t.slots) LOOP
            INSERT INTO public.schedule_template_slots (template_id, weekday, start_time, end_time)
            VALUES (tpl, wd, (s.value->>0)::time, (s.value->>1)::time);
          END LOOP;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;
END $$;
