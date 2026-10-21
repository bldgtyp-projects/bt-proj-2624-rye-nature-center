# Hosting and access

## Current state: public draft

Published 21 October 2026 as a **public, noindex draft**, matching the other bt-web-report sites (Ed chose public over an OTP gate for the draft).

| Item | Value |
| --- | --- |
| URL | https://project-2624.bldgtyp.com |
| Repository | [bldgtyp-projects/bt-proj-2624-rye-nature-center](https://github.com/bldgtyp-projects/bt-proj-2624-rye-nature-center) (public; checkout is this `04_Web/` folder) |
| Pages project | `bt-proj-2624-rye-nature-center`, direct upload, account `phtools@bldgtyp.com` |
| DNS | CNAME `project-2624` → `bt-proj-2624-rye-nature-center.pages.dev`, created by the setup script |
| Access | `report.json` `publishing.access.mode: public`; no Cloudflare Access application |
| Workflow | [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) on push to `main` or manual dispatch |

The repository is public because the `bldgtyp-projects` org is on GitHub Free, where org secrets do not reach private repos. Everything in `site/` (downloads, geometry, schedules) and the scripts/docs are therefore public on GitHub as well as on the site. `_private/` and `_.rtf` are git-ignored.

## How a release deploys

Pushing `main` publishes. Commit locally as often as needed; push only a checked release.

The workflow does not use the PHPP renderer. It:

1. runs `node scripts/check.mjs` against the committed `site/`;
2. checks out `bldgtyp/bt-web-report-template` at a pinned SHA and runs its `scripts/setup-cloudflare-pages.mjs --project-yaml report.json`. The script parses JSON as YAML and reads `publishing.production_url` and `publishing.access`, then ensures the Pages project, custom domain, DNS record and Access state (creating, updating or deleting the Access app to match `report.json`);
3. uploads the whole `site/` directory with a pinned `wrangler pages deploy site --branch main`.

Org secrets used: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCESS_OTP_IDP_ID`. Advance `TEMPLATE_REF` and `WRANGLER_VERSION` in the workflow deliberately, never to a floating ref.

`site/_worker.js` (Pages advanced mode, routed for every path by `_routes.json`) returns 404 on any hostname except `project-2624.bldgtyp.com`, so the `*.pages.dev` project and per-deployment URLs serve nothing. Keep the guard if the site moves behind Access: the template's gate covers only the custom hostname.

## Switching to an OTP gate

1. The org token `bt-web-report-platform-deploy` is documented with Pages and DNS scopes only. Add **Access: Apps and Policies Edit** (account scope) in the Cloudflare dashboard first; otherwise the setup step fails.
2. Set `publishing.access` in `report.json` to `{"mode": "cloudflare_access_otp", "allowed_emails": [...]}`, including Ed and John. The allowlist is reconciled on every deploy, so dashboard-only edits are reverted.
3. Push. Then verify in a signed-out browser that HTML, JSON, ZIP and geometry paths all require the PIN, that an allowlisted address gets in, and that a non-listed one does not. Cloudflare reports "code sent" for any address, listed or not.

The public repository still exposes the data after gating. Moving to a private repo needs repo-level copies of the three secrets (GitHub UI) or a paid org plan.

## Updates and rollback

Deploy the entire checked `site/` as one release; never upload individual files into separate deployments. Record the released commit SHA in [STATUS.md](STATUS.md); the deployment ID is in that commit's Actions run log. Doc-only pushes redeploy identical `site/` content. To roll back, use Pages deployment rollback in the dashboard, then revert the repository to the matching commit so the next push does not reintroduce the bad release.
