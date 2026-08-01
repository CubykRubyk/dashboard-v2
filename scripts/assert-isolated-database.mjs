const raw = process.env.DATABASE_URL?.trim()
  || process.env.HVAC_INTEGRATION_DATABASE_URL?.trim();
if (!raw) {
  throw new Error("An isolated DATABASE_URL is required.");
}

const parsed = new URL(raw);
const database = parsed.pathname.replace(/^\/+/, "");
const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (
  !allowedHosts.has(parsed.hostname)
  || !database.startsWith("dashboard_codex_")
  || database === "dashboard"
) {
  throw new Error(
    `Refusing non-isolated database target: host=${parsed.hostname}, database=${database}`,
  );
}

console.log(
  `Isolated database guard passed: ${parsed.hostname}/${database}`,
);
