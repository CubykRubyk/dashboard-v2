import assert from "node:assert/strict";
import test from "node:test";

import {
  companyAddressLabel,
  isTrue,
  normalizeColor,
  parseDolibarrCompany,
  parseDolibarrUser,
  userDisplayName,
} from "../../src/lib/dolibarr/directory-parse";

/**
 * Réponse réelle de `GET /users` sur l'instance d'Ion, réduite aux champs lus. Conservée telle
 * quelle : c'est la seule source de vérité dont on dispose sur le format (aucun appel à l'API
 * n'est fait, ni ici ni ailleurs).
 */
const REAL_USER = {
  id: "1",
  statut: "1",
  employee: "1",
  email: "interface.esd@gmail.com",
  job: "President",
  login: "Interface ESD",
  admin: "1",
  color: "cccccc",
  lastname: "Gabriel S.",
  firstname: "",
  note_private: "",
};

/** Réponse réelle de `GET /thirdparties`, même provenance. */
const REAL_COMPANY = {
  entity: "1",
  name: "Groupe France Ecoplanete",
  name_alias: null,
  address: "20 bis rue Louis Philippe",
  zip: "92200",
  town: "Neuilly sur Seine",
  status: "1",
  email: "contact@groupefranceecoplanete.com",
  client: "1",
  prospect: 0,
  fournisseur: "0",
  code_client: "ECOPLANETE",
  id: "1",
  statut: null,
  country: "France",
};

test("isTrue accepte les chaînes et les nombres dans la même réponse", () => {
  // Le cœur du problème : `client: "1"` est une chaîne, `prospect: 0` un nombre.
  assert.equal(isTrue(REAL_COMPANY.client), true);
  assert.equal(isTrue(REAL_COMPANY.prospect), false);
  assert.equal(isTrue(REAL_COMPANY.fournisseur), false);

  assert.equal(isTrue(1), true);
  assert.equal(isTrue("1"), true);
  assert.equal(isTrue(0), false);
  assert.equal(isTrue("0"), false);
  assert.equal(isTrue(""), false);
  assert.equal(isTrue(null), false);
  assert.equal(isTrue(undefined), false);
  assert.equal(isTrue(true), true);
  assert.equal(isTrue("false"), false);
});

test("le nom se construit malgré un firstname vide", () => {
  // Cas réel : `firstname` vide, `lastname` porte le nom entier.
  assert.equal(userDisplayName(REAL_USER), "Gabriel S.");
});

test("le nom retombe sur le login puis l’e-mail", () => {
  assert.equal(
    userDisplayName({ firstname: "", lastname: "", login: "jdupont", id: "7" }),
    "jdupont",
  );
  assert.equal(
    userDisplayName({ firstname: "", lastname: "", login: "", email: "a@b.fr", id: "7" }),
    "a@b.fr",
  );
  // Dernier recours : jamais de ligne sans libellé, elle serait impossible à choisir.
  assert.equal(userDisplayName({ id: "7" }), "Utilisateur 7");
});

test("les deux prénoms/noms renseignés sont concaténés", () => {
  assert.equal(userDisplayName({ firstname: "Jean", lastname: "Dupont", id: "2" }), "Jean Dupont");
});

test("la couleur reçoit le # manquant", () => {
  assert.equal(normalizeColor(REAL_USER.color), "#cccccc");
  assert.equal(normalizeColor("#ff8110"), "#ff8110");
  assert.equal(normalizeColor(""), "");
  assert.equal(normalizeColor(null), "");
  // Une valeur qui n'est pas une couleur ne doit pas produire un « # » seul.
  assert.equal(normalizeColor("bleu"), "");
});

test("l’utilisateur réel est lu correctement", () => {
  const parsed = parseDolibarrUser(REAL_USER);
  assert.ok(parsed);
  assert.equal(parsed.dolibarrId, "1");
  assert.equal(parsed.name, "Gabriel S.");
  assert.equal(parsed.login, "Interface ESD");
  assert.equal(parsed.job, "President");
  assert.equal(parsed.color, "#cccccc");
  assert.equal(parsed.isEmployee, true);
  assert.equal(parsed.active, true);
});

test("un utilisateur sans id est ignoré", () => {
  assert.equal(parseDolibarrUser({ lastname: "Sans Id" }), null);
});

test("un utilisateur désactivé est lu comme inactif", () => {
  const parsed = parseDolibarrUser({ ...REAL_USER, statut: "0" });
  assert.equal(parsed?.active, false);
});

test("la société réelle est lue correctement", () => {
  const parsed = parseDolibarrCompany(REAL_COMPANY);
  assert.ok(parsed);
  assert.equal(parsed.dolibarrId, "1");
  assert.equal(parsed.name, "Groupe France Ecoplanete");
  assert.equal(parsed.zip, "92200");
  assert.equal(parsed.town, "Neuilly sur Seine");
  assert.equal(parsed.clientCode, "ECOPLANETE");
  assert.equal(parsed.active, true);
});

test("`status` prime sur `statut` pour une société", () => {
  // Sur la réponse réelle, `statut` vaut null alors que la société est bien active : s'y fier
  // désactiverait tout le répertoire dès l'import.
  assert.equal(REAL_COMPANY.statut, null);
  assert.equal(parseDolibarrCompany(REAL_COMPANY)?.active, true);

  const disabled = parseDolibarrCompany({ ...REAL_COMPANY, status: "0" });
  assert.equal(disabled?.active, false);
});

test("un fournisseur pur est écarté", () => {
  const supplier = parseDolibarrCompany({
    ...REAL_COMPANY,
    client: "0",
    fournisseur: "1",
  });
  assert.equal(supplier, null);
});

test("un prospect qui est aussi client est conservé", () => {
  const prospect = parseDolibarrCompany({ ...REAL_COMPANY, prospect: 1 });
  assert.ok(prospect);
});

test("une société sans nom ou sans id est ignorée", () => {
  assert.equal(parseDolibarrCompany({ ...REAL_COMPANY, name: "" }), null);
  assert.equal(parseDolibarrCompany({ ...REAL_COMPANY, id: "" }), null);
});

test("l’adresse d’affichage compose rue, code postal et ville", () => {
  const parsed = parseDolibarrCompany(REAL_COMPANY)!;
  assert.equal(
    companyAddressLabel(parsed),
    "20 bis rue Louis Philippe, 92200 Neuilly sur Seine",
  );
  // Sans adresse, pas de virgule orpheline.
  assert.equal(companyAddressLabel({ address: "", zip: "75002", town: "Paris" }), "75002 Paris");
  assert.equal(companyAddressLabel({ address: "", zip: "", town: "" }), "");
});
