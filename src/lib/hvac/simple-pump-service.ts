import { EquipmentType } from "@/generated/prisma/enums";

import { normalizeEquipmentReference } from "@/lib/hvac/normalization";
import type { SimplePumpInput } from "@/lib/hvac/simple-pump-validation";

export interface PlannedEquipment {
  type: EquipmentType;
  name: string;
  manufacturerReference: string;
  normalizedReference: string;
  /**
   * `true` quand la référence n'a pas été saisie et a été déduite du nom de la pompe — le
   * catalogue signale déjà ces fiches comme « à vérifier » (`referenceNeedsReview`), on réutilise
   * ce mécanisme au lieu d'en inventer un.
   */
  referenceNeedsReview: boolean;
}

/**
 * Traduit une saisie rapide en fiches `Equipment` à créer.
 *
 * Règles (validées avec Ion) :
 * - une fiche par référence réellement saisie (intérieure → `INDOOR_UNIT`, extérieure →
 *   `OUTDOOR_UNIT`) ;
 * - aucune référence saisie → une seule fiche portant le nom de la pompe, dont le type découle
 *   de la configuration déclarée ;
 * - en `MONOBLOC`, une référence unique décrit la pompe entière : la fiche est de type
 *   `MONOBLOC`, pas `INDOOR_UNIT`/`OUTDOOR_UNIT` ;
 * - **aucune `SystemCombination` n'est créée ici** : c'est précisément la complexité que ce
 *   formulaire supprime. Elle reste possible depuis la section « Avancé ».
 */
export function planPumpEquipment(input: SimplePumpInput): PlannedEquipment[] {
  const indoor = input.indoorReference.trim();
  const outdoor = input.outdoorReference.trim();

  const plan = (
    type: EquipmentType,
    reference: string,
    nameSuffix = "",
  ): PlannedEquipment => {
    const provided = reference.length > 0;
    const effectiveReference = provided ? reference : input.name;
    return {
      type,
      name: nameSuffix ? `${input.name} ${nameSuffix}` : input.name,
      manufacturerReference: effectiveReference,
      normalizedReference: normalizeEquipmentReference(effectiveReference),
      referenceNeedsReview: !provided,
    };
  };

  // Monobloc : la pompe est d'un seul tenant. On prend la première référence renseignée, sans
  // jamais produire deux fiches — deux références sur un monobloc n'aurait pas de sens physique.
  if (input.configuration === "MONOBLOC") {
    return [plan(EquipmentType.MONOBLOC, indoor || outdoor)];
  }

  const planned: PlannedEquipment[] = [];
  if (indoor) planned.push(plan(EquipmentType.INDOOR_UNIT, indoor, "— unité intérieure"));
  if (outdoor) planned.push(plan(EquipmentType.OUTDOOR_UNIT, outdoor, "— unité extérieure"));
  if (planned.length > 0) return planned;

  // Ni l'une ni l'autre : une fiche unique représente la pompe telle qu'on la connaît
  // aujourd'hui. `SPLIT` sans référence reste indéterminé au niveau de la fiche physique, d'où
  // `OTHER` — les références pourront être ajoutées plus tard sans rien casser.
  return [plan(EquipmentType.OTHER, "")];
}

/** Champs techniques communs, appliqués à chaque fiche produite par `planPumpEquipment`. */
export function sharedPumpEquipmentData(input: SimplePumpInput) {
  return {
    manufacturerId: input.manufacturerId,
    nominalPowerKw: input.nominalPowerKw,
    installationNotes: input.installationNotes,
    internalNotes: input.internalNotes,
  };
}
