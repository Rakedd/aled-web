import { useState } from "react";
import type {
  KeywordDraftKeyboardEvent,
  KeywordTagsInputControllerParameters,
} from "./interfaces";

const KEYWORD_SEPARATOR_KEYS = ["Enter", ","];

export const useController = ({
  values,
  onChange,
}: KeywordTagsInputControllerParameters) => {
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const trimmedDraft = draft.trim();
    if (trimmedDraft.length === 0) {
      setDraft("");
      return;
    }
    const normalizedDraft = trimmedDraft.toLowerCase();
    const isAlreadyPresent = values.some(
      (value) => value.trim().toLowerCase() === normalizedDraft,
    );
    if (!isAlreadyPresent) onChange([...values, trimmedDraft]);
    setDraft("");
  };

  const removeValue = (valueIndex: number) =>
    onChange(
      values.filter((_, currentValueIndex) => currentValueIndex !== valueIndex),
    );

  const handleDraftKeyDown = (keyboardEvent: KeywordDraftKeyboardEvent) => {
    if (KEYWORD_SEPARATOR_KEYS.includes(keyboardEvent.key)) {
      keyboardEvent.preventDefault();
      addDraft();
      return;
    }
    if (
      keyboardEvent.key === "Backspace" &&
      draft.length === 0 &&
      values.length > 0
    ) {
      removeValue(values.length - 1);
    }
  };

  return { draft, setDraft, addDraft, removeValue, handleDraftKeyDown };
};
