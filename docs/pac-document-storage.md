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
