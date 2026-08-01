import { access, mkdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const configured = process.env.TECHNICAL_DOCUMENT_STORAGE_ROOT?.trim();
if (!configured) {
  throw new Error(
    "TECHNICAL_DOCUMENT_STORAGE_ROOT is required before starting production.",
  );
}

const root = path.resolve(configured);
await mkdir(root, { recursive: true, mode: 0o750 });
await access(root, constants.R_OK | constants.W_OK);

if (
  process.env.NODE_ENV === "production"
  && process.env.TECHNICAL_DOCUMENT_STORAGE_REQUIRE_MOUNT !== "true"
) {
  throw new Error(
    "TECHNICAL_DOCUMENT_STORAGE_REQUIRE_MOUNT=true is required in production.",
  );
}

if (process.env.TECHNICAL_DOCUMENT_STORAGE_REQUIRE_MOUNT === "true") {
  const mountInfo = await readFile("/proc/self/mountinfo", "utf8");
  const mountPoints = mountInfo
    .split("\n")
    .map((line) => line.trim().split(" "))
    .filter((fields) => fields.length > 5)
    .map((fields) => fields[4].replaceAll("\\040", " "));
  if (!mountPoints.includes(root)) {
    throw new Error(
      `Required document volume is not mounted at ${root}.`,
    );
  }
}

console.log(`Document storage ready: ${root}`);
