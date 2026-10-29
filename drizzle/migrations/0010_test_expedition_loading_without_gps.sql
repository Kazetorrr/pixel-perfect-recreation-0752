CREATE FUNCTION public.prepare_expedition_test(p_city text,p_amounts jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.cities;
BEGIN
 PERFORM public._require_testing();
 SELECT * INTO c FROM public.cities WHERE id=p_city;
 IF NOT FOUND THEN RAISE EXCEPTION 'Neznámé sídlo'; END IF;
 PERFORM public.prepare_expedition_gps(p_city,p_amounts,c.lat,c.lng,0);
END $$;
COMMENT ON FUNCTION public.prepare_expedition_test(text,jsonb) IS 'Shared-testing-only GPS bypass. Reuses authoritative ownership, capacity, stock and provenance checks; disabled by global testing switch.';
REVOKE ALL ON FUNCTION public.prepare_expedition_test(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_expedition_test(text,jsonb) TO authenticated;