CREATE OR REPLACE FUNCTION public.sync_my_steps(p_day date, p_steps bigint) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); today date := (now() AT TIME ZONE 'Europe/Prague')::date; reg date;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Nepřihlášený hráč'; END IF;
 IF p_day IS NULL OR p_day < today - 1 OR p_day > today THEN RAISE EXCEPTION 'Synchronizovat lze jen dnešek a včerejšek'; END IF;
 IF p_steps IS NULL OR p_steps < 0 THEN RAISE EXCEPTION 'Neplatný počet kroků'; END IF;
 SELECT (created_at AT TIME ZONE 'Europe/Prague')::date INTO reg FROM public.profiles WHERE id = uid;
 IF reg IS NULL OR p_day < reg THEN RETURN 0; END IF;
 RETURN public.credit_verified_steps(uid,'health_connect','hc:'||p_day::text,p_day,least(p_steps,60000));
END $$;
REVOKE ALL ON FUNCTION public.sync_my_steps(date,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_my_steps(date,bigint) TO authenticated;