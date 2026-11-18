// Node built-in tests for the real-product routine builder (no paid API calls).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const window = {};
const document = { getElementById: () => null };
for (const file of ["product-catalog.js", "routine-builder.js"]) {
  const source = readFileSync(new URL(file, root), "utf8");
  runInNewContext(source, { window, document });
}
const catalog = window.BeautyCatalog;
const { buildRoutine, questionForRoutine, buildSelectedProductNotes, buildFollowUpProductNotes, questionForSelectedProducts, parseSavedProductIds, normalizeSearch, filterCatalogProducts } = window.BeautyRoutineLogic;

test("catalog uses genuine named products with HTTPS official listing links", () => {
  assert.ok(catalog.length >= 23);
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  for (const item of catalog) {
    assert.match(item.url, /^https:\/\/www\.lorealparisusa\.com\/(skin-care|hair-care-hair-style|makeup)\//);
    assert.ok(item.name && item.description);
  }
});

test("morning and evening plans use proper step order and daily morning SPF", () => {
  const plan = buildRoutine({ skin: "normal", concern: "hydration", time: "both" });
  assert.deepEqual(Array.from(plan.am, item => item.group), ["cleanser", "serum", "moisturizer", "sunscreen"]);
  assert.deepEqual(Array.from(plan.pm, item => item.group), ["cleanser", "serum", "moisturizer"]);
  assert.ok(plan.am.at(-1).product.name.includes("SPF"));
});

test("user-saved safe serum is prioritized over other matching products", () => {
  const plan = buildRoutine({ skin: "normal", concern: "hydration", time: "am" }, ["peptide-serum"]);
  assert.equal(plan.am[1].product.id, "peptide-serum");
  assert.equal(plan.pm.length, 0);
});

test("evening-only serum is not recommended in a morning-only routine", () => {
  const plan = buildRoutine({ skin: "oily", concern: "radiance", time: "am" }, ["glycolic-serum"]);
  assert.ok(plan.am.every(step => step.product.id !== "glycolic-serum"));
  assert.ok(plan.notes.some(note => note.includes("left out")));
});

test("sensitive routines omit stronger acids even when selected", () => {
  const plan = buildRoutine({ skin: "sensitive", concern: "texture", time: "both" }, ["glycolic-serum", "vitamin-c-serum"]);
  assert.ok([...plan.am, ...plan.pm].every(step => !step.product.exfoliating && !step.product.strongActive));
  assert.ok(plan.notes.some(note => note.includes("sensitive")));
});

test("routines avoid stacking a glycolic exfoliating cleanser and glycolic serum", () => {
  const plan = buildRoutine({ skin: "normal", concern: "texture", time: "pm" }, ["glycolic-cleanser", "glycolic-serum"]);
  assert.equal(plan.pm[1].product.id, "glycolic-serum");
  assert.notEqual(plan.pm[0].product.id, "glycolic-cleanser");
});

test("AI refinement prompt carries selected routine without exceeding Worker limits", () => {
  const plan = buildRoutine({ skin: "dry", concern: "firmness", time: "both" }, ["peptide-serum", "night-moisturizer"]);
  const prompt = questionForRoutine(plan);
  assert.ok(prompt.length <= 1000);
  assert.match(prompt, /L'Oréal Paris/);
  assert.match(prompt, /RevitaLift/);
  assert.match(prompt, /Morning:/);
  assert.match(prompt, /Evening:/);
});

test("haircare wash-day plans follow real matching hair products", () => {
  const plan = buildRoutine({ type:"haircare", skin:"dry", concern:"hydration" });
  assert.equal(plan.type, "haircare");
  assert.deepEqual(Array.from(plan.am, s => s.group), ["shampoo", "conditioner", "leave-in"]);
  assert.ok(plan.am.every(s => s.product.name.includes("Elvive")));
  assert.equal(plan.pm.length, 0);
  assert.match(questionForRoutine(plan), /Wash day:/);
});

test("oily hair avoids dry-hair leave-in and matches Hyaluron Pure", () => {
  const plan = buildRoutine({ type:"haircare", skin:"oily", concern:"oil" }, ["plump-leave-in"]);
  assert.deepEqual(Array.from(plan.am, s => s.group), ["shampoo", "conditioner"]);
  assert.equal(plan.am[0].product.id, "pure-shampoo");
  assert.equal(plan.am[1].product.id, "pure-conditioner");
  assert.ok(plan.notes.some(s => s.includes("left out")));
});

test("damaged-hair routine prefers coordinated Dream Lengths line", () => {
  const plan = buildRoutine({ type:"haircare", skin:"damaged", concern:"repair" });
  assert.deepEqual(Array.from(plan.am, s => s.product.id), ["dream-shampoo", "dream-conditioner", "dream-leave-in"]);
});

test("makeup routines use product-backed steps with no automatic shade matching", () => {
  const natural = buildRoutine({ type:"makeup", skin:"natural", concern:"radiance" });
  const polished = buildRoutine({ type:"makeup", skin:"polished", concern:"definition" });
  assert.deepEqual(Array.from(natural.am, s => s.group), ["base", "eyes", "lips"]);
  assert.equal(natural.am[0].product.id, "lumi-glotion");
  assert.equal(polished.am[0].product.id, "true-match");
  assert.equal(natural.pm.length, 0);
  assert.ok(polished.notes.some(s => s.includes("shades")));
  assert.match(questionForRoutine(polished), /Makeup look:/);
});

test("exfoliating night cream is not paired with exfoliating glycolic serum", () => {
  const plan = buildRoutine({ type:"skincare", skin:"dry", concern:"texture", time:"pm" },
    ["glycolic-serum", "night-moisturizer"]);
  assert.equal(catalog.find(p => p.id === "night-moisturizer").exfoliating, true);
  assert.ok(plan.pm.filter(step => step.product.exfoliating).length <= 1);
  assert.ok(plan.notes.some(s => s.includes("left out")));
});

test("sensitive skin never receives an exfoliating night cream even when saved", () => {
  const plan = buildRoutine({ type:"skincare", skin:"sensitive", concern:"firmness", time:"pm" }, ["night-moisturizer"]);
  assert.ok(plan.pm.every(s => !s.product.exfoliating));
  assert.ok(plan.notes.some(s => s.includes("Sensitive-skin")));
});

test("selected products become source-backed context messages with real product details", () => {
  const serum = catalog.find(item => item.id === "ha-serum");
  const mascara = catalog.find(item => item.id === "lash-paradise");
  const notes = buildSelectedProductNotes([serum, mascara]);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /Selected L'Oréal Paris products/);
  assert.ok(notes[0].includes(serum.name));
  assert.ok(notes[0].includes(serum.description));
  assert.ok(notes[0].includes(serum.url));
  assert.ok(notes[0].includes(mascara.name));
  assert.ok(notes[0].includes(mascara.url));
  assert.ok(notes.every(note => note.length <= 1000));
});

test("selecting every catalog item preserves all products within Worker message limits", () => {
  const notes = buildSelectedProductNotes(catalog);
  assert.ok(notes.length >= 2 && notes.length <= 10);
  assert.ok(notes.every(note => note.trim().length > 0 && note.length <= 1000));
  const transmitted = notes.join("\n");
  for (const product of catalog) {
    assert.ok(transmitted.includes(product.name), "Missing selected product " + product.name);
    assert.ok(transmitted.includes(product.url), "Missing official listing for " + product.name);
  }
});

test("AI generation request includes user preferences and safe routine instructions", () => {
  const prompt = questionForSelectedProducts({
    type:"skincare",skin:"sensitive",concern:"hydration",time:"pm"
  }, 3);
  assert.match(prompt, /Generate a personalized L'Oréal Paris skincare routine/);
  assert.match(prompt, /3 selected products/);
  assert.match(prompt, /sensitive/);
  assert.match(prompt, /hydration/);
  assert.match(prompt, /timing: pm/);
  assert.match(prompt, /exfoliating acids/);
  assert.ok(prompt.length <= 1000);
});


test("Generated routine keeps all exact product names for follow-up turns", () => {
  const products = catalog;
  const notes = buildFollowUpProductNotes(products, {
    type: "skincare", skin: "sensitive", concern: "hydration", time: "pm"
  });
  assert.ok(notes.length >= 1 && notes.length <= 3);
  assert.ok(notes.every(note => note.length <= 1000));
  const text = notes.join("\n");
  for (const product of products) {
    assert.ok(text.includes(product.name), "Missing selected product " + product.name);
  }
  assert.match(text, /sensitive/);
  assert.match(text, /hydration/);
  assert.match(text, /historical context only/);
});


test("saved product IDs restore safely, discard removed catalog items and duplicates", () => {
  const ids = parseSavedProductIds(JSON.stringify([
    "lumi-glotion", "lumi-glotion", "removed-product-id", "lash-paradise", 1, null
  ]));
  assert.deepEqual(Array.from(ids), ["lumi-glotion", "lash-paradise"]);
  assert.deepEqual(Array.from(parseSavedProductIds("not JSON")), []);
  assert.deepEqual(Array.from(parseSavedProductIds('{"injected":true}')), []);
  assert.deepEqual(Array.from(parseSavedProductIds(JSON.stringify(["unknown"]))), []);
  assert.deepEqual(Array.from(parseSavedProductIds("x".repeat(10001))), []);
  assert.deepEqual(Array.from(parseSavedProductIds(null)), []);
});

test("restored selected products still influence personalized routine recommendations", () => {
  const saved = parseSavedProductIds(JSON.stringify(["peptide-serum"]));
  const plan = buildRoutine({ skin:"normal", concern:"hydration", time:"am" }, saved);
  assert.equal(plan.am[1].product.id, "peptide-serum");
});


test("Product search matches any-order keywords across name, group and description", () => {
  const sorted = filterCatalogProducts(catalog, "serum hyaluronic", "all");
  assert.ok(sorted.some(p => p.id === "ha-serum"), "Hyaluronic serum is discoverable");
  assert.ok(sorted.every(p => p.name.toLowerCase().includes("hyaluronic") && p.group === "serum"));
  const reversed = filterCatalogProducts(catalog, "HYALURONIC    SERUM", "all");
  assert.deepEqual(Array.from(reversed, p => p.id), Array.from(sorted, p => p.id));
  const hair = filterCatalogProducts(catalog, "oily shampoo", "haircare");
  assert.ok(hair.some(p => p.id === "pure-shampoo"));
  assert.ok(hair.every(p => p.type === "haircare" && p.group === "shampoo"));
});

test("Product search intersects keyword matches with the selected category", () => {
  const all = filterCatalogProducts(catalog, "hyaluron", "all");
  const serum = filterCatalogProducts(catalog, "hyaluron", "serum");
  const hair = filterCatalogProducts(catalog, "hyaluron", "haircare");
  assert.ok(all.length > serum.length);
  assert.ok(serum.some(p => p.id === "ha-serum"));
  assert.ok(hair.some(p => p.id === "plump-shampoo"));
  assert.ok(serum.every(p => p.group === "serum"));
  assert.ok(hair.every(p => p.type === "haircare"));
  assert.equal(filterCatalogProducts(catalog, "hyaluronic", "makeup").length, 0);
});

test("Product keyword matching is case, punctuation and accent insensitive", () => {
  assert.equal(normalizeSearch("  L’Oréal  SPF-50!  "), "loreal spf 50");
  assert.ok(filterCatalogProducts(catalog, "L’Oréal mascara", "all").some(p => p.id === "lash-paradise"));
  assert.equal(normalizeSearch("Hyalurónic acid"), "hyaluronic acid");
  const one = filterCatalogProducts(catalog, "SPF-50", "all");
  const two = filterCatalogProducts(catalog, "spf 50", "all");
  assert.deepEqual(Array.from(one, p => p.id), Array.from(two, p => p.id));
  assert.ok(one.some(p => p.id === "bright-spf"));
  assert.ok(filterCatalogProducts(catalog, "face wash", "all").some(p => p.id === "radiant-cleanser"));
});

test("Product keyword search preserves catalog order, returns all on empty query and no false matches", () => {
  const all = filterCatalogProducts(catalog, "", "all");
  assert.deepEqual(Array.from(all, p => p.id), Array.from(catalog, p => p.id));
  assert.deepEqual(Array.from(filterCatalogProducts(catalog, "not-real-product-name-zzz", "all")), []);
  assert.ok(filterCatalogProducts(catalog, "dry hair", "haircare").length > 0);
  assert.ok(filterCatalogProducts(catalog, "mascara", "makeup").some(p => p.id === "lash-paradise"));
});
