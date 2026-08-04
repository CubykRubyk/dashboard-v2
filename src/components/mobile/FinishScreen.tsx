"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronLeft, ImagePlus, Loader2, X } from "lucide-react";
import { useMobilePreferences } from "./MobilePreferences";
import type { CatalogCategory } from "@/lib/worksheets/types";
import type { PlanningItem } from "@/components/planification-sav/mock-data";
import styles from "./mobile.module.css";

interface Selection {
  materialId: string;
  selected: boolean;
  variantId: string;
  quantity: number;
  detailValue: number;
}

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

const UNIT_LABEL: Record<string, string> = {
  METER: "m",
  PIECE: "",
  BAG: "sac",
  RADIATOR: "rad",
  NONE: "",
};

export function FinishScreen({ item, catalog }: { item: PlanningItem; catalog: CatalogCategory[] }) {
  const { t } = useMobilePreferences();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [selections, setSelections] = useState<Selection[]>(() =>
    catalog.flatMap((category) =>
      category.materials.map((material) => ({
        materialId: material.id,
        selected: false,
        variantId: "",
        quantity: material.defaultQuantity || 1,
        detailValue: 0,
      })),
    ),
  );
  const [otherMaterials, setOtherMaterials] = useState("");
  const [reportText, setReportText] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  const update = (materialId: string, patch: Partial<Selection>) =>
    setSelections((current) =>
      current.map((selection) => (selection.materialId === materialId ? { ...selection, ...patch } : selection)),
    );

  const selectedCount = selections.filter((selection) => selection.selected).length;

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const added = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos((current) => [...current, ...added].slice(0, 20));
  };

  const removePhoto = (id: string) =>
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });

  const submit = async () => {
    setSaving(true);
    setToast(null);
    try {
      // La fiche passe par la route existante `POST /api/fiches` (même validation, même génération
      // de compte-rendu que le desktop) ; le mobile ne remplit simplement pas les champs
      // fournisseur/installé — valeurs par défaut côté payload.
      const response = await fetch("/api/fiches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate: item.date || "",
          client: item.contact || item.title,
          company: item.company,
          installer: item.team,
          eventId: item.dolibarrEventId || "",
          mainInstallations: "",
          installations: [],
          otherMaterials,
          reportText,
          reportFrozen: false,
          tagIds: [],
          selections: selections.map((selection) => ({
            ...selection,
            supplier: "INTERNAL" as const,
            installed: true,
          })),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.id) throw new Error(result?.error || "failed");

      for (const photo of photos) {
        const form = new FormData();
        form.append("file", photo.file);
        await fetch(`/api/fiches/${result.id}/photos`, { method: "POST", body: form });
      }

      setToast({ text: t("finish.success") });
      router.push(`/mobile/item/${item.id}`);
      router.refresh();
    } catch {
      setToast({ text: t("finish.error"), error: true });
      setSaving(false);
    }
  };

  return (
    <>
      <div className={styles.detailNav}>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => (step === 1 ? router.back() : setStep(1))}
        >
          <ChevronLeft aria-hidden size={19} />
          {step === 1 ? t("finish.cancel") : t("finish.step.materials")}
        </button>
        <span className={styles.topCount}>
          {step === 1 ? `${selectedCount} ${t("finish.selected")}` : `${photos.length} ${t("finish.photoCount")}`}
        </span>
      </div>

      <header className={styles.topBar} style={{ paddingTop: 0 }}>
        <p className={styles.topEyebrow}>{item.title}</p>
        <h1 className={styles.topTitle}>{t("finish.title")}</h1>
      </header>

      <div className={styles.steps} aria-hidden>
        <span className={`${styles.step} ${styles.stepActive}`} />
        <span className={`${styles.step}${step === 2 ? ` ${styles.stepActive}` : ""}`} />
      </div>

      {step === 1 ? (
        <div className={`${styles.scroll} ${styles.pageEnter}`} key="materials">
          <p className={styles.hint}>{t("finish.materialsHint")}</p>
          {catalog.map((category) => (
            <section className={styles.catCard} key={category.id}>
              <h2>{category.name}</h2>
              {category.materials.map((material) => {
                const selection = selections.find((entry) => entry.materialId === material.id)!;
                const isSelect = material.inputType === "SELECT";
                const isQuantity = material.inputType === "QUANTITY";
                const isDetail = material.inputType === "DETAIL";
                return (
                  <div className={styles.matRow} key={material.id}>
                    <button
                      type="button"
                      className={`${styles.matCheck}${selection.selected ? ` ${styles.matCheckOn}` : ""}`}
                      onClick={() => update(material.id, { selected: !selection.selected })}
                      aria-pressed={selection.selected}
                      aria-label={material.name}
                    >
                      <Check aria-hidden size={13} strokeWidth={3} />
                    </button>
                    {isSelect ? (
                      <select
                        className={styles.matSelect}
                        value={selection.variantId}
                        onChange={(event) =>
                          update(material.id, {
                            variantId: event.target.value,
                            selected: Boolean(event.target.value),
                          })
                        }
                      >
                        <option value="">{material.name}</option>
                        {material.variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>{variant.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`${styles.matName}${selection.selected ? "" : ` ${styles.matNameOff}`}`}>
                        {material.name}
                      </span>
                    )}
                    {selection.selected && isQuantity && (
                      <>
                        <input
                          className={styles.matQty}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.1"
                          value={selection.quantity}
                          onChange={(event) => update(material.id, { quantity: Number(event.target.value) })}
                        />
                        <span className={styles.matUnit}>{UNIT_LABEL[material.unit] ?? ""}</span>
                      </>
                    )}
                    {selection.selected && isDetail && (
                      <input
                        className={styles.matQty}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={selection.detailValue || ""}
                        placeholder={material.detailLabel || "—"}
                        onChange={(event) => update(material.id, { detailValue: Number(event.target.value) })}
                      />
                    )}
                  </div>
                );
              })}
            </section>
          ))}

          <label className={styles.textareaField}>
            <small>{t("finish.otherMaterials")}</small>
            <textarea
              rows={2}
              value={otherMaterials}
              placeholder={t("finish.otherMaterialsPlaceholder")}
              onChange={(event) => setOtherMaterials(event.target.value)}
            />
          </label>
          <label className={styles.textareaField}>
            <small>{t("finish.reportText")}</small>
            <textarea
              rows={3}
              value={reportText}
              placeholder={t("finish.reportPlaceholder")}
              onChange={(event) => setReportText(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <div className={`${styles.scroll} ${styles.pageEnter}`} key="photos">
          <p className={styles.hint}>{t("finish.photosHint")}</p>
          <div className={styles.photoGrid}>
            {photos.map((photo, index) => (
              <div
                className={styles.photoTile}
                key={photo.id}
                style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
              >
                {/* Aperçu local (blob:) avant envoi — pas d'optimisation Next possible ici. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt="" />
                <button
                  type="button"
                  className={styles.photoRemove}
                  onClick={() => removePhoto(photo.id)}
                  aria-label="×"
                >
                  <X aria-hidden size={13} />
                </button>
              </div>
            ))}
            <button type="button" className={styles.photoAdd} onClick={() => fileInputRef.current?.click()}>
              <ImagePlus aria-hidden size={20} />
              {t("finish.addPhoto")}
            </button>
          </div>
          <input
            ref={fileInputRef}
            className={styles.hiddenInput}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              addPhotos(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      )}

      <div className={styles.footerBar}>
        {step === 1 ? (
          <button type="button" className={styles.primaryButton} onClick={() => setStep(2)}>
            <Camera aria-hidden size={17} />
            {t("finish.next")}
          </button>
        ) : (
          <button type="button" className={styles.primaryButton} disabled={saving} onClick={submit}>
            {saving ? <Loader2 aria-hidden size={17} className={styles.spin} /> : <Check aria-hidden size={17} />}
            {saving ? t("finish.saving") : t("finish.submit")}
          </button>
        )}
      </div>

      {toast && (
        <div className={`${styles.toast}${toast.error ? ` ${styles.toastError}` : ""}`} role="status">
          {toast.text}
        </div>
      )}
    </>
  );
}
