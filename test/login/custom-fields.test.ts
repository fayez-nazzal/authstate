import { expect, test } from "bun:test";
import { planLogin } from "@login/login-plan";

const entryWithoutFields = {
  email: "a@example.com",
  password: "secret",
  app_url: "https://example.test",
};

test("an entry with no fields block plans steps with no selector overrides", () => {
  const steps = planLogin(entryWithoutFields);
  const email = steps.find((step) => step.kind === "fill-email") as { selector?: string };
  const password = steps.find((step) => step.kind === "fill-password") as { selector?: string };
  const submit = steps.find((step) => step.kind === "click-submit") as { selector?: string };
  expect(email.selector).toBeUndefined();
  expect(password.selector).toBeUndefined();
  expect(submit.selector).toBeUndefined();
});

test("a fields block carries each selector into its step", () => {
  const entry = {
    ...entryWithoutFields,
    fields: {
      email: "input[name='username']",
      password: "textarea[name='claims']",
      submit: "button[type='submit']",
    },
  };
  const steps = planLogin(entry);
  const email = steps.find((step) => step.kind === "fill-email") as { selector?: string };
  const password = steps.find((step) => step.kind === "fill-password") as { selector?: string };
  const submit = steps.find((step) => step.kind === "click-submit") as { selector?: string };
  expect(email.selector).toBe("input[name='username']");
  expect(password.selector).toBe("textarea[name='claims']");
  expect(submit.selector).toBe("button[type='submit']");
});

test("a partial fields block only overrides the key it names", () => {
  const entry = { ...entryWithoutFields, fields: { password: "textarea[name='claims']" } };
  const steps = planLogin(entry);
  const email = steps.find((step) => step.kind === "fill-email") as { selector?: string };
  const password = steps.find((step) => step.kind === "fill-password") as { selector?: string };
  expect(email.selector).toBeUndefined();
  expect(password.selector).toBe("textarea[name='claims']");
});
