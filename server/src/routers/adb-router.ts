import express from "express";
import type { AdbStatus } from "@media-server/shared";

import type { AppContext } from "../app-context";

export function createAdbRouter(context: AppContext) {
  const router = express.Router();

  router.get("/status", async (_req, res, next) => {
    try {
      const status = await context.androidDeviceClient.getStatus();
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/connect",
    async (_req: express.Request<Record<string, never>, AdbStatus>, res, next) => {
      try {
        await context.androidDeviceClient.connect();
        const status = await context.androidDeviceClient.getStatus();
        res.json(status);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
