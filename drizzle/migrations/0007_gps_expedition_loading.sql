CREATE OR REPLACE FUNCTION public.prepare_expedition(p_city text, p_resource text, p_qty integer) RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN RAISE EXCEPTION 'Nakládání zásob vyžaduje nové ověření GPS. Obnovte aplikaci.'; END $$;
COMMENT ON FUNCTION public.prepare_expedition(text,text,integer) IS 'DEPRECATED: replaced by prepare_expedition_gps; remote loading is prohibited.';
CREATE OR REPLACE FUNCTION public.prepare_expedition_gps(p_city text,p_amounts jsonb,p_lat double precision,p_lng double precision,p_accuracy double precision) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p profiles:=public._me(); cfg jsonb:=public.game_config(); c cities; cur bigint; total bigint:=0; r text; qty integer; prov jsonb; e jsonb;
BEGIN
 SELECT * INTO c FROM cities WHERE id=p_city;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM player_cities WHERE user_id=p.id AND city_id=p_city) THEN RAISE EXCEPTION 'Nakládat lze pouze z vlastního skladu'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR p_accuracy IS NULL OR p_accuracy NOT BETWEEN 0 AND (cfg->>'gps_max_accuracy_m')::double precision THEN RAISE EXCEPTION 'Poloha není dostupná nebo je příliš nepřesná'; END IF;
 IF public._haversine_km(p_lat,p_lng,c.lat,c.lng)>(cfg->'home_radius_km'->>c.tier)::double precision THEN RAISE EXCEPTION 'Pro naložení zásob musíte být fyzicky v okolí sídla (% km)',cfg->'home_radius_km'->>c.tier; END IF;
 IF p_amounts IS NULL OR jsonb_typeof(p_amounts)<>'object' THEN RAISE EXCEPTION 'Neplatné množství zásob'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_amounts) AS k WHERE k NOT IN('blue','green','yellow','red')) THEN RAISE EXCEPTION 'Neznámý typ zásob'; END IF;
 FOREACH r IN ARRAY ARRAY['blue','green','yellow','red'] LOOP
  IF p_amounts ? r AND (jsonb_typeof(p_amounts->r)<>'number' OR (p_amounts->>r)::numeric<>trunc((p_amounts->>r)::numeric) OR (p_amounts->>r)::numeric<0 OR (p_amounts->>r)::numeric>(cfg->>'expedition_capacity')::numeric) THEN RAISE EXCEPTION 'Zadejte celá nezáporná množství'; END IF;
  total:=total+coalesce((p_amounts->>r)::integer,0);
 END LOOP;
 IF total<=0 THEN RAISE EXCEPTION 'Vyberte zásoby k naložení'; END IF;
 SELECT coalesce(sum(qty),0) INTO cur FROM (SELECT qty FROM resource_lots WHERE holder_id=p.id AND location='expedition' UNION ALL SELECT qty FROM starter_lots WHERE holder_id=p.id AND location='expedition') x;
 IF cur+total>(cfg->>'expedition_capacity')::bigint THEN RAISE EXCEPTION 'V expedici není dost místa'; END IF;
 PERFORM public._settle(p.id,p_city);
 FOREACH r IN ARRAY ARRAY['blue','green','yellow','red'] LOOP
  qty:=coalesce((p_amounts->>r)::integer,0);
  IF qty=0 THEN CONTINUE; END IF;
  prov:=public._take_supply(p.id,'city',p_city,r,qty);
  FOR e IN SELECT * FROM jsonb_array_elements(prov) LOOP
   IF coalesce((e->>'starter')::boolean,false) THEN PERFORM public._add_starter(p.id,'expedition','',r,(e->>'qty')::integer);
   ELSE PERFORM public._add_lot(p.id,'expedition','',r,(e->>'origin')::uuid,(e->>'qty')::integer); END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.prepare_expedition_gps(text,jsonb,double precision,double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_expedition_gps(text,jsonb,double precision,double precision,double precision) TO authenticated,service_role;