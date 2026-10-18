import { useRef, useState } from "react";
import { GENERIC_ACTION_ERROR_MESSAGE } from "@/domain/action-result";
import {
  type OpportunityFilters,
  validateOpportunityFilters,
} from "@/domain/opportunity-filters";
import type {
  KeywordListField,
  OpportunityFiltersFormControllerParameters,
  RateFloorField,
  RateFloorTexts,
} from "./interfaces";

export const INVALID_AMOUNT_MESSAGE = "Montant invalide";
export const OPPORTUNITY_FILTERS_SAVED_MESSAGE = "Filtres enregistrés";

const WHOLE_NUMBER_PATTERN = /^\d+$/;

const toRateFloorTexts = (filters: OpportunityFilters): RateFloorTexts => ({
  rateFloorFullRemote:
    filters.rateFloorFullRemote === null
      ? ""
      : String(filters.rateFloorFullRemote),
  rateFloorHybrid:
    filters.rateFloorHybrid === null ? "" : String(filters.rateFloorHybrid),
  rateFloorOnsite:
    filters.rateFloorOnsite === null ? "" : String(filters.rateFloorOnsite),
});

const parseRateFloorText = (
  rateFloorText: string,
): number | null | undefined => {
  const trimmedText = rateFloorText.trim();
  if (trimmedText === "") return null;
  return WHOLE_NUMBER_PATTERN.test(trimmedText)
    ? Number(trimmedText)
    : undefined;
};

export const useController = ({
  source,
  initialFilters,
  saveOpportunityFilters,
  onDataChanged,
}: OpportunityFiltersFormControllerParameters) => {
  const [filters, setFilters] = useState<OpportunityFilters>(initialFilters);
  const [rateFloorTexts, setRateFloorTexts] = useState<RateFloorTexts>(() =>
    toRateFloorTexts(initialFilters),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isRequestInFlightRef = useRef(false);

  const setKeywordList = (
    keywordListField: KeywordListField,
    keywords: string[],
  ) =>
    setFilters((currentFilters) => ({
      ...currentFilters,
      [keywordListField]: keywords,
    }));

  const setRegions = (regions: string[]) =>
    setFilters((currentFilters) => ({ ...currentFilters, regions }));

  const setRateFloorText = (
    rateFloorField: RateFloorField,
    rateFloorText: string,
  ) =>
    setRateFloorTexts((currentTexts) => ({
      ...currentTexts,
      [rateFloorField]: rateFloorText,
    }));

  const submit = async () => {
    if (isRequestInFlightRef.current) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    const rateFloorFullRemote = parseRateFloorText(
      rateFloorTexts.rateFloorFullRemote,
    );
    const rateFloorHybrid = parseRateFloorText(rateFloorTexts.rateFloorHybrid);
    const rateFloorOnsite = parseRateFloorText(rateFloorTexts.rateFloorOnsite);
    if (
      rateFloorFullRemote === undefined ||
      rateFloorHybrid === undefined ||
      rateFloorOnsite === undefined
    ) {
      setErrorMessage(INVALID_AMOUNT_MESSAGE);
      return;
    }
    const validationResult = validateOpportunityFilters({
      ...filters,
      rateFloorFullRemote,
      rateFloorHybrid,
      rateFloorOnsite,
    });
    if (!validationResult.ok) {
      setErrorMessage(validationResult.errorMessage);
      return;
    }
    isRequestInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const saveResult = await saveOpportunityFilters(
        source,
        validationResult.data,
      );
      if (!saveResult.ok) {
        setErrorMessage(saveResult.errorMessage);
        return;
      }
      setFilters(saveResult.data);
      setRateFloorTexts(toRateFloorTexts(saveResult.data));
      setSuccessMessage(OPPORTUNITY_FILTERS_SAVED_MESSAGE);
      onDataChanged();
    } catch {
      setErrorMessage(GENERIC_ACTION_ERROR_MESSAGE);
    } finally {
      isRequestInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    filters,
    setKeywordList,
    setRegions,
    rateFloorTexts,
    setRateFloorText,
    isSubmitting,
    errorMessage,
    successMessage,
    submit,
  };
};
