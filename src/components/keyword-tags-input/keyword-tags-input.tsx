"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useController } from "./controller";
import type { KeywordTagsInputProps } from "./interfaces";

export const KeywordTagsInput = ({
  label,
  helpText,
  values,
  onChange,
  suggestions = [],
}: KeywordTagsInputProps) => {
  const { draft, setDraft, addDraft, removeValue, handleDraftKeyDown } =
    useController({ values, onChange });
  const inputId = useId();
  const helpTextId = useId();
  const suggestionsListId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <p id={helpTextId} className="text-xs text-muted-foreground">
        {helpText}
      </p>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((value, valueIndex) => (
            <li
              key={`${value}-${valueIndex}`}
              className="flex items-center gap-1 rounded-full border border-input py-1 pr-1 pl-3 text-sm"
            >
              <span>{value}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Retirer ${value}`}
                onClick={() => removeValue(valueIndex)}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={inputId}
          className="flex-1"
          value={draft}
          list={suggestions.length > 0 ? suggestionsListId : undefined}
          aria-describedby={helpTextId}
          onChange={(changeEvent) => setDraft(changeEvent.target.value)}
          onKeyDown={handleDraftKeyDown}
        />
        <Button type="button" variant="outline" onClick={addDraft}>
          Ajouter
        </Button>
      </div>
      {suggestions.length > 0 && (
        <datalist id={suggestionsListId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </div>
  );
};
