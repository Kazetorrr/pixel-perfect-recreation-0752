
-- ===== Config =====
CREATE OR REPLACE FUNCTION public.game_config() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
SELECT '{
 "dev_mode": true,
 "steps_per_sp": 100,
 "starter_sp": 500,
 "starter_resources": 20,
 "max_level": 5,
 "prod_per_level": [0,10,16,24,34,46],
 "build_cost": 30,
 "upgrade_cost": [0,0,50,100,180,300],
 "warehouse_capacity_per_level": 300,
 "warehouse_upgrade_cost": [0,0,80,160,260,400],
 "market_upgrade_cost": [0,40,90,160,260,400],
 "travel_multiplier": 1.25,
 "sp_per_km": 13,
 "transport_sp_per_unit_km": 0.05,
 "market_discount_per_level": 0.1,
 "expedition_capacity": 100,
 "poi_cost": {"peak":25,"ruin":30,"tower":20,"monument":15},
 "category_resource": {"peak":"blue","ruin":"green","tower":"yellow","monument":"red"},
 "gps_radius_m": 150,
 "gps_max_accuracy_m": 100,
 "guild_max_members": 10,
 "dev_day_seconds": 86400
}'::jsonb $$;

-- ===== Tables =====
CREATE TABLE public.cities (
  id text PRIMARY KEY, name text NOT NULL, lat double precision NOT NULL, lng double precision NOT NULL,
  osm_id text, eff_blue numeric NOT NULL, eff_green numeric NOT NULL, eff_yellow numeric NOT NULL, eff_red numeric NOT NULL,
  special text
);
CREATE TABLE public.pois (
  id text PRIMARY KEY, osm_id text NOT NULL, name text NOT NULL,
  category text NOT NULL CHECK (category IN ('peak','ruin','tower','monument')),
  lat double precision NOT NULL, lng double precision NOT NULL, elevation int, osm_tags text
);
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, is_active boolean NOT NULL DEFAULT false
);
CREATE TABLE public.guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE,
  invite_code text NOT NULL UNIQUE, owner_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE, home_city_id text REFERENCES public.cities(id), current_city_id text REFERENCES public.cities(id),
  guild_id uuid REFERENCES public.guilds(id) ON DELETE SET NULL, guild_joined_at timestamptz,
  steps_total bigint NOT NULL DEFAULT 0, step_remainder int NOT NULL DEFAULT 0,
  sp_balance int NOT NULL DEFAULT 0 CHECK (sp_balance >= 0), sp_spent int NOT NULL DEFAULT 0,
  time_offset_seconds bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.player_cities (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, city_id text NOT NULL REFERENCES public.cities(id),
  warehouse_level int NOT NULL DEFAULT 1, market_level int NOT NULL DEFAULT 0, unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, city_id)
);
CREATE TABLE public.buildings (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, city_id text NOT NULL REFERENCES public.cities(id),
  resource text NOT NULL CHECK (resource IN ('blue','green','yellow','red')), level int NOT NULL DEFAULT 1,
  last_settled_at timestamptz NOT NULL, PRIMARY KEY (user_id, city_id, resource)
);
CREATE TABLE public.resource_lots (
  holder_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location text NOT NULL CHECK (location IN ('city','expedition')), city_id text NOT NULL DEFAULT '',
  resource text NOT NULL CHECK (resource IN ('blue','green','yellow','red')), origin_user_id uuid NOT NULL,
  qty int NOT NULL CHECK (qty >= 0), PRIMARY KEY (holder_id, location, city_id, resource, origin_user_id)
);
CREATE TABLE public.step_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL, steps int NOT NULL DEFAULT 0, sp int NOT NULL, note text, simulated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.step_transactions(user_id, created_at DESC);
CREATE TABLE public.travels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_city text NOT NULL REFERENCES public.cities(id), to_city text NOT NULL REFERENCES public.cities(id),
  distance_km numeric NOT NULL, sp_required int NOT NULL, sp_paid int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE UNIQUE INDEX travels_one_active ON public.travels(user_id) WHERE status = 'active';
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_city text NOT NULL REFERENCES public.cities(id), to_city text NOT NULL REFERENCES public.cities(id),
  resource text NOT NULL, qty int NOT NULL CHECK (qty > 0), sp_cost int NOT NULL, status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.shipments(sender_id); CREATE INDEX ON public.shipments(recipient_id);
CREATE TABLE public.poi_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), season_id uuid NOT NULL REFERENCES public.seasons(id),
  poi_id text NOT NULL REFERENCES public.pois(id), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guild_id uuid REFERENCES public.guilds(id) ON DELETE SET NULL,
  verification text NOT NULL CHECK (verification IN ('gps','simulated')), resource text NOT NULL, resources_spent int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX poi_claims_guild_once ON public.poi_claims(season_id, guild_id, poi_id) WHERE guild_id IS NOT NULL;
CREATE UNIQUE INDEX poi_claims_user_once ON public.poi_claims(season_id, user_id, poi_id);
CREATE TABLE public.poi_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), season_id uuid NOT NULL REFERENCES public.seasons(id),
  poi_id text NOT NULL REFERENCES public.pois(id), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guild_id uuid, verification text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, poi_id, user_id)
);
CREATE TABLE public.economist_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claim_id uuid NOT NULL REFERENCES public.poi_claims(id) ON DELETE CASCADE,
  season_id uuid NOT NULL, contributor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL, resource text NOT NULL, qty int NOT NULL, verification text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Grants & RLS (clients read only; all writes via functions) =====
GRANT SELECT ON public.cities, public.pois, public.seasons TO anon, authenticated;
GRANT SELECT ON public.guilds, public.profiles, public.player_cities, public.buildings, public.resource_lots,
  public.step_transactions, public.travels, public.shipments, public.poi_claims, public.poi_visits, public.economist_score_events TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poi_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poi_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economist_score_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON public.cities FOR SELECT USING (true);
