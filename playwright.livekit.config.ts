import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/livekit",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3200",
    permissions: ["camera", "microphone"],
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-livekit",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--enable-usermedia-screen-capturing",
            "--auto-select-desktop-capture-source=Entire screen",
          ],
        },
      },
    },
  ],
});
