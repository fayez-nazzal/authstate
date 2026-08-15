export type FieldSelectors = {
  email?: string;
  password?: string;
  submit?: string;
};

export const FIELD_KEYS = ["email", "password", "submit"] as const;

const EMAIL_SELECTORS = [
  "input[type='email']:visible",
  "input[name*='email' i]:visible",
  "input[id*='email' i]:visible",
  "input[name*='username' i]:visible",
  "input[id*='username' i]:visible",
  "input[name*='user' i]:visible",
  "input[type='text']:visible",
];

const PASSWORD_SELECTORS = [
  "input[type='password']:visible",
  "textarea[name*='password' i]:visible",
  "textarea[name*='claim' i]:visible",
  "textarea[name*='token' i]:visible",
  "textarea:visible",
];

const SUBMIT_SELECTORS = ["button[type='submit']:visible", "input[type='submit']:visible"];

const withOverride = (builtIn: string[], custom: string | undefined): string[] => {
  let result = builtIn;
  if (custom != null && custom !== "") {
    result = [custom];
  }
  return result;
};

export const emailSelectors = (custom: string | undefined): string[] => {
  return withOverride(EMAIL_SELECTORS, custom);
};

export const passwordSelectors = (custom: string | undefined): string[] => {
  return withOverride(PASSWORD_SELECTORS, custom);
};

export const submitSelectors = (custom: string | undefined): string[] => {
  return withOverride(SUBMIT_SELECTORS, custom);
};
