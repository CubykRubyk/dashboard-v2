import assert from "node:assert/strict";
import test from "node:test";

import { planPumpEquipment } from "../../src/lib/hvac/simple-pump-service";
import {
  simplePumpFormData,
  simplePumpInputSchema,
} from "../../src/lib/hvac/simple-pump-validation";
import type { SimplePumpInput } from "../../src/lib/hvac/simple-pump-validation";

function input(overrides: Partial<SimplePumpInput> = {}): SimplePumpInput {
  return {
    manufacturerId: "man-1",
    productRangeId: null,
    newProductRangeName: "",
    name: "Altherma 3 H HT 16",
    configuration: "MONOBLOC",
    indoorReference: "",
    outdoorReference: "",
    nominalPowerKw: null,
    installationNotes: "",
    internalNotes: "",
    ...overrides,
  } as SimplePumpInput;
}

test("monobloc avec référence : une seule fiche MONOBLOC", () => {
  const planned = planPumpEquipment(
    input({ configuration: "MONOBLOC", indoorReference: "EBLA 16 D3V3" }),
  );
  assert.equal(planned.length, 1);
  assert.equal(planned[0].type, "MONOBLOC");
  assert.equal(planned[0].manufacturerReference, "EBLA 16 D3V3");
  assert.equal(planned[0].referenceNeedsReview, false);
});

test("monobloc sans référence : le nom sert de référence et la fiche est à vérifier", () => {
  const planned = planPumpEquipment(input({ configuration: "MONOBLOC" }));
  assert.equal(planned.length, 1);
  assert.equal(planned[0].type, "MONOBLOC");
  assert.equal(planned[0].manufacturerReference, "Altherma 3 H HT 16");
  assert.equal(planned[0].referenceNeedsReview, true);
  assert.ok(planned[0].normalizedReference.length > 0);
});

test("monobloc : deux références saisies ne produisent jamais deux fiches", () => {
  // Cas limite réel : l'utilisateur change de configuration après avoir rempli les deux champs.
  const planned = planPumpEquipment(
    input({
      configuration: "MONOBLOC",
      indoorReference: "EHVH 16",
      outdoorReference: "EPRA 16",
    }),
  );
  assert.equal(planned.length, 1);
  assert.equal(planned[0].type, "MONOBLOC");
});

test("split avec les deux références : deux fiches, intérieure et extérieure", () => {
  const planned = planPumpEquipment(
    input({
      configuration: "SPLIT",
      indoorReference: "EHVH 16 S26E9W",
      outdoorReference: "EPRA 16 DW17",
    }),
  );
  assert.equal(planned.length, 2);
  assert.deepEqual(
    planned.map((item) => item.type),
    ["INDOOR_UNIT", "OUTDOOR_UNIT"],
  );
  assert.ok(planned.every((item) => item.referenceNeedsReview === false));
  // Les noms sont distincts, sinon les deux fiches seraient indiscernables dans les listes.
  assert.notEqual(planned[0].name, planned[1].name);
  assert.ok(planned[0].name.startsWith("Altherma 3 H HT 16"));
});

test("split avec une seule référence : une seule fiche, du bon type", () => {
  const indoorOnly = planPumpEquipment(
    input({ configuration: "SPLIT", indoorReference: "EHVH 16" }),
  );
  assert.equal(indoorOnly.length, 1);
  assert.equal(indoorOnly[0].type, "INDOOR_UNIT");

  const outdoorOnly = planPumpEquipment(
    input({ configuration: "SPLIT", outdoorReference: "EPRA 16" }),
  );
  assert.equal(outdoorOnly.length, 1);
  assert.equal(outdoorOnly[0].type, "OUTDOOR_UNIT");
});

test("split sans aucune référence : une fiche unique OTHER à vérifier", () => {
  const planned = planPumpEquipment(input({ configuration: "SPLIT" }));
  assert.equal(planned.length, 1);
  assert.equal(planned[0].type, "OTHER");
  assert.equal(planned[0].manufacturerReference, "Altherma 3 H HT 16");
  assert.equal(planned[0].referenceNeedsReview, true);
});

test("configuration inconnue : une fiche unique, sans invention de type", () => {
  const planned = planPumpEquipment(input({ configuration: "UNKNOWN" }));
  assert.equal(planned.length, 1);
  assert.equal(planned[0].type, "OTHER");
  assert.equal(planned[0].referenceNeedsReview, true);
});

test("configuration inconnue avec références : les fiches suivent les références", () => {
  const planned = planPumpEquipment(
    input({ configuration: "UNKNOWN", indoorReference: "A1", outdoorReference: "B2" }),
  );
  assert.deepEqual(planned.map((item) => item.type), ["INDOOR_UNIT", "OUTDOOR_UNIT"]);
});

test("aucune combinaison n’est planifiée : le plan ne contient que des équipements", () => {
  // Garde-fou explicite sur la décision produit : ce formulaire ne crée jamais de
  // SystemCombination, c'est exactement la complexité qu'il supprime.
  const planned = planPumpEquipment(
    input({ configuration: "SPLIT", indoorReference: "A1", outdoorReference: "B2" }),
  );
  assert.ok(planned.every((item) => "type" in item && "manufacturerReference" in item));
  assert.equal(planned.length, 2);
});

test("le schéma refuse une gamme existante ET une nouvelle gamme", () => {
  const result = simplePumpInputSchema.safeParse(
    simplePumpFormData(
      new Map([
        ["manufacturerId", "man-1"],
        ["name", "Pompe"],
        ["configuration", "MONOBLOC"],
        ["productRangeId", "range-1"],
        ["newProductRangeName", "Nouvelle gamme"],
      ]) as unknown as FormData,
    ),
  );
  assert.equal(result.success, false);
});

test("le schéma refuse deux références identiques", () => {
  const result = simplePumpInputSchema.safeParse({
    manufacturerId: "man-1",
    productRangeId: "",
    newProductRangeName: "",
    name: "Pompe",
    configuration: "SPLIT",
    indoorReference: "EPRA 16",
    outdoorReference: "epra   16", // même référence une fois normalisée
    nominalPowerKw: "",
    installationNotes: "",
    internalNotes: "",
  });
  assert.equal(result.success, false);
});

test("le schéma accepte une pompe minimale : fabricant, nom, configuration", () => {
  const result = simplePumpInputSchema.safeParse({
    manufacturerId: "man-1",
    productRangeId: "",
    newProductRangeName: "",
    name: "Pompe simple",
    configuration: "UNKNOWN",
    indoorReference: "",
    outdoorReference: "",
    nominalPowerKw: "",
    installationNotes: "",
    internalNotes: "",
  });
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  if (result.success) {
    assert.equal(result.data.productRangeId, null);
    assert.equal(result.data.nominalPowerKw, null);
  }
});

test("le schéma accepte une virgule décimale pour la puissance", () => {
  const result = simplePumpInputSchema.safeParse({
    manufacturerId: "man-1",
    productRangeId: "",
    newProductRangeName: "",
    name: "Pompe",
    configuration: "MONOBLOC",
    indoorReference: "",
    outdoorReference: "",
    nominalPowerKw: "11,2",
    installationNotes: "",
    internalNotes: "",
  });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.nominalPowerKw, 11.2);
});
