import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";

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
  observe: (assertion: SignInAssertion, timeoutMs: number) => Promise<Observation>;
  capture: (jarPath: string) => Promise<void>;
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

  const observe = async (assertion: SignInAssertion, timeoutMs: number): Promise<Observation> => {
    let observation: Observation;
    if (!page) {
      observation = { kind: "browser-unavailable", detail: "session not open" };
    } else {
      observation = await observeAssertion(page, assertion, timeoutMs);
    }
    return observation;
  };

  const capture = async (jarPath: string) => {
    if (!context) {
      throw new Error("browser session not open");
    }
    const temp = `${jarPath}.tmp-${process.pid}`;
    await context.storageState({ path: temp });
    const { renameSync } = await import("node:fs");
    renameSync(temp, jarPath);
  };

  const close = async () => {
    if (browser) {
      await browser.close();
    }
  };

  const channel = () => browserChannel;

  return { open, run, observe, capture, close, channel };
};
