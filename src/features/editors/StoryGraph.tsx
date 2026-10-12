import {
  ArrowRight,
  Link2,
  Network,
  Plus,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useState } from "react";
import { storyGraph } from "../../domain/authoring";
import { useEditorStore } from "../../store/editor-store";
import { EditorHeading } from "../../components/EditorHeading";

export function StoryGraph({ active = true }: { active?: boolean }) {
  const project = useEditorStore((state) => state.project);
  const select = useEditorStore((state) => state.select);
  const setSceneLink = useEditorStore((state) => state.setSceneLink);
  const setClueLink = useEditorStore((state) => state.setClueLink);
  const add = useEditorStore((state) => state.addEntity);
  const [mode, setMode] = useState<"scene" | "clue">("scene");
  const [scale, setScale] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [both, setBoth] = useState(true);
  const [message, setMessage] = useState("");
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  if (!active) return null;
  const graph = storyGraph(project, mode);
  const nodes = graph.nodes.map((node) => ({
    ...node,
    ...positions[`${mode}:${node.id}`],
  }));
  const width = Math.max(graph.width, ...nodes.map((node) => node.x + 260));
  const height = Math.max(graph.height, ...nodes.map((node) => node.y + 130));
  const canConnect =
    !!from &&
    !!to &&
    from !== to &&
    nodes.some((node) => node.id === from) &&
    nodes.some((node) => node.id === to);
  return (
    <div className="editor-document graph-document">
      <EditorHeading
        eyebrow="STORY CONNECTIONS"
        title="故事关系图"
        icon={<Network size={23} />}
      />
      <p className="section-help">
        查看真实的场景出口与线索推理。点击卡片进入编辑，拖动卡片整理布局；连接修改可以撤销。
      </p>
      <div className="graph-toolbar">
        <div className="segmented-control">
          <button
            aria-pressed={mode === "scene"}
            onClick={() => {
              setMode("scene");
              setFrom("");
              setTo("");
              setMessage("");
            }}
          >
            场景路线
          </button>
          <button
            aria-pressed={mode === "clue"}
            onClick={() => {
              setMode("clue");
              setFrom("");
              setTo("");
              setMessage("");
            }}
          >
            线索推理
          </button>
        </div>
        <div className="graph-zoom">
          <button
            className="quiet-button"
            aria-label="缩小关系图"
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
          >
            <ZoomOut size={17} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            className="quiet-button"
            aria-label="放大关系图"
            onClick={() => setScale(Math.min(1.5, scale + 0.1))}
          >
            <ZoomIn size={17} />
          </button>
          <button
            className="quiet-button"
            aria-label="重置关系图布局"
            onClick={() => {
              setPositions({});
              setScale(1);
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <button className="secondary-button" onClick={() => add(mode)}>
          <Plus size={15} /> 新建{mode === "scene" ? "场景" : "线索"}
        </button>
      </div>
      <div
        className="graph-scroll"
        aria-label={mode === "scene" ? "场景路线画布" : "线索推理画布"}
      >
        <div style={{ width: width * scale, height: height * scale }}>
          <div
            className="graph-board"
            style={{ width, height, transform: `scale(${scale})` }}
          >
            <svg width={width} height={height} aria-hidden="true">
              <defs>
                <marker
                  id="graph-arrow"
                  markerWidth="9"
                  markerHeight="9"
                  refX="8"
                  refY="4.5"
                  orient="auto"
                >
                  <path d="M0,0 L9,4.5 L0,9" fill="#729eab" />
                </marker>
              </defs>
              {graph.edges.map((edge) => {
                const source = nodes.find((node) => node.id === edge.from);
                const target = nodes.find((node) => node.id === edge.to);
                if (!source || !target) return null;
                const horizontal = Math.abs(target.x - source.x) >= 220;
                const forward = target.x > source.x;
                const x1 = source.x + (horizontal && !forward ? 0 : 208);
                const y1 = source.y + (horizontal && !forward ? 60 : 44);
                const x2 = target.x + (horizontal && forward ? 0 : 208);
                const y2 = target.y + (horizontal && !forward ? 60 : 44);
                const bend = horizontal ? (forward ? 30 : -30) : 45;
                return (
                  <path
                    key={`${edge.from}:${edge.to}`}
                    d={`M${x1},${y1} C${x1 + bend},${y1} ${x2 + (horizontal ? -bend : bend)},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke="#729eab"
                    strokeWidth={1.5}
                    markerEnd="url(#graph-arrow)"
                  />
                );
              })}
            </svg>
            {nodes.map((node) => (
              <div
                key={node.id}
                className={`graph-node${node.entry ? " is-entry" : ""}${!node.reachable ? " is-unreachable" : ""}`}
                style={{ left: node.x, top: node.y }}
              >
                <div
                  className="graph-drag-handle"
                  title="拖动调整布局"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    const handle = event.currentTarget;
                    const startX = event.clientX;
                    const startY = event.clientY;
                    handle.setPointerCapture(event.pointerId);
                    const move = (next: PointerEvent) =>
                      setPositions((current) => ({
                        ...current,
                        [`${mode}:${node.id}`]: {
                          x: Math.max(
                            12,
                            node.x + (next.clientX - startX) / scale,
                          ),
                          y: Math.max(
                            12,
                            node.y + (next.clientY - startY) / scale,
                          ),
                        },
                      }));
                    const stop = () => {
                      handle.removeEventListener("pointermove", move);
                      handle.removeEventListener("pointerup", stop);
                      handle.removeEventListener("pointercancel", stop);
                    };
                    handle.addEventListener("pointermove", move);
                    handle.addEventListener("pointerup", stop);
                    handle.addEventListener("pointercancel", stop);
                  }}
                >
                  <span />
                  {node.entry
                    ? "故事入口"
                    : !node.reachable
                      ? "尚不可达"
                      : mode === "scene"
                        ? "场景"
                        : "线索"}
                </div>
                <button onClick={() => select({ kind: mode, id: node.id })}>
                  <strong>{node.label || "未命名"}</strong>
                  <code>{node.id}</code>
                </button>
              </div>
            ))}
            {!nodes.length && (
              <div className="graph-empty">
                <Network size={30} />
                <strong>第一条线索，是故事的起点。</strong>
                <button className="primary-button" onClick={() => add(mode)}>
                  创建{mode === "scene" ? "场景" : "线索"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="graph-legend">
        <span>
          <i className="legend-entry" /> 故事入口
        </span>
        <span>
          <i /> {mode === "scene" ? "箭头表示可前往的方向" : "箭头表示推理关系"}
        </span>
        <span>
          {nodes.length} 个节点 · {graph.edges.length} 条连接
        </span>
      </div>
      <section className="surface-card">
        <div className="section-heading">
          <h2>
            <Link2 size={18} /> 编辑连接
          </h2>
        </div>
        <form
          className="connection-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canConnect) return;
            if (mode === "scene") setSceneLink(from, to, true, both);
            else setClueLink(from, to, reasoning);
            setMessage("连接已保存，可用撤销恢复。");
          }}
        >
          <label>
            从
            <select
              aria-label="连接起点"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            >
              <option value="">选择{mode === "scene" ? "场景" : "线索"}</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
          </label>
          <ArrowRight size={18} />
          <label>
            到
            <select
              aria-label="连接终点"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            >
              <option value="">选择目标</option>
              {nodes
                .filter((node) => node.id !== from)
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label}
                  </option>
                ))}
            </select>
          </label>
          {mode === "scene" ? (
            <label className="check-option">
              <input
                type="checkbox"
                checked={both}
                onChange={(event) => setBoth(event.target.checked)}
              />
              双向通行
            </label>
          ) : (
            <label>
              推理说明
              <input
                aria-label="推理说明"
                value={reasoning}
                onChange={(event) => setReasoning(event.target.value)}
                placeholder="为什么可以推导出下一条线索"
              />
            </label>
          )}
          <button className="primary-button" disabled={!canConnect}>
            <Plus size={15} /> 保存连接
          </button>
        </form>
        {message && (
          <p className="inline-success" role="status">
            {message}
          </p>
        )}
        <div className="connection-list">
          {graph.edges.map((edge) => (
            <div key={`${edge.from}:${edge.to}`}>
              <span>
                {nodes.find((node) => node.id === edge.from)?.label ??
                  edge.from}
              </span>
              <ArrowRight size={13} />
              <span>
                {nodes.find((node) => node.id === edge.to)?.label ?? edge.to}
              </span>
              {mode === "clue" && (
                <small>{edge.label || "未填写推理说明"}</small>
              )}
              <button
                className="quiet-button"
                aria-label={`删除连接 ${edge.from} 到 ${edge.to}`}
                onClick={() => {
                  if (mode === "scene") setSceneLink(edge.from, edge.to, false);
                  else setClueLink(edge.from, edge.to, null);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!graph.edges.length && (
            <p className="small-muted">
              还没有连接。选择起点和终点，建立第一条故事路线。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
