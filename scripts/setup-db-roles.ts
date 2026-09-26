/**
 * Creates the least-privilege Postgres roles for aboutselphy.com:
 *
 *   aboutselphy_main         owns ONLY schema "main" (this app's DATABASE_URL)
 *   aboutselphy_auth_reader  SELECT on auth.session + auth."user", read-only
 *                            (AUTH_DATABASE_URL here and in the Social app)
 *
 * and revokes CONNECT/TEMPORARY on the database from PUBLIC.
 *
 * Must run as a superuser (or a role with CREATEROLE that owns the database),
 * because the "aboutselphy" app user can't create roles. The admin URL is
 * never written anywhere by this script.
 *
 *   ADMIN_DATABASE_URL="postgres://postgres:...@host:5435/aboutselphy" \
 *     pnpm db:setup-roles [--dry-run] [--rotate] [--write-env] [--skip-revoke]
 *
 *   --dry-run      print the SQL (passwords masked) and exit, no changes
 *   --rotate       roles already exist: set new passwords instead of failing
 *   --write-env    put the new DATABASE_URL/AUTH_DATABASE_URL into .env.local
 *                  (the previous DATABASE_URL line is kept, commented out)
 *   --skip-revoke  don't revoke CONNECT/TEMPORARY from PUBLIC
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: [".env.local", ".env"], quiet: true });

const APP_ROLE = "aboutselphy_main";
const READER_ROLE = "aboutselphy_auth_reader";
const APP_SCHEMA = process.env.DATABASE_SCHEMA || "main";
const AUTH_SCHEMA = "auth";
// Roles allowed to keep connecting after PUBLIC loses CONNECT. The auth
// service uses "aboutselphy"; postgres is the superuser.
const KNOWN_ROLES = new Set(["postgres", "aboutselphy", APP_ROLE, READER_ROLE]);

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const rotate = args.has("--rotate");
const writeEnv = args.has("--write-env");
const skipRevoke = args.has("--skip-revoke");

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function ident(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

function roleUrl(adminUrl: URL, user: string, password: string) {
  const url = new URL(adminUrl.toString());
  url.username = user;
  url.password = password;
  url.search = "";
  return url.toString();
}

async function main() {
  const adminUrlRaw = process.env.ADMIN_DATABASE_URL;
  if (!adminUrlRaw) {
    fail(
      "ADMIN_DATABASE_URL is not set (superuser connection to the aboutselphy database).",
    );
  }
  const adminUrl = new URL(adminUrlRaw);

  const admin = new Client({
    connectionString: adminUrlRaw,
    connectionTimeoutMillis: 10_000,
  });
  await admin.connect();
  const q = async <T extends Record<string, unknown>>(sql: string) =>
    (await admin.query<T>(sql)).rows;

  try {
    // ── Preflight ──────────────────────────────────────────────────────────
    const [me] = await q<{
      user: string;
      db: string;
      super: boolean;
      createrole: boolean;
    }>(`SELECT current_user AS user, current_database() AS db,
               rolsuper AS super, rolcreaterole AS createrole
        FROM pg_roles WHERE rolname = current_user`);
    console.log(`Connected as ${me.user} to database "${me.db}".`);
    if (!me.super && !me.createrole) {
      if (!dryRun) {
        fail(`${me.user} can't create roles. Use the postgres superuser.`);
      }
      console.warn(
        `⚠ ${me.user} can't create roles -- fine for --dry-run, but the real ` +
          "run needs the postgres superuser (and sees all connections).",
      );
    }

    const authTables = (
      await q<{ t: string }>(
        `SELECT table_name AS t FROM information_schema.tables
         WHERE table_schema = '${AUTH_SCHEMA}'`,
      )
    ).map((r) => r.t);
    for (const table of ["session", "user"]) {
      if (!authTables.includes(table)) {
        fail(`${AUTH_SCHEMA}.${table} not found. Is this the right database?`);
      }
    }

    const existing = new Set(
      (
        await q<{ r: string }>(
          `SELECT rolname AS r FROM pg_roles
           WHERE rolname IN ('${APP_ROLE}', '${READER_ROLE}')`,
        )
      ).map((r) => r.r),
    );
    if (existing.size > 0 && !rotate) {
      fail(
        `Role(s) already exist: ${[...existing].join(", ")}. ` +
          "Re-run with --rotate to set new passwords.",
      );
    }

    // Anyone else connected to this database right now would be locked out
    // by the PUBLIC revoke -- refuse unless --skip-revoke.
    const otherUsers = (
      await q<{ u: string }>(
        `SELECT DISTINCT usename AS u FROM pg_stat_activity
         WHERE datname = current_database() AND usename IS NOT NULL`,
      )
    )
      .map((r) => r.u)
      .filter((u) => !KNOWN_ROLES.has(u));
    if (otherUsers.length > 0 && !skipRevoke) {
      fail(
        `Other roles are connected to "${me.db}": ${otherUsers.join(", ")}. ` +
          "Revoking PUBLIC CONNECT would lock them out. Check, then re-run " +
          "with --skip-revoke if they need access.",
      );
    }

    // ── Plan ───────────────────────────────────────────────────────────────
    // Plain hex: nothing that needs URL-encoding (see Social's CLAUDE.md).
    const appPassword = randomBytes(32).toString("hex");
    const readerPassword = randomBytes(32).toString("hex");
    const lit = (value: string) => admin.escapeLiteral(value);
    const db = ident(me.db);

    const roleStatement = (role: string, password: string, limit: number) =>
      existing.has(role)
        ? `ALTER ROLE ${ident(role)} PASSWORD ${lit(password)}`
        : `CREATE ROLE ${ident(role)} LOGIN PASSWORD ${lit(password)}
             NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT ${limit}`;

    // Everything below is idempotent, so --rotate re-applies it safely.
    const statements = [
      roleStatement(APP_ROLE, appPassword, 20),
      `GRANT CONNECT ON DATABASE ${db} TO ${ident(APP_ROLE)}`,
      `CREATE SCHEMA IF NOT EXISTS ${ident(APP_SCHEMA)} AUTHORIZATION ${ident(APP_ROLE)}`,
      `ALTER SCHEMA ${ident(APP_SCHEMA)} OWNER TO ${ident(APP_ROLE)}`,
      `ALTER ROLE ${ident(APP_ROLE)} IN DATABASE ${db} SET search_path = ${ident(APP_SCHEMA)}`,
      `ALTER ROLE ${ident(APP_ROLE)} SET idle_in_transaction_session_timeout = '60s'`,

      roleStatement(READER_ROLE, readerPassword, 10),
      `GRANT CONNECT ON DATABASE ${db} TO ${ident(READER_ROLE)}`,
      `GRANT USAGE ON SCHEMA ${ident(AUTH_SCHEMA)} TO ${ident(READER_ROLE)}`,
      `GRANT SELECT ON ${ident(AUTH_SCHEMA)}.session, ${ident(AUTH_SCHEMA)}."user" TO ${ident(READER_ROLE)}`,
      `ALTER ROLE ${ident(READER_ROLE)} SET default_transaction_read_only = on`,
      `ALTER ROLE ${ident(READER_ROLE)} SET statement_timeout = '5s'`,
      `ALTER ROLE ${ident(READER_ROLE)} SET idle_in_transaction_session_timeout = '30s'`,

      ...(skipRevoke
        ? []
        : [`REVOKE CONNECT, TEMPORARY ON DATABASE ${db} FROM PUBLIC`]),
    ];

    const masked = (sql: string) =>
      sql
        .replace(lit(appPassword), "'***'")
        .replace(lit(readerPassword), "'***'");

    console.log("\nPlanned SQL:");
    for (const sql of statements) console.log(`  ${masked(sql)};`);

    if (dryRun) {
      console.log("\n--dry-run: nothing was changed.");
      return;
    }

    // ── Apply (one transaction: all or nothing) ────────────────────────────
    await admin.query("BEGIN");
    try {
      for (const sql of statements) await admin.query(sql);
      await admin.query("COMMIT");
    } catch (error) {
      await admin.query("ROLLBACK");
      throw error;
    }
    console.log("\n✔ Applied.");

    const appUrl = roleUrl(adminUrl, APP_ROLE, appPassword);
    const readerUrl = roleUrl(adminUrl, READER_ROLE, readerPassword);

    // ── Verify by actually logging in as each role ─────────────────────────
    await verify(appUrl, readerUrl);

    // ── Output ─────────────────────────────────────────────────────────────
    if (writeEnv) {
      updateEnvLocal({ DATABASE_URL: appUrl, AUTH_DATABASE_URL: readerUrl });
      console.log("\n✔ .env.local updated (DATABASE_URL, AUTH_DATABASE_URL).");
    }
    console.log(
      "\nNew connection strings (shown once, store them now). The host is the " +
        "one you connected with; in Dokploy use the internal host instead.\n",
    );
    console.log(`  DATABASE_URL="${appUrl}"`);
    console.log(`  AUTH_DATABASE_URL="${readerUrl}"`);
    console.log(
      "\nUse AUTH_DATABASE_URL in the Social app too. The auth service keeps " +
        "its current user.",
    );
  } finally {
    await admin.end();
  }
}

async function verify(appUrl: string, readerUrl: string) {
  const checks: Array<[string, boolean]> = [];
  const connect = async (url: string) => {
    const client = new Client({ connectionString: url });
    await client.connect();
    return client;
  };
  const denied = async (client: Client, sql: string) => {
    try {
      await client.query(sql);
      return false;
    } catch {
      return true;
    }
  };

  const app = await connect(appUrl);
  try {
    const [row] = (await app.query(`SELECT current_schema() AS s`)).rows;
    checks.push([`${APP_ROLE}: search_path is "${APP_SCHEMA}"`, row.s === APP_SCHEMA]);
    const [priv] = (
      await app.query(`SELECT has_schema_privilege($1, 'CREATE') AS c`, [APP_SCHEMA])
    ).rows;
    checks.push([`${APP_ROLE}: can create tables in "${APP_SCHEMA}"`, priv.c === true]);
    checks.push([
      `${APP_ROLE}: cannot read ${AUTH_SCHEMA}.session`,
      await denied(app, `SELECT 1 FROM ${AUTH_SCHEMA}.session LIMIT 1`),
    ]);
  } finally {
    await app.end();
  }

  const reader = await connect(readerUrl);
  try {
    checks.push([
      `${READER_ROLE}: can read ${AUTH_SCHEMA}.session`,
      !(await denied(reader, `SELECT 1 FROM ${AUTH_SCHEMA}.session LIMIT 1`)),
    ]);
    checks.push([
      `${READER_ROLE}: can read ${AUTH_SCHEMA}."user"`,
      !(await denied(reader, `SELECT 1 FROM ${AUTH_SCHEMA}."user" LIMIT 1`)),
    ]);
    checks.push([
      `${READER_ROLE}: cannot read ${AUTH_SCHEMA}.account (OAuth tokens)`,
      await denied(reader, `SELECT 1 FROM ${AUTH_SCHEMA}.account LIMIT 1`),
    ]);
    checks.push([
      `${READER_ROLE}: cannot write`,
      await denied(reader, `DELETE FROM ${AUTH_SCHEMA}.session WHERE false`),
    ]);
  } finally {
    await reader.end();
  }

  console.log("\nVerification:");
  for (const [label, ok] of checks) console.log(`  ${ok ? "✔" : "✖"} ${label}`);
  if (checks.some(([, ok]) => !ok)) {
    fail("Some checks failed -- roles were created, review the output above.");
  }
}

function updateEnvLocal(values: Record<string, string>) {
  const path = ".env.local";
  const lines = existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    const entry = `${key}="${value}"`;
    if (index === -1) {
      lines.push(entry);
    } else {
      lines.splice(index, 1, `# ${lines[index]}  (replaced by db:setup-roles)`, entry);
    }
  }
  writeFileSync(path, lines.join("\n").replace(/\n*$/, "\n"));
}

main().catch((error) => {
  console.error("\n✖", error instanceof Error ? error.message : error);
  process.exit(1);
});
