import { mkdir, writeFile } from "node:fs/promises";

try {
    process.loadEnvFile(".env");
} catch (error) {
    if (error.code === "ENOENT") {
        console.error("Missing .env. Copy .env.example to .env and fill in the Firebase values.");
        process.exit(1);
    }
    throw error;
}

const envToConfig = {
    FIREBASE_API_KEY: "apiKey",
    FIREBASE_AUTH_DOMAIN: "authDomain",
    FIREBASE_PROJECT_ID: "projectId",
    FIREBASE_STORAGE_BUCKET: "storageBucket",
    FIREBASE_MESSAGING_SENDER_ID: "messagingSenderId",
    FIREBASE_APP_ID: "appId"
};

const missing = Object.keys(envToConfig).filter((key) => !process.env[key]);
if (missing.length > 0) {
    console.error(`Missing Firebase environment values: ${missing.join(", ")}`);
    process.exit(1);
}

const firebaseConfig = Object.fromEntries(
    Object.entries(envToConfig).map(([envKey, configKey]) => [configKey, process.env[envKey]])
);

await mkdir("scripts", { recursive: true });
await writeFile(
    "scripts/firebase-config.js",
    `export const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 4)};\n`
);
console.log("Generated scripts/firebase-config.js");