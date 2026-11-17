// Verified L'Oréal Paris USA product listing snapshots (reviewed Nov 2026).
// This is a curated, static catalog: not a real-time product/price/inventory API.
// All product detail links lead to the official L'Oréal Paris USA website.
window.BeautyCatalog = Object.freeze([
  {
    id: "radiant-cleanser",
    name: "RevitaLift Radiant Smoothing Cream Cleanser",
    family: "REVITALIFT", group: "cleanser", time: "both",
    description: "Cream cleanser for a comfortable first step.",
    concerns: ["hydration", "firmness"], skins: ["dry", "normal", "combination", "sensitive"],
    url: "https://www.lorealparisusa.com/skin-care/facial-cleansers/revitalift-radiant-smoothing-cream-cleanser"
  },
  {
    id: "glycolic-cleanser",
    name: "RevitaLift 3.5% Glycolic Acid Cleanser",
    family: "REVITALIFT", group: "cleanser", time: "pm",
    description: "Exfoliating wash for a smoother-looking complexion.",
    concerns: ["texture", "radiance"], skins: ["oily", "normal", "combination"],
    exfoliating: true,
    url: "https://www.lorealparisusa.com/skin-care/facial-cleansers/revitalift-derm-intensives-glycolic-acid-cleanser"
  },
  {
    id: "ha-serum",
    name: "RevitaLift 1.5% Pure Hyaluronic Acid Serum",
    family: "REVITALIFT", group: "serum", time: "both",
    description: "Lightweight hydrating serum to visibly plump skin.",
    concerns: ["hydration", "firmness"], skins: ["dry", "normal", "oily", "combination", "sensitive"],
    url: "https://www.lorealparisusa.com/skin-care/face-serums/revitalift-derm-intensives-pure-hyaluronic-acid-serum"
  },
  {
    id: "vitamin-c-serum",
    name: "RevitaLift 12% Vitamin C + E + Salicylic Acid Serum",
    family: "REVITALIFT", group: "serum", time: "am",
    description: "Brightening serum with vitamins C and E plus salicylic acid.",
    concerns: ["radiance", "texture"], skins: ["normal", "oily", "combination"],
    strongActive: true,
    url: "https://www.lorealparisusa.com/skin-care/face-serums/vitamin-c-vitamin-e-salicylic-acid-serum"
  },
  {
    id: "glycolic-serum",
    name: "RevitaLift 10% Pure Glycolic Acid Serum",
    family: "REVITALIFT", group: "serum", time: "pm",
    description: "Exfoliating serum for uneven-looking tone and texture.",
    concerns: ["radiance", "texture"], skins: ["normal", "oily", "combination"],
    exfoliating: true, strongActive: true,
    url: "https://www.lorealparisusa.com/skin-care/exfoliant/revitalift-derm-intensives-10-pure-glycolic-acid-serum"
  },
  {
    id: "peptide-serum",
    name: "RevitaLift Triple Power Tri-Peptides Serum",
    family: "REVITALIFT", group: "serum", time: "both",
    description: "Serum focused on the look of firmness and fine lines.",
    concerns: ["firmness", "hydration"], skins: ["dry", "normal", "oily", "combination"],
    url: "https://www.lorealparisusa.com/skin-care/face-serums/revitalift-triple-power-age-defying-serum"
  },
  {
    id: "hydra-genius",
    name: "Hydra Genius Daily Liquid Care — Normal/Dry Skin",
    family: "HYDRA GENIUS", group: "moisturizer", time: "both",
    description: "Lightweight, water-based moisturizer for normal to dry skin.",
    concerns: ["hydration"], skins: ["dry", "normal", "combination"],
    url: "https://www.lorealparisusa.com/skin-care/facial-moisturizers/hydra-genius-daily-liquid-care-normal-dry-skin"
  },
  {
    id: "fragrance-free",
    name: "RevitaLift Triple Power Moisturizer — Fragrance-Free",
    family: "REVITALIFT", group: "moisturizer", time: "both",
    description: "Fragrance-free daily moisturizer for hydration and firmness.",
    concerns: ["firmness", "hydration"], skins: ["dry", "normal", "oily", "combination", "sensitive"],
    url: "https://www.lorealparisusa.com/skin-care/facial-moisturizers/revitalift-triple-power-anti-aging-moisturizer-fragrance-free"
  },
  {
    id: "night-moisturizer",
    name: "RevitaLift Triple Power Rich Night Moisturizer",
    family: "REVITALIFT", group: "moisturizer", time: "pm",
    description: "Rich nighttime moisturizer for a firm, smooth-looking finish.",
    concerns: ["firmness", "hydration"], skins: ["dry", "normal", "combination"],
    url: "https://www.lorealparisusa.com/skin-care/facial-moisturizers/revitalift-triple-power-rich-night-moisturizer"
  },
  {
    id: "bright-spf",
    name: "Bright Reveal Broad Spectrum SPF 50 UV Fluid",
    family: "BRIGHT REVEAL", group: "sunscreen", time: "am",
    description: "Daily broad-spectrum SPF 50 UV lotion.",
    concerns: ["radiance", "texture", "hydration"], skins: ["dry", "normal", "oily", "combination", "sensitive"],
    url: "https://www.lorealparisusa.com/skin-care/facial-moisturizers/bright-reveal-spf-50-invisible-uv-fluid"
  },
  {
    id: "triple-spf",
    name: "RevitaLift Triple Power Moisturizer with SPF 30",
    family: "REVITALIFT", group: "sunscreen", time: "am",
    description: "Daily anti-aging moisturizer with broad-spectrum SPF 30.",
    concerns: ["firmness", "hydration"], skins: ["dry", "normal", "oily", "combination"],
    url: "https://www.lorealparisusa.com/skin-care/facial-moisturizers/revitalift-triple-power-moisturizer-spf-30"
  }
].map(product => Object.freeze(product)));
