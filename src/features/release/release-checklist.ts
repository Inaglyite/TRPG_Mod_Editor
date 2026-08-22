import type { Diagnostic, EditorProject } from "../../domain/types";

export interface ChecklistItem {
  label: string;
  status: "pass" | "warn" | "fail";
  note: string;
}

const ENGINE_VERSION_BASELINE = "1.0.0";

const SEMVER_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

function compareSemver(left: string, right: string): number {
  const parse = (value: string): number[] => value.split(".").map((part) => Number(part) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

export function buildChecklist(project: EditorProject, diagnostics: Diagnostic[]): ChecklistItem[] {
  const { manifest } = project;
  const errors = diagnostics.filter((item) => item.level === "error");
  const assetErrors = errors.filter((item) => item.path.startsWith("module.assets") || item.path.endsWith(".asset_id"));
  const licenseOk = manifest.license.trim().length > 0;
  const authorOk = manifest.author.trim().length > 0;
  const homepageOk = manifest.homepage.trim().length > 0;
  const semverOk = SEMVER_PATTERN.test(manifest.version);
  const engineOk = semverOk && compareSemver(manifest.min_engine_version, ENGINE_VERSION_BASELINE) <= 0;

  return [
    {
      label: "结构与引用零错误",
      status: errors.length === 0 ? "pass" : "fail",
      note: errors.length === 0 ? "诊断面板没有 error" : `仍有 ${errors.length} 项 error，见工程检查器`,
    },
    {
      label: "内容许可证已声明",
      status: licenseOk ? "pass" : "warn",
      note: licenseOk ? manifest.license : "缺少许可证不得被误标为可自由复用",
    },
    {
      label: "作者信息已填写",
      status: authorOk ? "pass" : "warn",
      note: authorOk ? manifest.author : "建议填写作者或团队名称",
    },
    {
      label: "主页或来源页已填写",
      status: homepageOk ? "pass" : "warn",
      note: homepageOk ? manifest.homepage : "方便玩家溯源与反馈",
    },
    {
      label: "版本号符合 SemVer",
      status: semverOk ? "pass" : "fail",
      note: semverOk ? manifest.version : "版本号必须是 x.y.z 形式",
    },
    {
      label: "最低引擎版本不高于目标引擎",
      status: engineOk ? "pass" : "warn",
      note: engineOk
        ? `${manifest.min_engine_version} ≤ ${ENGINE_VERSION_BASELINE}`
        : `${manifest.min_engine_version} 高于当前引擎 ${ENGINE_VERSION_BASELINE}，导入会被拒绝`,
    },
    {
      label: "素材映射引用有效",
      status: assetErrors.length === 0 ? "pass" : "fail",
      note: assetErrors.length === 0 ? "素材 ID 引用均已在 assets 映射中" : `${assetErrors.length} 项素材引用错误`,
    },
    {
      label: "capabilities 与包内容一致",
      status: "warn",
      note: `已声明：${manifest.capabilities.join("、") || "无"}。打包前确认 skills/characters/scenes 目录与声明一致（发布前人工确认）`,
    },
    {
      label: "素材文件与映射一致",
      status: "warn",
      note: "打包时 TRPG Master 会核对 assets/ 目录与素材映射；发布前人工确认文件齐备",
    },
  ];
}
