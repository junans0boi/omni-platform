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
const changes = git("diff", "--name-status", `${base}...HEAD`)
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [status, ...paths] = line.split("\t");
    return { status, file: paths.at(-1) };
  });
const changedFiles = changes.map(({ file }) => file);

const behaviorFiles = changedFiles.filter(
  (file) =>
    file.startsWith("src/") ||
    file.startsWith("prisma/migrations/") ||
    file === "prisma/schema.prisma" ||
    file.startsWith("supabase/migrations/"),
);
const runnableTestChanges = changes.filter(
  ({ status, file }) =>
    status !== "D" &&
    (/^tests\/unit\/.*\.test\.[cm]?[jt]sx?$/.test(file) ||
      /^tests\/e2e\/.*\.spec\.[cm]?[jt]sx?$/.test(file) ||
      /^tests\/supabase\/.*\.test\.[cm]?[jt]sx?$/.test(file)),
);
const supabaseFiles = changedFiles.filter((file) => file.startsWith("supabase/migrations/"));

if (behaviorFiles.length > 0 && runnableTestChanges.length === 0) {
  throw new Error(
    `Behavior changed without a test change:\n${behaviorFiles.map((file) => `- ${file}`).join("\n")}`,
  );
}

const supabaseTestChanges = changes.filter(
  ({ status, file }) => status !== "D" && /^tests\/supabase\/.*\.test\.[cm]?[jt]sx?$/.test(file),
);

if (supabaseFiles.length > 0 && supabaseTestChanges.length === 0) {
  throw new Error(
    `Supabase migrations require an executable SQL contract test change:\n${supabaseFiles.map((file) => `- ${file}`).join("\n")}`,
  );
}

console.log(`Test policy passed for ${changedFiles.length} changed file(s).`);
