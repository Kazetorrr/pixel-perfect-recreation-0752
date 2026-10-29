CREATE FUNCTION public.complete_onboarding_test(p_username text,p_city text,p_color text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.cities; u uuid:=auth.uid();
BEGIN
 PERFORM public._require_testing();
 SELECT * INTO c FROM public.cities WHERE id=p_city;
 IF NOT FOUND THEN RAISE EXCEPTION 'Neznámé sídlo'; END IF;
 PERFORM public.complete_onboarding_verified(p_username,p_city,p_color,c.lat,c.lng,0);
 UPDATE public.profiles SET home_verified_at=NULL WHERE id=u;
END $$;
COMMENT ON FUNCTION public.complete_onboarding_test(text,text,text) IS 'Temporary shared-testing onboarding without GPS. Home stays unverified; disabled by testing_enabled; ordinary verified onboarding validations and starter allocation remain atomic.';
REVOKE ALL ON FUNCTION public.complete_onboarding_test(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_test(text,text,text) TO authenticated;