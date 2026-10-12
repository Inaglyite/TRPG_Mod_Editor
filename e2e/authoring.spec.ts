import { expect, test, type Page } from "@playwright/test";
import { authoringFixture } from "./fixtures";
import type { EditorProject } from "../src/domain/types";
import { mkdir } from "node:fs/promises";
import path from "node:path";

async function capture(page: Page, name: string) {
  if (!process.env.EDITOR_ARTIFACT_DIR) return;
  await mkdir(process.env.EDITOR_ARTIFACT_DIR, {
    recursive: true,
    mode: 0o700,
  });
  await page.screenshot({
    path: path.join(process.env.EDITOR_ARTIFACT_DIR, `${name}.png`),
  });
}

async function start(page: Page, project = authoringFixture()) {
  await page.addInitScript(
    (project) =>
      localStorage.setItem("trpg-mod-editor:draft:v2", JSON.stringify(project)),
    project,
  );
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/") || url.hostname !== "127.0.0.1")
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Local acceptance: service offline"}',
      });
    return route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "创作总览", exact: true }),
  ).toBeVisible();
}
async function draft(page: Page): Promise<EditorProject> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("trpg-mod-editor:draft:v2")!),
  );
}
async function navigate(page: Page, name: string) {
  const nav = page.getByRole("navigation", { name: "模组内容导航" });
  if (!(await nav.isVisible()))
    await page
      .getByRole("button", { name: "切换内容导航", exact: true })
      .click();
  await nav.getByRole("button", { name, exact: true }).click();
}

test("overview uses real content and guides authors directly into editing", async ({
  page,
}) => {
  await start(page);
  await expect(
    page.locator(".overview-metrics .metric-scene strong"),
  ).toHaveText("3");
  await expect(page.locator(".overview-metrics .metric-npc strong")).toHaveText(
    "2",
  );
  await expect(page.locator(".route-summary")).toContainText("3 / 3");
  await page
    .getByRole("button", { name: /写下故事的起点/ })
    .first()
    .click();
  await expect(page.getByLabel("模组名称", { exact: true })).toBeVisible();
  await page.getByLabel("模组名称", { exact: true }).fill("新版低语档案馆");
  await page.keyboard.press("Control+s");
  await expect
    .poll(async () => (await draft(page)).manifest.title)
    .toBe("新版低语档案馆");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).manifest.title)
    .toBe("低语档案馆");
});

test("search, collapsing and duplicate/rename keep entities navigable", async ({
  page,
}) => {
  await start(page);
  await page.getByLabel("搜索实体", { exact: true }).fill("reading_room");
  const tree = page.getByRole("complementary", { name: "模组实体" });
  await expect(
    tree.getByRole("button", { name: /阅览室 reading_room/ }),
  ).toBeVisible();
  await expect(
    tree.getByRole("button", { name: /档案馆门厅 opening_scene/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "清空搜索", exact: true }).click();
  await tree.getByRole("button", { name: /阅览室 reading_room/ }).click();
  await tree.getByRole("button", { name: "复制实体", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "阅览室（副本）", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("reading_copy"));
  await tree.getByRole("button", { name: "重命名 ID", exact: true }).click();
  await expect
    .poll(async () => Object.keys((await draft(page)).module.scenes))
    .toContain("reading_copy");
});

test("relationship connections edit directed exits and undo as one action", async ({
  page,
}) => {
  await start(page);
  await navigate(page, "故事关系图");
  await page
    .getByLabel("连接起点", { exact: true })
    .selectOption("opening_scene");
  await page.getByLabel("连接终点", { exact: true }).selectOption("basement");
  await page.getByRole("button", { name: "保存连接", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).module.scenes.opening_scene.exits)
    .toContain("basement");
  await expect
    .poll(async () => (await draft(page)).module.scenes.basement.exits)
    .toContain("opening_scene");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).module.scenes.opening_scene.exits)
    .not.toContain("basement");
  await page.getByRole("button", { name: "线索推理", exact: true }).click();
  await page.getByLabel("连接起点", { exact: true }).selectOption("known");
  await page.getByLabel("连接终点", { exact: true }).selectOption("card");
  await page
    .getByLabel("推理说明", { exact: true })
    .fill("委托信提到了借阅记录");
  await page.getByRole("button", { name: "保存连接", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).module.clue_links)
    .toEqual([
      { from: "known", to: "card", reasoning: "委托信提到了借阅记录" },
    ]);
});

test("player preview hides secrets and unknown clues; keeper view reveals author context", async ({
  page,
}) => {
  await start(page);
  await navigate(page, "阅读与预览");
  const visible = page.getByRole("article", { name: "玩家预览内容" });
  await expect(visible).toContainText("委托信：整理尘封档案");
  await expect(visible).not.toContainText("泛黄的借阅卡");
  await expect(visible).not.toContainText("SECRET_SENTINEL");
  await page.getByRole("button", { name: "守秘人视角", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "守秘人预览内容" }),
  ).toContainText("NPC_SECRET_SENTINEL");
  await page.getByRole("button", { name: "玩家视角", exact: true }).click();
  await expect(visible).not.toContainText("SECRET_SENTINEL");
});

