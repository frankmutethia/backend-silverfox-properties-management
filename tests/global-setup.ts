import type { TestProject } from "vitest/node";
import { startLocalMySql } from "../scripts/local-mysql.js";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const { db, url } = await startLocalMySql();
  project.provide("databaseUrl", url);
  return async () => {
    await db.stop();
  };
}
