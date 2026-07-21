import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/password";

const KNOWN_PASSWORD = "correct horse battery staple";
const KNOWN_SCRYPT_HASH =
  "scrypt$16384$8$1$b21uaS1wbGF0Zm9ybS10ZXN0LXNhbHQ$nKFnt7X0scL9ivZeTJCDaqqP6vHYaKPlnRJq0xc-Qq7MVkoTbCmgrm6As00FJeK-9vLHzPPdzwrnJB6Cz_EiTw";

describe("password credential contract", () => {
  it("accepts the known credential and rejects a different password", async () => {
    await expect(verifyPassword(KNOWN_PASSWORD, KNOWN_SCRYPT_HASH)).resolves.toBe(true);
    await expect(verifyPassword("not the password", KNOWN_SCRYPT_HASH)).resolves.toBe(false);
  });

  it("creates a credential that can be verified without retaining plaintext", async () => {
    const credential = await hashPassword(KNOWN_PASSWORD);

    expect(credential).not.toContain(KNOWN_PASSWORD);
    await expect(verifyPassword(KNOWN_PASSWORD, credential)).resolves.toBe(true);
  });

  it("rejects unsupported or malformed credential formats", async () => {
    await expect(verifyPassword(KNOWN_PASSWORD, "bcrypt$invalid")).resolves.toBe(false);
    await expect(verifyPassword(KNOWN_PASSWORD, "scrypt$16384$8$1")).resolves.toBe(false);
  });
});
