# Security Policy

Malmunchi is intended for local or controlled-server operation over user-provided
documents.

## Supported Version

The supported development line is `main`.

## Reporting

Open a private security advisory when possible. If that is unavailable, file a
GitHub issue with:

- affected route or MCP tool;
- reproduction steps;
- expected impact;
- whether source exports, local paths, or API keys are exposed.

Do not include secrets, private source data, or access tokens in public reports.

## Operator Notes

- Set `MALMUNCHI_API_KEY` for non-local HTTP deployments.
- Keep `MALMUNCHI_CORS_ORIGIN` pinned to known origins outside local development.
- Treat exported source bundles as data artifacts; review them before sharing.
- Source memory backups stay server-local and public responses expose backup IDs,
  not absolute paths.
