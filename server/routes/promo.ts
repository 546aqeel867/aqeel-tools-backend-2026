import type { Request, Response } from "express";

export interface PromoResult {
  valid: boolean;
  plan?: "nitro" | "nitro_bat";
  days?: number;
  message: string;
}

export function validatePromo(code: string): PromoResult {
  if (!code || typeof code !== "string") {
    return { valid: false, message: "Please enter a promo code." };
  }

  const rawCodes = process.env.PROMO_CODES || "";
  const entries = rawCodes.split(",").filter(Boolean);
  const upperCode = code.trim().toUpperCase();

  for (const entry of entries) {
    const parts = entry.split(":");
    if (parts.length < 3) continue;
    const [entryCode, planRaw, daysStr] = parts;
    if (entryCode?.trim().toUpperCase() === upperCode) {
      const plan = (planRaw?.trim() === "nitro_bat" ? "nitro_bat" : "nitro") as "nitro" | "nitro_bat";
      const days = parseInt(daysStr?.trim() || "7", 10);
      const planName = plan === "nitro_bat" ? "🦇 Nitro Bat" : "⚡ Nitro";
      return {
        valid: true,
        plan,
        days,
        message: `🎉 Code accepted! ${days} days of ${planName} unlocked.`,
      };
    }
  }

  return { valid: false, message: "Invalid or expired promo code. Try again." };
}

export function registerPromoRoutes(app: any) {
  app.post("/api/promo/validate", (req: Request, res: Response) => {
    const { code } = req.body || {};
    const result = validatePromo(code);
    res.json(result);
  });
}
