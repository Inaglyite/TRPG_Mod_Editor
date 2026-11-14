import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { EditorProject } from "../src/domain/types";
import { authoringFixture } from "./fixtures";
import { spatialFixture } from "./spatial-fixture";

async function start(page: Page, project = spatialFixture()) {
  await page.addInitScript((value) => {
    localStorage.setItem("trpg-mod-editor:draft:v2", JSON.stringify(value));
    localStorage.removeItem("trpg-mod-editor:active-session:v1");
  }, project);
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/") || url.hostname !== "127.0.0.1") {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Spatial local acceptance: service offline"}',
      });
    }
    return route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "创作总览", exact: true })).toBeVisible();
}

async function navigateSpatial(page: Page) {
  const nav = page.getByRole("navigation", { name: "模组内容导航" });
  if (!(await nav.isVisible())) {
    await page.getByRole("button", { name: "切换内容导航", exact: true }).click();
  }
  await nav.getByRole("button", { name: "空间调查", exact: true }).click();
  await expect(page.getByRole("heading", { name: "空间调查", exact: true })).toBeVisible();
}

async function draft(page: Page): Promise<EditorProject> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("trpg-mod-editor:draft:v2")!));
}

async function exportProject(page: Page): Promise<EditorProject> {
  await page.locator(".file-menu summary").click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出工程 JSON", exact: true }).click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as EditorProject;
}

async function capture(page: Page, name: string) {
  if (!process.env.EDITOR_ARTIFACT_DIR) return;
  await mkdir(process.env.EDITOR_ARTIFACT_DIR, { recursive: true, mode: 0o700 });
  await page.screenshot({ path: path.join(process.env.EDITOR_ARTIFACT_DIR, `${name}.png`) });
}

test("authors can edit the example, separate information from objects, and reopen all Spatial fields", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await navigateSpatial(page);
  await page.locator(".spatial-scene-tree").getByRole("button", { name: /卧室 bedroom/ }).click();
  await page.getByLabel("场景名称", { exact: true }).fill("卧室（修订）");
  await page.getByLabel("场景名称", { exact: true }).press("Tab");
  await expect.poll(async () => (await draft(page)).module.scenes.bedroom.name).toBe("卧室（修订）");

  await page.getByRole("tab", { name: "通路", exact: true }).click();
  const passage = page.locator(".form-section").filter({
    has: page.getByRole("heading", { name: "满足条件才能通过", exact: true }),
  });
  await passage.getByLabel("至少为", { exact: true }).fill("0");
  await expect.poll(async () => {
    const condition = (await draft(page)).module.spatial!.connections.secret_door.requires;
    return condition.op === "all" ? condition.conditions[1] : null;
  }).toMatchObject({ op: "item", item_id: "charged_key", minimum_states: { charge: 0 } });

  await page.getByRole("tab", { name: "调查点与动作", exact: true }).click();
  await page.getByRole("region", { name: "调查点" }).getByRole("button", { name: /门边衣柜 cabinet/ }).click();
  await expect(page.getByLabel("动作意图", { exact: true })).toHaveValue("take");
  expect((await draft(page)).module.spatial!.points.cabinet.actions.take.success).toEqual([
    { kind: "give_item", item_id: "charged_key", quantity: 1 },
  ]);

  const exported = await exportProject(page);
  expect(exported.module.scenes.bedroom.name).toBe("卧室（修订）");
  expect(exported.module.spatial!.connections.secret_door.remember_unlock).toBe(true);
  expect(exported.module.spatial!.points.fireplace.actions.search.failure).toContainEqual({
    kind: "advance_clock", clock_id: "pressure", amount: 1,
  });
  expect(exported.manifest.capabilities).toContain("spatial_investigation");
  expect(exported.manifest.min_engine_version).toBe("1.1.0");
  expect(exported.skills).toBeUndefined();

  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({
    name: "spatial-roundtrip.trpgmod-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByRole("heading", { name: "创作总览", exact: true })).toBeVisible();
  await expect.poll(async () => (await draft(page)).module.scenes.bedroom.name).toBe("卧室（修订）");
  expect((await draft(page)).module.spatial).toEqual(exported.module.spatial);
  const reopened = await exportProject(page);
  expect(reopened.module.spatial).toEqual(exported.module.spatial);
  expect(errors).toEqual([]);
});

test("legacy projects remain flat and opt into Spatial with the required capability", async ({ page }) => {
  await start(page, authoringFixture());
  await navigateSpatial(page);
  await expect(page.getByRole("button", { name: "启用空间调查", exact: true })).toBeVisible();
  expect((await draft(page)).module.spatial).toBeUndefined();
  await page.getByRole("button", { name: "启用空间调查", exact: true }).click();
  await expect(page.getByRole("tab", { name: "场景树", exact: true })).toBeVisible();
  await expect.poll(async () => (await draft(page)).module.spatial?.version).toBe(1);
  const saved = await draft(page);
  expect(saved.manifest.capabilities).toContain("spatial_investigation");
  expect(saved.manifest.min_engine_version).toBe("1.1.0");
  expect(saved.manifest.capabilities).not.toContain("custom_skills");
});

for (const width of [390, 768, 1280]) {
  test(`Spatial forms stay usable at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await start(page);
    await navigateSpatial(page);
    for (const tab of ["场景树", "通路", "调查点与动作", "物品与状态"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      const workspaceOverflow = await page.locator(".editor-workspace").evaluate((element) =>
        element.scrollWidth > element.clientWidth + 1,
      );
      expect(workspaceOverflow).toBe(false);
      const clippedButtons = await page.locator(".spatial-tab-panel button").evaluateAll((buttons) =>
        buttons.filter((button) => button.getClientRects().length > 0).filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width < 28 || rect.height < 28 || rect.left < 0 || rect.right > innerWidth + 1;
        }).map((button) => button.getAttribute("aria-label") || button.textContent),
      );
      expect(clippedButtons).toEqual([]);
      await capture(page, `spatial-${tab}-${width}`);
    }
    expect(errors).toEqual([]);
  });
}
