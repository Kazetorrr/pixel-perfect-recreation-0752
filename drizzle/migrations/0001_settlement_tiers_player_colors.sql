ALTER TABLE public.cities ADD COLUMN tier text NOT NULL DEFAULT 'town' CHECK (tier IN ('village','town','regional'));
UPDATE public.cities SET tier='regional' WHERE id IN ('zlin','brno');
UPDATE public.cities SET tier='village' WHERE id IN ('tecovice','sazovice');
ALTER TABLE public.profiles ADD COLUMN color text NOT NULL DEFAULT '#3b82f6';

CREATE OR REPLACE FUNCTION public.game_config()
 RETURNS jsonb LANGUAGE sql IMMUTABLE AS $function$
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
 "dev_day_seconds": 86400,
 "tier_bonus": {"village":{"production":0.15},"town":{"warehouse":0.15},"regional":{"logistics":0.20}},
 "player_colors": ["#3b82f6","#22d3ee","#14b8a6","#22c55e","#84cc16","#eab308","#f59e0b","#f97316","#ef4444","#f43f5e","#ec4899","#d946ef","#a855f7","#8b5cf6","#e2e8f0","#94a3b8"]
}'::jsonb $function$;

CREATE OR REPLACE FUNCTION public._wh_cap(p_uid uuid, p_city text)
 RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT floor(pc.warehouse_level * (public.game_config()->>'warehouse_capacity_per_level')::int
    * (1 + coalesce((public.game_config()->'tier_bonus'->c.tier->>'warehouse')::numeric,0)))::int
  FROM player_cities pc JOIN cities c ON c.id=pc.city_id WHERE pc.user_id=p_uid AND pc.city_id=p_city $$;
REVOKE EXECUTE ON FUNCTION public._wh_cap(uuid,text) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public._settle(p_uid uuid, p_city text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cfg jsonb := public.game_config(); b record; c cities; pc player_cities; nowv timestamptz; cap int; used int;
  rate numeric; produced int; room int; pb numeric;
BEGIN
  SELECT * INTO c FROM cities WHERE id=p_city;
  SELECT * INTO pc FROM player_cities WHERE user_id=p_uid AND city_id=p_city;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT now() + make_interval(secs => time_offset_seconds) INTO nowv FROM profiles WHERE id=p_uid;
  cap := public._wh_cap(p_uid, p_city);
  pb := 1 + coalesce((cfg->'tier_bonus'->c.tier->>'production')::numeric, 0);
  FOR b IN SELECT * FROM buildings WHERE user_id=p_uid AND city_id=p_city FOR UPDATE LOOP
    rate := pb * (cfg->'prod_per_level'->>b.level)::numeric * CASE b.resource WHEN 'blue' THEN c.eff_blue WHEN 'green' THEN c.eff_green WHEN 'yellow' THEN c.eff_yellow ELSE c.eff_red END;
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
END $function$;

CREATE OR REPLACE FUNCTION public.quote_shipment(p_from text, p_to text, p_qty integer)
 RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cfg jsonb := public.game_config(); km numeric; ml int; lb numeric;
BEGIN
  km := public._virtual_km(p_from, p_to);
  SELECT market_level INTO ml FROM player_cities WHERE user_id=auth.uid() AND city_id=p_from;
  SELECT coalesce((cfg->'tier_bonus'->tier->>'logistics')::numeric,0) INTO lb FROM cities WHERE id=p_from;
  RETURN greatest(1, ceil(km * p_qty * (cfg->>'transport_sp_per_unit_km')::numeric
     * (1 - least(coalesce(ml,0),4) * (cfg->>'market_discount_per_level')::numeric) / (1 + coalesce(lb,0))));
END $function$;

CREATE OR REPLACE FUNCTION public.send_shipment(p_from text, p_to text, p_resource text, p_qty integer, p_recipient uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  cap := public._wh_cap(rcpt, p_to);
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
END $function$;

DROP FUNCTION IF EXISTS public.complete_onboarding(text, text);
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_username text, p_city text, p_color text DEFAULT '#3b82f6')
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cfg jsonb := public.game_config(); u uuid := auth.uid(); r text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Nejste přihlášeni'; END IF;
  p_username := trim(p_username);
  IF length(p_username) < 3 OR length(p_username) > 20 THEN RAISE EXCEPTION 'Jméno musí mít 3–20 znaků'; END IF;
  IF NOT EXISTS (SELECT 1 FROM cities WHERE id=p_city) THEN RAISE EXCEPTION 'Neznámé město'; END IF;
  IF NOT (cfg->'player_colors') ? p_color THEN RAISE EXCEPTION 'Neplatná barva'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id=u AND username IS NOT NULL) THEN RAISE EXCEPTION 'Účet je již nastaven'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE lower(username)=lower(p_username)) THEN RAISE EXCEPTION 'Jméno je obsazené'; END IF;
  INSERT INTO profiles(id, username, home_city_id, current_city_id, sp_balance, color)
   VALUES (u, p_username, p_city, p_city, (cfg->>'starter_sp')::int, p_color)
   ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, home_city_id=EXCLUDED.home_city_id, current_city_id=EXCLUDED.current_city_id, sp_balance=EXCLUDED.sp_balance, color=EXCLUDED.color;
  INSERT INTO player_cities(user_id, city_id) VALUES (u, p_city) ON CONFLICT DO NOTHING;
  INSERT INTO buildings(user_id, city_id, resource, level, last_settled_at) VALUES (u, p_city, 'blue', 1, now()) ON CONFLICT DO NOTHING;
  FOREACH r IN ARRAY ARRAY['blue','green','yellow','red'] LOOP
    PERFORM public._add_lot(u,'city',p_city,r,u,(cfg->>'starter_resources')::int);
  END LOOP;
  INSERT INTO step_transactions(user_id, kind, sp, note) VALUES (u,'starter',(cfg->>'starter_sp')::int,'Startovní SP');
