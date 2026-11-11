import { execFileSync } from "node:child_process";

const [projectId, mode] = process.argv.slice(2);
if (!projectId || !/^[a-z][a-z0-9-]+$/.test(projectId) || (mode !== undefined && mode !== "--apply")) {
  throw new Error("Usage: node scripts/migrate-player-contacts.mjs <project-id> [--apply]");
}

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (emulatorHost && (!/^127\.0\.0\.1:\d+$/.test(emulatorHost) || !projectId.startsWith("demo-"))) {
  throw new Error("An emulator migration requires a loopback host and a demo project ID.");
}
const token = emulatorHost
  ? "owner"
  : process.env.FIRESTORE_MIGRATION_ACCESS_TOKEN ||
    execFileSync("gcloud", ["auth", "application-default", "print-access-token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }).trim();
const origin = emulatorHost ? `http://${emulatorHost}` : "https://firestore.googleapis.com";
const database = `projects/${projectId}/databases/(default)/documents`;
const base = `${origin}/v1/${database}`;

async function firestore(path, body) {
  const response = await fetch(base + path, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Firestore request failed: ${result.error?.status ?? response.status}`);
  }
  return result;
}

async function list(path) {
  const result = [];
  const params = new URLSearchParams({ pageSize: "200", "mask.fieldPaths": "contactNumber" });
  do {
    const page = await firestore(`/${path}?${params}`);
    result.push(...(page.documents ?? []));
    if (!page.nextPageToken) break;
    params.set("pageToken", page.nextPageToken);
  } while (true);
  return result;
}

const idOf = (document) => document.name.split("/").at(-1);

async function planMigration() {
  const plan = [];
  let conflicts = 0;
  for (const tournament of await list("tournaments")) {
    const path = `tournaments/${encodeURIComponent(idOf(tournament))}`;
    const [players, contacts] = await Promise.all([
      list(`${path}/players`),
      list(`${path}/playerContacts`),
    ]);
    const contactById = new Map(contacts.map((contact) => [idOf(contact), contact]));
    for (const player of players) {
      const legacyField = player.fields?.contactNumber;
      if (!legacyField) continue;
      const legacy = legacyField.stringValue?.trim() ?? "";
      const contact = contactById.get(idOf(player));
      const existing = contact?.fields?.contactNumber?.stringValue?.trim();
      if ((legacy && contact && legacy !== existing) ||
        !("stringValue" in legacyField || "nullValue" in legacyField)) {
        conflicts += 1;
        continue;
      }
      const writes = [{
        update: { name: player.name, fields: {} },
        updateMask: { fieldPaths: ["contactNumber"] },
        currentDocument: { updateTime: player.updateTime },
      }];
      if (legacy && !contact) {
        writes.push({
          update: {
            name: `${tournament.name}/playerContacts/${idOf(player)}`,
            fields: { contactNumber: { stringValue: legacy } },
          },
          currentDocument: { exists: false },
        });
      }
      plan.push(writes);
    }
  }
  return { plan, conflicts };
}

const { plan, conflicts } = await planMigration();
console.log(JSON.stringify({
  projectId,
  mode: mode === "--apply" ? "apply" : "dry-run",
  publicFieldsToRemove: plan.length,
  privateContactsToCreate: plan.filter((writes) => writes.length === 2).length,
  conflicts,
}));
if (conflicts > 0) {
  throw new Error("Resolve conflicting or invalid contact fields before applying the migration.");
}
if (mode === "--apply") {
  // Keep each contact and its public-field removal together in the same commit.
  for (let offset = 0; offset < plan.length; offset += 200) {
    await firestore(":commit", { writes: plan.slice(offset, offset + 200).flat() });
  }
  const remaining = await planMigration();
  if (remaining.plan.length || remaining.conflicts) {
    throw new Error("Legacy contact fields remain. Run a new dry-run before retrying.");
  }
  console.log("Verified that tournament player documents have no legacy contact fields.");
}
