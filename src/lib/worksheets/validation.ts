type FinalizableWorkSheet = {
  workDate: Date | null;
  client: string;
  company: string;
  installer: string;
  eventId: string | null;
  mainInstallations: string;
  otherMaterials: string;
  reportText: string;
  tags: unknown[];
  items: unknown[];
  installations: unknown[];
};

export function finalizationErrors(workSheet: FinalizableWorkSheet) {
  const errors: string[] = [];
  if (!workSheet.workDate) errors.push("La date du chantier est obligatoire.");
  if (!workSheet.client.trim()) errors.push("Le client est obligatoire.");
  if (!workSheet.company.trim()) errors.push("La société est obligatoire.");
  if (!workSheet.installer.trim()) errors.push("L’installateur est obligatoire.");
  if (!workSheet.eventId?.trim()) errors.push("L’ID de l’événement Dolibarr est obligatoire.");
  if (workSheet.tags.length === 0) errors.push("Sélectionnez au moins un tag.");
  if (!workSheet.reportText.trim()) errors.push("Le rapport ne peut pas être vide.");
  if (
    workSheet.items.length === 0 &&
    workSheet.installations.length === 0 &&
    !workSheet.mainInstallations.trim() &&
    !workSheet.otherMaterials.trim()
  ) {
    errors.push("Indiquez au moins une installation ou un matériel utilisé.");
  }
  return errors;
}
