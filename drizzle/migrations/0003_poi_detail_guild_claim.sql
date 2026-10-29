CREATE OR REPLACE FUNCTION public.get_poi_detail(p_poi text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'claims', coalesce((SELECT jsonb_agg(jsonb_build_object('username',pr.username,'guild',g.name,'verification',c.verification,'created_at',c.created_at) ORDER BY c.created_at DESC)
       FROM poi_claims c JOIN profiles pr ON pr.id=c.user_id LEFT JOIN guilds g ON g.id=c.guild_id WHERE c.poi_id=p_poi AND c.season_id=public._active_season()),'[]'::jsonb),
    'guild_claim', (SELECT jsonb_build_object('username',pr.username,'verification',c.verification,'created_at',c.created_at)
       FROM poi_claims c JOIN profiles pr ON pr.id=c.user_id
       WHERE c.poi_id=p_poi AND c.season_id=public._active_season() AND c.guild_id IS NOT NULL
         AND c.guild_id=(SELECT guild_id FROM profiles WHERE id=auth.uid())
       ORDER BY c.created_at ASC LIMIT 1),
    'guild_visitors', coalesce((SELECT jsonb_agg(jsonb_build_object('username',pr.username,'verification',v.verification,'created_at',v.created_at) ORDER BY v.created_at DESC)
       FROM poi_visits v JOIN profiles pr ON pr.id=v.user_id
       WHERE v.poi_id=p_poi AND v.season_id=public._active_season() AND v.guild_id IS NOT NULL AND v.guild_id=(SELECT guild_id FROM profiles WHERE id=auth.uid())),'[]'::jsonb)
  )
$$;