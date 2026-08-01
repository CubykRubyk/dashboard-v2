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

## Local development reconciliation completed

On 2026-08-01, the local development database `dashboard` was reconciled after
an additional custom-format backup was created and verified. The existing
legacy migration row was updated to the corrected migration checksum, the
persistent component archive table was created, and the corrective migration
`20260801230000_pac_library_audit_remediation` was applied with
`prisma migrate deploy`. The database reported no combinations or components
before the change; existing documents and other rows were retained.

This was a one-off local operation backed by
`dashboard-v2-before-local-db-migration-20260801-195004.dump`. Production and
shared databases still require the controlled procedure above.
