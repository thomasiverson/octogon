import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { onMessage, post } from './vscodeApi';
import type {
  ContextInfo,
  CostEstimate,
  Leaderboard as LeaderboardData,
  ModelInfo,
  OctogonConfig,
  RunOptions,
  RunRecord,
  RunSummary
} from '../../src/shared/types';
import { runReducer } from './state';
import type { Columns } from './state';
import { computeClientLeaderboard } from './leaderboard';
import { PromptBar } from './components/PromptBar';
import { ModelPicker } from './components/ModelPicker';
import { ResultGrid } from './components/ResultGrid';
import { CostPreview } from './components/CostPreview';
import { Leaderboard } from './components/Leaderboard';
import { ContextPanel } from './components/ContextPanel';
import { ContextDisclosure } from './components/ContextDisclosure';
import { JudgeBar } from './components/JudgeBar';
import { VerifyBar } from './components/VerifyBar';
import { HistoryPanel } from './components/HistoryPanel';
import { CollapsibleSection } from './components/CollapsibleSection';

interface Notice {
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface PreviewData {
  estimates: CostEstimate[];
  totalUsd: number;
  totalCredits: number;
  expectedOutputTokens: number;
}

const noticeClasses: Record<Notice['level'], string> = {
  info: 'border-blue-500/40 bg-blue-500/10',
  warn: 'border-yellow-500/40 bg-yellow-500/10',
  error: 'border-red-500/40 bg-red-500/10'
};

export function App() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [config, setConfig] = useState<OctogonConfig | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [columns, dispatch] = useReducer(runReducer, {});
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [useActiveFile, setUseActiveFile] = useState(true);
  const [useRetrieval, setUseRetrieval] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [topK, setTopK] = useState(5);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);
  const [judging, setJudging] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const verifyPendingRef = useRef(0);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadedRun, setLoadedRun] = useState<RunRecord | null>(null);
  const [modelsOpen, setModelsOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    const off = onMessage((msg) => {
      switch (msg.type) {
        case 'init':
          setModels(msg.models);
          setConfig(msg.config);
          setTopK(msg.config.retrievalTopK);
          break;
        case 'models':
          setModels(msg.models);
          break;
        case 'activeFile':
          setActiveFile(msg.path);
          break;
        case 'attachedFiles':
          setPreview(null);
          setAttachedFiles((prev) => Array.from(new Set([...prev, ...msg.files])));
          break;
        case 'context':
          if (msg.runId === runIdRef.current) {
            setContextInfo(msg.context);
          }
          break;
        case 'costPreview':
          setPreviewing(false);
          if (msg.estimates.length > 0) {
            setPreview({
              estimates: msg.estimates,
              totalUsd: msg.totalUsd,
              totalCredits: msg.totalCredits,
              expectedOutputTokens: msg.expectedOutputTokens
            });
          }
          break;
        case 'runStarted':
          runIdRef.current = msg.runId;
          setOrder(msg.modelIds);
          setLeaderboard(undefined);
          setContextInfo(null);
          setWinner(null);
          setJudging(false);
          setLoadedRun(null);
          verifyPendingRef.current = 0;
          setVerifying(false);
          setModelsOpen(false);
          dispatch({ type: 'start', modelIds: msg.modelIds });
          setRunning(true);
          break;
        case 'modelStart':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'modelStart', modelId: msg.modelId });
          }
          break;
        case 'fragment':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'fragment', modelId: msg.modelId, text: msg.text });
          }
          break;
        case 'modelDone':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'modelDone', modelId: msg.modelId, result: msg.result });
          }
          break;
        case 'modelError':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'modelError', modelId: msg.modelId, message: msg.message, code: msg.code });
          }
          break;
        case 'runComplete':
          if (msg.runId === runIdRef.current) {
            setRunning(false);
            setLeaderboard(msg.leaderboard);
          }
          break;
        case 'judgeDone':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'judge', scores: msg.scores });
            setJudging(false);
          }
          break;
        case 'judgeError':
          if (msg.runId === runIdRef.current) {
            setJudging(false);
          }
          setNotice({ level: 'error', message: `Judge failed: ${msg.message}` });
          break;
        case 'verifyDone':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'verify', modelId: msg.modelId, result: msg.result });
            verifyPendingRef.current = Math.max(0, verifyPendingRef.current - 1);
            if (verifyPendingRef.current === 0) setVerifying(false);
          }
          break;
        case 'verifyError':
          if (msg.runId === runIdRef.current) {
            verifyPendingRef.current = Math.max(0, verifyPendingRef.current - 1);
            if (verifyPendingRef.current === 0) setVerifying(false);
          }
          setNotice({ level: 'error', message: `Verify failed: ${msg.message}` });
          break;
        case 'history':
          setHistory(msg.runs);
          break;
        case 'historyRun': {
          const run = msg.run;
          const cols: Columns = {};
          for (const r of run.results) {
            cols[r.modelId] = {
              modelId: r.modelId,
              status: r.error ? 'error' : 'done',
              text: r.output,
              result: r,
              error: r.error
            };
          }
          dispatch({ type: 'load', columns: cols });
          setOrder(run.modelIds);
          setWinner(run.winner ?? null);
          setLeaderboard(computeClientLeaderboard(run.results));
          setContextInfo({
            refs: run.contextRefs,
            totalTokens: run.contextRefs.reduce((s, ref) => s + ref.tokens, 0),
            trimmed: false,
            budget: 0
          });
          setLoadedRun(run);
          setShowHistory(false);
          setRunning(false);
          break;
        }
        case 'notice':
          setNotice({ level: msg.level, message: msg.message });
          break;
        default:
          break;
      }
    });
    post({ type: 'ready' });
    return off;
  }, []);

  const selectedIds = () => models.filter((m) => selected.has(m.id)).map((m) => m.id);

  const buildOptions = (): RunOptions => ({
    useActiveFile,
    attachedFiles,
    useRetrieval,
    retrievalTopK: topK
  });

  const toggleModel = (id: string) => {
    setPreview(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const changePrompt = (value: string) => {
    setPreview(null);
    setPrompt(value);
  };

  // Context options affect cost, so invalidate any stale preview when they change.
  const changeUseActiveFile = (v: boolean) => {
    setPreview(null);
    setUseActiveFile(v);
  };
  const changeUseRetrieval = (v: boolean) => {
    setPreview(null);
    setUseRetrieval(v);
  };
  const changeTopK = (v: number) => {
    setPreview(null);
    setTopK(v);
  };
  const removeAttached = (path: string) => {
    setPreview(null);
    setAttachedFiles((prev) => prev.filter((p) => p !== path));
  };
  const clearAttached = () => {
    setPreview(null);
    setAttachedFiles([]);
  };

  const requestPreview = () => {
    const ids = selectedIds();
    if (ids.length === 0 || !prompt.trim()) return;
    setPreview(null);
    setPreviewing(true);
    post({ type: 'previewCost', prompt, modelIds: ids, options: buildOptions() });
  };

  const confirmRun = () => {
    const ids = selectedIds();
    setPreview(null);
    post({ type: 'run', prompt, modelIds: ids, options: buildOptions() });
  };

  const cancel = () => post({ type: 'cancel' });

  const rate = (modelId: string, rating: number | null) => {
    dispatch({ type: 'rate', modelId, rating });
    if (runIdRef.current) {
      post({ type: 'rate', runId: runIdRef.current, modelId, rating });
    }
  };

  const pickWinner = (modelId: string) => {
    const next = winner === modelId ? null : modelId;
    setWinner(next);
    if (runIdRef.current) {
      post({ type: 'pickWinner', runId: runIdRef.current, modelId: next });
    }
  };

  const runJudge = (referenceAnswer: string) => {
    if (!runIdRef.current) return;
    setJudging(true);
    post({
      type: 'runJudge',
      runId: runIdRef.current,
      referenceAnswer: referenceAnswer.trim() || undefined
    });
  };

  const runVerify = () => {
    if (!runIdRef.current) return;
    const pending = order.filter((id) => columns[id]?.result && !columns[id]?.error).length;
    if (pending === 0) return;
    verifyPendingRef.current = pending;
    setVerifying(true);
    post({ type: 'runVerify', runId: runIdRef.current });
  };

  const toggleHistory = () => {
    if (!showHistory) post({ type: 'loadHistory' });
    setShowHistory((s) => !s);
  };

  const exitHistory = () => {
    setLoadedRun(null);
    dispatch({ type: 'reset' });
    setOrder([]);
    setLeaderboard(undefined);
    setContextInfo(null);
    setWinner(null);
  };

  const hasResults = order.length > 0;

  const titleFor = useMemo(
    () => (id: string) => {
      if (loadedRun) {
        return { title: loadedRun.modelNames[id] ?? id, subtitle: undefined };
      }
      const m = models.find((x) => x.id === id);
      return {
        title: m?.name ?? id,
        subtitle: m ? `${m.vendor} · ${m.family}` : undefined
      };
    },
    [models, loadedRun]
  );

  const nameFor = useMemo(
    () => (id: string) => {
      if (loadedRun) return loadedRun.modelNames[id] ?? id;
      return models.find((x) => x.id === id)?.name ?? id;
    },
    [models, loadedRun]
  );

  const canRun = prompt.trim().length > 0 && selected.size > 0;

  const selectedModelNames = models.filter((m) => selected.has(m.id)).map((m) => m.name);
  const modelsSummary =
    selected.size === 0
      ? 'none selected'
      : `${selected.size} selected · ${selectedModelNames.join(', ')}`;

  const contextParts: string[] = [];
  if (useActiveFile) contextParts.push(activeFile ? (activeFile.split(/[\\/]/).pop() ?? 'active file') : 'active file');
  if (useRetrieval) contextParts.push(`retrieval ${topK}`);
  if (attachedFiles.length > 0) contextParts.push(`${attachedFiles.length} attached`);
  const contextSummary = contextParts.length > 0 ? contextParts.join(' · ') : 'none';

  return (
    <div className="flex flex-col gap-2 p-3">
      <header className="flex shrink-0 items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Octogon</h1>
        <span className="text-xs text-vscode-desc">compare cost and accuracy, side by side</span>
        <button
          className="ml-auto rounded px-2 py-0.5 text-xs text-vscode-link hover:bg-vscode-list-hover"
          onClick={toggleHistory}
        >
          {showHistory ? 'Hide history' : 'History'}
        </button>
        {config && (
          <span className="text-[11px] text-vscode-desc">
            pricing as of {config.pricingLastUpdated} · estimates only
          </span>
        )}
      </header>

      {notice && (
        <div className={`flex shrink-0 items-start gap-2 rounded border px-3 py-2 text-xs ${noticeClasses[notice.level]}`}>
          <span className="flex-1">{notice.message}</span>
          <button className="opacity-70 hover:opacity-100" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}

      {showHistory && (
        <HistoryPanel
          runs={history}
          onReload={(id) => post({ type: 'reloadRun', id })}
          onExport={(id, format) => post({ type: 'exportRun', id, format })}
          onClear={() => post({ type: 'clearHistory' })}
          onClose={() => setShowHistory(false)}
        />
      )}

      {loadedRun && (
        <div className="flex shrink-0 items-center gap-2 rounded border border-vscode-link/40 bg-vscode-panel-bg px-3 py-2 text-xs">
          <span className="flex-1">
            Viewing saved run from {new Date(loadedRun.timestamp).toLocaleString()} (read-only)
          </span>
          <button
            className="rounded border border-vscode-border px-2 py-0.5 hover:bg-vscode-list-hover"
            onClick={exitHistory}
          >
            Exit
          </button>
        </div>
      )}

      <PromptBar
        prompt={prompt}
        onPromptChange={changePrompt}
        onRun={requestPreview}
        onCancel={cancel}
        running={running}
        previewing={previewing}
        canRun={canRun}
      />

          <CollapsibleSection
            title="Models"
            open={modelsOpen}
            onToggle={() => setModelsOpen((o) => !o)}
            summary={modelsSummary}
            right={
              <button
                className="rounded px-2 py-0.5 text-xs text-vscode-link hover:bg-vscode-list-hover disabled:opacity-50"
                onClick={() => post({ type: 'requestModels' })}
                disabled={running}
              >
                Refresh
              </button>
            }
          >
            <ModelPicker models={models} selected={selected} onToggle={toggleModel} disabled={running} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Context"
            open={contextOpen}
            onToggle={() => setContextOpen((o) => !o)}
            summary={contextSummary}
          >
            <ContextPanel
              activeFile={activeFile}
              useActiveFile={useActiveFile}
              onToggleActiveFile={changeUseActiveFile}
              useRetrieval={useRetrieval}
              onToggleRetrieval={changeUseRetrieval}
              topK={topK}
              onTopKChange={changeTopK}
              attachedFiles={attachedFiles}
              onAttach={() => post({ type: 'attachFiles' })}
              onRemoveAttached={removeAttached}
              onClearAttached={clearAttached}
              disabled={running}
            />
          </CollapsibleSection>

      {preview && (
          <CostPreview
            estimates={preview.estimates}
            totalUsd={preview.totalUsd}
            totalCredits={preview.totalCredits}
            expectedOutputTokens={preview.expectedOutputTokens}
            nameFor={nameFor}
            onConfirm={confirmRun}
            onCancel={() => setPreview(null)}
          />
        )}

        {hasResults && !running && !loadedRun && (
          <CollapsibleSection
            title="Score & verify"
            open={scoringOpen}
            onToggle={() => setScoringOpen((o) => !o)}
            summary="rate · LLM judge · sandboxed tests"
          >
            <div className="flex flex-col gap-3">
              <JudgeBar onRunJudge={runJudge} judging={judging} disabled={running} />
              <VerifyBar
                command={config?.verifyCommand ?? ''}
                onVerify={runVerify}
                verifying={verifying}
                disabled={running}
              />
            </div>
          </CollapsibleSection>
        )}

      {contextInfo && <ContextDisclosure context={contextInfo} />}

      {leaderboard && !running && <Leaderboard leaderboard={leaderboard} nameFor={nameFor} />}

      <ResultGrid
        order={order}
        columns={columns}
        titleFor={titleFor}
        leaderboard={leaderboard}
        winner={winner}
        readOnly={Boolean(loadedRun)}
        onRate={rate}
        onPickWinner={pickWinner}
      />

      <footer className="shrink-0 text-[10px] leading-snug text-vscode-desc">
        Costs are estimates from Copilot usage-based rates (1 AI credit = $0.01). Running
        comparisons — and the optional judge/verification — consume real tokens/credits against your
        plan.
      </footer>
    </div>
  );
}