CREATE POLICY "public read" ON public.pois FOR SELECT USING (true);
CREATE POLICY "public read" ON public.seasons FOR SELECT USING (true);
CREATE POLICY "auth read" ON public.guilds FOR SELECT TO authenticated USING (true);
CREATE POLICY "own read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own read" ON public.player_cities FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own read" ON public.buildings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own read" ON public.resource_lots FOR SELECT TO authenticated USING (holder_id = auth.uid());
CREATE POLICY "own read" ON public.step_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own read" ON public.travels FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own read" ON public.shipments FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "auth read" ON public.poi_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "own read" ON public.poi_visits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own read" ON public.economist_score_events FOR SELECT TO authenticated USING (contributor_id = auth.uid());

-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public._haversine_km(a_lat float8, a_lng float8, b_lat float8, b_lng float8) RETURNS float8
LANGUAGE sql IMMUTABLE AS $$
  SELECT 2*6371*asin(sqrt(power(sin(radians(b_lat-a_lat)/2),2) + cos(radians(a_lat))*cos(radians(b_lat))*power(sin(radians(b_lng-a_lng)/2),2)))
$$;

CREATE OR REPLACE FUNCTION public._virtual_km(a text, b text) RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT round((public._haversine_km(c1.lat,c1.lng,c2.lat,c2.lng) * (public.game_config()->>'travel_multiplier')::numeric)::numeric, 1)
  FROM cities c1, cities c2 WHERE c1.id=a AND c2.id=b
$$;

