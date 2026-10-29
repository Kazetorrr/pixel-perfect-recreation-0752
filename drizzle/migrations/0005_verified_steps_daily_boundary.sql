CREATE OR REPLACE FUNCTION public.credit_verified_steps(p_user uuid,p_source text,p_event_key text,p_day date,p_cumulative_steps bigint) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles; prev bigint; delta bigint;
BEGIN
 SELECT * INTO p FROM profiles WHERE id=p_user FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Neznámý hráč'; END IF;
 IF p_source IS NULL OR p_source NOT IN('health_connect','healthkit') OR p_event_key IS NULL OR length(p_event_key)<1 OR p_day IS NULL OR p_cumulative_steps IS NULL OR p_cumulative_steps<0 OR p_day<(p.created_at AT TIME ZONE 'Europe/Prague')::date OR p_day>(now() AT TIME ZONE 'Europe/Prague')::date THEN RAISE EXCEPTION 'Neplatný zdroj nebo datum kroků'; END IF;
 IF EXISTS(SELECT 1 FROM verified_step_events WHERE user_id=p_user AND source=p_source AND event_key=p_event_key AND walked_day<>p_day) THEN RAISE EXCEPTION 'Událost patří jinému dni'; END IF;
 -- Adapter must submit the deduplicated cumulative daily movement total, not per-device batches.
 -- Maximum across sources prevents the same daily walking from being credited twice.
 SELECT coalesce(max(credited_steps),0) INTO prev FROM verified_step_events WHERE user_id=p_user AND walked_day=p_day;
 delta:=greatest(0,p_cumulative_steps-prev);
 INSERT INTO verified_step_events(user_id,source,event_key,walked_day,credited_steps) VALUES(p_user,p_source,p_event_key,p_day,p_cumulative_steps) ON CONFLICT(user_id,source,event_key) DO UPDATE SET credited_steps=greatest(verified_step_events.credited_steps,excluded.credited_steps),updated_at=now();
 IF delta>0 THEN UPDATE profiles SET wallet_steps=wallet_steps+delta,walked_verified=walked_verified+delta WHERE id=p_user; INSERT INTO step_transactions(user_id,kind,sp,delta_steps,note) VALUES(p_user,'verified',0,delta,'Ověřené kroky'); END IF; RETURN delta;
END $$;
REVOKE ALL ON FUNCTION public.credit_verified_steps(uuid,text,text,date,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.credit_verified_steps(uuid,text,text,date,bigint) TO service_role;
COMMENT ON FUNCTION public.credit_verified_steps(uuid,text,text,date,bigint) IS 'Trusted adapter only: submit cumulative deduplicated daily totals, no raw per-device batches. Daily maximum prevents replay under new IDs and cross-source double credit.';
COMMENT ON COLUMN public.profiles.home_city_id IS 'Permanently assigned at onboarding. Existing homes grandfathered; GPS checks are browser-coordinate validation, not device attestation.';
