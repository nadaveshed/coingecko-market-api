import type { Request, Response } from "express";

export function getHealth(_req: Request, res: Response): void {
  res.json({ status: "ok" });
}

export function getReady(_req: Request, res: Response): void {
  res.json({ status: "ready" });
}