CREATE OR REPLACE FUNCTION public._me() RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nejste přihlášeni'; END IF;
  SELECT * INTO p FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR p.username IS NULL THEN RAISE EXCEPTION 'Nejprve dokončete registraci'; END IF;
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public._spend_sp(p_uid uuid, p_amount int, p_kind text, p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;
  UPDATE profiles SET sp_balance = sp_balance - p_amount, sp_spent = sp_spent + p_amount
   WHERE id = p_uid AND sp_balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nedostatek SP'; END IF;
  INSERT INTO step_transactions(user_id, kind, sp, note) VALUES (p_uid, p_kind, -p_amount, p_note);
END $$;

CREATE OR REPLACE FUNCTION public._res_label(r text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE r WHEN 'blue' THEN 'modrých' WHEN 'green' THEN 'zelených' WHEN 'yellow' THEN 'žlutých' ELSE 'červených' END
$$;

CREATE OR REPLACE FUNCTION public._add_lot(p_holder uuid, p_loc text, p_city text, p_res text, p_origin uuid, p_qty int) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO resource_lots(holder_id, location, city_id, resource, origin_user_id, qty)
  VALUES (p_holder, p_loc, coalesce(p_city,''), p_res, p_origin, p_qty)
  ON CONFLICT (holder_id, location, city_id, resource, origin_user_id) DO UPDATE SET qty = resource_lots.qty + EXCLUDED.qty
$$;

-- Take resources; returns [{origin, qty}] provenance. Own lots consumed last so foreign supplies get used (and credited) first.
CREATE OR REPLACE FUNCTION public._take(p_holder uuid, p_loc text, p_city text, p_res text, p_qty int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; need int := p_qty; t int; prov jsonb := '[]'::jsonb; total int;
BEGIN
  SELECT coalesce(sum(qty),0) INTO total FROM resource_lots
   WHERE holder_id=p_holder AND location=p_loc AND city_id=coalesce(p_city,'') AND resource=p_res;
  IF total < p_qty THEN RAISE EXCEPTION 'Nedostatek % zásob', public._res_label(p_res); END IF;
  FOR l IN SELECT * FROM resource_lots WHERE holder_id=p_holder AND location=p_loc AND city_id=coalesce(p_city,'') AND resource=p_res AND qty>0
           ORDER BY (origin_user_id = p_holder), qty DESC FOR UPDATE LOOP
    EXIT WHEN need <= 0;
    t := least(need, l.qty);
    UPDATE resource_lots SET qty = qty - t WHERE holder_id=l.holder_id AND location=l.location AND city_id=l.city_id AND resource=l.resource AND origin_user_id=l.origin_user_id;
    prov := prov || jsonb_build_object('origin', l.origin_user_id, 'qty', t);
    need := need - t;
  END LOOP;
  DELETE FROM resource_lots WHERE holder_id=p_holder AND qty=0;
  RETURN prov;
END $$;

CREATE OR REPLACE FUNCTION public._settle(p_uid uuid, p_city text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg jsonb := public.game_config(); b record; c cities; pc player_cities; nowv timestamptz; cap int; used int;
  rate numeric; produced int; room int;
BEGIN
  SELECT * INTO c FROM cities WHERE id=p_city;
  SELECT * INTO pc FROM player_cities WHERE user_id=p_uid AND city_id=p_city;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT now() + make_interval(secs => time_offset_seconds) INTO nowv FROM profiles WHERE id=p_uid;
  cap := pc.warehouse_level * (cfg->>'warehouse_capacity_per_level')::int;
  FOR b IN SELECT * FROM buildings WHERE user_id=p_uid AND city_id=p_city FOR UPDATE LOOP
    rate := (cfg->'prod_per_level'->>b.level)::numeric * CASE b.resource WHEN 'blue' THEN c.eff_blue WHEN 'green' THEN c.eff_green WHEN 'yellow' THEN c.eff_yellow ELSE c.eff_red END;
    IF rate <= 0 OR nowv <= b.last_settled_at THEN CONTINUE; END IF;
    produced := floor(extract(epoch FROM (nowv - b.last_settled_at)) / 86400.0 * rate);
    SELECT coalesce(sum(qty),0) INTO used FROM resource_lots WHERE holder_id=p_uid AND location='city' AND city_id=p_city;
    room := greatest(cap - used, 0);
    IF produced >= room THEN
      IF room > 0 THEN PERFORM public._add_lot(p_uid,'city',p_city,b.resource,p_uid,room); END IF;
      UPDATE buildings SET last_settled_at = nowv WHERE user_id=p_uid AND city_id=p_city AND resource=b.resource;
    ELSIF produced > 0 THEN
      PERFORM public._add_lot(p_uid,'city',p_city,b.resource,p_uid,produced);
      UPDATE buildings SET last_settled_at = last_settled_at + make_interval(secs => produced / rate * 86400)
       WHERE user_id=p_uid AND city_id=p_city AND resource=b.resource;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._active_season() RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM seasons WHERE is_active ORDER BY starts_at DESC LIMIT 1
$$;

-- ===== Public RPCs =====
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_username text, p_city text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg jsonb := public.game_config(); u uuid := auth.uid(); r text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Nejste přihlášeni'; END IF;
  p_username := trim(p_username);
  IF length(p_username) < 3 OR length(p_username) > 20 THEN RAISE EXCEPTION 'Jméno musí mít 3–20 znaků'; END IF;
  IF NOT EXISTS (SELECT 1 FROM cities WHERE id=p_city) THEN RAISE EXCEPTION 'Neznámé město'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id=u AND username IS NOT NULL) THEN RAISE EXCEPTION 'Účet je již nastaven'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE lower(username)=lower(p_username)) THEN RAISE EXCEPTION 'Jméno je obsazené'; END IF;
  INSERT INTO profiles(id, username, home_city_id, current_city_id, sp_balance)
   VALUES (u, p_username, p_city, p_city, (cfg->>'starter_sp')::int)
   ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, home_city_id=EXCLUDED.home_city_id, current_city_id=EXCLUDED.current_city_id, sp_balance=EXCLUDED.sp_balance;
  INSERT INTO player_cities(user_id, city_id) VALUES (u, p_city) ON CONFLICT DO NOTHING;
  INSERT INTO buildings(user_id, city_id, resource, level, last_settled_at) VALUES (u, p_city, 'blue', 1, now()) ON CONFLICT DO NOTHING;
  FOREACH r IN ARRAY ARRAY['blue','green','yellow','red'] LOOP
    PERFORM public._add_lot(u,'city',p_city,r,u,(cfg->>'starter_resources')::int);
  END LOOP;
  INSERT INTO step_transactions(user_id, kind, sp, note) VALUES (u,'starter',(cfg->>'starter_sp')::int,'Startovní SP');
END $$;

CREATE OR REPLACE FUNCTION public.get_state() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); p profiles; c record; res jsonb;
BEGIN
  IF u IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM profiles WHERE id=u FOR UPDATE;
  IF NOT FOUND OR p.username IS NULL THEN RETURN jsonb_build_object('onboarded', false); END IF;
  FOR c IN SELECT city_id FROM player_cities WHERE user_id=u LOOP PERFORM public._settle(u, c.city_id); END LOOP;
  SELECT jsonb_build_object(
    'onboarded', true,
    'profile', jsonb_build_object('id',p.id,'username',p.username,'home_city_id',p.home_city_id,'current_city_id',p.current_city_id,
       'guild_id',p.guild_id,'steps_total',p.steps_total,'sp_balance',p.sp_balance,'sp_spent',p.sp_spent,'time_offset_seconds',p.time_offset_seconds),
    'cities', coalesce((SELECT jsonb_agg(jsonb_build_object('city_id',pc.city_id,'warehouse_level',pc.warehouse_level,'market_level',pc.market_level,
        'buildings', coalesce((SELECT jsonb_object_agg(b.resource,b.level) FROM buildings b WHERE b.user_id=u AND b.city_id=pc.city_id),'{}'::jsonb),
        'inventory', coalesce((SELECT jsonb_object_agg(x.resource,x.q) FROM (SELECT resource, sum(qty)::int q FROM resource_lots WHERE holder_id=u AND location='city' AND city_id=pc.city_id GROUP BY resource) x),'{}'::jsonb)
      )) FROM player_cities pc WHERE pc.user_id=u),'[]'::jsonb),
    'expedition', coalesce((SELECT jsonb_object_agg(x.resource,x.q) FROM (SELECT resource, sum(qty)::int q FROM resource_lots WHERE holder_id=u AND location='expedition' GROUP BY resource) x),'{}'::jsonb),
    'travel', (SELECT to_jsonb(t) FROM travels t WHERE t.user_id=u AND t.status='active'),
    'transactions', coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM (SELECT kind, steps, sp, note, simulated, created_at FROM step_transactions WHERE user_id=u ORDER BY created_at DESC LIMIT 15) s),'[]'::jsonb),
    'shipments', coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'from_city',s.from_city,'to_city',s.to_city,'resource',s.resource,'qty',s.qty,'sp_cost',s.sp_cost,'created_at',s.created_at,
        'direction', CASE WHEN s.sender_id=u AND s.recipient_id=u THEN 'internal' WHEN s.sender_id=u THEN 'out' ELSE 'in' END,
        'sender', (SELECT username FROM profiles WHERE id=s.sender_id), 'recipient', (SELECT username FROM profiles WHERE id=s.recipient_id)) ORDER BY s.created_at DESC)
      FROM (SELECT * FROM shipments WHERE sender_id=u OR recipient_id=u ORDER BY created_at DESC LIMIT 20) s),'[]'::jsonb),
    'my_claims', coalesce((SELECT jsonb_agg(poi_id) FROM poi_claims WHERE user_id=u AND season_id=public._active_season()),'[]'::jsonb),
    'guild_claims', coalesce((SELECT jsonb_agg(poi_id) FROM poi_claims WHERE p.guild_id IS NOT NULL AND guild_id=p.guild_id AND season_id=public._active_season()),'[]'::jsonb),
    'season', (SELECT to_jsonb(s) FROM seasons s WHERE id=public._active_season()),
    'config', public.game_config()
  ) INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.dev_grant_steps(p_steps int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); per int := (public.game_config()->>'steps_per_sp')::int; total int; sp int;
