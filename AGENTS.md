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
