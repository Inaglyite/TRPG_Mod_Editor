import { expect, test } from "@playwright/test";

const current = { version: "0.3.0" };
const update = {
  version: "0.3.1",
  sha256: "a".repeat(64),
  notes: "新增主动检查更新\n改进模组创作体验",
  size: 1024 * 1024,
};

test("declining an update never downloads it; manual check can offer it again", async ({
  page,
}) => {
  let installs = 0;
  await page.route("**/api/**", (route) => {
    if (route.request().url().includes("/updates/install")) {
      installs++;
      return route.fulfill({ json: { ok: true } });
    }
    if (route.request().url().includes("/updates/check"))
      return route.fulfill({
        json: { ok: true, enabled: true, current, update },
      });
    return route.fulfill({
      status: 503,
      json: { error: "offline authoring fixture" },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toContainText("新增主动检查更新");
  await page.getByRole("button", { name: "暂不更新" }).click();
  expect(installs).toBe(0);
  await page.locator(".file-menu summary").click();
  await page.getByRole("button", { name: "检查编辑器更新" }).click();
  await expect(page.getByRole("dialog")).toContainText("新版 v0.3.1");
  await page.getByRole("button", { name: "更新编辑器", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "下次打开模组工坊时启用",
  );
  expect(installs).toBe(1);
});

test("automatic network failures stay quiet; manual checks explain failures and latest state", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/**", (route) => {
    if (route.request().url().includes("/updates/check"))
      return fail
        ? route.fulfill({
            status: 503,
            json: { ok: false, error: "网络不可用，当前版本仍可使用" },
          })
        : route.fulfill({
            json: { ok: true, enabled: true, current, update: null },
          });
    return route.fulfill({ status: 503, json: { error: "offline" } });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "创作总览", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".file-menu summary").click();
  await page.getByRole("button", { name: "检查编辑器更新" }).click();
  await expect(page.getByRole("dialog")).toContainText("网络不可用");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  fail = false;
  await page.locator(".file-menu summary").click();
  await page.getByRole("button", { name: "检查编辑器更新" }).click();
  await expect(page.getByRole("dialog")).toContainText("已是最新兼容版本");
});

test("long update notes and buttons fit 1280, 939 and 640 pixel windows", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.request().url().includes("/updates/check")
      ? route.fulfill({
          json: {
            ok: true,
            enabled: true,
            current,
            update: { ...update, notes: "更新说明。".repeat(800) },
          },
        })
      : route.fulfill({ status: 503, json: { error: "offline" } }),
  );
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const width of [1280, 939, 640]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await dialog.evaluate((element) => {
      const buttons = [...element.querySelectorAll("footer button")].map(
        (button) => {
          const style = getComputedStyle(button);
          return {
            height: button.getBoundingClientRect().height,
            padding: parseFloat(style.paddingLeft),
            whiteSpace: style.whiteSpace,
          };
        },
      );
      return {
        width: element.getBoundingClientRect().width,
        scroll: element.scrollWidth,
        client: element.clientWidth,
        buttons,
      };
    });
    expect(dimensions.width).toBeLessThan(width);
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
    for (const button of dimensions.buttons) {
      expect(button.height).toBeGreaterThanOrEqual(38);
      expect(button.padding).toBeGreaterThanOrEqual(16);
      expect(button.whiteSpace).toBe("nowrap");
    }
    if (process.env.EDITOR_ARTIFACT_DIR)
      await page.screenshot({
        path: `${process.env.EDITOR_ARTIFACT_DIR}/update-dialog-${width}.png`,
      });
  }
});