END $function$;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_player_color(p_color text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p profiles := public._me(); who text;
BEGIN
  IF NOT (public.game_config()->'player_colors') ? p_color THEN RAISE EXCEPTION 'Neplatná barva'; END IF;
  IF p.guild_id IS NOT NULL THEN
    PERFORM 1 FROM guilds WHERE id=p.guild_id FOR UPDATE;
    SELECT username INTO who FROM profiles WHERE guild_id=p.guild_id AND id<>p.id AND color=p_color LIMIT 1;
    IF who IS NOT NULL THEN RAISE EXCEPTION 'Barvu už v guildě používá hráč %', who; END IF;
  END IF;
  UPDATE profiles SET color=p_color WHERE id=p.id;
END $function$;
REVOKE EXECUTE ON FUNCTION public.set_player_color(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_player_color(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_state()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u uuid := auth.uid(); p profiles; c record; res jsonb;
BEGIN
  IF u IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM profiles WHERE id=u FOR UPDATE;
  IF NOT FOUND OR p.username IS NULL THEN RETURN jsonb_build_object('onboarded', false, 'config', public.game_config()); END IF;
  FOR c IN SELECT city_id FROM player_cities WHERE user_id=u LOOP PERFORM public._settle(u, c.city_id); END LOOP;
  SELECT jsonb_build_object(
    'onboarded', true,
    'profile', jsonb_build_object('id',p.id,'username',p.username,'home_city_id',p.home_city_id,'current_city_id',p.current_city_id,'color',p.color,
       'guild_id',p.guild_id,'steps_total',p.steps_total,'sp_balance',p.sp_balance,'sp_spent',p.sp_spent,'time_offset_seconds',p.time_offset_seconds),
    'cities', coalesce((SELECT jsonb_agg(jsonb_build_object('city_id',pc.city_id,'warehouse_level',pc.warehouse_level,'market_level',pc.market_level,
        'capacity', public._wh_cap(u, pc.city_id),
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
END $function$;