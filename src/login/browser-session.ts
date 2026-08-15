import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import type { LoginStep } from "@login/login-plan";
import { emailSelectors, passwordSelectors, submitSelectors } from "@login/field-locators";

export type Observation =
  | { kind: "observed"; urlMatched: boolean; selectorMatched: boolean | null }
  | { kind: "timed-out"; waitedMs: number }
  | { kind: "navigation-failed"; detail: string }
  | { kind: "browser-unavailable"; detail: string };

export type SignInAssertion = {
  urlMatches?: string;
  selector?: string;
};

export type BrowserSession = {
  open: (jarPath?: string) => Promise<void>;
  run: (step: (page: Page) => Promise<void>) => Promise<void>;
  executeLogin: (steps: LoginStep[], timeoutMs: number) => Promise<void>;
  observe: (assertion: SignInAssertion, timeoutMs: number) => Promise<Observation>;
  captureStorageState: () => Promise<string>;
  close: () => Promise<void>;
  channel: () => string;
};

const observeAssertion = async (
  page: Page,
  assertion: SignInAssertion,
  timeoutMs: number,
): Promise<Observation> => {
  let observation: Observation;
  try {
    if (assertion.urlMatches) {
      await page.waitForURL(assertion.urlMatches, { timeout: timeoutMs });
    }
    let selectorMatched: boolean | null = null;
    if (assertion.selector) {
      await page.locator(assertion.selector).first().waitFor({ state: "visible", timeout: timeoutMs });
      selectorMatched = true;
    }
    const urlMatched = assertion.urlMatches ? true : false;
    observation = { kind: "observed", urlMatched, selectorMatched };
  } catch (error) {
    const message = String(error);
    if (message.includes("Timeout")) {
      observation = { kind: "timed-out", waitedMs: timeoutMs };
    } else {
      observation = { kind: "navigation-failed", detail: message };
    }
  }
  return observation;
};

const firstMatch = async (page: Page, selectors: string[]) => {
  let found = null;
  for (const selector of selectors) {
    if (found === null) {
      const candidate = page.locator(selector).first();
      const matches = await candidate.count();
      if (matches > 0) {
        found = candidate;
      }
    }
  }
  return found;
};

const resolveField = async (page: Page, selectors: string[]) => {
  const matched = await firstMatch(page, selectors);
  let field = matched;
  if (field === null) {
    field = page.locator(selectors[0] as string).first();
  }
  return field;
};

const runLoginStep = async (page: Page, step: LoginStep, timeoutMs: number): Promise<void> => {
  if (step.kind === "goto") {
    await page.goto(step.url, { waitUntil: "load", timeout: timeoutMs });
  } else if (step.kind === "fill-email") {
    let emailField = null;
    if (step.selector == null) {
      const byRole = page.getByRole("textbox", { name: /email|username|user/i }).first();
      const roleMatches = await byRole.count();
      if (roleMatches > 0) {
        emailField = byRole;
      }
    }
    if (emailField === null) {
      emailField = await resolveField(page, emailSelectors(step.selector));
    }
    await emailField.waitFor({ state: "visible", timeout: timeoutMs });
    await emailField.fill(step.value);
  } else if (step.kind === "fill-password") {
    const passwordField = await resolveField(page, passwordSelectors(step.selector));
    await passwordField.waitFor({ state: "visible", timeout: timeoutMs });
    await passwordField.fill(step.value);
  } else if (step.kind === "click-submit") {
    let submit = null;
    if (step.selector == null) {
      const byRole = page.getByRole("button", { name: /sign in|log in|login|sign-in/i }).first();
      const roleMatches = await byRole.count();
      if (roleMatches > 0) {
        submit = byRole;
      }
    }
    if (submit === null) {
      submit = await resolveField(page, submitSelectors(step.selector));
    }
    await submit.click();
  }
};

export const createPlaywrightBrowserSession = (headed: boolean): BrowserSession => {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let browserChannel = "chrome";

  const open = async (jarPath?: string) => {
    try {
      browser = await chromium.launch({ channel: "chrome", headless: !headed });
      browserChannel = "chrome";
    } catch {
      browser = await chromium.launch({ headless: !headed });
      browserChannel = "chromium";
    }
    const options = jarPath ? { storageState: jarPath } : {};
    context = await browser.newContext(options);
    page = await context.newPage();
  };

  const run = async (step: (targetPage: Page) => Promise<void>) => {
    if (!page) {
      throw new Error("browser session not open");
    }
    await step(page);
  };

  const executeLogin = async (steps: LoginStep[], timeoutMs: number): Promise<void> => {
    if (!page) {
      throw new Error("browser session not open");
    }
    for (const step of steps) {
      await runLoginStep(page, step, timeoutMs);
    }
  };

  const observe = async (assertion: SignInAssertion, timeoutMs: number): Promise<Observation> => {
    let observation: Observation;
    if (!page) {
      observation = { kind: "browser-unavailable", detail: "session not open" };
    } else {
      observation = await observeAssertion(page, assertion, timeoutMs);
    }
    return observation;
  };

  const captureStorageState = async (): Promise<string> => {
    if (!context) {
      throw new Error("browser session not open");
    }
    const state = await context.storageState();
    return JSON.stringify(state);
  };

  const close = async () => {
    if (browser) {
      await browser.close();
    }
  };

  const channel = () => browserChannel;

  return { open, run, executeLogin, observe, captureStorageState, close, channel };
};
