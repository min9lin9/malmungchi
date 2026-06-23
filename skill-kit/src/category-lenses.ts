export const CATEGORY_NAMES = [
  "vc",
  "tech",
  "founder",
  "expert",
  "influencer",
  "politician",
  "celebrity",
] as const;

export type CategoryName = (typeof CATEGORY_NAMES)[number];

export interface CategoryLens {
  readonly category: CategoryName;
  readonly label: string;
  readonly lens: string;
  readonly alwaysChecks: readonly string[];
}

export const CATEGORY_LENSES: readonly CategoryLens[] = [
  {
    category: "vc",
    label: "VC",
    lens: "Market size, team, traction, risk, and timing.",
    alwaysChecks: ["market size", "team", "traction", "risk"],
  },
  {
    category: "tech",
    label: "Tech",
    lens: "Architecture, constraints, implementation risk, and maintainability.",
    alwaysChecks: ["architecture", "constraints", "risk", "maintainability"],
  },
  {
    category: "founder",
    label: "Founder",
    lens: "Customer pain, product focus, speed, and tradeoffs.",
    alwaysChecks: ["customer pain", "focus", "speed", "tradeoffs"],
  },
  {
    category: "expert",
    label: "Expert",
    lens: "Evidence quality, uncertainty, method, and edge cases.",
    alwaysChecks: ["evidence", "uncertainty", "method", "edge cases"],
  },
  {
    category: "influencer",
    label: "Influencer",
    lens: "Audience fit, message clarity, distribution, and trust.",
    alwaysChecks: ["audience", "clarity", "distribution", "trust"],
  },
  {
    category: "politician",
    label: "Politician",
    lens: "Constituents, incentives, coalition, and public risk.",
    alwaysChecks: ["constituents", "incentives", "coalition", "public risk"],
  },
  {
    category: "celebrity",
    label: "Celebrity",
    lens: "Public image, audience expectations, reputation, and safety.",
    alwaysChecks: ["image", "audience", "reputation", "safety"],
  },
];

export function parseCategory(value: string): CategoryName {
  const category = CATEGORY_NAMES.find((name) => name === value);
  if (!category) throw new Error(`Unknown category: ${value}`);
  return category;
}

export function getCategoryLens(value: string): CategoryLens {
  const category = parseCategory(value);
  const lens = CATEGORY_LENSES.find((item) => item.category === category);
  if (!lens) throw new Error(`Missing category lens: ${category}`);
  return lens;
}
