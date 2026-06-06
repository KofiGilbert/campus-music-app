/**
 * Promote a user to admin (flips users.is_admin).
 *
 *   pnpm admin:promote <email>            # prompts for confirmation
 *   pnpm admin:promote <email> --yes      # skip the prompt (automation)
 *
 * Run from the repo root; reads DATABASE_URL from artifacts/api-server/.env
 * (the package script passes --env-file). NOTE: is_admin is baked into the JWT
 * at login, so a promoted user must re-login for admin access to take effect.
 */
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

async function main(): Promise<void> {
  const email = process.argv[2];
  const skipConfirm = process.argv.includes("--yes") || process.argv.includes("-y");

  if (!email || email.startsWith("-")) {
    console.error("Usage: pnpm admin:promote <email> [--yes]");
    process.exit(1);
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  if (user.isAdmin) {
    console.log(`${user.email} is already an admin. Nothing to do.`);
    process.exit(0);
  }

  console.log("About to grant ADMIN to:");
  console.log(`  ${user.name || "(no name)"} <${user.email}>  [id=${user.id}, role=${user.role}]`);

  if (!skipConfirm) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = (await rl.question("Promote to admin? (y/N) ")).trim().toLowerCase();
    rl.close();
    if (answer !== "y" && answer !== "yes") {
      console.log("Aborted. No changes made.");
      process.exit(0);
    }
  }

  await db.update(users).set({ isAdmin: true, updatedAt: new Date() }).where(eq(users.id, user.id));
  console.log(`✓ ${user.email} is now an admin. (They must re-login for it to take effect.)`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("admin:promote failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
