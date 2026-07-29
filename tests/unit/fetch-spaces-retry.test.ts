import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../src/store/useAppStore";

describe("fetchSpaces retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("recovers from a transient failure instead of leaving spaces stuck empty", async () => {
    vi.useFakeTimers();
    const spaces = [{ id: "s1", name: "Space One", avatarUrl: null, inviteCode: "abc", ownerId: "u1", createdAt: "" }];

    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        // Simulate the transient failure right after login (cold server / session race).
        return new Response(null, { status: 503 });
      }
      return new Response(JSON.stringify(spaces), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const fetchPromise = useAppStore.getState().fetchSpaces();
    await vi.runAllTimersAsync();
    await fetchPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().spaces).toEqual(spaces);
    expect(useAppStore.getState().isLoading).toBe(false);
  });

  it("gives up after repeated failures without throwing", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const fetchPromise = useAppStore.getState().fetchSpaces();
    await vi.runAllTimersAsync();
    await fetchPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(useAppStore.getState().isLoading).toBe(false);
  });
});
