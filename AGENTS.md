<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Trekra architecture
- All game rules and balance numbers live in Postgres: `public.game_config()` plus SECURITY DEFINER RPCs (build_or_upgrade, send_shipment, claim_poi, …). Why: atomic, server-trusted state; clients have read-only table access.
- Resources are stored as provenance lots (`resource_lots`, origin_user_id) so economist scoring credits original suppliers only on consumption in a claim.
- `src/game/config.ts` holds presentation metadata only (Czech labels, colors, map style URL); never duplicate balance numbers there.
- Dev simulators (steps, time advance, demo GPS) are gated by `game_config().dev_mode`; simulated claims are stored with verification='simulated' and shown on separate leaderboards.