BEGIN
  IF NOT (public.game_config()->>'dev_mode')::boolean THEN RAISE EXCEPTION 'Simulátor je vypnutý'; END IF;
  IF p_steps IS NULL OR p_steps <= 0 OR p_steps > 100000 THEN RAISE EXCEPTION 'Zadejte kladný počet kroků (max 100 000)'; END IF;
  total := p.step_remainder + p_steps; sp := total / per;
  UPDATE profiles SET steps_total = steps_total + p_steps, step_remainder = total % per, sp_balance = sp_balance + sp WHERE id=p.id;
  INSERT INTO step_transactions(user_id, kind, steps, sp, note, simulated) VALUES (p.id,'steps',p_steps,sp,'Simulované kroky',true);
  RETURN jsonb_build_object('sp', sp);
END $$;

CREATE OR REPLACE FUNCTION public.dev_advance_day() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); c record;
BEGIN
  IF NOT (public.game_config()->>'dev_mode')::boolean THEN RAISE EXCEPTION 'Simulátor je vypnutý'; END IF;
  FOR c IN SELECT city_id FROM player_cities WHERE user_id=p.id LOOP PERFORM public._settle(p.id, c.city_id); END LOOP;
  UPDATE profiles SET time_offset_seconds = time_offset_seconds + (public.game_config()->>'dev_day_seconds')::bigint WHERE id=p.id;
END $$;

CREATE OR REPLACE FUNCTION public.dev_reset() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF NOT (public.game_config()->>'dev_mode')::boolean THEN RAISE EXCEPTION 'Simulátor je vypnutý'; END IF;
  IF u IS NULL THEN RAISE EXCEPTION 'Nejste přihlášeni'; END IF;
  IF EXISTS (SELECT 1 FROM guilds WHERE owner_id=u) THEN
    UPDATE guilds g SET owner_id = (SELECT id FROM profiles WHERE guild_id=g.id AND id<>u ORDER BY guild_joined_at LIMIT 1) WHERE owner_id=u
      AND EXISTS (SELECT 1 FROM profiles WHERE guild_id=g.id AND id<>u);
    DELETE FROM guilds WHERE owner_id=u;
  END IF;
  DELETE FROM profiles WHERE id=u;
END $$;

CREATE OR REPLACE FUNCTION public.build_or_upgrade(p_city text, p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); cfg jsonb := public.game_config(); lvl int; cost int;
BEGIN
  IF p_resource NOT IN ('blue','green','yellow','red') THEN RAISE EXCEPTION 'Neznámý typ'; END IF;
  IF NOT EXISTS (SELECT 1 FROM player_cities WHERE user_id=p.id AND city_id=p_city) THEN RAISE EXCEPTION 'Do tohoto města musíte nejprve docestovat'; END IF;
  PERFORM public._settle(p.id, p_city);
  SELECT level INTO lvl FROM buildings WHERE user_id=p.id AND city_id=p_city AND resource=p_resource FOR UPDATE;
  IF lvl IS NULL THEN
    cost := (cfg->>'build_cost')::int;
    PERFORM public._spend_sp(p.id, cost, 'build', 'Stavba budovy');
    INSERT INTO buildings(user_id, city_id, resource, level, last_settled_at)
      SELECT p.id, p_city, p_resource, 1, now() + make_interval(secs => p.time_offset_seconds);
    RETURN jsonb_build_object('level',1,'cost',cost);
  END IF;
  IF lvl >= (cfg->>'max_level')::int THEN RAISE EXCEPTION 'Maximální úroveň'; END IF;
  cost := (cfg->'upgrade_cost'->>(lvl+1))::int;
  PERFORM public._spend_sp(p.id, cost, 'upgrade', 'Vylepšení produkce');
  UPDATE buildings SET level = level+1 WHERE user_id=p.id AND city_id=p_city AND resource=p_resource;
  RETURN jsonb_build_object('level',lvl+1,'cost',cost);
END $$;

CREATE OR REPLACE FUNCTION public.upgrade_facility(p_city text, p_kind text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); cfg jsonb := public.game_config(); pc player_cities; lvl int; cost int;
BEGIN
  SELECT * INTO pc FROM player_cities WHERE user_id=p.id AND city_id=p_city FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Do tohoto města musíte nejprve docestovat'; END IF;
  PERFORM public._settle(p.id, p_city);
  IF p_kind='warehouse' THEN lvl := pc.warehouse_level; ELSIF p_kind='market' THEN lvl := pc.market_level; ELSE RAISE EXCEPTION 'Neznámá budova'; END IF;
  IF lvl >= (cfg->>'max_level')::int THEN RAISE EXCEPTION 'Maximální úroveň'; END IF;
  cost := (cfg->(CASE WHEN p_kind='warehouse' THEN 'warehouse_upgrade_cost' ELSE 'market_upgrade_cost' END)->>(lvl+1))::int;
  PERFORM public._spend_sp(p.id, cost, 'upgrade', CASE WHEN p_kind='warehouse' THEN 'Vylepšení skladu' ELSE 'Tržiště' END);
  IF p_kind='warehouse' THEN UPDATE player_cities SET warehouse_level=lvl+1 WHERE user_id=p.id AND city_id=p_city;
  ELSE UPDATE player_cities SET market_level=lvl+1 WHERE user_id=p.id AND city_id=p_city; END IF;
  RETURN jsonb_build_object('level',lvl+1,'cost',cost);
END $$;

CREATE OR REPLACE FUNCTION public.start_travel(p_city text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); km numeric; req int; t travels;
BEGIN
  IF p.current_city_id = p_city THEN RAISE EXCEPTION 'V tomto městě již jste'; END IF;
  IF EXISTS (SELECT 1 FROM travels WHERE user_id=p.id AND status='active') THEN RAISE EXCEPTION 'Již máte rozpracovanou cestu'; END IF;
  km := public._virtual_km(p.current_city_id, p_city);
  IF km IS NULL THEN RAISE EXCEPTION 'Neznámé město'; END IF;
  req := ceil(km * (public.game_config()->>'sp_per_km')::numeric);
  INSERT INTO travels(user_id, from_city, to_city, distance_km, sp_required) VALUES (p.id, p.current_city_id, p_city, km, req) RETURNING * INTO t;
  RETURN to_jsonb(t);
END $$;

