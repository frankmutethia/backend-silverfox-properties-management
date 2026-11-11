import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");

const parseEnvFile = (filePath) => {
  const parsed = {};
  if (!fs.existsSync(filePath)) return parsed;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }

  return parsed;
};

const parseCloudinaryUrl = (url) => {
  if (!url) return null;
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) return null;
  return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
};

const parseOrigins = (raw) =>
  (raw || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

const isHostingerRuntime = () => {
  const cwd = process.cwd();
  return cwd.includes("hbuilds") || cwd.includes("silverfoxpropertymanagement.com");
};

const isTest = process.env.NODE_ENV === "test";

// Hostinger redeploys can reset NODE_ENV to development — detect the hosted runtime anyway.
const isLiveDeployment = !isTest && (process.env.NODE_ENV === "production" || isHostingerRuntime());

const fileEnv = isLiveDeployment || isTest ? {} : parseEnvFile(envPath);
const get = (key) => process.env[key] ?? fileEnv[key];

const PRODUCTION_FRONTEND = "https://silverfoxpropertymanagement.com";

const frontendUrl = (
  get("FRONTEND_URL") || (isLiveDeployment ? PRODUCTION_FRONTEND : "http://localhost:5173")
).replace(/\/$/, "");

const buildCorsOrigins = () => {
  const origins = [...new Set([...parseOrigins(get("CORS_ORIGIN")), frontendUrl])];
  if (isLiveDeployment && frontendUrl.startsWith("https://") && !frontendUrl.includes("://www.")) {
    const wwwUrl = frontendUrl.replace("https://", "https://www.");
    if (!origins.includes(wwwUrl)) origins.push(wwwUrl);
  }
  return origins;
};

const fromUrl = parseCloudinaryUrl(get("CLOUDINARY_URL"));
const cloudName = fromUrl?.cloudName || get("CLOUDINARY_CLOUD_NAME");
const apiKey = fromUrl?.apiKey || get("CLOUDINARY_API_KEY");
const apiSecret = fromUrl?.apiSecret || get("CLOUDINARY_API_SECRET");

const requiredPairs = [
  ["MONGO_URI", get("MONGO_URI")],
  ["ACCESS_TOKEN_SECRET", get("ACCESS_TOKEN_SECRET")],
  ["CLOUDINARY_CLOUD_NAME", cloudName],
  ["CLOUDINARY_API_KEY", apiKey],
  ["CLOUDINARY_API_SECRET", apiSecret],
];

const missing = requiredPairs.filter(([, value]) => !value).map(([key]) => key);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const accessTokenSecret = get("ACCESS_TOKEN_SECRET");
if (isLiveDeployment && accessTokenSecret.length < 32) {
  console.error("ACCESS_TOKEN_SECRET must be at least 32 characters in production");
  process.exit(1);
}

export const env = Object.freeze({
  port: Number(process.env.PORT) || Number(fileEnv.PORT) || 5000,
  nodeEnv: isTest ? "test" : isLiveDeployment ? "production" : get("NODE_ENV") || "development",
  isProd: isLiveDeployment,
  isTest,
  mongoUri: get("MONGO_URI"),
  accessTokenSecret,
  corsOrigin: buildCorsOrigins(),
  frontendUrl,
  cloudinary: {
    cloudName,
    apiKey,
    apiSecret,
    folder: get("CLOUDINARY_FOLDER") || "silverfox",
  },
  seedAdmin: {
    email: get("SEED_ADMIN_EMAIL"),
    password: get("SEED_ADMIN_PASSWORD"),
    name: get("SEED_ADMIN_NAME") || "Administrator",
  },
  seedContent: get("SEED_CONTENT") !== "false",
  smtp: (() => {
    const host = get("SMTP_HOST") || null;
    const port = Number(get("SMTP_PORT")) || 465;
    const user = get("SMTP_USER") || null;
    const pass = get("SMTP_PASS") || null;
    const secure = get("SMTP_SECURE") ? get("SMTP_SECURE") === "true" : port === 465;
    const from =
      get("SMTP_FROM") ||
      (user ? `Silverfox Property Management <${user}>` : "no-reply@silverfoxpropertymanagement.com");
    const notificationTo = get("SMTP_NOTIFICATION_TO") || "intisarof1997@gmail.com";

    return { host, port, secure, user, pass, from, notificationTo, isConfigured: Boolean(host && user && pass) };
  })(),
});
