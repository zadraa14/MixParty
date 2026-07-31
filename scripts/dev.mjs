import { spawn } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const npmCli = process.env.npm_execpath;

function runNpm(args) {
  // npm_execpath pointe vers npm-cli.js lorsque ce script est lancé avec `npm run`.
  // Le lancer avec Node évite l’erreur `spawn EINVAL` de npm.cmd sous Windows/Node 24.
  if (npmCli) {
    return spawn(process.execPath, [npmCli, ...args], {
      stdio: "inherit",
      env: sharedEnv,
    });
  }

  return spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    stdio: "inherit",
    env: sharedEnv,
    shell: process.platform === "win32",
  });
}

function getLocalIpv4() {
  const interfaces = os.networkInterfaces();
  const preferredNames = [/wi-?fi/i, /wireless/i, /wlan/i, /ethernet/i, /eth/i];
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      candidates.push({ name, address: address.address });
    }
  }

  for (const pattern of preferredNames) {
    const match = candidates.find((candidate) => pattern.test(candidate.name));
    if (match) return match.address;
  }

  return candidates[0]?.address ?? "localhost";
}

const host = getLocalIpv4();
const appUrl = `http://${host}:3000`;
const sharedEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || appUrl,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || `${appUrl}/mixparty-api`,
};

// Supprime l'ancien cache de développement Next.js afin que le téléphone
// ne recharge jamais une ancienne version de la page soirée.
const nextCachePath = path.resolve("apps", "web", ".next");
try {
  fs.rmSync(nextCachePath, { recursive: true, force: true });
} catch (error) {
  console.warn("Impossible de nettoyer le cache Next.js", error);
}

console.log("\n🎉 MixParty démarre…");
console.log(`💻 Sur ce PC : http://localhost:3000`);
console.log(`📱 Sur téléphone : ${appUrl}`);
console.log("   Le PC et le téléphone doivent être connectés au même Wi-Fi.\n");

const processes = [
  runNpm(["run", "dev", "--workspace=api"]),
  runNpm(["run", "dev", "--workspace=web", "--", "--hostname", "0.0.0.0"]),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(exitCode);
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (!stopping && code && code !== 0) stop(code);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
