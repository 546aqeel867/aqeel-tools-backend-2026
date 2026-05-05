import type { Request, Response } from "express";

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: null,
    days: null,
    hasAds: true,
    features: ["25+ free tools", "Basic AI (limited)", "Standard support"],
  },
  {
    id: "nitro_month",
    name: "Nitro",
    price: 2.99,
    period: "month",
    days: 30,
    hasAds: false,
    features: ["All Nitro tools", "Ad-free experience", "Priority AI", "Exclusive theme"],
  },
  {
    id: "nitro_year",
    name: "Nitro",
    price: 24.99,
    period: "year",
    days: 365,
    hasAds: false,
    savings: "Save 30%",
    features: ["All Nitro tools", "Ad-free experience", "Priority AI", "Exclusive theme"],
  },
  {
    id: "nitro_bat_month",
    name: "Nitro Bat",
    price: 4.99,
    period: "month",
    days: 30,
    hasAds: false,
    features: ["ALL 40+ tools unlocked", "PyMate Pro access", "Fastest AI (GPT-4 level)", "Ad-free + exclusive themes", "Early access + Bat badge"],
  },
  {
    id: "nitro_bat_year",
    name: "Nitro Bat",
    price: 39.99,
    period: "year",
    days: 365,
    hasAds: false,
    savings: "Save 33%",
    features: ["ALL 40+ tools unlocked", "PyMate Pro access", "Fastest AI (GPT-4 level)", "Ad-free + exclusive themes", "Early access + Bat badge"],
  },
];

export function registerPlansRoutes(app: any) {
  app.get("/api/plans", (_req: Request, res: Response) => {
    res.json({ plans: PLANS });
  });
}
