CREATE TABLE public.health_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  kind TEXT NOT NULL,
  value1 NUMERIC NOT NULL,
  value2 NUMERIC,
  context TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_readings TO authenticated;
GRANT ALL ON public.health_readings TO service_role;
ALTER TABLE public.health_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own readings select" ON public.health_readings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own readings insert" ON public.health_readings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own readings update" ON public.health_readings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own readings delete" ON public.health_readings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX health_readings_user_idx ON public.health_readings(user_id, kind, recorded_at);

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  care_type TEXT NOT NULL,
  clinic TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own appts select" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own appts insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own appts update" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own appts delete" ON public.appointments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX appointments_user_idx ON public.appointments(user_id, starts_at);