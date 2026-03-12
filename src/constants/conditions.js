// ── Condition Taxonomy ────────────────────────────────────────────────────
export const CONDITION_GROUPS = [
  {
    id: "mind-cognition",
    label: "Mind & Cognition",
    icon: "🧠",
    description: "Memory, focus, neuroprotection",
  },
  {
    id: "stress-mood",
    label: "Stress & Mood",
    icon: "🌊",
    description: "Anxiety, depression, emotional balance",
  },
  {
    id: "sleep",
    label: "Sleep & Recovery",
    icon: "🌙",
    description: "Sleep quality, insomnia, relaxation",
  },
  {
    id: "performance",
    label: "Performance & Vitality",
    icon: "⚡",
    description: "Athletic output, testosterone, energy",
  },
  {
    id: "inflammation",
    label: "Inflammation & Pain",
    icon: "🔥",
    description: "Joint health, chronic pain, antioxidant",
  },
  {
    id: "immune",
    label: "Immune Defence",
    icon: "🛡️",
    description: "Infection resistance, antiviral",
  },
  {
    id: "digestive",
    label: "Digestive Health",
    icon: "🌿",
    description: "Gut health, liver, digestion",
  },
  {
    id: "heart-circulation",
    label: "Heart & Circulation",
    icon: "❤️",
    description: "Blood pressure, cholesterol, flow",
  },
  {
    id: "metabolic",
    label: "Metabolic Health",
    icon: "⚖️",
    description: "Blood sugar, insulin, weight",
  },
  {
    id: "women-health",
    label: "Women's Health",
    icon: "🌺",
    description: "Hormones, menstrual, menopause",
  },
  {
    id: "men-health",
    label: "Men's Health",
    icon: "🌿",
    description: "Prostate, testosterone, male vitality",
  },
  {
    id: "skin-care",
    label: "Skin Care",
    icon: "✨",
    description: "Acne, eczema, wound healing, anti-aging",
  },
];

// ── Condition → PubMed search terms ──────────────────────────────────────
// Used to narrow a herb search to a specific condition context.
export const CONDITION_SEARCH_TERMS = {
  "mind-cognition": ["cognitive function", "memory", "neuroprotection", "learning", "attention", "cognition"],
  "stress-mood":    ["anxiety", "stress", "depression", "cortisol", "mood", "adaptogen"],
  "sleep":          ["sleep", "insomnia", "sedative", "sleep quality", "sleep disorder", "circadian"],
  "performance":    ["athletic performance", "exercise", "testosterone", "endurance", "strength", "sport"],
  "inflammation":   ["anti-inflammatory", "inflammation", "COX-2", "pain", "arthritis", "cytokine"],
  "immune":         ["immune", "immunomodulation", "antiviral", "infection", "antimicrobial"],
  "digestive":      ["digestion", "gut", "gastrointestinal", "liver", "hepatoprotective", "microbiome"],
  "heart-circulation": ["cardiovascular", "blood pressure", "circulation", "cholesterol", "hypertension"],
  "metabolic":      ["blood sugar", "diabetes", "insulin", "metabolic syndrome", "obesity", "glycemic"],
  "women-health":   ["menopause", "hormonal", "estrogen", "menstrual", "fertility", "PMS"],
  "men-health":     ["prostate", "testosterone", "BPH", "erectile dysfunction", "male fertility", "androgen", "libido", "sperm"],
  "skin-care":      ["acne", "eczema", "wound healing", "dermatitis", "psoriasis", "anti-aging", "hyperpigmentation", "skin inflammation"],
};
