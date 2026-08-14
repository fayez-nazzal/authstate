import { expect, test } from "bun:test";
import { planLogin } from "@login/login-plan";

test("plans navigation before filling before submitting", () => {
  const entry = { email: "a@example.com", password: "secret", app_url: "https://example.test" };
  const steps = planLogin(entry);
  expect(steps.map((step) => step.kind)).toEqual(["goto", "fill-email", "fill-password", "click-submit"]);
});

test("carries the entry's own email and password into the fill steps", () => {
  const entry = { email: "a@example.com", password: "secret", app_url: "https://example.test" };
  const steps = planLogin(entry);
  const emailStep = steps.find((step) => step.kind === "fill-email") as { value: string };
  const passwordStep = steps.find((step) => step.kind === "fill-password") as { value: string };
  expect(emailStep.value).toBe("a@example.com");
  expect(passwordStep.value).toBe("secret");
});