CREATE OR REPLACE FUNCTION public.fund_travel(p_amount int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); t travels; amt int;
BEGIN
  SELECT * INTO t FROM travels WHERE user_id=p.id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Žádná aktivní cesta'; END IF;
  amt := least(coalesce(p_amount, t.sp_required - t.sp_paid), t.sp_required - t.sp_paid, p.sp_balance);
  IF amt <= 0 THEN RAISE EXCEPTION 'Nedostatek SP'; END IF;
  PERFORM public._spend_sp(p.id, amt, 'travel', 'Cesta');
  UPDATE travels SET sp_paid = sp_paid + amt WHERE id=t.id RETURNING * INTO t;
  IF t.sp_paid >= t.sp_required THEN
    UPDATE travels SET status='completed', completed_at=now() WHERE id=t.id;
    UPDATE profiles SET current_city_id = t.to_city WHERE id=p.id;
    INSERT INTO player_cities(user_id, city_id) VALUES (p.id, t.to_city) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('completed', true, 'paid', amt);
  END IF;
  RETURN jsonb_build_object('completed', false, 'paid', amt);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_travel() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me();
BEGIN
  UPDATE travels SET status='cancelled', completed_at=now() WHERE user_id=p.id AND status='active';
END $$;

CREATE OR REPLACE FUNCTION public.quote_shipment(p_from text, p_to text, p_qty int) RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg jsonb := public.game_config(); km numeric; ml int;
BEGIN
  km := public._virtual_km(p_from, p_to);
  SELECT market_level INTO ml FROM player_cities WHERE user_id=auth.uid() AND city_id=p_from;
  RETURN greatest(1, ceil(km * p_qty * (cfg->>'transport_sp_per_unit_km')::numeric
     * (1 - least(coalesce(ml,0),4) * (cfg->>'market_discount_per_level')::numeric)));
END $$;

CREATE OR REPLACE FUNCTION public.send_shipment(p_from text, p_to text, p_resource text, p_qty int, p_recipient uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); rcpt uuid := coalesce(p_recipient, auth.uid()); rp profiles; cost int; prov jsonb; e jsonb;
  cap int; used int; sid uuid;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Zadejte kladné množství'; END IF;
  IF p_from = p_to AND rcpt = p.id THEN RAISE EXCEPTION 'Zvolte jiné cílové město'; END IF;
  IF NOT EXISTS (SELECT 1 FROM player_cities WHERE user_id=p.id AND city_id=p_from) THEN RAISE EXCEPTION 'Ve výchozím městě nemáte sklad'; END IF;
  IF rcpt <> p.id THEN
    SELECT * INTO rp FROM profiles WHERE id=rcpt FOR UPDATE;
    IF NOT FOUND OR p.guild_id IS NULL OR rp.guild_id IS DISTINCT FROM p.guild_id THEN RAISE EXCEPTION 'Příjemce není členem vaší guildy'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM player_cities WHERE user_id=rcpt AND city_id=p_to) THEN RAISE EXCEPTION 'Příjemce nemá v cílovém městě sklad'; END IF;
  PERFORM public._settle(p.id, p_from); PERFORM public._settle(rcpt, p_to);
  SELECT warehouse_level * (public.game_config()->>'warehouse_capacity_per_level')::int INTO cap FROM player_cities WHERE user_id=rcpt AND city_id=p_to;
  SELECT coalesce(sum(qty),0) INTO used FROM resource_lots WHERE holder_id=rcpt AND location='city' AND city_id=p_to;
  IF used + p_qty > cap THEN RAISE EXCEPTION 'Cílový sklad nemá dost místa (volno %)', cap-used; END IF;
  cost := public.quote_shipment(p_from, p_to, p_qty);
  PERFORM public._spend_sp(p.id, cost, 'transport', 'Přeprava zásob');
  prov := public._take(p.id, 'city', p_from, p_resource, p_qty);
  FOR e IN SELECT * FROM jsonb_array_elements(prov) LOOP
    PERFORM public._add_lot(rcpt, 'city', p_to, p_resource, (e->>'origin')::uuid, (e->>'qty')::int);
  END LOOP;
  INSERT INTO shipments(sender_id, recipient_id, from_city, to_city, resource, qty, sp_cost) VALUES (p.id, rcpt, p_from, p_to, p_resource, p_qty, cost) RETURNING id INTO sid;
  RETURN jsonb_build_object('id', sid, 'cost', cost);
END $$;

CREATE OR REPLACE FUNCTION public.prepare_expedition(p_city text, p_resource text, p_qty int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); cur int; prov jsonb; e jsonb; cap int := (public.game_config()->>'expedition_capacity')::int;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Zadejte kladné množství'; END IF;
  IF NOT EXISTS (SELECT 1 FROM player_cities WHERE user_id=p.id AND city_id=p_city) THEN RAISE EXCEPTION 'K tomuto skladu nemáte přístup'; END IF;
  PERFORM public._settle(p.id, p_city);
  SELECT coalesce(sum(qty),0) INTO cur FROM resource_lots WHERE holder_id=p.id AND location='expedition';
  IF cur + p_qty > cap THEN RAISE EXCEPTION 'Kapacita expedice je % jednotek (volno %)', cap, cap-cur; END IF;
  prov := public._take(p.id, 'city', p_city, p_resource, p_qty);
  FOR e IN SELECT * FROM jsonb_array_elements(prov) LOOP
    PERFORM public._add_lot(p.id, 'expedition', '', p_resource, (e->>'origin')::uuid, (e->>'qty')::int);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.claim_poi(p_poi text, p_mode text, p_lat float8, p_lng float8, p_accuracy float8) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); cfg jsonb := public.game_config(); poi pois; season uuid := public._active_season();
  res text; cost int; dist float8; prov jsonb; e jsonb; cid uuid;
