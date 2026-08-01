# PAC technical document storage

The database stores document metadata and associations. PDF bytes are stored
once in a dedicated filesystem directory.

## Paths and permissions

- Development defaults to `./data/pac-documents` from the application root.
  `TECHNICAL_DOCUMENT_STORAGE_ROOT` may override it.
- The production container uses `/app/data/pac-documents`.
- Docker Compose mounts the named volume `document_data` directly at that
  path.
- The runtime user is `nextjs` (`uid=1001`, `gid=1001`). The directory must be
  readable and writable by that user; files are created with mode `0640`.

The production startup command verifies that the configured directory is an
actual mount point when `TECHNICAL_DOCUMENT_STORAGE_REQUIRE_MOUNT=true`. The
container stops before starting Next.js if the volume is absent, unreadable or
unwritable. This prevents uploads to the image's ephemeral filesystem.

## Safe transfer of existing files

Do not move production files during an application deployment. Prepare a
maintenance window and keep the source unchanged until verification succeeds.

1. Stop document mutations and back up both PostgreSQL and the source storage.
2. Copy files into a new, empty volume without deleting the source.
3. Export a manifest before and after the copy:

   ```bash
   find SOURCE -type f -name '*.pdf' -print0 \
     | sort -z \
     | xargs -0 shasum -a 256 > source.sha256
   find TARGET -type f -name '*.pdf' -print0 \
     | sort -z \
     | xargs -0 shasum -a 256 > target.sha256
   ```

4. Compare file counts and byte totals:

   ```bash
   find SOURCE -type f -name '*.pdf' | wc -l
   find TARGET -type f -name '*.pdf' | wc -l
   du -sk SOURCE TARGET
   ```

5. Compare the SHA-256 manifests after normalizing the root prefix. Confirm
   every `TechnicalDocument.storageName` exists exactly once in the target.
6. Start one application instance with the new volume, verify inline viewing
   and download, then restore normal traffic.

## Rollback

If any count, size, checksum or database-to-file lookup differs, stop the new
container and remount the unchanged source volume. Do not delete the target:
keep it isolated for reconciliation. Database migrations in this increment do
not rename or move PDF files, so storage rollback is independent of the schema
rollback.

Never use recursive deletion as part of transfer or rollback. A document file
may be removed only by an explicit, separately audited future workflow after a
database reference check.

## Upload reconciliation journal

Every upload creates a JSON operation record in
`<storage-root>/.reconciliation` before the database transaction begins. The
record contains the generated storage name, safe logical name, SHA-256, size,
MIME type, actor ID, timestamps, database check and reconciliation state. It
never contains a physical path, token, cookie or PDF content.

Confirmed commits are marked `COMMITTED`; confirmed rollbacks whose new file
was compensated are marked `ROLLED_BACK`. A connection loss, failed database
check or failed compensation is marked `AMBIGUOUS`, and the PDF is retained.
An initial `PENDING_DB` record also remains useful if the process terminates
before its final state can be written.

Inventory reconciliation without modifying either the database or journal:

```bash
npm run documents:reconciliation:inventory
```

The command opens a read-only PostgreSQL transaction. `FOUND` means the file
must be retained and the journal can later be marked committed by an approved
operator workflow. `NOT_FOUND` is not permission to delete: the file remains
until the database outcome, backups and concurrent operations have been
reviewed.

PDF upload uses the `File` stream when available, calculates SHA-256
incrementally, writes with exclusive creation and fsyncs before persistence.
The 25 MiB limit is enforced both from metadata and while streaming. A fallback
buffer path exists only for runtimes or test doubles without `File.stream()`;
production Node/Next.js supplies the streaming API. Limit concurrent uploads at
the reverse proxy if deploying on a memory-constrained host.
