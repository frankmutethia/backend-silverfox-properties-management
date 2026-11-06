import { createApp } from "./app.js";
import { config } from "./config.js";
import { bootstrap } from "./db/bootstrap.js";
import { pool, runMigrations } from "./db/client.js";

async function main() {
  if (config.RUN_MIGRATIONS) await runMigrations();
  await bootstrap();

  const server = createApp().listen(config.PORT, () => {
    console.info(`Silverfox API listening on port ${config.PORT}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      server.close(() => void pool.end().then(() => process.exit(0)));
    });
  }
}

main().catch((error: unknown) => {
  console.error("Failed to start the Silverfox API:", error);
  process.exit(1);
});