BEGIN
  SELECT * INTO poi FROM pois WHERE id=p_poi;
  IF NOT FOUND THEN RAISE EXCEPTION 'Neznámá lokalita'; END IF;
  IF season IS NULL THEN RAISE EXCEPTION 'Žádná aktivní sezóna'; END IF;
  IF p_mode = 'gps' THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN RAISE EXCEPTION 'Poloha není k dispozici'; END IF;
    IF p_accuracy IS NULL OR p_accuracy > (cfg->>'gps_max_accuracy_m')::float8 THEN RAISE EXCEPTION 'Poloha je příliš nepřesná (±% m)', round(coalesce(p_accuracy,0)); END IF;
    dist := public._haversine_km(p_lat, p_lng, poi.lat, poi.lng) * 1000;
    IF dist > (cfg->>'gps_radius_m')::float8 THEN RAISE EXCEPTION 'Jste % m od lokality – přibližte se na % m', round(dist), cfg->>'gps_radius_m'; END IF;
  ELSIF p_mode = 'simulated' THEN
    IF NOT (cfg->>'dev_mode')::boolean THEN RAISE EXCEPTION 'Demo ověření je vypnuto'; END IF;
  ELSE RAISE EXCEPTION 'Neplatný režim'; END IF;

  IF EXISTS (SELECT 1 FROM poi_claims WHERE season_id=season AND user_id=p.id AND poi_id=p_poi) THEN RAISE EXCEPTION 'Tuto lokalitu jste již v této sezóně získali'; END IF;
  IF p.guild_id IS NOT NULL AND EXISTS (SELECT 1 FROM poi_claims WHERE season_id=season AND guild_id=p.guild_id AND poi_id=p_poi) THEN
    INSERT INTO poi_visits(season_id, poi_id, user_id, guild_id, verification) VALUES (season, p_poi, p.id, p.guild_id, p_mode) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status','visit');
  END IF;

  res := cfg->'category_resource'->>poi.category; cost := (cfg->'poi_cost'->>poi.category)::int;
  prov := public._take(p.id, 'expedition', '', res, cost);
  INSERT INTO poi_claims(season_id, poi_id, user_id, guild_id, verification, resource, resources_spent)
    VALUES (season, p_poi, p.id, p.guild_id, p_mode, res, cost) RETURNING id INTO cid;
  INSERT INTO poi_visits(season_id, poi_id, user_id, guild_id, verification) VALUES (season, p_poi, p.id, p.guild_id, p_mode) ON CONFLICT DO NOTHING;
  FOR e IN SELECT * FROM jsonb_array_elements(prov) LOOP
    IF (e->>'origin')::uuid <> p.id THEN
      INSERT INTO economist_score_events(claim_id, season_id, contributor_id, beneficiary_id, resource, qty, verification)
       VALUES (cid, season, (e->>'origin')::uuid, p.id, res, (e->>'qty')::int, p_mode);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('status','claimed','claim_id',cid);
END $$;

CREATE OR REPLACE FUNCTION public.get_poi_detail(p_poi text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'claims', coalesce((SELECT jsonb_agg(jsonb_build_object('username',pr.username,'guild',g.name,'verification',c.verification,'created_at',c.created_at) ORDER BY c.created_at DESC)
       FROM poi_claims c JOIN profiles pr ON pr.id=c.user_id LEFT JOIN guilds g ON g.id=c.guild_id WHERE c.poi_id=p_poi AND c.season_id=public._active_season()),'[]'::jsonb),
    'guild_visitors', coalesce((SELECT jsonb_agg(jsonb_build_object('username',pr.username,'verification',v.verification,'created_at',v.created_at) ORDER BY v.created_at DESC)
       FROM poi_visits v JOIN profiles pr ON pr.id=v.user_id
       WHERE v.poi_id=p_poi AND v.guild_id IS NOT NULL AND v.guild_id=(SELECT guild_id FROM profiles WHERE id=auth.uid())),'[]'::jsonb)
  )
$$;

CREATE OR REPLACE FUNCTION public.create_guild(p_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); g guilds;
BEGIN
  IF p.guild_id IS NOT NULL THEN RAISE EXCEPTION 'Již jste členem guildy'; END IF;
  p_name := trim(p_name);
  IF length(p_name) < 3 OR length(p_name) > 30 THEN RAISE EXCEPTION 'Název musí mít 3–30 znaků'; END IF;
  IF EXISTS (SELECT 1 FROM guilds WHERE lower(name)=lower(p_name)) THEN RAISE EXCEPTION 'Název je obsazený'; END IF;
  INSERT INTO guilds(name, invite_code, owner_id) VALUES (p_name, upper(substr(md5(gen_random_uuid()::text),1,6)), p.id) RETURNING * INTO g;
  UPDATE profiles SET guild_id=g.id, guild_joined_at=now() WHERE id=p.id;
  RETURN to_jsonb(g);
END $$;

CREATE OR REPLACE FUNCTION public.join_guild(p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); g guilds; n int;
BEGIN
  IF p.guild_id IS NOT NULL THEN RAISE EXCEPTION 'Již jste členem guildy'; END IF;
  SELECT * INTO g FROM guilds WHERE invite_code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Neplatný kód pozvánky'; END IF;
  SELECT count(*) INTO n FROM profiles WHERE guild_id=g.id;
  IF n >= (public.game_config()->>'guild_max_members')::int THEN RAISE EXCEPTION 'Guilda je plná'; END IF;
  UPDATE profiles SET guild_id=g.id, guild_joined_at=now() WHERE id=p.id;
  RETURN to_jsonb(g);
END $$;

CREATE OR REPLACE FUNCTION public.leave_guild() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p profiles := public._me(); nxt uuid;
BEGIN
  IF p.guild_id IS NULL THEN RAISE EXCEPTION 'Nejste v guildě'; END IF;
  UPDATE profiles SET guild_id=NULL, guild_joined_at=NULL WHERE id=p.id;
  IF EXISTS (SELECT 1 FROM guilds WHERE id=p.guild_id AND owner_id=p.id) THEN
    SELECT id INTO nxt FROM profiles WHERE guild_id=p.guild_id ORDER BY guild_joined_at LIMIT 1;
    IF nxt IS NULL THEN DELETE FROM guilds WHERE id=p.guild_id; ELSE UPDATE guilds SET owner_id=nxt WHERE id=p.guild_id; END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_guild() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE gid uuid; s uuid := public._active_season();
