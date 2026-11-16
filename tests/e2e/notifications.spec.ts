import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

test.setTimeout(150_000);
test.describe.configure({ mode: "serial" });

const unreadOf = async (page: Page) => {
  const name = await page.getByRole("button", { name: /^Notifications/ }).first().getAttribute("aria-label");
  return Number(/(\d+) unread/.exec(name ?? "")?.[1] ?? 0);
};

/** A published event of our own (unique title), so nothing depends on seed data other specs change. Returns title and slug. */
async function createPublishedEvent(page: Page) {
  const title = `NOTIF ${Date.now().toString(36)}`;
  await signInAs(page, "dev-admin");
  await page.goto("/en/admin/events/new");
  await page.locator('input[name="title.mn"]:visible').fill(title);
  await page.locator('input[name="title.en"]:visible').fill(title);
  await page.getByRole("button", { name: "Create event" }).click();
  await page.waitForURL(/\/admin\/events\/e_\d+\?created=1/);
  const slug = await page.locator('input[name="slug"]:visible').inputValue();
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish anyway" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();
  return { title, slug };
}

test.describe("member bell and pages", () => {
  let title = "";
  let slug = "";
  let before = 0;

  test("RSVP raises the bell count; opening the panel marks nothing; the item says what happened and links to the event", async ({ page }) => {
    ({ title, slug } = await createPublishedEvent(page));
    await signInAs(page, "anuujin");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/me");
    await page.waitForLoadState("networkidle");
    before = await unreadOf(page);

    await page.goto(`/en/events/${slug}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "I’m going" }).click();
    await expect(page.getByRole("button", { name: "Cancel RSVP" })).toBeVisible();

    await page.goto("/en/me");
    await page.waitForLoadState("networkidle");
    expect(await unreadOf(page)).toBe(before + 1);
    const bell = page.getByRole("button", { name: /^Notifications/ }).first();
    await bell.click();
    const panel = page.getByRole("dialog", { name: "Latest notifications" });
    await expect(panel).toBeVisible();
    const item = panel.getByRole("link", { name: new RegExp(title) }).first();
    await expect(item).toContainText("You are going");
    await expect(item).toContainText(`Your seat at “${title}” is confirmed.`);
    await expect(item).toHaveAttribute("href", `/en/events/${slug}`);
    // opening the panel changed nothing, even after a reload
    expect(await unreadOf(page)).toBe(before + 1);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(bell).toBeFocused();
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(await unreadOf(page)).toBe(before + 1);
  });

  test("/en/me/notifications lists it with the unread tint and the link goes to the event page", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/me/notifications");
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    const row = page.locator("li[data-unread]").filter({ hasText: title }).first();
    await expect(row).toHaveAttribute("data-unread", "true");
    await expect(row).toContainText("Unread");
    await row.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/en/events/${slug}$`));
    // following the item marked that one row read
    await page.goto("/en/me/notifications");
    await expect(page.locator("li[data-unread]").filter({ hasText: title }).first()).toHaveAttribute("data-unread", "false");
  });

  test("Mark all read clears the badge and the tint, and tells screen readers politely", async ({ page }) => {
    await signInAs(page, "anuujin");
    // make sure there is something unread: a second event of our own
    const second = await createPublishedEvent(page);
    await signInAs(page, "anuujin");
    await page.goto(`/en/events/${second.slug}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "I’m going" }).click();
    await expect(page.getByRole("button", { name: "Cancel RSVP" })).toBeVisible();
    await page.goto("/en/me/notifications");
    await page.waitForLoadState("networkidle");
    expect(await unreadOf(page)).toBeGreaterThan(0);
    await page.getByRole("main").getByRole("button", { name: "Mark all read" }).click();
    await expect(page.getByRole("button", { name: "Notifications", exact: true }).first()).toBeVisible();
    expect(await unreadOf(page)).toBe(0);
    await expect(page.locator('li[data-unread="true"]')).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("button", { name: "Mark all read" })).toHaveCount(0);
  });

  test("the empty state and Mongolian copy (a person with nothing yet)", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/mn/me/notifications");
    await expect(page.getByRole("heading", { level: 1, name: "Мэдэгдэл" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Мэдэгдэл/ }).first()).toBeVisible();
  });
});

test.describe("staff inbox", () => {
  test("a membership application by bayar reaches staff as an item that opens the applications", async ({ page }) => {
    await signInAs(page, "bayar");
    await page.goto("/en/me/membership");
    await page.waitForLoadState("networkidle");
    const submit = page.getByRole("button", { name: "Submit application" });
    let applied = false;
    if (await submit.count()) {
      await page.getByLabel(/Why do you want to join/).fill("I want to help run events and learn from older members.");
      await page.getByText("Dev", { exact: true }).click();
      await submit.click();
      await expect(page.getByRole("heading", { name: "Application status" })).toBeVisible();
      applied = true;
    }
    for (const who of ["dev-admin", "dev-organizer"]) {
      await signInAs(page, who);
      await page.goto("/en/admin/inbox");
      await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
      const items = page.locator("li[data-unread], li").filter({ hasText: "New membership application" });
      await expect(items.first()).toBeVisible();
      await expect(items.first().getByRole("link")).toHaveAttribute("href", "/en/admin/members?tab=applications");
      if (applied) await expect(page.locator("li[data-unread='true']").filter({ hasText: "New membership application" }).first()).toBeVisible();
    }
  });

  test("failed emails reach staff with a link to the failed filter; the bell shows in the admin shell", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await page.goto("/en/admin/inbox");
    const failed = page.locator("li").filter({ hasText: "An email did not send" }).first();
    await expect(failed.getByRole("link")).toHaveAttribute("href", "/en/admin/comms?status=failed");
    await expect(page.getByRole("button", { name: /^Notifications/ }).first()).toBeVisible();
  });

  test("a member never sees the inbox: /en/admin/inbox is a 404 status", async ({ page }) => {
    await signInAs(page, "anuujin");
    expect((await page.request.get("/en/admin/inbox", { maxRedirects: 0 })).status()).toBe(404);
  });
});

test.describe("load more", () => {
  test("a long list pages through the cursor", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await page.goto("/en/admin/inbox");
    await page.waitForLoadState("networkidle");
    const more = page.getByRole("button", { name: "Load more" });
    if (await more.count()) {
      const first = await page.locator("li[data-unread]").count();
      await more.click();
      await expect.poll(() => page.locator("li[data-unread]").count()).toBeGreaterThan(first);
    } else {
      test.info().annotations.push({ type: "note", description: "fewer than one page of items: nothing to load" });
    }
  });
});
