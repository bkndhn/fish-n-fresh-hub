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
- Page on/off switches live in the `disabled_pages` table (path list); PageGate in __root blocks them for all roles and nav menus filter them — why: one source of truth shared across devices and roles.
- Business type presets (BUSINESS_HIDDEN_PAGES in pageVisibility) rewrite disabled_pages when the shop type changes in admin settings — why: each business only sees the pages it uses.
- Yield waste marked `[yield-cost-absorbed]` is physical waste only in P&L; use current product cost for unsnapshotted sales and label closing COGS accordingly — why: avoid charging cleaning loss twice without fabricating historical costs.
- Checkout preflight derives trade eligibility from the verified caller and saved account, then shares tier/discount calculations with the cart; never trust submitted trade status or item prices.
- Push enrollment succeeds only with a real subscription and a successful token write; failed subscription or persistence returns null rather than a placeholder token.
- Clear query caches on auth identity transitions and resolve sign-in workspaces from saved roles; never await auth methods inside an auth callback, to prevent stale permissions and session-lock deadlocks.
- Driver counter handover uses the existing verified delivery RPC; ordinary delivery orders retain PIN input, so UI changes never bypass server authorization.
- Keep phone chrome synchronized with computed background tokens and system theme changes; never pin the root background inline across themes.
