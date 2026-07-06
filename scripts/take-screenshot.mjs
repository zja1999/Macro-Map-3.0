import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const chromePath = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const token = process.env.MM_SESSION;
const out = process.env.SCREENSHOT_OUT ?? "macroverse-screenshot.png";
const url = process.env.SCREENSHOT_URL ?? "http://localhost:3020/restaurants";

if (!token) throw new Error("MM_SESSION is required");

const userDataDir = mkdtempSync(join(tmpdir(), "macroverse-chrome-"));
const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(path) {
  const endpoint = `http://127.0.0.1:${port}${path}`;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return res.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`Chrome DevTools did not become ready: ${endpoint}`);
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id) return;
    const waiter = pending.get(msg.id);
    if (!waiter) return;
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
    else waiter.resolve(msg.result);
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      ws.close();
    },
  };
}

try {
  const tab = await waitForJson(`/json/new?${encodeURIComponent("about:blank")}`);
  const cdp = await connect(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Network.setCookie", {
    name: "mm_session",
    value: token,
    url: "http://localhost:3020/",
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 86400,
  });
  await cdp.send("Page.navigate", { url });
  await sleep(4000);
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  cdp.close();
} finally {
  chrome.kill();
  await sleep(250);
  rmSync(userDataDir, { recursive: true, force: true });
}
