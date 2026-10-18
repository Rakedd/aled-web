import type { ActionResult } from "@/domain/action-result";
import type { OpportunityFilters } from "@/domain/opportunity-filters";
import type { OpportunitySource } from "@/domain/opportunities";

export type SaveOpportunityFilters = (
  source: OpportunitySource,
  filters: OpportunityFilters,
) => Promise<ActionResult<OpportunityFilters>>;

export type KeywordListField =
  | "includeKeywords"
  | "alwaysExcludeKeywords"
  | "rescuableExcludeKeywords"
  | "rescueKeywords";

export type RateFloorField =
  "rateFloorFullRemote" | "rateFloorHybrid" | "rateFloorOnsite";

export type RateFloorTexts = Record<RateFloorField, string>;

export type OpportunityFiltersFormControllerParameters = {
  source: OpportunitySource;
  initialFilters: OpportunityFilters;
  saveOpportunityFilters: SaveOpportunityFilters;
  onDataChanged: () => void;
};

export type OpportunityFiltersFormProps = Omit<
  OpportunityFiltersFormControllerParameters,
  "onDataChanged"
> & {
  knownRegions: string[];
};
