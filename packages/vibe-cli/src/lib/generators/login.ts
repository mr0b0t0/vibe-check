export function emitLoginHelper() {
  return `
import { Page, APIRequestContext, test as base } from '@playwright/test';
export const test = base.extend<{ loginAs: (role?: string) => Promise<void> }>({
  loginAs: async ({ page }, use) => {
    await use(async (role?: string) => {
      // demo: noop (your app may set cookie or perform POST)
    });
  },
});
export const expect = test.expect;
`;
}
