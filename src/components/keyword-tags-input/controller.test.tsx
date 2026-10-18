import { act, renderHook } from "@testing-library/react";
import { useController } from "./controller";

const renderKeywordTagsInputController = (values: string[] = []) => {
  const onChange = jest.fn();
  const { result } = renderHook(() => useController({ values, onChange }));
  return { result, onChange };
};

const pressKey = (key: string) => ({ key, preventDefault: jest.fn() });

describe("keyword-tags-input useController", () => {
  it.each(["Enter", ","])(
    "adds the trimmed draft when %p is pressed and clears it",
    (key) => {
      const { result, onChange } = renderKeywordTagsInputController(["react"]);
      const keyboardEvent = pressKey(key);
      act(() => result.current.setDraft("  vue "));
      act(() => result.current.handleDraftKeyDown(keyboardEvent));
      expect(keyboardEvent.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(["react", "vue"]);
      expect(result.current.draft).toBe("");
    },
  );

  it("ignores a blank draft", () => {
    const { result, onChange } = renderKeywordTagsInputController();
    act(() => result.current.setDraft("   "));
    act(() => result.current.handleDraftKeyDown(pressKey("Enter")));
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.draft).toBe("");
  });

  it("does not add a duplicate, whatever the case", () => {
    const { result, onChange } = renderKeywordTagsInputController(["React"]);
    act(() => result.current.setDraft("react"));
    act(() => result.current.handleDraftKeyDown(pressKey("Enter")));
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.draft).toBe("");
  });

  it("removes the last keyword on Backspace when the draft is empty", () => {
    const { result, onChange } = renderKeywordTagsInputController([
      "react",
      "vue",
    ]);
    act(() => result.current.handleDraftKeyDown(pressKey("Backspace")));
    expect(onChange).toHaveBeenCalledWith(["react"]);
  });

  it("keeps the keywords on Backspace when the draft is not empty", () => {
    const { result, onChange } = renderKeywordTagsInputController(["react"]);
    act(() => result.current.setDraft("vu"));
    act(() => result.current.handleDraftKeyDown(pressKey("Backspace")));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a keyword by index", () => {
    const { result, onChange } = renderKeywordTagsInputController([
      "react",
      "vue",
    ]);
    act(() => result.current.removeValue(0));
    expect(onChange).toHaveBeenCalledWith(["vue"]);
  });
});
