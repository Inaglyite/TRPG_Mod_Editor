import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Lightbulb,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { authoringSteps } from "../domain/authoring";
import type {
  Diagnostic,
  EditorProject,
  EntitySelection,
} from "../domain/types";

interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
  project: EditorProject;
  selection: EntitySelection;
  onSelect: (selection: EntitySelection) => void;
  onClose: () => void;
}
const levelMeta = {
  error: { label: "错误", icon: CircleX },
  warning: { label: "提醒", icon: TriangleAlert },
  advice: { label: "建议", icon: Lightbulb },
} as const;
const guidance: Partial<
  Record<EntitySelection["kind"], { title: string; text: string }>
> = {
  scene: {
    title: "让场景可被探索",
    text: "先写调查员能感知的内容，再连接出口与在场人物。不同入口可以共享同一场景，不必复制内容。",
  },
  npc: {
    title: "公开信息与秘密分开写",
    text: "公开标签描述第一印象。秘密、作者备注与揭示条目仅供守秘人使用，可在阅读预览中核对。",
  },
  clue: {
    title: "发现失败，也能继续故事",
    text: "设置发现动作与目标。主线线索若依赖检定成功，请安排失败时仍可得到线索或转向替代线索。",
  },
  ending: {
    title: "为选择留下回声",
    text: "触发条件描述何时收束故事；旗标条件引用世界设置里已声明的旗标。",
  },
  source: {
    title: "为复杂创意留出空间",
    text: "可直接编辑规则与 extensions。JSON 结构错误不会应用，成功修改可整体撤销。",
  },
  graph: {
    title: "沿着箭头检查路线",
    text: "场景箭头代表可通行的方向，线索箭头代表推理关系。金色标记是故事入口，红色标记提示不可达。",
  },
  content: {
    title: "搭好故事的幕后",
    text: "设置初始调查员、旗标和时钟，整理素材引用。高级 JSON 保留完整扩展能力。",
  },
};
export function DiagnosticsPanel({
  diagnostics,
  project,
  selection,
  onSelect,
  onClose,
}: DiagnosticsPanelProps) {
  const [filter, setFilter] = useState<"all" | "error" | "warning">("all");
  const errors = diagnostics.filter((item) => item.level === "error").length;
  const warnings = diagnostics.filter(
    (item) => item.level === "warning",
  ).length;
  const tip = guidance[selection.kind] ?? {
    title: "让故事更完整",
    text: "从简介与开场开始，再铺设场景、人物、线索和结局。所有步骤都可以自由跳转。",
  };
  const next = authoringSteps(project).find((step) => !step.done);
  const filtered = diagnostics.filter(
    (item) => filter === "all" || item.level === filter,
  );
  return (
    <aside className="diagnostics-panel" aria-label="创作助手">
      <div className="panel-title-row">
        <div>
          <Sparkles size={19} />
          <strong>创作助手</strong>
        </div>
        <button
          className="quiet-button"
          aria-label="关闭创作助手"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      <div className="assistant-scroll">
        <section className="assistant-tip">
          <Lightbulb size={19} />
          <div>
            <h3>{tip.title}</h3>
            <p>{tip.text}</p>
          </div>
        </section>
        {next && (
          <button
            className="next-step"
            onClick={() =>
              onSelect(
                next.selection.id ||
                  !["clue", "ending"].includes(next.selection.kind)
                  ? next.selection
                  : { kind: "overview" },
              )
            }
          >
            <span>下一步建议</span>
            <strong>{next.title}</strong>
            <ArrowRight size={15} />
          </button>
        )}
        <div className={`health-summary${errors ? " has-errors" : ""}`}>
          {errors ? <CircleX size={21} /> : <CircleCheck size={21} />}
          <div>
            <strong>
              {errors ? `${errors} 项问题需要处理` : "结构检查通过"}
            </strong>
            <p>
              {errors
                ? "点击下面的问题定位到对应内容。"
                : "继续丰富故事，或打开发布检查单。"}
            </p>
          </div>
        </div>
        <div className="section-heading inspector-heading">
          <h3>工程检查</h3>
          <span className="small-muted">{diagnostics.length} 项</span>
        </div>
        <div className="diagnostic-filters">
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            全部
          </button>
          <button
            aria-pressed={filter === "error"}
            onClick={() => setFilter("error")}
          >
            错误 {errors}
          </button>
          <button
            aria-pressed={filter === "warning"}
            onClick={() => setFilter("warning")}
          >
            提醒 {warnings}
          </button>
        </div>
        <div className="diagnostic-list">
          {filtered.length === 0 && (
            <div className="diagnostic-empty">
              <CircleCheck size={24} />
              <strong>
                {diagnostics.length ? "这个分类暂无问题" : "结构与引用均有效"}
              </strong>
            </div>
          )}
          {filtered.map((diagnostic) => {
            const meta = levelMeta[diagnostic.level];
            const Icon = meta.icon;
            return (
              <button
                className={`diagnostic-item ${diagnostic.level}`}
                key={diagnostic.id}
                onClick={() =>
                  onSelect(diagnostic.selection ?? { kind: "content" })
                }
              >
                <Icon size={15} />
                <span>
                  <strong>{meta.label}</strong>
                  <span>{diagnostic.message}</span>
                  <code>{diagnostic.path}</code>
                </span>
              </button>
            );
          })}
        </div>
        <div className="assistant-shortcuts">
          <span>常用快捷键</span>
          <div>
            保存工程 <kbd>Ctrl / ⌘ S</kbd>
          </div>
          <div>
            撤销修改 <kbd>Ctrl / ⌘ Z</kbd>
          </div>
          <div>
            搜索内容 <kbd>Ctrl / ⌘ K</kbd>
          </div>
        </div>
      </div>
    </aside>
  );
}
