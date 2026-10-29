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
- Wallet, real walked totals and test totals are separate bigint fields; legacy SP fields are deprecated so migration cannot re-credit walking.
- Starter inventory lives in separately tracked lots and only enters expedition consumption, never shipment provenance, to enforce non-transferability.
- Fractional production is retained per building and allocated proportionally against shared storage; settle before every capacity-changing action to avoid polling-dependent production.
- `economy_settings.testing_enabled` gates all simulators server-side; privileged `set_testing_mode` is the single global launch switch, with shared testing enabled by default.
- Client economy helpers derive previews only from RPC configuration; server RPCs remain authoritative, and shipment request IDs prevent repeat delivery.
- City detail keeps upgrade-tree presentation and expedition supply controls in separate components; both use RPC configuration and authoritative actions to avoid duplicating balance rules.
- Expedition supplies move through prepare_expedition_gps as one atomic multi-resource action with owned-city and physical-location checks; the legacy remote-loading RPC is disabled to close bypass paths.
- Test onboarding uses a dedicated RPC gated by the global testing switch, reuses atomic onboarding validation/allocation and leaves home_verified_at null; it must never bypass account authentication or affect expedition GPS rules.
