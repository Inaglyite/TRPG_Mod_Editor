import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

type Offer = { version: string; sha256: string; notes: string; size: number };
type CheckResult = {
  enabled: boolean;
  current: { version: string };
  update: Offer | null;
  test_channel?: boolean;
};
type View = {
  kind: "checking" | "available" | "latest" | "error" | "installed";
  message?: string;
  result?: CheckResult;
};

export function EditorUpdateDialog({
  checkRequest,
  dirty,
}: {
  checkRequest: number;
  dirty: boolean;
}) {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const installing = useRef(false);

  useEffect(() => {
    const manual = checkRequest > 0;
    if (installing.current) return;
    const controller = new AbortController();
    const id = ++requestId.current;
    let cancelled = false;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    async function check() {
      await Promise.resolve();
      if (cancelled) return;
      if (!window.location.protocol.startsWith("http")) {
        if (manual)
          setView({
            kind: "error",
            message: "请通过 TRPG Master 的模组工坊检查内嵌编辑器更新。",
          });
        return;
      }
      if (manual) setView({ kind: "checking" });
      try {
        const response = await fetch(
          `/api/editor/updates/check${manual ? "?force=true" : ""}`,
          {
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        const value = (await response.json()) as CheckResult & {
          ok: boolean;
          error?: string;
        };
        if (!response.ok || !value.ok)
          throw new Error(value.error || "更新检查失败，请稍后重试。");
        if (cancelled || id !== requestId.current || controller.signal.aborted)
          return;
        if (!value.enabled) {
          if (manual)
            setView({
              kind: "error",
              message:
                "此运行方式未启用独立更新，请在支持该功能的桌面客户端中打开模组工坊。",
            });
        } else if (value.update) setView({ kind: "available", result: value });
        else if (manual) setView({ kind: "latest", result: value });
      } catch (error) {
        if (manual && !cancelled && id === requestId.current)
          setView({
            kind: "error",
            message:
              error instanceof Error && error.name !== "AbortError"
                ? error.message
                : "连接更新服务超时，请稍后重试。",
          });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void check();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [checkRequest]);

  useEffect(() => {
    const element = dialog.current;
    if (view && element && !element.open) element.showModal();
    else if (!view && element?.open) element.close();
  }, [view]);

  async function install() {
    const offer = view?.result?.update;
    if (!offer || installing.current) return;
    installing.current = true;
    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch("/api/editor/updates/install", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: offer.version, sha256: offer.sha256 }),
      });
      const value = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !value.ok)
        throw new Error(value.error || "更新失败，当前版本仍可使用。");
      setView({
        kind: "installed",
        message: `v${offer.version} 已准备好，下次打开模组工坊时启用。`,
      });
    } catch (error) {
      setView({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "更新失败，当前版本仍可使用。",
      });
    } finally {
      window.clearTimeout(timeout);
      installing.current = false;
      setBusy(false);
    }
  }

  const offer = view?.result?.update;
  return (
    <dialog
      ref={dialog}
      className="editor-update-dialog"
      aria-labelledby="editor-update-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) setView(null);
      }}
    >
      <header>
        <Download size={20} />
        <h2 id="editor-update-title">
          {view?.kind === "available" ? "模组工坊有新更新" : "模组工坊更新"}
        </h2>
      </header>
      <div className="editor-update-body" aria-live="polite">
        {view?.kind === "checking" && (
          <p>
            <RefreshCw size={16} /> 正在检查更新…
          </p>
        )}
        {view?.kind === "available" && (
          <>
            <p>
              当前 v{view.result?.current.version} → 新版 v{offer?.version}
            </p>
            {view.result?.test_channel && (
              <p className="update-test-channel">预发布测试通道</p>
            )}
            <strong>更新信息如下：</strong>
            <pre>{offer?.notes || "本次更新包含编辑器改进。"}</pre>
            <p className="update-hint">
              下载约 {((offer?.size || 0) / 1024 / 1024).toFixed(1)} MB。
              当前页面可以继续编辑，新版将在下次打开时启用。
            </p>
          </>
        )}
        {view?.kind === "latest" && (
          <p>当前 v{view.result?.current.version} 已是最新兼容版本。</p>
        )}
        {view?.message && (
          <p role={view.kind === "error" ? "alert" : "status"}>
            {view.message}
          </p>
        )}
        {view?.kind === "installed" && dirty && (
          <p className="update-hint">
            当前工程有未保存内容，请先保存，再打开新版。
          </p>
        )}
      </div>
      <footer>
        <button
          className="secondary-button"
          autoFocus
          disabled={busy}
          onClick={() => setView(null)}
        >
          {view?.kind === "available"
            ? "暂不更新"
            : view?.kind === "installed"
              ? "稍后打开"
              : "关闭"}
        </button>
        {view?.kind === "available" && (
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void install()}
          >
            {busy ? "正在下载并校验…" : "更新编辑器"}
          </button>
        )}
        {view?.kind === "installed" && (
          <button
            className="primary-button"
            disabled={dirty}
            onClick={() => {
              window.location.assign("/editor/");
            }}
          >
            打开新版
          </button>
        )}
      </footer>
    </dialog>
  );
}
