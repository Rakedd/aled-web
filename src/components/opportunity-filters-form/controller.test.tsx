import { act, renderHook } from "@testing-library/react";
import type { ActionResult } from "@/domain/action-result";
import {
  EMPTY_OPPORTUNITY_FILTERS,
  type OpportunityFilters,
} from "@/domain/opportunity-filters";
import { useController } from "./controller";

const savedFilters: OpportunityFilters = {
  ...EMPTY_OPPORTUNITY_FILTERS,
  includeKeywords: ["react"],
  rateFloorHybrid: 500,
};

const renderOpportunityFiltersFormController = (
  saveResult: ActionResult<OpportunityFilters> = {
    ok: true,
    data: savedFilters,
  },
) => {
  const saveOpportunityFilters = jest.fn().mockResolvedValue(saveResult);
  const onDataChanged = jest.fn();
  const { result } = renderHook(() =>
    useController({
      source: "free-work",
      initialFilters: EMPTY_OPPORTUNITY_FILTERS,
      saveOpportunityFilters,
      onDataChanged,
    }),
  );
  return { result, saveOpportunityFilters, onDataChanged };
};

describe("opportunity-filters-form useController", () => {
  it("sends the validated filters, then reports success and notifies the page", async () => {
    const { result, saveOpportunityFilters, onDataChanged } =
      renderOpportunityFiltersFormController();
    act(() => result.current.setKeywordList("includeKeywords", ["react"]));
    act(() => result.current.setRateFloorText("rateFloorHybrid", " 500 "));
    await act(() => result.current.submit());
    expect(saveOpportunityFilters).toHaveBeenCalledWith(
      "free-work",
      savedFilters,
    );
    expect(result.current.successMessage).toBe("Filtres enregistrés");
    expect(result.current.errorMessage).toBeNull();
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it("refuses a non numeric rate floor without calling the server", async () => {
    const { result, saveOpportunityFilters, onDataChanged } =
      renderOpportunityFiltersFormController();
    act(() => result.current.setRateFloorText("rateFloorOnsite", "abc"));
    await act(() => result.current.submit());
    expect(saveOpportunityFilters).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe("Montant invalide");
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it("refuses a rate floor above the maximum with the domain message", async () => {
    const { result, saveOpportunityFilters } =
      renderOpportunityFiltersFormController();
    act(() => result.current.setRateFloorText("rateFloorFullRemote", "6000"));
    await act(() => result.current.submit());
    expect(saveOpportunityFilters).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe(
      "Le TJM minimum doit être un entier entre 0 et 5000",
    );
  });

  it("sends null for an empty rate floor", async () => {
    const { result, saveOpportunityFilters } =
      renderOpportunityFiltersFormController();
    await act(() => result.current.submit());
    expect(saveOpportunityFilters).toHaveBeenCalledWith(
      "free-work",
      EMPTY_OPPORTUNITY_FILTERS,
    );
  });

  it("shows the generic error when the action throws", async () => {
    const saveOpportunityFilters = jest
      .fn()
      .mockRejectedValue(new Error("Network down"));
    const onDataChanged = jest.fn();
    const { result } = renderHook(() =>
      useController({
        source: "free-work",
        initialFilters: EMPTY_OPPORTUNITY_FILTERS,
        saveOpportunityFilters,
        onDataChanged,
      }),
    );
    await act(() => result.current.submit());
    expect(result.current.errorMessage).toBe(
      "Une erreur est survenue, réessaie.",
    );
    expect(result.current.isSubmitting).toBe(false);
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it("relays the server error message", async () => {
    const { result, onDataChanged } = renderOpportunityFiltersFormController({
      ok: false,
      errorMessage: "Indisponible",
    });
    await act(() => result.current.submit());
    expect(result.current.errorMessage).toBe("Indisponible");
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  it("is disabled while sending and ignores a second submit", async () => {
    let resolveSave: (
      saveResult: ActionResult<OpportunityFilters>,
    ) => void = () => undefined;
    const saveOpportunityFilters = jest.fn().mockReturnValue(
      new Promise<ActionResult<OpportunityFilters>>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useController({
        source: "free-work",
        initialFilters: EMPTY_OPPORTUNITY_FILTERS,
        saveOpportunityFilters,
        onDataChanged: jest.fn(),
      }),
    );
    let firstSubmission: Promise<void> = Promise.resolve();
    act(() => {
      firstSubmission = result.current.submit();
    });
    expect(result.current.isSubmitting).toBe(true);
    await act(() => result.current.submit());
    expect(saveOpportunityFilters).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSave({ ok: true, data: EMPTY_OPPORTUNITY_FILTERS });
      await firstSubmission;
    });
    expect(result.current.isSubmitting).toBe(false);
  });
});