BEGIN
  SELECT guild_id INTO gid FROM profiles WHERE id=auth.uid();
  IF gid IS NULL THEN RETURN NULL; END IF;
  RETURN (SELECT jsonb_build_object(
    'id',g.id,'name',g.name,'invite_code',g.invite_code,'owner_id',g.owner_id,
    'members', (SELECT jsonb_agg(jsonb_build_object('id',m.id,'username',m.username,'home_city_id',m.home_city_id,'current_city_id',m.current_city_id,
        'cities',(SELECT coalesce(jsonb_agg(city_id),'[]'::jsonb) FROM player_cities WHERE user_id=m.id),
        'claims',(SELECT count(*) FROM poi_claims WHERE user_id=m.id AND season_id=s)) ORDER BY m.guild_joined_at) FROM profiles m WHERE m.guild_id=g.id),
    'stats', (SELECT jsonb_build_object('total',count(*),'spent',coalesce(sum(resources_spent),0),
        'verified', count(*) FILTER (WHERE verification='gps'),
        'peak',count(*) FILTER (WHERE po.category='peak'),'ruin',count(*) FILTER (WHERE po.category='ruin'),
        'tower',count(*) FILTER (WHERE po.category='tower'),'monument',count(*) FILTER (WHERE po.category='monument'))
        FROM poi_claims c JOIN pois po ON po.id=c.poi_id WHERE c.guild_id=g.id AND c.season_id=s),
    'activity', coalesce((SELECT jsonb_agg(a ORDER BY a->>'at' DESC) FROM (
        SELECT jsonb_build_object('type','claim','user',pr.username,'poi',po.name,'verification',c.verification,'at',c.created_at) a
          FROM poi_claims c JOIN profiles pr ON pr.id=c.user_id JOIN pois po ON po.id=c.poi_id WHERE c.guild_id=g.id
        UNION ALL
        SELECT jsonb_build_object('type','shipment','user',ps.username,'to',pr.username,'qty',sh.qty,'resource',sh.resource,'at',sh.created_at)
          FROM shipments sh JOIN profiles ps ON ps.id=sh.sender_id JOIN profiles pr ON pr.id=sh.recipient_id
          WHERE sh.sender_id<>sh.recipient_id AND ps.guild_id=g.id AND pr.guild_id=g.id
        ORDER BY 1 DESC LIMIT 20) x),'[]'::jsonb)
  ) FROM guilds g WHERE g.id=gid);
END $$;

CREATE OR REPLACE FUNCTION public.get_leaderboards(p_category text, p_verification text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'guilds', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'score')::int DESC) FROM (
       SELECT jsonb_build_object('name',g.name,'score',count(*),'members',(SELECT count(*) FROM profiles WHERE guild_id=g.id)) x
       FROM poi_claims c JOIN guilds g ON g.id=c.guild_id JOIN pois po ON po.id=c.poi_id
       WHERE c.season_id=public._active_season() AND c.verification=p_verification AND (p_category='all' OR po.category=p_category)
       GROUP BY g.id ORDER BY count(*) DESC LIMIT 50) t),'[]'::jsonb),
    'explorers', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'score')::int DESC) FROM (
       SELECT jsonb_build_object('name',pr.username,'guild',(SELECT name FROM guilds WHERE id=pr.guild_id),'score',count(*)) x
       FROM poi_claims c JOIN profiles pr ON pr.id=c.user_id JOIN pois po ON po.id=c.poi_id
       WHERE c.season_id=public._active_season() AND c.verification=p_verification AND (p_category='all' OR po.category=p_category)
       GROUP BY pr.id ORDER BY count(*) DESC LIMIT 50) t),'[]'::jsonb),
    'economists', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'score')::int DESC) FROM (
       SELECT jsonb_build_object('name',pr.username,'guild',(SELECT name FROM guilds WHERE id=pr.guild_id),'score',sum(e.qty)) x
       FROM economist_score_events e JOIN profiles pr ON pr.id=e.contributor_id
       WHERE e.season_id=public._active_season() AND e.verification=p_verification
       GROUP BY pr.id ORDER BY sum(e.qty) DESC LIMIT 50) t),'[]'::jsonb)
  )
$$;

-- Lock down helpers; expose RPCs to signed-in users
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_config(), public.get_state(), public.complete_onboarding(text,text), public.dev_grant_steps(int),
  public.dev_advance_day(), public.dev_reset(), public.build_or_upgrade(text,text), public.upgrade_facility(text,text),
  public.start_travel(text), public.fund_travel(int), public.cancel_travel(), public.quote_shipment(text,text,int),
  public.send_shipment(text,text,text,int,uuid), public.prepare_expedition(text,text,int),
  public.claim_poi(text,text,float8,float8,float8), public.get_poi_detail(text), public.create_guild(text),
  public.join_guild(text), public.leave_guild(), public.get_guild(), public.get_leaderboards(text,text) TO authenticated;

-- ===== Seed =====
INSERT INTO public.cities(id,name,lat,lng,osm_id,eff_blue,eff_green,eff_yellow,eff_red,special) VALUES
('zlin','Zlín',49.22677,17.66674,'n1598988152',1.20,0.90,0.70,1.00,'Průmyslové město'),
('otrokovice','Otrokovice',49.20883,17.53539,'n314657716',0.95,1.20,1.00,0.80,'Dopravní uzel'),
('napajedla','Napajedla',49.17159,17.51137,'n1598988196',1.00,1.10,0.80,0.70,NULL),
('vizovice','Vizovice',49.22314,17.85451,'n1598988160',0.70,0.85,1.30,0.75,'Brána Beskyd'),
('tecovice','Tečovice',49.22107,17.58733,'n1598988170',0.90,1.00,0.90,0.85,NULL),
('sazovice','Sazovice',49.24102,17.56882,'n1598988178',0.85,0.95,1.10,0.80,NULL),
('kromeriz','Kroměříž',49.29842,17.39298,'n1598911116',0.80,1.15,0.90,1.25,'Historické město'),
('holesov','Holešov',49.33372,17.57868,'n1598911131',1.05,0.90,1.05,1.10,NULL),
('uherske-hradiste','Uherské Hradiště',49.06810,17.46639,'n2343424942',0.90,1.25,1.00,1.05,NULL),
('brno','Brno',49.19224,16.61134,'n1601566699',0.75,0.85,1.10,1.25,'Metropole');

