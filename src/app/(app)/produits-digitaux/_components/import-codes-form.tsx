"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { FileUp } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { getDigitalProductFamily, type DigitalProductFamilyId } from "@/lib/digital-products/catalog";
import {
  formatLicenceCode,
  isValidLicenceCode,
  normalizeLicenceCode,
  parseLicenceCodeInput,
} from "@/lib/digital-products/licence-code-format";
import { importCodesAction, type ImportCodesActionState } from "../actions";

const MAX_FILE_BYTES = 512 * 1024;

function formatLines(lines: number[]) {
  if (lines.length === 0) return "";
  const shown = lines.slice(0, 12).join(", ");
  return lines.length > 12 ? `${shown}… (+${lines.length - 12})` : shown;
}

export function ImportCodesForm({
  familyId,
  defaultSku,
}: {
  familyId: DigitalProductFamilyId;
  defaultSku: string;
}) {
  const family = getDigitalProductFamily(familyId);
  const format = family.codeFormat;
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [single, setSingle] = useState("");
  const [bulk, setBulk] = useState("");
  const [state, formAction] = useActionState<ImportCodesActionState, FormData>(
    async (previous, formData) => {
      const result = await importCodesAction(previous, formData);
      if (result.status === "success") {
        // Clear plaintext codes from the page as soon as they are stored.
        setSingle("");
        setBulk("");
      }
      return result;
    },
    {},
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const { addToast } = useToast();
  const handled = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!state.submissionId || handled.current === state.submissionId) return;
    handled.current = state.submissionId;
    if (state.status === "success") {
      addToast({ variant: "success", title: state.message ?? "Codes ajoutés." });
    }
  }, [state, addToast]);

  const singleNormalized = normalizeLicenceCode(single);
  const singleValid = isValidLicenceCode(singleNormalized, format);
  const singleRejected = format.rejected.includes(singleNormalized);
  const preview = useMemo(() => {
    if (mode !== "bulk" || !bulk.trim()) return null;
    try {
      return parseLicenceCodeInput(bulk, getDigitalProductFamily(familyId).codeFormat);
    } catch {
      return null;
    }
  }, [bulk, mode, familyId]);

  const onFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError("Fichier trop volumineux (512 Ko maximum).");
      return;
    }
    if (!/\.(txt|csv|tsv)$/i.test(file.name) && !/^text\//.test(file.type)) {
      setFileError("Format accepté : .txt ou .csv (un code par ligne).");
      return;
    }
    const text = await file.text();
    setBulk((current) => (current.trim() ? `${current.trimEnd()}\n${text}` : text));
  };

  const codesValue = mode === "single" ? singleNormalized : bulk;

  return (
    <form action={formAction} className="card space-y-5 p-5" autoComplete="off">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Ajouter des codes</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Les codes sont chiffrés avant stockage. Les doublons (même code déjà en stock) sont ignorés.
        </p>
      </div>

      <input type="hidden" name="family" value={family.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="import-sku" className="label">Variante</label>
          <Select id="import-sku" name="sku" defaultValue={defaultSku} required>
            {family.variants.map((variant) => (
              <option key={variant.sku} value={variant.sku}>
                {variant.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="import-batch" className="label">
            Lot / fournisseur <span className="font-normal text-zinc-400">(facultatif)</span>
          </label>
          <Input id="import-batch" name="batchLabel" maxLength={80} placeholder="Ex. Achat novembre 2026" />
        </div>
      </div>

      <div role="tablist" aria-label="Mode d’ajout" className="inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
        {(
          [
            ["single", "Code unique"],
            ["bulk", "Import en masse"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              mode === value
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <input type="hidden" name="codes" value={codesValue} />

      {mode === "single" ? (
        <div className="space-y-1.5">
          <label htmlFor="single-code" className="label">Code d’activation</label>
          <Input
            id="single-code"
            value={formatLicenceCode(single, format)}
            onChange={(event) => setSingle(normalizeLicenceCode(event.target.value).slice(0, format.length))}
            placeholder={format.placeholder}
            className="font-mono tracking-wider"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="single-code-hint"
            aria-invalid={single.length > 0 && !singleValid}
          />
          <p
            id="single-code-hint"
            className={clsx(
              "text-xs",
              singleValid ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400",
            )}
          >
            {singleValid
              ? `Code complet : ${format.length} caractères valides.`
              : singleRejected
                ? "Clé générique publique Microsoft : elle n’active pas Windows et ne peut pas être vendue."
                : `${format.length} caractères A–Z / 0–9 (${singleNormalized.length}/${format.length}). Les tirets sont ajoutés automatiquement.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="bulk-codes" className="label">Codes (un par ligne)</label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Importer un fichier .txt / .csv
              <input
                type="file"
                accept=".txt,.csv,.tsv,text/plain,text/csv"
                className="sr-only"
                onChange={(event) => {
                  void onFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <Textarea
            id="bulk-codes"
            rows={8}
            value={bulk}
            onChange={(event) => setBulk(event.target.value)}
            className="font-mono text-sm"
            placeholder={`${format.placeholder}\n${format.placeholder}`}
            spellCheck={false}
            autoCorrect="off"
          />
          {fileError ? <p className="text-xs text-red-600 dark:text-red-400">{fileError}</p> : null}
          {preview ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">
              <strong className="text-emerald-600 dark:text-emerald-400">{preview.valid.length}</strong> code(s)
              valide(s)
              {preview.invalidLines.length ? ` · ${preview.invalidLines.length} ligne(s) invalide(s)` : ""}
              {preview.duplicateLines.length ? ` · ${preview.duplicateLines.length} doublon(s) dans la saisie` : ""}
            </p>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              CSV accepté : la première cellule ressemblant à un code est utilisée. 5 000 codes maximum par envoi.
            </p>
          )}
        </div>
      )}

      {state.status === "error" && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}
      {state.summary ? (
        <Alert
          variant={state.summary.imported > 0 ? "success" : "warning"}
          title={`Résultat : ${state.summary.imported} ajouté(s) sur ${state.summary.submitted} ligne(s)`}
        >
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {state.summary.alreadyStored > 0 ? (
              <li>{state.summary.alreadyStored} code(s) déjà présent(s) en stock (ignorés).</li>
            ) : null}
            {state.summary.duplicateLines.length > 0 ? (
              <li>Doublons dans la saisie, lignes : {formatLines(state.summary.duplicateLines)}</li>
            ) : null}
            {state.summary.invalidLines.length > 0 ? (
              <li>Format invalide, lignes : {formatLines(state.summary.invalidLines)}</li>
            ) : null}
          </ul>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <FormSubmitButton
          className="w-full sm:w-auto"
          disabled={mode === "single" ? !singleValid : !preview || preview.valid.length === 0}
          pendingLabel="Chiffrement et ajout…"
        >
          {mode === "single" ? "Ajouter le code" : `Importer ${preview?.valid.length ?? 0} code(s)`}
        </FormSubmitButton>
      </div>
    </form>
  );
}
