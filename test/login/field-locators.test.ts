import { expect, test } from "bun:test";
import { emailSelectors, passwordSelectors, submitSelectors } from "@login/field-locators";

test("email selectors cover username and user named inputs", () => {
  const selectors = emailSelectors(undefined);
  expect(selectors.some((selector) => selector.includes("username"))).toBe(true);
  expect(selectors.some((selector) => selector.includes("user"))).toBe(true);
});

test("password selectors put the password input first and the bare textarea last", () => {
  const selectors = passwordSelectors(undefined);
  expect(selectors[0]).toBe("input[type='password']:visible");
  expect(selectors[selectors.length - 1]).toBe("textarea:visible");
});

test("email selectors put the typed email input before the generic text input", () => {
  const selectors = emailSelectors(undefined);
  const typed = selectors.indexOf("input[type='email']:visible");
  const generic = selectors.indexOf("input[type='text']:visible");
  expect(typed).toBeLessThan(generic);
});

test("a custom selector replaces the built in list", () => {
  expect(emailSelectors("input[name='u']")).toEqual(["input[name='u']"]);
  expect(passwordSelectors("textarea[name='claims']")).toEqual(["textarea[name='claims']"]);
  expect(submitSelectors("button.go")).toEqual(["button.go"]);
});