test("discovery rules, mainline flag, item and fallback remain after navigation", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("complementary", { name: "模组实体" })
    .getByRole("button", { name: /泛黄的借阅卡 card/ })
    .click();
  await page.getByRole("button", { name: "添加发现规则", exact: true }).click();
  await page.getByLabel("检定方式", { exact: true }).selectOption("skill");
  await page.getByLabel("只有检定成功才发现", { exact: true }).check();
  await page
    .getByLabel("失败替代路径", { exact: true })
    .selectOption("grant_clue");
  await page.getByLabel("这是推进故事必需的主线线索", { exact: true }).check();
  await page
    .getByLabel("发现后获得的物品", { exact: true })
    .fill("地下库房钥匙");
  await navigate(page, "创作总览");
  await expect
    .poll(async () => (await draft(page)).module.clues.card.granted_item)
    .toBe("地下库房钥匙");
  const saved = await draft(page);
  expect(saved.module.clues.card.discovery_rules[0].fallback?.mode).toBe(
    "grant_clue",
  );
  expect(saved.module.progression?.essential_clue_ids).toEqual(["card"]);
});

test("world drafts survive navigation and apply declared flags and asset maps", async ({
  page,
}) => {
  await start(page);
  await navigate(page, "世界与素材");
  await page
    .getByLabel("Markdown 源文档", { exact: true })
    .fill("# 新的幕后真相\n\n守秘人秘密");
  await navigate(page, "创作总览");
  await navigate(page, "世界与素材");
  await expect(page.getByLabel("Markdown 源文档", { exact: true })).toHaveValue(
    "# 新的幕后真相\n\n守秘人秘密",
  );
  await page.getByRole("button", { name: "调查员与世界", exact: true }).click();
  await page.getByLabel("旗标名", { exact: true }).fill("truth_found");
  await page.getByRole("button", { name: "添加旗标", exact: true }).click();
  await page.getByRole("button", { name: "素材映射", exact: true }).click();
  await page.getByLabel("新的素材 ID", { exact: true }).fill("library_cover");
  await page.getByRole("button", { name: "添加素材映射", exact: true }).click();
  await page
    .getByLabel("包内文件路径", { exact: true })
    .fill("assets/library.webp");
  await page
    .getByRole("button", { name: "应用世界与素材", exact: true })
    .click();
  await expect
    .poll(
      async () => (await draft(page)).module.initial_state.flags.truth_found,
    )
    .toBe(false);
  expect(
    (await draft(page)).module.assets.scenes.library_cover.reveal_on,
  ).toEqual([]);
  expect((await draft(page)).keeperDocument).toContain("新的幕后真相");
});

test("source drafts persist, reject invalid JSON and can be undone without losing extensions", async ({
  page,
}) => {
  await start(page);
  await navigate(page, "完整源码");
  const editor = page.getByLabel("工程 JSON 源码", { exact: true });
  const next = JSON.parse(await editor.inputValue()) as EditorProject;
  next.manifest.title = "源码中的新标题";
  next.module.extensions = { freedom: { custom: [1, 2, 3] } };
  await editor.fill(JSON.stringify(next, null, 2));
  await navigate(page, "创作总览");
  await navigate(page, "完整源码");
  await expect(editor).toHaveValue(JSON.stringify(next, null, 2));
  await page.getByRole("button", { name: "应用到工程", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).manifest.title)
    .toBe("源码中的新标题");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).manifest.title)
    .toBe("低语档案馆");
  await editor.fill('{"broken":');
  await page.getByRole("button", { name: "应用到工程", exact: true }).click();
  await expect(page.locator(".content-save-error")).toBeVisible();
  expect((await draft(page)).manifest.title).toBe("低语档案馆");
});

test("source conflict keeps its draft and does not overwrite changes made in another editor", async ({
  page,
}) => {
  await start(page);
  await navigate(page, "完整源码");
  const editor = page.getByLabel("工程 JSON 源码", { exact: true });
  const next = JSON.parse(await editor.inputValue()) as EditorProject;
  next.manifest.description = "未应用的源码草稿";
  await editor.fill(JSON.stringify(next));
  await navigate(page, "模组设置");
  await page.getByLabel("模组名称", { exact: true }).fill("另一个页面的修改");
  await navigate(page, "完整源码");
  await page.getByRole("button", { name: "应用到工程", exact: true }).click();
  await expect(page.locator(".content-save-error")).toContainText(
    "工程已在其他位置修改",
  );
  await expect(editor).toHaveValue(JSON.stringify(next));
  await expect
    .poll(async () => (await draft(page)).manifest.title)
    .toBe("另一个页面的修改");
});

