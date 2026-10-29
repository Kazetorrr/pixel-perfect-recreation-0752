ALTER TABLE public.profiles ADD COLUMN wallet_steps bigint NOT NULL DEFAULT 0, ADD COLUMN spent_steps bigint NOT NULL DEFAULT 0, ADD COLUMN walked_verified bigint NOT NULL DEFAULT 0, ADD COLUMN test_steps bigint NOT NULL DEFAULT 0, ADD COLUMN economy_migrated_at timestamptz, ADD COLUMN home_verified_at timestamptz, ADD COLUMN founded_count integer NOT NULL DEFAULT 1;
UPDATE public.profiles p SET wallet_steps=sp_balance::bigint*100,spent_steps=sp_spent::bigint*100,walked_verified=greatest(0,steps_total-(SELECT coalesce(sum(steps),0) FROM public.step_transactions WHERE user_id=p.id AND simulated)),test_steps=(SELECT coalesce(sum(steps),0) FROM public.step_transactions WHERE user_id=p.id AND simulated),founded_count=greatest(1,(SELECT count(*) FROM public.player_cities WHERE user_id=p.id)),economy_migrated_at=now() WHERE economy_migrated_at IS NULL;
ALTER TABLE public.step_transactions ADD COLUMN delta_steps bigint NOT NULL DEFAULT 0;
UPDATE public.step_transactions SET delta_steps=sp::bigint*100;
ALTER TABLE public.travels ADD COLUMN required_steps bigint NOT NULL DEFAULT 0, ADD COLUMN paid_steps bigint NOT NULL DEFAULT 0;
UPDATE public.travels SET required_steps=sp_required::bigint*100,paid_steps=sp_paid::bigint*100;
ALTER TABLE public.shipments ADD COLUMN cost_steps bigint NOT NULL DEFAULT 0, ADD COLUMN request_id uuid;
UPDATE public.shipments SET cost_steps=sp_cost::bigint*100;
CREATE UNIQUE INDEX shipments_idempotency ON public.shipments(sender_id,request_id) WHERE request_id IS NOT NULL;
ALTER TABLE public.player_cities ALTER COLUMN warehouse_level SET DEFAULT 0;
ALTER TABLE public.player_cities ADD COLUMN explicitly_founded boolean NOT NULL DEFAULT false;
ALTER TABLE public.buildings ADD COLUMN fractional_qty numeric NOT NULL DEFAULT 0;
DO $$ DECLARE c record; BEGIN FOR c IN SELECT user_id,city_id FROM public.player_cities LOOP PERFORM public._settle(c.user_id,c.city_id); END LOOP; END $$;
COMMENT ON COLUMN public.profiles.sp_balance IS 'DEPRECATED: replaced by wallet_steps';
COMMENT ON COLUMN public.profiles.sp_spent IS 'DEPRECATED: replaced by spent_steps';
COMMENT ON COLUMN public.profiles.steps_total IS 'DEPRECATED: replaced by walked_verified and test_steps';
COMMENT ON COLUMN public.profiles.step_remainder IS 'DEPRECATED: no conversion';
COMMENT ON COLUMN public.step_transactions.sp IS 'DEPRECATED: replaced by delta_steps';
COMMENT ON COLUMN public.travels.sp_required IS 'DEPRECATED: replaced by required_steps';
COMMENT ON COLUMN public.travels.sp_paid IS 'DEPRECATED: replaced by paid_steps';
COMMENT ON COLUMN public.shipments.sp_cost IS 'DEPRECATED: replaced by cost_steps';
CREATE TABLE public.economy_settings(id boolean PRIMARY KEY DEFAULT true,testing_enabled boolean NOT NULL DEFAULT true,CONSTRAINT settings_singleton CHECK(id));
GRANT SELECT ON public.economy_settings TO authenticated;
GRANT ALL ON public.economy_settings TO service_role;
ALTER TABLE public.economy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_read ON public.economy_settings FOR SELECT TO authenticated USING(true);
CREATE TABLE public.starter_lots(holder_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,location text NOT NULL,city_id text NOT NULL DEFAULT '',resource text NOT NULL,qty integer NOT NULL CHECK(qty>=0),PRIMARY KEY(holder_id,location,city_id,resource));
GRANT SELECT ON public.starter_lots TO authenticated;
GRANT ALL ON public.starter_lots TO service_role;
ALTER TABLE public.starter_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY starter_own ON public.starter_lots FOR SELECT TO authenticated USING(holder_id=auth.uid());
CREATE TABLE public.verified_step_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,source text NOT NULL,event_key text NOT NULL,walked_day date NOT NULL,credited_steps bigint NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,source,event_key));
GRANT SELECT ON public.verified_step_events TO authenticated;
GRANT ALL ON public.verified_step_events TO service_role;
ALTER TABLE public.verified_step_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY steps_own ON public.verified_step_events FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.game_config() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT '{"dev_mode":true,"max_level":6,"prod_per_level":[0,3,5,8,11,15,20],"build_cost":1500,"upgrade_cost":[0,1500,4000,8000,15000,27000,45000],"warehouse_max_level":5,"warehouse_capacity":[110,175,250,340,460,600],"warehouse_upgrade_cost":[0,2500,6500,14000,28000,50000],"market_max_level":3,"market_upgrade_cost":[0,6000,18000,48000],"market_capacity":[0,50,120,250],"market_discount":[0,0,0.2,0.35],"travel_base":500,"travel_per_km":45,"shipment_base":150,"shipment_per_km":5,"shipment_per_unit":3,"founding_second":12000,"founding_factor":5000,"starter_resources":{"blue":18,"green":22,"yellow":16,"red":14},"home_radius_km":{"village":3,"town":5,"regional":10},"expedition_capacity":100,"poi_cost":{"peak":25,"ruin":30,"tower":20,"monument":15},"category_resource":{"peak":"blue","ruin":"green","tower":"yellow","monument":"red"},"gps_radius_m":150,"gps_max_accuracy_m":100,"guild_max_members":10,"dev_day_seconds":86400,"tier_bonus":{"village":{"production":0.08},"town":{"warehouse":0.15},"regional":{"logistics":0.20}},"player_colors":["#3b82f6","#22d3ee","#14b8a6","#22c55e","#84cc16","#eab308","#f59e0b","#f97316","#ef4444","#f43f5e","#ec4899","#d946ef","#a855f7","#8b5cf6","#e2e8f0","#94a3b8"]}'::jsonb $$;
CREATE FUNCTION public.testing_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND coalesce((SELECT testing_enabled FROM economy_settings WHERE id),true) $$;
CREATE FUNCTION public._require_testing() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT public.testing_enabled() THEN RAISE EXCEPTION 'Testovací režim je vypnutý'; END IF; END $$;
CREATE FUNCTION public.set_testing_mode(p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO economy_settings(id,testing_enabled) VALUES(true,p_enabled) ON CONFLICT(id) DO UPDATE SET testing_enabled=excluded.testing_enabled; END $$;
REVOKE ALL ON FUNCTION public.set_testing_mode(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_testing_mode(boolean) TO service_role;
CREATE FUNCTION public._spend_steps(p_uid uuid,p_amount bigint,p_kind text,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF p_amount<0 THEN RAISE EXCEPTION 'Neplatná cena'; END IF;
 UPDATE profiles SET wallet_steps=wallet_steps-p_amount,spent_steps=spent_steps+p_amount WHERE id=p_uid AND wallet_steps>=p_amount;
 IF NOT FOUND THEN RAISE EXCEPTION 'Nedostatek kroků'; END IF;
 IF p_amount>0 THEN INSERT INTO step_transactions(user_id,kind,sp,delta_steps,note) VALUES(p_uid,p_kind,0,-p_amount,p_note); END IF;
END $$;
CREATE OR REPLACE FUNCTION public._virtual_km(a text,b text) RETURNS numeric LANGUAGE sql STABLE SET search_path=public AS $$ SELECT public._haversine_km(c1.lat,c1.lng,c2.lat,c2.lng)::numeric FROM cities c1,cities c2 WHERE c1.id=a AND c2.id=b $$;
CREATE OR REPLACE FUNCTION public._wh_cap(p_uid uuid,p_city text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT floor(110+((public.game_config()->'warehouse_capacity'->>least(pc.warehouse_level,5))::numeric-110)*(1+coalesce((public.game_config()->'tier_bonus'->c.tier->>'warehouse')::numeric,0)))::int FROM player_cities pc JOIN cities c ON c.id=pc.city_id WHERE pc.user_id=p_uid AND pc.city_id=p_city $$;
CREATE FUNCTION public._used_capacity(p_uid uuid,p_city text) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT sum(qty) FROM resource_lots WHERE holder_id=p_uid AND location='city' AND city_id=p_city),0)+coalesce((SELECT sum(qty) FROM starter_lots WHERE holder_id=p_uid AND location='city' AND city_id=p_city),0)+coalesce((SELECT sum(fractional_qty) FROM buildings WHERE user_id=p_uid AND city_id=p_city),0) $$;
CREATE OR REPLACE FUNCTION public._settle(p_uid uuid,p_city text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg jsonb:=public.game_config(); c cities; b record; nowv timestamptz; pending numeric:=0; room numeric; share numeric; rate numeric; amount numeric; whole integer;
BEGIN
 PERFORM 1 FROM profiles WHERE id=p_uid FOR UPDATE;
 PERFORM 1 FROM player_cities WHERE user_id=p_uid AND city_id=p_city FOR UPDATE; IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO c FROM cities WHERE id=p_city;
 SELECT now()+make_interval(secs=>time_offset_seconds) INTO nowv FROM profiles WHERE id=p_uid;
 FOR b IN SELECT * FROM buildings WHERE user_id=p_uid AND city_id=p_city FOR UPDATE LOOP
 rate:=(cfg->'prod_per_level'->>b.level)::numeric*(CASE b.resource WHEN 'blue' THEN c.eff_blue WHEN 'green' THEN c.eff_green WHEN 'yellow' THEN c.eff_yellow ELSE c.eff_red END)*(1+coalesce((cfg->'tier_bonus'->c.tier->>'production')::numeric,0));
 pending:=pending+greatest(0,extract(epoch FROM(nowv-b.last_settled_at)))*rate/86400;
 END LOOP;
 room:=greatest(public._wh_cap(p_uid,p_city)-public._used_capacity(p_uid,p_city),0);
 share:=CASE WHEN pending>0 THEN least(1,room/pending) ELSE 0 END;
 FOR b IN SELECT * FROM buildings WHERE user_id=p_uid AND city_id=p_city FOR UPDATE LOOP
 rate:=(cfg->'prod_per_level'->>b.level)::numeric*(CASE b.resource WHEN 'blue' THEN c.eff_blue WHEN 'green' THEN c.eff_green WHEN 'yellow' THEN c.eff_yellow ELSE c.eff_red END)*(1+coalesce((cfg->'tier_bonus'->c.tier->>'production')::numeric,0));
 amount:=b.fractional_qty+greatest(0,extract(epoch FROM(nowv-b.last_settled_at)))*rate/86400*share;
 whole:=floor(amount);
 IF whole>0 THEN PERFORM public._add_lot(p_uid,'city',p_city,b.resource,p_uid,whole); END IF;
 UPDATE buildings SET fractional_qty=amount-whole,last_settled_at=greatest(last_settled_at,nowv) WHERE user_id=p_uid AND city_id=p_city AND resource=b.resource;
 END LOOP;
END $$;
CREATE FUNCTION public._add_starter(p_uid uuid,p_loc text,p_city text,p_res text,p_qty integer) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ INSERT INTO starter_lots(holder_id,location,city_id,resource,qty) VALUES(p_uid,p_loc,coalesce(p_city,''),p_res,p_qty) ON CONFLICT(holder_id,location,city_id,resource) DO UPDATE SET qty=starter_lots.qty+excluded.qty $$;
CREATE FUNCTION public._take_supply(p_uid uuid,p_loc text,p_city text,p_res text,p_qty integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; prov jsonb:='[]'; need integer:=p_qty;
BEGIN
 SELECT qty INTO n FROM starter_lots WHERE holder_id=p_uid AND location=p_loc AND city_id=coalesce(p_city,'') AND resource=p_res FOR UPDATE;
 n:=least(coalesce(n,0),need);
 IF n>0 THEN UPDATE starter_lots SET qty=qty-n WHERE holder_id=p_uid AND location=p_loc AND city_id=coalesce(p_city,'') AND resource=p_res; need:=need-n; prov:=jsonb_build_array(jsonb_build_object('origin',p_uid,'qty',n,'starter',true)); END IF;
 IF need>0 THEN prov:=prov||public._take(p_uid,p_loc,p_city,p_res,need); END IF; RETURN prov;
END $$;
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_username text,p_city text,p_color text DEFAULT '#3b82f6') RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Domovské sídlo nejprve ověřte polohou'; END $$;
CREATE FUNCTION public.complete_onboarding_verified(p_username text,p_city text,p_color text,p_lat double precision,p_lng double precision,p_accuracy double precision) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg jsonb:=public.game_config(); u uuid:=auth.uid(); c cities; r text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Nejste přihlášeni'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 IF EXISTS(SELECT 1 FROM profiles WHERE id=u AND username IS NOT NULL) THEN RAISE EXCEPTION 'Domovské sídlo již nelze změnit'; END IF;
 IF length(trim(p_username))<3 OR length(trim(p_username))>20 THEN RAISE EXCEPTION 'Jméno musí mít 3–20 znaků'; END IF;
 IF NOT (cfg->'player_colors') ? p_color THEN RAISE EXCEPTION 'Neplatná barva'; END IF;
 SELECT * INTO c FROM cities WHERE id=p_city; IF NOT FOUND THEN RAISE EXCEPTION 'Neznámé sídlo'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR p_accuracy IS NULL OR p_accuracy<0 OR p_accuracy>(cfg->>'gps_max_accuracy_m')::numeric THEN RAISE EXCEPTION 'Poloha není dostupná nebo je příliš nepřesná'; END IF;
 IF public._haversine_km(p_lat,p_lng,c.lat,c.lng)>(cfg->'home_radius_km'->>c.tier)::numeric THEN RAISE EXCEPTION 'Zvolené sídlo není v povoleném okolí vaší polohy'; END IF;
 INSERT INTO profiles(id,username,home_city_id,current_city_id,color,home_verified_at,economy_migrated_at) VALUES(u,trim(p_username),p_city,p_city,p_color,now(),now()) ON CONFLICT(id) DO UPDATE SET username=excluded.username,home_city_id=excluded.home_city_id,current_city_id=excluded.current_city_id,color=excluded.color,home_verified_at=now(),economy_migrated_at=now();
 INSERT INTO player_cities(user_id,city_id,warehouse_level) VALUES(u,p_city,0);
 FOREACH r IN ARRAY ARRAY['blue','green','yellow','red'] LOOP PERFORM public._add_starter(u,'city',p_city,r,(cfg->'starter_resources'->>r)::int); END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.build_or_upgrade(p_city text,p_resource text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles:=public._me(); cfg jsonb:=public.game_config(); lvl int; cost bigint;
BEGIN
 IF p_resource NOT IN('blue','green','yellow','red') OR p_resource IS NULL THEN RAISE EXCEPTION 'Neznámý typ'; END IF;
 IF NOT EXISTS(SELECT 1 FROM player_cities WHERE user_id=p.id AND city_id=p_city) THEN RAISE EXCEPTION 'Nejprve založte sídlo'; END IF;
 PERFORM public._settle(p.id,p_city);
 SELECT level INTO lvl FROM buildings WHERE user_id=p.id AND city_id=p_city AND resource=p_resource FOR UPDATE; lvl:=coalesce(lvl,0);
 IF lvl>=(cfg->>'max_level')::int THEN RAISE EXCEPTION 'Maximální úroveň'; END IF;
 cost:=(cfg->'upgrade_cost'->>(lvl+1))::bigint; PERFORM public._spend_steps(p.id,cost,'build','Výrobna');
 INSERT INTO buildings(user_id,city_id,resource,level,last_settled_at) VALUES(p.id,p_city,p_resource,lvl+1,now()+make_interval(secs=>p.time_offset_seconds)) ON CONFLICT(user_id,city_id,resource) DO UPDATE SET level=excluded.level;
 RETURN jsonb_build_object('level',lvl+1,'cost',cost);
END $$;
CREATE OR REPLACE FUNCTION public.upgrade_facility(p_city text,p_kind text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles:=public._me(); cfg jsonb:=public.game_config(); pc player_cities; lvl int; cost bigint; maximum int;
BEGIN
 SELECT * INTO pc FROM player_cities WHERE user_id=p.id AND city_id=p_city FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Nejprve založte sídlo'; END IF;
 PERFORM public._settle(p.id,p_city);
 IF p_kind='warehouse' THEN lvl:=pc.warehouse_level; maximum:=(cfg->>'warehouse_max_level')::int; ELSIF p_kind='market' THEN lvl:=pc.market_level; maximum:=(cfg->>'market_max_level')::int; ELSE RAISE EXCEPTION 'Neznámá budova'; END IF;
 IF lvl>=maximum THEN RAISE EXCEPTION 'Maximální úroveň'; END IF;
 cost:=(cfg->(p_kind||'_upgrade_cost')->>(lvl+1))::bigint; PERFORM public._spend_steps(p.id,cost,'upgrade',CASE WHEN p_kind='market' THEN 'Tržiště' ELSE 'Vylepšení skladu' END);
 IF p_kind='warehouse' THEN UPDATE player_cities SET warehouse_level=lvl+1 WHERE user_id=p.id AND city_id=p_city; ELSE UPDATE player_cities SET market_level=lvl+1 WHERE user_id=p.id AND city_id=p_city; END IF;
 RETURN jsonb_build_object('level',lvl+1,'cost',cost);
END $$;
CREATE OR REPLACE FUNCTION public.start_travel(p_city text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles:=public._me(); cfg jsonb:=public.game_config(); km numeric; req bigint; t travels;
BEGIN
 IF p.current_city_id=p_city THEN RAISE EXCEPTION 'V tomto sídle již jste'; END IF;
 IF EXISTS(SELECT 1 FROM travels WHERE user_id=p.id AND status='active') THEN RAISE EXCEPTION 'Již máte rozpracovanou cestu'; END IF;
 km:=public._virtual_km(p.current_city_id,p_city); IF km IS NULL THEN RAISE EXCEPTION 'Neznámé sídlo'; END IF;
 req:=ceil((cfg->>'travel_base')::numeric+km*(cfg->>'travel_per_km')::numeric);
 INSERT INTO travels(user_id,from_city,to_city,distance_km,sp_required,required_steps) VALUES(p.id,p.current_city_id,p_city,km,0,req) RETURNING * INTO t; RETURN to_jsonb(t);
END $$;
CREATE OR REPLACE FUNCTION public.fund_travel(p_amount integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles:=public._me(); t travels; amt bigint;
BEGIN
 SELECT * INTO t FROM travels WHERE user_id=p.id AND status='active' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Žádná aktivní cesta'; END IF;
 amt:=least(coalesce(p_amount::bigint,t.required_steps-t.paid_steps),t.required_steps-t.paid_steps,p.wallet_steps);
 IF amt<=0 THEN RAISE EXCEPTION 'Nedostatek kroků'; END IF;
 PERFORM public._spend_steps(p.id,amt,'travel','Cesta'); UPDATE travels SET paid_steps=paid_steps+amt WHERE id=t.id RETURNING * INTO t;
 IF t.paid_steps>=t.required_steps THEN UPDATE travels SET status='completed',completed_at=now() WHERE id=t.id; UPDATE profiles SET current_city_id=t.to_city WHERE id=p.id; END IF;
 RETURN jsonb_build_object('completed',t.paid_steps>=t.required_steps,'paid',amt);
END $$;
CREATE FUNCTION public.found_settlement(p_city text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles:=public._me(); cfg jsonb:=public.game_config(); n integer:=p.founded_count+1; cost bigint;
BEGIN
 IF p.current_city_id<>p_city OR EXISTS(SELECT 1 FROM travels WHERE user_id=p.id AND status='active') THEN RAISE EXCEPTION 'Nejprve sem dokončete virtuální cestu'; END IF;
 IF EXISTS(SELECT 1 FROM player_cities WHERE user_id=p.id AND city_id=p_city) THEN RAISE EXCEPTION 'Sídlo již vlastníte'; END IF;
 cost:=CASE WHEN n=2 THEN (cfg->>'founding_second')::bigint ELSE (cfg->>'founding_factor')::bigint*n*(n-1) END;
 PERFORM public._spend_steps(p.id,cost,'found','Založení sídla');
 INSERT INTO player_cities(user_id,city_id,warehouse_level,explicitly_founded) VALUES(p.id,p_city,0,true); UPDATE profiles SET founded_count=n WHERE id=p.id; RETURN jsonb_build_object('cost',cost);
END $$;
CREATE FUNCTION public._market_capacity(p_uid uuid,p_city text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT floor((public.game_config()->'market_capacity'->>least(pc.market_level,3))::numeric*(1+coalesce((public.game_config()->'tier_bonus'->c.tier->>'logistics')::numeric,0)))::int FROM player_cities pc JOIN cities c ON c.id=pc.city_id WHERE pc.user_id=p_uid AND pc.city_id=p_city $$;
CREATE FUNCTION public._market_used(p_uid uuid,p_city text) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(sum(qty),0) FROM shipments WHERE sender_id=p_uid AND from_city=p_city AND status='completed' AND (created_at AT TIME ZONE 'Europe/Prague')::date=(now() AT TIME ZONE 'Europe/Prague')::date $$;
CREATE OR REPLACE FUNCTION public.quote_shipment(p_from text,p_to text,p_qty integer) RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg jsonb:=public.game_config(); km numeric; ml integer;
BEGIN
 SELECT market_level INTO ml FROM player_cities WHERE user_id=auth.uid() AND city_id=p_from;
 IF ml IS NULL OR ml<1 THEN RAISE EXCEPTION 'Odesílání vyžaduje postavené tržiště'; END IF;
 IF p_qty IS NULL OR p_qty<=0 THEN RAISE EXCEPTION 'Zadejte kladné množství'; END IF;
 km:=public._virtual_km(p_from,p_to); IF km IS NULL THEN RAISE EXCEPTION 'Neznámé sídlo'; END IF;
 IF p_from=p_to THEN RETURN 0; END IF;
 RETURN ceil(((cfg->>'shipment_base')::numeric+km*(cfg->>'shipment_per_km')::numeric+p_qty*(cfg->>'shipment_per_unit')::numeric)*(1-(cfg->'market_discount'->>least(ml,3))::numeric));
END $$;
CREATE OR REPLACE FUNCTION public.send_shipment(p_from text,p_to text,p_resource text,p_qty integer,p_recipient uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Obnovte aplikaci před odesláním zásilky'; END $$;
CREATE FUNCTION public.send_shipment_safe(p_from text,p_to text,p_resource text,p_qty integer,p_recipient uuid,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles; rcpt uuid:=coalesce(p_recipient,auth.uid()); rp profiles; cost integer; prov jsonb; e jsonb; sid uuid; old shipments; cap integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nejste přihlášeni'; END IF;
 PERFORM id FROM profiles WHERE id IN(auth.uid(),rcpt) ORDER BY id FOR UPDATE; p:=public._me();
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Chybí identifikátor zásilky'; END IF;
 SELECT * INTO old FROM shipments WHERE sender_id=p.id AND request_id=p_request_id;
 IF FOUND THEN IF old.from_city IS DISTINCT FROM p_from OR old.to_city IS DISTINCT FROM p_to OR old.resource IS DISTINCT FROM p_resource OR old.qty IS DISTINCT FROM p_qty OR old.recipient_id IS DISTINCT FROM rcpt THEN RAISE EXCEPTION 'Identifikátor již patří jiné zásilce'; END IF; RETURN jsonb_build_object('id',old.id,'cost',old.cost_steps); END IF;
 IF p_qty IS NULL OR p_qty<=0 THEN RAISE EXCEPTION 'Zadejte kladné množství'; END IF;
 IF p_from=p_to AND rcpt=p.id THEN RAISE EXCEPTION 'Zvolte jiné cílové sídlo'; END IF;
 SELECT * INTO rp FROM profiles WHERE id=rcpt;
 IF rcpt<>p.id AND (p.guild_id IS NULL OR rp.guild_id IS DISTINCT FROM p.guild_id) THEN RAISE EXCEPTION 'Příjemce není členem vaší guildy'; END IF;
 IF NOT EXISTS(SELECT 1 FROM player_cities WHERE user_id=rcpt AND city_id=p_to) THEN RAISE EXCEPTION 'Příjemce nemá v cíli sídlo'; END IF;
 cost:=public.quote_shipment(p_from,p_to,p_qty); cap:=public._market_capacity(p.id,p_from);
 IF public._market_used(p.id,p_from)+p_qty>cap THEN RAISE EXCEPTION 'Překročena denní odchozí kapacita tržiště'; END IF;
 PERFORM public._settle(p.id,p_from); PERFORM public._settle(rcpt,p_to);
 IF public._used_capacity(rcpt,p_to)+p_qty>public._wh_cap(rcpt,p_to) THEN RAISE EXCEPTION 'Cílový sklad nemá dost místa'; END IF;
 prov:=public._take(p.id,'city',p_from,p_resource,p_qty); PERFORM public._spend_steps(p.id,cost,'transport','Přeprava zásob');
 FOR e IN SELECT * FROM jsonb_array_elements(prov) LOOP PERFORM public._add_lot(rcpt,'city',p_to,p_resource,(e->>'origin')::uuid,(e->>'qty')::int); END LOOP;
 INSERT INTO shipments(sender_id,recipient_id,from_city,to_city,resource,qty,sp_cost,cost_steps,request_id) VALUES(p.id,rcpt,p_from,p_to,p_resource,p_qty,0,cost,p_request_id) RETURNING id INTO sid; RETURN jsonb_build_object('id',sid,'cost',cost);
END $$;
CREATE OR REPLACE FUNCTION public.dev_grant_steps(p_steps integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p profiles:=public._me(); BEGIN PERFORM public._require_testing(); IF p_steps IS NULL OR p_steps<=0 THEN RAISE EXCEPTION 'Zadejte kladný počet kroků'; END IF; UPDATE profiles SET wallet_steps=wallet_steps+p_steps,test_steps=test_steps+p_steps WHERE id=p.id; INSERT INTO step_transactions(user_id,kind,steps,sp,delta_steps,note,simulated) VALUES(p.id,'steps',p_steps,0,p_steps,'Testovací kroky',true); RETURN jsonb_build_object('steps',p_steps); END $$;
CREATE OR REPLACE FUNCTION public.dev_advance_day() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p profiles:=public._me(); c record; BEGIN PERFORM public._require_testing(); FOR c IN SELECT city_id FROM player_cities WHERE user_id=p.id LOOP PERFORM public._settle(p.id,c.city_id); END LOOP; UPDATE profiles SET time_offset_seconds=time_offset_seconds+(public.game_config()->>'dev_day_seconds')::bigint WHERE id=p.id; END $$;
CREATE FUNCTION public.credit_verified_steps(p_user uuid,p_source text,p_event_key text,p_day date,p_cumulative_steps bigint) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles; prev bigint; delta bigint;
BEGIN
 SELECT * INTO p FROM profiles WHERE id=p_user FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Neznámý hráč'; END IF;
 IF p_source NOT IN('health_connect','healthkit') OR p_source IS NULL OR p_event_key IS NULL OR length(p_event_key)<1 OR p_day IS NULL OR p_cumulative_steps IS NULL OR p_cumulative_steps<0 OR p_day<(p.created_at AT TIME ZONE 'Europe/Prague')::date OR p_day>(now() AT TIME ZONE 'Europe/Prague')::date THEN RAISE EXCEPTION 'Neplatný zdroj nebo datum kroků'; END IF;
 SELECT credited_steps INTO prev FROM verified_step_events WHERE user_id=p_user AND source=p_source AND event_key=p_event_key FOR UPDATE;
 IF EXISTS(SELECT 1 FROM verified_step_events WHERE user_id=p_user AND source=p_source AND event_key=p_event_key AND walked_day<>p_day) THEN RAISE EXCEPTION 'Událost patří jinému dni'; END IF;
 delta:=greatest(0,p_cumulative_steps-coalesce(prev,0));
 INSERT INTO verified_step_events(user_id,source,event_key,walked_day,credited_steps) VALUES(p_user,p_source,p_event_key,p_day,p_cumulative_steps) ON CONFLICT(user_id,source,event_key) DO UPDATE SET credited_steps=greatest(verified_step_events.credited_steps,excluded.credited_steps),updated_at=now();
 IF delta>0 THEN UPDATE profiles SET wallet_steps=wallet_steps+delta,walked_verified=walked_verified+delta WHERE id=p_user; INSERT INTO step_transactions(user_id,kind,sp,delta_steps,note) VALUES(p_user,'verified',0,delta,'Ověřené kroky'); END IF; RETURN delta;
END $$;
REVOKE ALL ON FUNCTION public.credit_verified_steps(uuid,text,text,date,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.credit_verified_steps(uuid,text,text,date,bigint) TO service_role;
CREATE OR REPLACE FUNCTION public.prepare_expedition(p_city text,p_resource text,p_qty integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles:=public._me(); cur integer; prov jsonb; e jsonb; cap integer:=(public.game_config()->>'expedition_capacity')::int;
BEGIN
 IF p_qty IS NULL OR p_qty<=0 THEN RAISE EXCEPTION 'Zadejte kladné množství'; END IF;
 IF NOT EXISTS(SELECT 1 FROM player_cities WHERE user_id=p.id AND city_id=p_city) THEN RAISE EXCEPTION 'K tomuto skladu nemáte přístup'; END IF;
 PERFORM public._settle(p.id,p_city);
 SELECT coalesce(sum(qty),0) INTO cur FROM (SELECT qty FROM resource_lots WHERE holder_id=p.id AND location='expedition' UNION ALL SELECT qty FROM starter_lots WHERE holder_id=p.id AND location='expedition') x;
 IF cur+p_qty>cap THEN RAISE EXCEPTION 'Kapacita expedice je % jednotek',cap; END IF;
 prov:=public._take_supply(p.id,'city',p_city,p_resource,p_qty);
 FOR e IN SELECT * FROM jsonb_array_elements(prov) LOOP IF coalesce((e->>'starter')::boolean,false) THEN PERFORM public._add_starter(p.id,'expedition','',p_resource,(e->>'qty')::int); ELSE PERFORM public._add_lot(p.id,'expedition','',p_resource,(e->>'origin')::uuid,(e->>'qty')::int); END IF; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.claim_poi(p_poi text,p_mode text,p_lat double precision,p_lng double precision,p_accuracy double precision) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p profiles:=public._me(); cfg jsonb:=public.game_config(); poi pois; season uuid:=public._active_season(); res text; cost int; dist float8; prov jsonb; e jsonb; cid uuid;
BEGIN
 SELECT * INTO poi FROM pois WHERE id=p_poi; IF NOT FOUND THEN RAISE EXCEPTION 'Neznámá lokalita'; END IF;
 IF season IS NULL THEN RAISE EXCEPTION 'Žádná aktivní sezóna'; END IF;
 IF p_mode='gps' THEN
 IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Poloha není k dispozici'; END IF;
 IF p_accuracy IS NULL OR p_accuracy<0 OR p_accuracy>(cfg->>'gps_max_accuracy_m')::float8 THEN RAISE EXCEPTION 'Poloha je příliš nepřesná'; END IF;
 dist:=public._haversine_km(p_lat,p_lng,poi.lat,poi.lng)*1000;
 IF dist>(cfg->>'gps_radius_m')::float8 THEN RAISE EXCEPTION 'Přibližte se na % m od lokality',cfg->>'gps_radius_m'; END IF;
 ELSIF p_mode='simulated' THEN PERFORM public._require_testing(); ELSE RAISE EXCEPTION 'Neplatný režim'; END IF;
 IF p.guild_id IS NOT NULL THEN PERFORM 1 FROM guilds WHERE id=p.guild_id FOR UPDATE; END IF;
 IF EXISTS(SELECT 1 FROM poi_claims WHERE season_id=season AND user_id=p.id AND poi_id=p_poi) THEN RAISE EXCEPTION 'Tuto lokalitu jste již v této sezóně získali'; END IF;
 IF p.guild_id IS NOT NULL AND EXISTS(SELECT 1 FROM poi_claims WHERE season_id=season AND guild_id=p.guild_id AND poi_id=p_poi) THEN INSERT INTO poi_visits(season_id,poi_id,user_id,guild_id,verification) VALUES(season,p_poi,p.id,p.guild_id,p_mode) ON CONFLICT DO NOTHING; RETURN jsonb_build_object('status','visit'); END IF;
 res:=cfg->'category_resource'->>poi.category; cost:=(cfg->'poi_cost'->>poi.category)::int;
 prov:=public._take_supply(p.id,'expedition','',res,cost);
 INSERT INTO poi_claims(season_id,poi_id,user_id,guild_id,verification,resource,resources_spent) VALUES(season,p_poi,p.id,p.guild_id,p_mode,res,cost) RETURNING id INTO cid;
 INSERT INTO poi_visits(season_id,poi_id,user_id,guild_id,verification) VALUES(season,p_poi,p.id,p.guild_id,p_mode) ON CONFLICT DO NOTHING;
 FOR e IN SELECT * FROM jsonb_array_elements(prov) LOOP IF (e->>'origin')::uuid<>p.id AND NOT coalesce((e->>'starter')::boolean,false) THEN INSERT INTO economist_score_events(claim_id,season_id,contributor_id,beneficiary_id,resource,qty,verification) VALUES(cid,season,(e->>'origin')::uuid,p.id,res,(e->>'qty')::int,p_mode); END IF; END LOOP;
 RETURN jsonb_build_object('status','claimed','claim_id',cid);
END $$;
CREATE OR REPLACE FUNCTION public.dev_reset() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); BEGIN PERFORM public._require_testing(); IF u IS NULL THEN RAISE EXCEPTION 'Nejste přihlášeni'; END IF;
 IF EXISTS(SELECT 1 FROM guilds WHERE owner_id=u) THEN UPDATE guilds g SET owner_id=(SELECT id FROM profiles WHERE guild_id=g.id AND id<>u ORDER BY guild_joined_at LIMIT 1) WHERE owner_id=u AND EXISTS(SELECT 1 FROM profiles WHERE guild_id=g.id AND id<>u); DELETE FROM guilds WHERE owner_id=u; END IF; DELETE FROM profiles WHERE id=u;
END $$;
CREATE OR REPLACE FUNCTION public.get_state() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); p profiles; c record; cfg jsonb:=public.game_config()||jsonb_build_object('dev_mode',public.testing_enabled());
BEGIN
 IF u IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO p FROM profiles WHERE id=u FOR UPDATE;
 IF NOT FOUND OR p.username IS NULL THEN RETURN jsonb_build_object('onboarded',false,'config',cfg); END IF;
 FOR c IN SELECT city_id FROM player_cities WHERE user_id=u LOOP PERFORM public._settle(u,c.city_id); END LOOP;
 RETURN jsonb_build_object('onboarded',true,
 'profile',jsonb_build_object('id',p.id,'username',p.username,'home_city_id',p.home_city_id,'current_city_id',p.current_city_id,'color',p.color,'guild_id',p.guild_id,'steps_total',p.walked_verified,'test_steps',p.test_steps,'wallet_steps',p.wallet_steps,'spent_steps',p.spent_steps,'founded_count',p.founded_count,'time_offset_seconds',p.time_offset_seconds),
 'cities',coalesce((SELECT jsonb_agg(jsonb_build_object('city_id',pc.city_id,'warehouse_level',pc.warehouse_level,'market_level',pc.market_level,'capacity',public._wh_cap(u,pc.city_id),'used_capacity',public._used_capacity(u,pc.city_id),'market_capacity',public._market_capacity(u,pc.city_id),'market_used',public._market_used(u,pc.city_id),
 'buildings',coalesce((SELECT jsonb_object_agg(b.resource,b.level) FROM buildings b WHERE b.user_id=u AND b.city_id=pc.city_id),'{}'::jsonb),
 'transferable',coalesce((SELECT jsonb_object_agg(x.resource,x.q) FROM (SELECT resource,sum(qty)::int q FROM resource_lots WHERE holder_id=u AND location='city' AND city_id=pc.city_id GROUP BY resource)x),'{}'::jsonb),
 'inventory',coalesce((SELECT jsonb_object_agg(x.resource,x.q) FROM (SELECT resource,sum(qty)::int q FROM (SELECT resource,qty FROM resource_lots WHERE holder_id=u AND location='city' AND city_id=pc.city_id UNION ALL SELECT resource,qty FROM starter_lots WHERE holder_id=u AND location='city' AND city_id=pc.city_id) all_lots GROUP BY resource)x),'{}'::jsonb))) FROM player_cities pc WHERE pc.user_id=u),'[]'::jsonb),
 'expedition',coalesce((SELECT jsonb_object_agg(x.resource,x.q) FROM (SELECT resource,sum(qty)::int q FROM (SELECT resource,qty FROM resource_lots WHERE holder_id=u AND location='expedition' UNION ALL SELECT resource,qty FROM starter_lots WHERE holder_id=u AND location='expedition') all_lots GROUP BY resource)x),'{}'::jsonb),
 'travel',(SELECT to_jsonb(t) FROM travels t WHERE t.user_id=u AND t.status='active'),
 'transactions',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM (SELECT kind,steps,delta_steps,note,simulated,created_at FROM step_transactions WHERE user_id=u ORDER BY created_at DESC LIMIT 15)s),'[]'::jsonb),
 'shipments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'from_city',s.from_city,'to_city',s.to_city,'resource',s.resource,'qty',s.qty,'cost_steps',s.cost_steps,'created_at',s.created_at,'direction',CASE WHEN s.sender_id=u AND s.recipient_id=u THEN 'internal' WHEN s.sender_id=u THEN 'out' ELSE 'in' END,'sender',(SELECT username FROM profiles WHERE id=s.sender_id),'recipient',(SELECT username FROM profiles WHERE id=s.recipient_id)) ORDER BY s.created_at DESC) FROM (SELECT * FROM shipments WHERE sender_id=u OR recipient_id=u ORDER BY created_at DESC LIMIT 20)s),'[]'::jsonb),
 'my_claims',coalesce((SELECT jsonb_agg(poi_id) FROM poi_claims WHERE user_id=u AND season_id=public._active_season()),'[]'::jsonb),
 'guild_claims',coalesce((SELECT jsonb_agg(poi_id) FROM poi_claims WHERE p.guild_id IS NOT NULL AND guild_id=p.guild_id AND season_id=public._active_season()),'[]'::jsonb),
 'season',(SELECT to_jsonb(s) FROM seasons s WHERE id=public._active_season()),'config',cfg);
END $$;
CREATE OR REPLACE FUNCTION public.get_guild_settlements() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); gid uuid;
BEGIN
 IF u IS NULL THEN RETURN '[]'::jsonb; END IF;
 SELECT guild_id INTO gid FROM profiles WHERE id=u;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('city_id',x.city_id,'owners',x.owners)) FROM (SELECT pc.city_id,jsonb_agg(jsonb_build_object('id',m.id,'username',m.username,'color',m.color,'market_level',pc.market_level,'warehouse_level',pc.warehouse_level,'buildings',coalesce((SELECT jsonb_object_agg(b.resource,b.level) FROM buildings b WHERE b.user_id=m.id AND b.city_id=pc.city_id),'{}'::jsonb)) ORDER BY(m.id<>u),m.guild_joined_at NULLS FIRST,m.id) owners FROM player_cities pc JOIN profiles m ON m.id=pc.user_id WHERE(m.id=u OR(gid IS NOT NULL AND m.guild_id=gid)) AND(pc.explicitly_founded OR pc.warehouse_level>0 OR pc.market_level>0 OR EXISTS(SELECT 1 FROM buildings b WHERE b.user_id=m.id AND b.city_id=pc.city_id)) GROUP BY pc.city_id)x),'[]'::jsonb);
END $$;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND (left(proname,1)='_' OR proname='complete_onboarding') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature); END LOOP; END $$;
GRANT EXECUTE ON FUNCTION public.game_config() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.testing_enabled(),public.get_state(),public.complete_onboarding_verified(text,text,text,double precision,double precision,double precision),public.send_shipment_safe(text,text,text,integer,uuid,uuid),public.found_settlement(text) TO authenticated;
REVOKE ALL ON FUNCTION public.testing_enabled(),public.get_state(),public.complete_onboarding_verified(text,text,text,double precision,double precision,double precision),public.send_shipment_safe(text,text,text,integer,uuid,uuid),public.found_settlement(text) FROM anon;
