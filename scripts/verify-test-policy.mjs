import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function resolveBase() {
  const requestedBase = process.env.TEST_POLICY_BASE_SHA;

  if (requestedBase && !/^0+$/.test(requestedBase)) {
    try {
      git("cat-file", "-e", `${requestedBase}^{commit}`);
      return requestedBase;
    } catch {
      // Fall back to the parent for shallow/manual environments.
    }
  }

  return git("rev-parse", "HEAD^");
}

const base = resolveBase();
const changedFiles = git("diff", "--name-only", `${base}...HEAD`)
  .split("\n")
  .filter(Boolean);

const behaviorFiles = changedFiles.filter(
  (file) =>
    file.startsWith("src/") ||
    file.startsWith("prisma/migrations/") ||
    file === "prisma/schema.prisma" ||
    file.startsWith("supabase/migrations/"),
);
const testFiles = changedFiles.filter((file) => file.startsWith("tests/"));
const supabaseFiles = changedFiles.filter((file) => file.startsWith("supabase/migrations/"));
const supabaseTests = changedFiles.filter((file) => file.startsWith("tests/supabase/"));

if (behaviorFiles.length > 0 && testFiles.length === 0) {
  throw new Error(
    `Behavior changed without a test change:\n${behaviorFiles.map((file) => `- ${file}`).join("\n")}`,
  );
}

if (supabaseFiles.length > 0 && supabaseTests.length === 0) {
  throw new Error(
    `Supabase migrations require local policy/integration tests under tests/supabase/:\n${supabaseFiles.map((file) => `- ${file}`).join("\n")}`,
  );
}

console.log(`Test policy passed for ${changedFiles.length} changed file(s).`);
