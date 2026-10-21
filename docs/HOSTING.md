# Hosting and access

## Feasibility confirmed, live setup pending

A one-off site can use the existing Cloudflare infrastructure. Pages accepts a directory of static HTML/assets; it does not require Astro, PHPP or the Report Manager. Cloudflare Access and custom-domain DNS are separate from the renderer. This is supported by [Cloudflare's static HTML guide](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) and [Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/).

The current local platform evidence is:

- `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/bldgtyp/bt-web-report/context/environment.html`, sections Cloudflare configuration and Accounts: one direct-upload Pages project per report; `project-<number>.bldgtyp.com`; existing `phtools@bldgtyp.com` account; R2 is outside the report publishing path.
- `bt-web-report-template/scripts/per-project-deploy.yml`: delegates building and publishing to the shared PHPP renderer workflow. This custom site should use its own build/upload workflow instead.
- `bt-web-report-template/scripts/setup-cloudflare-pages.mjs`: existing Pages custom-domain/DNS/OTP setup helper. Review its exported functions when implementing the remote setup; do not route this site through the PHPP schema merely to reuse its CLI.

Proposed Pages project: `bt-proj-2624-rye-nature-center`.
Proposed hostname: `project-2624.bldgtyp.com`.
These names have not been checked for remote availability. No cloud/account changes have been made. Existing local documentation establishes the architectural fit; account permissions and live state still need preflight.

## Deployment sequence

1. Confirm the client email allowlist, proposed hostname, and authority to publish. Keep the source repository private because the repository contains downloadable project inputs.
2. Check the existing authenticated Cloudflare account and whether the proposed Pages project, custom domain, Access application or DNS record already exists. Preserve existing projects and policies.
3. Create the Pages direct-upload project under the normal account if absent. Before uploading project data, attach the custom hostname and configure a Cloudflare Access self-hosted application for the whole hostname, including assets and downloads. Use One-Time PIN and the confirmed email allowlist, including Ed and John. Use the existing protected credential flow; never put credentials in this folder.
4. Build and run the checks in the README. Review `site/` as the exact upload directory. Deploy through the established authenticated Wrangler installation: `wrangler pages deploy site --project-name bt-proj-2624-rye-nature-center --branch main`. Pin the installed Wrangler release in a future CI workflow; do not add an unpinned remote execution dependency here.
5. The included `site/_worker.js` rejects every hostname except `project-2624.bldgtyp.com`. `_routes.json` sends every path through the guard. This closes the alternate `pages.dev` and deployment-preview paths. The guard is not authentication: the custom hostname still depends on Cloudflare Access. Pages advanced mode forwards authorized custom-host requests to `env.ASSETS.fetch(request)`. See [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/) and [routing](https://developers.cloudflare.com/pages/functions/routing/).
6. Verify in a fresh signed-out session: production HTML, JSON, ZIP and geometry requests all require Access; an allowlisted user can open the site and downloads; a non-allowlisted user cannot; project and deployment `pages.dev` URLs return 404 even for known asset paths. Test nested/trailing-slash paths and downloaded bytes. Record the deployment ID and live evidence before marking deployed.

The normal report infrastructure documents a gate on the custom hostname only. This site's hostname guard intentionally covers the alternate-host boundary as well. Cloudflare runtime behavior still requires deployment acceptance. All requests invoke a Pages Function; confirm the account's Functions limits and fail-closed behavior during setup.

## Updates and rollback

Deploy the entire checked `site/` directory as one release. Do not upload individual input/geometry files into different deployments. Save the deployment ID and input/output manifest hashes. Use Pages deployment rollback to restore a prior coherent release; then reconcile the source folder and docs with that release.

For ongoing GitHub automation, use a private `bldgtyp-projects` repository and its own workflow that builds/checks these files, then uploads `site/`. Reuse organization secrets with the same minimum account/zone scopes as existing reports. The normal renderer workflow and Manager would otherwise assume PHPP content and can overwrite this custom setup. Remote repository creation, CI and account configuration remain a later step.
