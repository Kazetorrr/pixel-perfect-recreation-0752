CREATE OR REPLACE FUNCTION public.get_today_steps()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(credited_steps),0)::bigint FROM verified_step_events
  WHERE user_id = auth.uid() AND walked_day::date = (now() AT TIME ZONE 'Europe/Prague')::date
$$;
REVOKE ALL ON FUNCTION public.get_today_steps() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_today_steps() TO authenticated, service_role;