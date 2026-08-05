import assert from "node:assert/strict";
import test from "node:test";

import { applyEventPatch, toDolibarrTimestamp } from "../../src/lib/dolibarr/event-payload";

/** Modèle typique renvoyé par `/agendaevents/{id}`, réduit aux champs qui nous concernent. */
function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "48431",
    ref: "AC-48431",
    label: "Entretien annuel",
    actioncomm: "Entretien annuel",
    datep: 1_754_380_800,
    datef: 1_754_413_200,
    date_start_in_calendar: 1_754_380_800,
    date_end_in_calendar: 1_754_413_200,
    percentage: "0",
    location: "12 rue de la Paix, 75002 Paris",
    socid: "412",
    userownerid: "12",
    note_private: "Ancienne note",
    // Champ propre à l'instance : doit survivre au PUT.
    array_options: { options_secteur: "Nord" },
    ...overrides,
  };
}

test("un patch vide ne modifie rien du modèle relu", () => {
  const source = event();
  const result = applyEventPatch(source, {});
  assert.deepEqual(result, source);
});

test("les champs inconnus de nous sont conservés tels quels", () => {
  // C'est tout l'intérêt de relire puis renvoyer le modèle complet : un champ propre à une
  // version de Dolibarr ne doit jamais être perdu au passage.
  const result = applyEventPatch(event(), { label: "Nouveau titre" });
  assert.deepEqual(result.array_options, { options_secteur: "Nord" });
  assert.equal(result.socid, "412");
  assert.equal(result.ref, "AC-48431");
});

test("la date est renvoyée dans la même convention que la lecture", () => {
  // `datep` encode l'heure de Paris dans les composantes UTC brutes (cf. CLAUDE.md) : la valeur
  // écrite doit être exactement l'inverse de la lecture, sans re-conversion de fuseau.
  const date = new Date("2026-08-05T09:00:00.000Z");
  const result = applyEventPatch(event(), { startAt: date });
  assert.equal(result.datep, 1_785_920_400);
  assert.equal(toDolibarrTimestamp(date), result.datep);
  // Un aller-retour lecture → écriture doit être neutre.
  const roundTrip = new Date((result.datep as number) * 1000);
  assert.equal(roundTrip.toISOString(), date.toISOString());
});

test("date_start_in_calendar suit datep quand le champ existe", () => {
  const result = applyEventPatch(event(), { startAt: new Date("2026-08-05T09:00:00.000Z") });
  assert.equal(result.date_start_in_calendar, result.datep);

  // …et n'est pas inventé si l'instance ne l'expose pas.
  const withoutField = applyEventPatch(event({ date_start_in_calendar: undefined }), {
    startAt: new Date("2026-08-05T09:00:00.000Z"),
  });
  assert.equal("date_start_in_calendar" in withoutField ? withoutField.date_start_in_calendar : null,
    withoutField.datep);
});

test("une date nulle est transmise comme nulle", () => {
  const result = applyEventPatch(event(), { endAt: null });
  assert.equal(result.datef, null);
});

test("le libellé met à jour label et actioncomm", () => {
  const result = applyEventPatch(event(), { label: "Dépannage urgent" });
  assert.equal(result.label, "Dépannage urgent");
  assert.equal(result.actioncomm, "Dépannage urgent");
});

test("actioncomm n’est pas créé si l’instance ne l’expose pas", () => {
  const source = event();
  delete (source as Record<string, unknown>).actioncomm;
  const result = applyEventPatch(source, { label: "Titre" });
  assert.equal("actioncomm" in result, false);
});

test("la note écrase note_private", () => {
  const result = applyEventPatch(event(), { note: "Nouvelle note" });
  assert.equal(result.note_private, "Nouvelle note");
});

test("vider une note envoie un espace, pas une chaîne vide", () => {
  // Comportement constaté sur l'instance réelle : un PUT avec une chaîne vide est ignoré par
  // Dolibarr (réponse 200, note inchangée). Sans ce contournement, l'effacement d'une note
  // depuis l'interface échouait en silence.
  const result = applyEventPatch(event(), { note: "" });
  assert.equal(result.note_private, " ");

  // Une note non vide part telle quelle.
  const filled = applyEventPatch(event(), { note: "Contenu réel" });
  assert.equal(filled.note_private, "Contenu réel");
});

test("la réaffectation change userownerid", () => {
  const result = applyEventPatch(event(), { ownerId: "27" });
  assert.equal(result.userownerid, "27");

  const cleared = applyEventPatch(event(), { ownerId: null });
  assert.equal(cleared.userownerid, null);
});

test("la clôture passe percentage à 100 et la réouverture à 0", () => {
  assert.equal(applyEventPatch(event(), { closed: true }).percentage, "100");
  assert.equal(applyEventPatch(event({ percentage: "100" }), { closed: false }).percentage, "0");
});

test("le modèle source n’est jamais muté", () => {
  const source = event();
  const snapshot = JSON.stringify(source);
  applyEventPatch(source, { label: "Autre", ownerId: "99", closed: true });
  assert.equal(JSON.stringify(source), snapshot);
});

test("plusieurs champs peuvent être modifiés en une passe", () => {
  const result = applyEventPatch(event(), {
    startAt: new Date("2026-09-01T07:30:00.000Z"),
    label: "Visite de maintenance",
    location: "5 avenue des Champs, 75008 Paris",
    ownerId: "33",
    closed: true,
  });
  assert.equal(result.label, "Visite de maintenance");
  assert.equal(result.location, "5 avenue des Champs, 75008 Paris");
  assert.equal(result.userownerid, "33");
  assert.equal(result.percentage, "100");
  assert.equal(result.datep, 1_788_247_800);
  // Les champs non touchés restent identiques.
  assert.equal(result.datef, 1_754_413_200);
});
