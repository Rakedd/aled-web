export type KeywordTagsInputProps = {
  label: string;
  helpText: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
};

export type KeywordTagsInputControllerParameters = Pick<
  KeywordTagsInputProps,
  "values" | "onChange"
>;

export type KeywordDraftKeyboardEvent = {
  key: string;
  preventDefault: () => void;
};
