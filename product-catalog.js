// Verified L'Oréal Paris USA product listing snapshots (reviewed Nov 2026).
// This is a curated, static catalog: not a real-time product/price/inventory API.
// All product detail links lead to the official L'Oréal Paris USA website.
window.BeautyCatalog = Object.freeze([
  {
    id: "radiant-cleanser",
    name: "RevitaLift Radiant Smoothing Cream Cleanser",
    family: "REVITALIFT", group: "cleanser", time: "both",
    description: "Cream cleanser with a gentle smoothing/exfoliating effect.",
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
    description: "Rich resurfacing night cream formulated with glycolic, BHA and PHA exfoliating acids.",
    concerns: ["firmness", "hydration", "texture"], skins: ["dry", "normal", "combination"],
    exfoliating: true, strongActive: true,
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
  }  ,
  // Haircare products: official L'Oréal Paris/Elvive catalog pages.
  { id:"plump-shampoo", name:"Elvive Hyaluron + Plump Hydrating Shampoo", family:"ELVIVE", type:"haircare",
    group:"shampoo", time:"both", description:"Hydrating shampoo for dry, thirsty hair.",
    concerns:["hydration"], skins:["dry","normal"], url:"https://www.lorealparisusa.com/hair-care-hair-style/shampoo/elvive-hyaluron-plump-hyaluro-shampoo-26-5oz" },
  { id:"plump-conditioner", name:"Elvive Hyaluron + Plump Hydrating Conditioner", family:"ELVIVE", type:"haircare",
    group:"conditioner", time:"both", description:"Detangling conditioner to moisturize dry hair lengths.",
    concerns:["hydration"], skins:["dry","normal"], url:"https://www.lorealparisusa.com/hair-care-hair-style/conditioner/elvive-hyaluron-plump-hydrating-conditioner-paraben-free" },
  { id:"plump-leave-in", name:"Elvive Hyaluron + Plump Moisture Leave-In Serum", family:"ELVIVE", type:"haircare",
    group:"leave-in", time:"both", description:"Lightweight leave-in hydration for dry hair lengths.",
    concerns:["hydration"], skins:["dry","normal"], url:"https://www.lorealparisusa.com/hair-care-hair-style/hair-treatments/hyaluron-plump-moisture-plump-serum-paraben-free" },
  { id:"pure-shampoo", name:"Elvive Hyaluron + Pure 72H Purifying Shampoo", family:"ELVIVE", type:"haircare",
    group:"shampoo", time:"both", description:"Shampoo aimed at oily roots and a refreshed scalp.",
    concerns:["oil"], skins:["oily"], url:"https://www.lorealparisusa.com/hair-care-hair-style/shampoo/hyaluron-pure-purifying-shampoo" },
  { id:"pure-conditioner", name:"Elvive Hyaluron + Pure Rehydrating Conditioner", family:"ELVIVE", type:"haircare",
    group:"conditioner", time:"both", description:"Conditioner for oily roots and dehydrated lengths; apply to lengths and ends.",
    concerns:["oil","hydration"], skins:["oily"], url:"https://www.lorealparisusa.com/hair-care-hair-style/conditioner/hyaluron-pure-purifying-conditioner" },
  { id:"dream-shampoo", name:"Elvive Dream Lengths Restoring Shampoo", family:"ELVIVE", type:"haircare",
    group:"shampoo", time:"both", description:"Restoring shampoo for longer, damage-prone hair.",
    concerns:["repair"], skins:["damaged"], url:"https://www.lorealparisusa.com/hair-care-hair-style/shampoo/elvive-dream-lengths-restoring-shampoo-for-long-damaged-hair" },
  { id:"dream-conditioner", name:"Elvive Dream Length Super Detangler Conditioner", family:"ELVIVE", type:"haircare",
    group:"conditioner", time:"both", description:"Detangling conditioner for long, damaged hair.",
    concerns:["repair"], skins:["damaged"], url:"https://www.lorealparisusa.com/hair-care-hair-style/conditioner/elvive-dream-lengths-conditioner-for-long-damaged-hair" },
  { id:"dream-leave-in", name:"Elvive Dream Lengths No Haircut Cream Leave-In", family:"ELVIVE", type:"haircare",
    group:"leave-in", time:"both", description:"Leave-in cream for long hair prone to breakage and split ends.",
    concerns:["repair"], skins:["damaged"], url:"https://www.lorealparisusa.com/hair-care-hair-style/hair-treatments/elvive-dream-lengths-no-haircut-cream-leave-in-conditioner" },
  // Makeup product detail pages: never guess foundation or lipstick shades.
  { id:"lumi-glotion", name:"True Match Lumi Glotion Glow Enhancer", family:"TRUE MATCH", type:"makeup",
    group:"base", time:"am", description:"Sheer glow enhancer; choose the appropriate shade on the official site.",
    concerns:["radiance"], skins:["natural"], url:"https://www.lorealparisusa.com/makeup/face/highlighters/true-match-lumi-glotion-natural-glow-enhancer" },
  { id:"true-match", name:"True Match Super-Blendable Foundation", family:"TRUE MATCH", type:"makeup",
    group:"base", time:"am", description:"Buildable medium-coverage foundation; official page shows a sample shade, not a personalized match.",
    concerns:["definition"], skins:["polished"], url:"https://www.lorealparisusa.com/makeup/face/foundation-makeup/true-match-super-blendable-makeup-c3-creamy-natural" },
  { id:"lash-paradise", name:"Voluminous Lash Paradise Washable Mascara", family:"VOLUMINOUS", type:"makeup",
    group:"eyes", time:"am", description:"Washable mascara for volume and length.",
    concerns:["definition","radiance"], skins:["natural","polished"], url:"https://www.lorealparisusa.com/makeup/eye/mascara/voluminous-lash-paradise-washable-mascara" },
  { id:"colour-riche", name:"Colour Riche Satin Lipstick", family:"COLOUR RICHE", type:"makeup",
    group:"lips", time:"am", description:"Creamy satin lip color; select your preferred shade on the official listing.",
    concerns:["definition","radiance"], skins:["natural","polished"], url:"https://www.lorealparisusa.com/makeup/lip-color/lipstick/colour-riche-lipcolour" }

].map(product => Object.freeze(product)));
