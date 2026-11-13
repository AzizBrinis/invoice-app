"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { documentDecimalNumber } from "@/lib/document-precision";

// Text input accepts both French commas and decimal points in every browser.
// Keep the raw text while editing (including a trailing separator).
export function DocumentDecimalInput(props: ComponentProps<typeof Input>) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const value = documentDecimalNumber(String(props.value ?? ""));
    const empty = props.value === "" || props.value == null;
    const valid = (empty && !props.required) || (Number.isFinite(value) && value >= 0 &&
      (props.max == null || value <= Number(props.max)));
    input.setCustomValidity(valid ? "" : "Saisissez un nombre positif avec au maximum 3 décimales.");
  }, [props.value, props.required, props.max]);
  return <Input {...props} ref={ref} type="text" inputMode="decimal" step="0.001"
    pattern="(?:[0-9]+(?:[.,][0-9]{0,3})?|[.,][0-9]{1,3})" />;
}
