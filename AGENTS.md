# Rye project report

This is the authorized standalone custom report, outside the PHPP template and Manager. Read [README.md](README.md), [docs/STATUS.md](docs/STATUS.md) and the relevant update/hosting guide before editing. Project-wide current state is in [../CONTEXT.md](../CONTEXT.md). Site implementation lives here; source-model changes require their own authorized modeling task.

Only `site/` is deployable. Preserve `_.rtf`. Never deploy `_private/`, raw simulation/weather files, licensed workbook/climate content, credentials or unreviewed outputs. Refresh source snapshots explicitly; do not watch or modify modeling folders. Archive a coherent site/private snapshot before replacement.

Use the existing Ladybug Python runtime for native exports and verification. Node tooling has no package install step. Preserve vendored licenses and exact releases. Do not add framework/build dependencies without a concrete need.

Release reviewed inputs, outputs, provenance, downloads and checks together. Annual energy and Design Days are separate result packages; matching physical inputs can have different generated identifiers. Keep electricity, room thermal loads, actual coil output and rated equipment inputs distinct. Sum supplemental dehumidifier electricity once in Cooling. Preserve the effective-calendar disclosure and downstream measure boundary. Resilience stays pending until its own reviewed package exists; no placeholder zeros or certification claims.

Publishing is a separate live operation. Before first publication, complete the allowlist, Cloudflare Access/custom-host and alternate-host checks in [docs/HOSTING.md](docs/HOSTING.md). Local tests do not prove live access control. Preserve this report's existing hosting approach; do not register another hosting service to update local files.