for (const width of [360, 390, 768, 1280, 1600]) {
  test(`all navigation and header actions remain accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await start(page);
    await capture(page, `overview-${width}`);
    const overflow = await page.locator(".top-bar").evaluate((bar) =>
      [...bar.querySelectorAll<HTMLElement>("button,summary")]
        .filter(
          (element) =>
            element.getClientRects().length > 0 &&
            !(
              element.closest(".file-menu-items") &&
              element.closest("details:not([open])")
            ),
        )
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.left < 0 || box.right > innerWidth + 1 || box.height < 24;
        })
        .map(
          (element) =>
            element.getAttribute("aria-label") || element.textContent,
        ),
    );
    expect(overflow).toEqual([]);
    await navigate(page, "模组设置");
    await expect(page.getByLabel("模组名称", { exact: true })).toBeVisible();
    if (
      await page
        .getByRole("complementary", { name: "创作助手", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "关闭创作助手", exact: true })
        .click();
    await page
      .getByRole("button", { name: "切换创作助手", exact: true })
      .click();
    await page
      .getByRole("button", { name: "关闭创作助手", exact: true })
      .click();
    await page.locator(".file-menu summary").click();
    await page.getByRole("button", { name: "发布检查单", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "发布检查单", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("JSON export/import roundtrip preserves author data and new-project guidance works offline", async ({
  page,
}) => {
  await start(page);
  await page.locator(".file-menu summary").click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出工程 JSON", exact: true })
    .click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(
    Buffer.concat(chunks).toString("utf8"),
  ) as EditorProject;
  expect(exported.module.npcs.archivist.extensions).toEqual({
    author_note: "preserved",
  });
  exported.manifest.title = "重新导入的档案馆";
  await page
    .locator('input[type=file][accept=".json,application/json"]')
    .setInputFiles({
      name: "roundtrip.trpgmod-project.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
  await expect(
    page.getByRole("heading", { name: "创作总览", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await draft(page)).manifest.title)
    .toBe("重新导入的档案馆");
  await page.locator(".file-menu summary").click();
  await page.getByRole("button", { name: "新建工程", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "新建模组工程",
    exact: true,
  });
  await dialog.getByLabel("模组名称", { exact: true }).fill("自己的新故事");
  await dialog.getByLabel("包 ID", { exact: true }).fill("local.my_new_story");
  await dialog
    .getByRole("button", { name: "创建模组，开始写作", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () => (await draft(page)).manifest.title)
    .toBe("自己的新故事");
  expect((await draft(page)).theme.title).toBe("自己的新故事");
  await expect(
    page.getByRole("button", { name: /铺设线索与发现方式/ }).first(),
  ).toBeVisible();
});

test("encounters and ending flags can be edited without losing NPC metadata", async ({
  page,
}) => {
  await start(page);
  const tree = page.getByRole("complementary", { name: "模组实体" });
  await tree.getByRole("button", { name: /阅览室 reading_room/ }).click();
  await page.getByRole("button", { name: "添加遭遇", exact: true }).click();
  await page.getByLabel("遭遇人物", { exact: true }).selectOption("visitor");
  await page
    .getByLabel("出现方式", { exact: true })
    .selectOption("conditional");
  await page
    .getByRole("combobox", { name: "添加旗标条件", exact: true })
    .selectOption("archive_unlocked");
  await page.getByRole("button", { name: "添加旗标条件", exact: true }).click();
  await page
    .getByLabel("archive_unlocked 的旗标条件值", { exact: true })
    .fill("true");
  await tree.getByRole("button", { name: /被掩埋的真相 truth/ }).click();
  await page
    .getByRole("combobox", { name: "添加旗标条件", exact: true })
    .selectOption("archive_unlocked");
  await page.getByRole("button", { name: "添加旗标条件", exact: true }).click();
  await page
    .getByLabel("archive_unlocked 的旗标条件值", { exact: true })
    .fill("true");
  await navigate(page, "创作总览");
  await expect
    .poll(
      async () =>
        (await draft(page)).module.endings.truth.required_flags
          .archive_unlocked,
    )
    .toBe(true);
  const saved = await draft(page);
  expect(saved.module.scenes.reading_room.encounters[0]).toMatchObject({
    npc_id: "visitor",
    availability: "conditional",
    required_flags: { archive_unlocked: true },
  });
  expect(saved.module.npcs.visitor.extensions).toEqual({
    author_note: "preserved",
  });
});

test("graph, world and preview render without client errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1050 });
  await start(page);
  await capture(page, "overview-desktop");
  await navigate(page, "故事关系图");
  await capture(page, "story-graph");
  const handle = page
    .locator(".graph-node")
    .first()
    .locator(".graph-drag-handle");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 65, box.y + 70);
  await page.mouse.up();
  await expect(page.locator(".graph-node").first()).toHaveCSS("left", "67px");
  await navigate(page, "世界与素材");
  await page.getByRole("button", { name: "调查员与世界", exact: true }).click();
  await capture(page, "world-settings");
  await navigate(page, "阅读与预览");
  await capture(page, "player-preview");
  expect(errors).toEqual([]);
});
