# Local database migration after the corrected PAC migration

The local database at `127.0.0.1:5433/dashboard` contains irreplaceable
development data. It already records the original checksum of
`20260801220000_pac_library_remediation` and must never be connected directly
to the corrected migration history.

## Current backup

Before changing the published migration, a complete custom-format dump was
created outside the repository and verified with `pg_restore --list`. Keep both
the original database and that dump unchanged until a separately approved
cutover.

## Future controlled procedure

Do not run this procedure without a separate confirmation.

1. Stop all writes to the old local database and create a fresh `pg_dump`.
2. Create a new database whose name starts with `dashboard_codex_`.
3. Run `scripts/assert-isolated-database.mjs` against its URL.
4. Apply the corrected Prisma chain to the empty database.
5. Import application data from a copy of the dump using a reviewed,
   dependency-aware transfer script. Never restore schema objects or
   `_prisma_migrations` from the old history over the corrected schema.
6. Reconcile table counts, primary keys, foreign keys, worksheet relations,
   legacy mappings, technical-document associations, storage names and
   checksums.
7. Verify every referenced PDF against the persistent storage manifest.
8. Exercise read-only application flows against the new database.
9. Retain the old database and both dumps as rollback sources.
10. Change `DATABASE_URL` only after reviewing the reconciliation report and
    receiving a separate cutover confirmation.

The procedure must never claim to recover component rows that were already
deleted by a previously executed version of the migration unless a real dump,
audit snapshot or other source contains those rows.
