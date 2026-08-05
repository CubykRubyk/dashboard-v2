"use client";

import { useState } from "react";

export interface DolibarrUserChoice {
  dolibarrId: string;
  name: string;
  job: string;
}

/**
 * Choix de l'identifiant Dolibarr d'un compte, dans les paramètres utilisateurs.
 *
 * Remplace la saisie manuelle du `userownerid`. **Repli sur la saisie libre** tant que le
 * répertoire n'a pas été importé : sinon, un CRM fraîchement déployé n'offrirait aucun moyen de
 * renseigner ce champ, sans que rien ne l'explique.
 */
export function DolibarrUserPicker({
  name,
  defaultValue,
  choices,
}: {
  name: string;
  defaultValue: string;
  choices: DolibarrUserChoice[];
}) {
  const [value, setValue] = useState(defaultValue);

  if (choices.length === 0) {
    return (
      <>
        <input
          name={name}
          inputMode="numeric"
          pattern="\d*"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ex. 12"
        />
        <small>
          Répertoire Dolibarr non importé — saisissez l’identifiant à la main, ou lancez l’import
          depuis Paramètres → Dolibarr pour choisir dans une liste.
        </small>
      </>
    );
  }

  // La valeur actuelle peut pointer vers un utilisateur absent du répertoire (compte désactivé
  // depuis, import pas encore relancé) : on garde une entrée pour ne pas l'effacer en silence.
  const known = choices.some((choice) => choice.dolibarrId === value);

  return (
    <>
      <select name={name} value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="">Aucun rattachement</option>
        {!known && value && <option value={value}>Identifiant {value} (hors répertoire)</option>}
        {choices.map((choice) => (
          <option key={choice.dolibarrId} value={choice.dolibarrId}>
            {choice.name}{choice.job ? ` — ${choice.job}` : ""}
          </option>
        ))}
      </select>
      <small>
        Utilisateur Dolibarr correspondant. Sans lui, un technicien ne voit aucune de ses
        interventions sur le mobile.
      </small>
    </>
  );
}
