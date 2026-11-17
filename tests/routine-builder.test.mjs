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
const { buildRoutine, questionForRoutine } = window.BeautyRoutineLogic;

test("catalog uses genuine named products with HTTPS official listing links", () => {
  assert.ok(catalog.length >= 10);
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  for (const item of catalog) {
    assert.match(item.url, /^https:\/\/www\.lorealparisusa\.com\/skin-care\//);
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
