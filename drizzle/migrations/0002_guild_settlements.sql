CREATE OR REPLACE FUNCTION public.get_guild_settlements()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u uuid := auth.uid(); gid uuid;
BEGIN
  IF u IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT guild_id INTO gid FROM profiles WHERE id=u;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('city_id', x.city_id, 'owners', x.owners))
    FROM (
      SELECT pc.city_id,
        jsonb_agg(jsonb_build_object(
          'id', m.id, 'username', m.username, 'color', m.color,
          'market_level', pc.market_level, 'warehouse_level', pc.warehouse_level,
          'buildings', coalesce((SELECT jsonb_object_agg(b.resource,b.level) FROM buildings b WHERE b.user_id=m.id AND b.city_id=pc.city_id),'{}'::jsonb)
        ) ORDER BY (m.id<>u), m.guild_joined_at NULLS FIRST, m.id) AS owners
      FROM player_cities pc JOIN profiles m ON m.id=pc.user_id
      WHERE (m.id=u OR (gid IS NOT NULL AND m.guild_id=gid))
        AND (pc.market_level>0 OR EXISTS (SELECT 1 FROM buildings b WHERE b.user_id=m.id AND b.city_id=pc.city_id))
      GROUP BY pc.city_id
    ) x), '[]'::jsonb);
END $function$;
REVOKE EXECUTE ON FUNCTION public.get_guild_settlements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_guild_settlements() TO authenticated;