INSERT INTO public.pois(id,osm_id,name,category,lat,lng,elevation,osm_tags) VALUES
('n990213274','n990213274','Barabáš','peak',49.21185,17.66609,410,'natural=peak'),
('n990213355','n990213355','Tlustá hora','peak',49.20849,17.6464,458,'natural=peak'),
('n997548358','n997548358','Šternberk','peak',49.20869,17.62569,344,'natural=peak'),
('n1725882240','n1725882240','Klenčov','peak',49.17121,17.72687,536,'natural=peak'),
('n1729839714','n1729839714','Komonec','peak',49.15674,17.77329,672,'natural=peak'),
('n1800001935','n1800001935','Kamenná','peak',49.13793,17.70541,482,'natural=peak'),
('n1851847344','n1851847344','Suchý vrch','peak',49.19607,17.90831,694,'natural=peak'),
('n2357192495','n2357192495','Hřeben','peak',49.25723,17.61352,399,'natural=peak'),
('n2338631497','n2338631497','Nad Bařinami','peak',49.29137,17.81501,534,'natural=peak'),
('n1242959353','n1242959353','Kula','peak',49.20355,17.41314,391,'natural=peak'),
('n700343551','n700343551','Smrdutá','peak',49.37431,17.75674,750,'natural=peak'),
('n430001425','n430001425','Holý vrch','peak',49.1801,17.35364,544,'natural=peak'),
('n929081504','n929081504','Starý Světlov','ruin',49.15192,17.76298,NULL,'historic=ruins'),
('n1357544882','n1357544882','Engelsberk','ruin',49.16319,17.79836,NULL,'historic=ruins'),
('n3081929993','n3081929993','Rýsov','ruin',49.15246,17.7343,NULL,'historic=ruins'),
('w58205731','w58205731','Zřícenina hradu Lukov','ruin',49.30324,17.74007,NULL,'historic=castle + ruins=yes'),
('n6567288705','n6567288705','Janův Hrad','ruin',49.2008,17.83294,NULL,'historic=ruins'),
('n4864686499','n4864686499','Šarov','ruin',49.13352,17.60896,NULL,'historic=ruins'),
('n4783204715','n4783204715','Zřícenina hradu Chlum','ruin',49.38107,17.65278,NULL,'historic=ruins'),
('n2628738552','n2628738552','Obřany','ruin',49.36663,17.73223,NULL,'historic=ruins'),
('r3458729','r3458729','Tvrz Kurovice','ruin',49.28844,17.5168,NULL,'historic=ruins'),
('w134575737','w134575737','Cimburk','ruin',49.10368,17.21627,413,'historic=castle + ruins=yes'),
('n7650049888','n7650049888','Zřícenina hradu Křídlo','ruin',49.35623,17.66477,NULL,'historic=ruins'),
('w367113086','w367113086','Na Strážné','tower',49.25543,17.59601,NULL,'man_made=tower + tower:type=observation'),
('n10067375148','n10067375148','Rozhledna Kurovický lom','tower',49.27366,17.52008,NULL,'man_made=tower + tower:type=observation'),
('n9899533783','n9899533783','Rozhledna Doubrava','tower',49.18377,17.87288,NULL,'man_made=tower + tower:type=observation'),
('w52572463','w52572463','Rozhledna císaře Františka Josefa I.','tower',49.38015,17.70182,NULL,'man_made=tower + tower:type=observation'),
('w977945508','w977945508','Rozhledna Maruška','tower',49.36591,17.82839,NULL,'man_made=tower + tower:type=observation'),
('w520489310','w520489310','Vartovna','tower',49.27,17.93878,688,'man_made=tower + tower:type=observation'),
('w82717360','w82717360','Rozhledna Brdo','tower',49.17068,17.30822,NULL,'man_made=tower + tower:type=observation'),
('n12025415071','n12025415071','Rozhledna Kelčský Javorník','tower',49.40011,17.76549,905,'man_made=tower + tower:type=observation'),
('n822897593','n822897593','Rozhledna Rovnina','tower',49.0715,17.51316,335,'man_made=tower + tower:type=observation'),
('w1113247676','w1113247676','Rozhledna Salaš','tower',49.14285,17.35224,NULL,'man_made=tower + tower:type=observation'),
('n992670809','n992670809','T. G. Masaryk','monument',49.22274,17.66433,NULL,'historic=memorial'),
('n886023328','n886023328','Památník obětem první světové války','monument',49.20876,17.70596,NULL,'historic=memorial'),
('n1332795110','n1332795110','Mohyla padlým','monument',49.1761,17.67866,NULL,'historic=memorial'),
('n331596594','n331596594','Morový sloup','monument',49.29879,17.39349,NULL,'historic=memorial'),
('n700166306','n700166306','Památník partyzánské brigády Jana Žižky','monument',49.35341,17.81264,NULL,'historic=memorial'),
('n1340735165','n1340735165','Pomník obětem 1. světové války','monument',49.17599,17.58659,NULL,'historic=monument'),
('n6900724024','n6900724024','Obětem druhé světové války','monument',49.21792,17.74733,NULL,'historic=monument'),
('n9663364741','n9663364741','Vůdcům Valašského povstání','monument',49.31049,17.76263,NULL,'historic=monument'),
('n11235653927','n11235653927','Jan Žižka','monument',49.25823,17.50425,NULL,'historic=monument'),
('n512157358','n512157358','K. H. Borovský','monument',49.17058,17.51397,NULL,'historic=memorial');

INSERT INTO public.seasons(name, starts_at, ends_at, is_active) VALUES ('Sezóna 1', now(), now() + interval '30 days', true);
