import type { Locator, Page } from "@playwright/test";

/** Open a themed `Select` (combobox) and click an option by its text, or by position (0 = first). */
export async function chooseOption(page: Page, combo: Locator, option: string | RegExp | { index: number }) {
  await combo.click();
  const list = page.getByRole("listbox");
  const opt = typeof option === "object" && !(option instanceof RegExp) ? list.getByRole("option").nth(option.index) : list.getByRole("option", { name: option });
  await opt.click();
}

/**
 * Set a `DateTimeField` by its label: opens the calendar, types the day into its `YYYY-MM-DD` box, then types the time.
 * `value` is UB wall-clock "YYYY-MM-DDTHH:mm" (the same string the old datetime-local input took).
 */
export async function setDateTime(page: Page, scope: Page | Locator, label: string, value: string) {
  const [date, time] = value.split("T");
  const trigger = scope.getByRole("button", { name: new RegExp(`^${label}`) });
  await trigger.click();
  const box = page.getByLabel(/Date \(YYYY-MM-DD\)/);
  await box.fill(date);
  await box.press("Enter");
  const field = scope.getByRole("textbox", { name: new RegExp(`^${label}.*Time`) });
  await field.fill(time);
  await field.blur();
}
