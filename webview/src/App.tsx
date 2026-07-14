import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { onMessage, post } from './vscodeApi';
import type {
  AgentLeaderboard,
  ContextInfo,
  CostEstimate,
  Leaderboard as LeaderboardData,
  ModelInfo,
  ModelStat,
  OctogonConfig,
  RunOptions,
  RunRecord,
  RunSummary
} from '../../src/shared/types';
import { runReducer } from './state';
import type { Columns } from './state';
import { computeClientLeaderboard } from './leaderboard';
import { blindLabel } from './format';
import { PromptBar } from './components/PromptBar';
import { ModelPicker } from './components/ModelPicker';
import { ResultGrid } from './components/ResultGrid';
import { AgentGrid } from './components/AgentGrid';
import { ModeToggle } from './components/ModeToggle';
import { CostPreview } from './components/CostPreview';
import { Leaderboard } from './components/Leaderboard';
import { ContextPanel } from './components/ContextPanel';
import { ContextDisclosure } from './components/ContextDisclosure';
import { HistoryPanel } from './components/HistoryPanel';
import { ModelStatsPanel } from './components/ModelStatsPanel';
import { CollapsibleSection } from './components/CollapsibleSection';
import { OctogonMark } from './components/OctogonMark';

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

/** Whole days between an ISO-ish date string and now; null if unparseable. */
function daysSince(dateStr: string): number | null {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  const ms = Date.now() - t;
  return ms < 0 ? 0 : Math.floor(ms / 86_400_000);
}

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
  const [showStats, setShowStats] = useState(false);
  const [modelStats, setModelStats] = useState<ModelStat[]>([]);
  const [modelsOpen, setModelsOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(false);
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [showReference, setShowReference] = useState(false);
  const [judgeModelId, setJudgeModelId] = useState('');
  const [mode, setMode] = useState<'ask' | 'agent' | 'blind'>('ask');
  const [runMode, setRunMode] = useState<'ask' | 'agent' | 'blind'>('ask');
  const [revealed, setRevealed] = useState(false);
  // Blind mode: false = Octogon auto-picks random models; true = the user picks
  // the contestants (still anonymized until reveal).
  const [blindManual, setBlindManual] = useState(false);
  const [agentLeaderboard, setAgentLeaderboard] = useState<AgentLeaderboard | undefined>();
  const [agentCleanedUp, setAgentCleanedUp] = useState(false);
  const runIdRef = useRef<string | null>(null);
  const pendingAgentRef = useRef(false);

  useEffect(() => {
    const off = onMessage((msg) => {
      switch (msg.type) {
        case 'init':
          setModels(msg.models);
          setConfig(msg.config);
          setTopK(msg.config.retrievalTopK);
          if (pendingAgentRef.current && msg.config.agentEnabled) {
            pendingAgentRef.current = false;
            setMode('agent');
          }
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
          setRunMode(msg.mode ?? 'ask');
          setAgentLeaderboard(undefined);
          setAgentCleanedUp(false);
          setLeaderboard(undefined);
          setContextInfo(null);
          setWinner(null);
          setRevealed(false);
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
        case 'agentStart':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'agentStart', modelId: msg.modelId });
          }
          break;
        case 'agentFragment':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'agentFragment', modelId: msg.modelId, text: msg.text });
          }
          break;
        case 'agentStep':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'agentStep', modelId: msg.modelId, step: msg.step });
          }
          break;
        case 'agentDone':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'agentDone', modelId: msg.modelId, result: msg.result });
          }
          break;
        case 'agentError':
          if (msg.runId === runIdRef.current) {
            dispatch({ type: 'agentError', modelId: msg.modelId, message: msg.message, code: msg.code });
          }
          break;
        case 'agentApplied':
          setNotice({ level: msg.ok ? 'info' : 'error', message: msg.message });
          if (msg.ok) setAgentCleanedUp(true);
          break;
        case 'agentDiscarded':
          setNotice({ level: 'info', message: msg.message });
          setAgentCleanedUp(true);
          break;
        case 'runComplete':
          if (msg.runId === runIdRef.current) {
            setRunning(false);
            setLeaderboard(msg.leaderboard);
            setAgentLeaderboard(msg.agentLeaderboard);
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
        case 'modelStats':
          setModelStats(msg.stats);
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
          setRunMode('ask');
          setAgentLeaderboard(undefined);
          setAgentCleanedUp(false);
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
    retrievalTopK: topK,
    mode
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

  // Agent runs skip the cost preview (cost depends on the loop) and go straight
  // to the extension's consent modal.
  const startRun = () => {
    if (!prompt.trim()) return;
    if (mode === 'blind') {
      // Auto: send no ids and let the extension pick at random. Manual: send the
      // chosen ids — the extension shuffles them and keeps names hidden. Either
      // way the cost preview is skipped (identities stay anonymous).
      setPreview(null);
      const ids = blindManual ? selectedIds() : [];
      post({ type: 'run', prompt, modelIds: ids, options: buildOptions() });
      return;
    }
    const ids = selectedIds();
    if (ids.length === 0) return;
    if (mode === 'agent') {
      setPreview(null);
      post({ type: 'run', prompt, modelIds: ids, options: buildOptions() });
      return;
    }
    requestPreview();
  };

  const applyAgent = (modelId: string) => {
    if (runIdRef.current) {
      post({ type: 'applyAgent', runId: runIdRef.current, modelId });
    }
  };

  const discardAgent = () => {
    if (runIdRef.current) {
      post({ type: 'discardAgent', runId: runIdRef.current });
    }
  };

  const previewAgent = (modelId: string) => {
    if (runIdRef.current) {
      post({ type: 'previewAgent', runId: runIdRef.current, modelId });
    }
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
    setRevealed(true);
    if (runIdRef.current) {
      post({ type: 'pickWinner', runId: runIdRef.current, modelId: next });
    }
  };

  const reveal = () => setRevealed(true);

  const runJudge = (referenceAnswer: string) => {
    if (!runIdRef.current) return;
    setJudging(true);
    post({
      type: 'runJudge',
      runId: runIdRef.current,
      referenceAnswer: referenceAnswer.trim() || undefined,
      judgeModelId: judgeModelId || undefined
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

  const toggleStats = () => {
    if (!showStats) post({ type: 'loadModelStats' });
    setShowStats((s) => !s);
  };

  const exitHistory = () => {
    setLoadedRun(null);
    dispatch({ type: 'reset' });
    setOrder([]);
    setLeaderboard(undefined);
    setAgentLeaderboard(undefined);
    setAgentCleanedUp(false);
    setRunMode('ask');
    setContextInfo(null);
    setWinner(null);
    setRevealed(false);
  };

  const hasResults = order.length > 0;
  const blindActive = runMode === 'blind' && !revealed;
  const askLike = runMode === 'ask' || (runMode === 'blind' && revealed);

  // Warn when the chosen judge also competed in this run (self-preference bias).
  // Only applies to an explicit pick that produced a judgeable answer; "Auto"
  // (empty judgeModelId) is kept unbiased server-side by pickJudgeModel.
  const judgeConflictName = (() => {
    if (!judgeModelId) return null;
    const result = columns[judgeModelId]?.result;
    if (!result || result.error || result.output.trim().length === 0) return null;
    return models.find((m) => m.id === judgeModelId)?.name ?? judgeModelId;
  })();

  const titleFor = useMemo(
    () => (id: string) => {
      if (runMode === 'blind' && !revealed && !loadedRun) {
        return { title: blindLabel(order.indexOf(id)), subtitle: undefined };
      }
      if (loadedRun) {
        return { title: loadedRun.modelNames[id] ?? id, subtitle: undefined };
      }
      const m = models.find((x) => x.id === id);
      return {
        title: m?.name ?? id,
        subtitle: m ? `${m.vendor} · ${m.family}` : undefined
      };
    },
    [models, loadedRun, runMode, revealed, order]
  );

  const nameFor = useMemo(
    () => (id: string) => {
      if (loadedRun) return loadedRun.modelNames[id] ?? id;
      return models.find((x) => x.id === id)?.name ?? id;
    },
    [models, loadedRun]
  );

  const canRun =
    prompt.trim().length > 0 &&
    (mode === 'blind' ? (blindManual ? selected.size >= 2 : true) : selected.size > 0);

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

  const pricingDays = config ? daysSince(config.pricingLastUpdated) : null;
  const pricingStale = pricingDays !== null && pricingDays > 30;

  return (
    <div className="flex flex-col gap-2 p-3">
      <header className="flex shrink-0 items-center gap-2">
        <OctogonMark className="h-5 w-5 shrink-0 text-vscode-link" />
        <h1 className="text-lg font-semibold tracking-tight">Octogon</h1>
        <span className="text-xs text-vscode-desc">compare cost and accuracy, side by side</span>
        <button
          className="ml-auto rounded px-2 py-0.5 text-xs text-vscode-link hover:bg-vscode-list-hover"
          onClick={toggleStats}
        >
          {showStats ? 'Hide stats' : 'Stats'}
        </button>
        <button
          className="rounded px-2 py-0.5 text-xs text-vscode-link hover:bg-vscode-list-hover"
          onClick={toggleHistory}
        >
          {showHistory ? 'Hide history' : 'History'}
        </button>
        <button
          className="rounded px-2 py-0.5 text-xs text-vscode-link hover:bg-vscode-list-hover"
          onClick={() => post({ type: 'openSettings' })}
          title="Open Octogon settings"
        >
          ⚙ Settings
        </button>
      </header>

      {config && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px] text-vscode-desc">
          <span className={pricingStale ? 'text-yellow-500' : undefined}>
            {pricingDays === null
              ? `Pricing as of ${config.pricingLastUpdated}`
              : pricingDays === 0
                ? 'Pricing updated today'
                : `Pricing updated ${pricingDays} day${pricingDays === 1 ? '' : 's'} ago`}
            {pricingStale ? ' · may be stale' : ''} · estimates only
          </span>
          <button
            className="text-vscode-link hover:underline"
            onClick={() => post({ type: 'refreshPricing' })}
            title="Fetch the latest pricing from octogon.pricingUrl"
          >
            refresh
          </button>
        </div>
      )}

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

      {showStats && (
        <ModelStatsPanel
          stats={modelStats}
          onRefresh={() => post({ type: 'loadModelStats' })}
          onClose={() => setShowStats(false)}
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
        onRun={startRun}
        running={running}
        previewing={previewing}
        canRun={canRun}
      />

      <div className="flex flex-wrap items-center gap-2">
        <ModeToggle
          mode={mode}
          onChange={setMode}
          agentEnabled={config?.agentEnabled ?? false}
          disabled={running}
          onEnableRequest={() => {
            pendingAgentRef.current = true;
            post({ type: 'enableAgent' });
          }}
        />
        {mode === 'agent' && (
          <span className="text-[11px] text-vscode-desc">
            Each model works in its own sandbox · apply a winning diff when done
          </span>
        )}
        {mode === 'blind' && (
          <span className="text-[11px] text-vscode-desc">
            {blindManual
              ? 'You pick the models · names hidden until you pick the best'
              : `${config?.blindModelCount ?? 3} random models · names hidden until you pick the best`}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <button
            className="rounded bg-vscode-btn-sec-bg px-3 py-1.5 text-vscode-btn-sec-fg hover:opacity-90"
            onClick={cancel}
          >
            Cancel
          </button>
        ) : (
          <button
            className="rounded bg-vscode-btn-bg px-3 py-1.5 text-vscode-btn-fg hover:bg-vscode-btn-hover disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canRun || previewing}
            onClick={startRun}
          >
            {previewing
              ? 'Estimating cost…'
              : mode === 'agent'
                ? 'Run agent bake-off'
                : mode === 'blind'
                  ? 'Run blind test'
                  : 'Run comparison'}
          </button>
        )}

        {blindActive && hasResults && !running && (
          <button
            className="rounded bg-vscode-btn-sec-bg px-3 py-1.5 text-vscode-btn-sec-fg hover:opacity-90"
            onClick={reveal}
            title="Reveal which model produced each answer"
          >
            Reveal models
          </button>
        )}

        {hasResults && !loadedRun && askLike && (
          <button
            className="rounded bg-vscode-btn-sec-bg px-3 py-1.5 text-vscode-btn-sec-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={running || verifying}
            title={
              (config?.verifyCommand ?? '').trim()
                ? `Sandbox runs: ${config?.verifyCommand}`
                : 'Set octogon.verifyCommand (e.g. npm test) to enable verification'
            }
            onClick={runVerify}
          >
            {verifying ? 'Verifying…' : 'Run verification'}
          </button>
        )}

        {running && (
          <span className="flex items-center gap-1 text-xs text-vscode-desc">
            <span className="h-2 w-2 animate-pulse rounded-full bg-vscode-link" />
            Running…
          </span>
        )}

        <span className="ml-auto text-[11px] text-vscode-desc">Ctrl/Cmd+Enter to run</span>
      </div>

      {hasResults && !loadedRun && askLike && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded bg-vscode-btn-sec-bg px-3 py-1.5 text-vscode-btn-sec-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={running || judging}
            onClick={() => runJudge(referenceAnswer)}
          >
            {judging ? 'Judging…' : 'Run LLM judge'}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-vscode-desc">
            with
            <select
              className="max-w-[180px] rounded border border-vscode-input-border bg-vscode-input-bg px-1.5 py-1 text-xs text-vscode-input-fg outline-none focus:border-vscode-link disabled:opacity-50"
              value={judgeModelId}
              onChange={(e) => setJudgeModelId(e.target.value)}
              disabled={judging}
              title="Model used to judge the responses"
            >
              <option value="">Auto (strongest)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-xs text-vscode-link hover:underline"
            onClick={() => setShowReference((s) => !s)}
          >
            {showReference ? 'Hide reference' : 'Add reference answer'}
          </button>
        </div>
      )}

      {judgeConflictName && hasResults && !loadedRun && askLike && (
        <div className="flex items-start gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs">
          <span aria-hidden="true">⚠</span>
          <span>
            <strong>{judgeConflictName}</strong> also competed in this run. Models tend to rate their
            own answers higher — for an unbiased score, pick a judge that wasn&apos;t in the ring.
            You can still run it anyway.
          </span>
        </div>
      )}

      {showReference && hasResults && !loadedRun && askLike && (
        <textarea
          className="min-h-[60px] w-full resize-y rounded border border-vscode-input-border bg-vscode-input-bg p-2 text-xs text-vscode-input-fg outline-none focus:border-vscode-link"
          placeholder="Optional reference answer — when provided, the LLM judge scores responses against it."
          value={referenceAnswer}
          onChange={(e) => setReferenceAnswer(e.target.value)}
          disabled={running || judging}
        />
      )}

          {mode === 'blind' ? (
            <div className="flex flex-col gap-2 rounded border border-vscode-border bg-vscode-panel-bg px-3 py-2 text-xs text-vscode-desc">
              <div className="flex items-center gap-2">
                <span>Contestants</span>
                <div className="inline-flex overflow-hidden rounded border border-vscode-border">
                  <button
                    className={`px-2 py-0.5 transition-colors ${
                      !blindManual ? 'bg-vscode-btn-bg text-vscode-btn-fg' : 'hover:text-vscode-fg'
                    }`}
                    onClick={() => setBlindManual(false)}
                    disabled={running}
                    title="Octogon picks the models at random"
                  >
                    Auto (random)
                  </button>
                  <button
                    className={`px-2 py-0.5 transition-colors ${
                      blindManual ? 'bg-vscode-btn-bg text-vscode-btn-fg' : 'hover:text-vscode-fg'
                    }`}
                    onClick={() => setBlindManual(true)}
                    disabled={running}
                    title="Pick the models yourself — their names stay hidden while you judge"
                  >
                    Pick models
                  </button>
                </div>
                {blindManual && (
                  <button
                    className="ml-auto rounded px-2 py-0.5 text-vscode-link hover:bg-vscode-list-hover disabled:opacity-50"
                    onClick={() => post({ type: 'requestModels' })}
                    disabled={running}
                  >
                    Refresh
                  </button>
                )}
              </div>
              {blindManual ? (
                <>
                  <ModelPicker
                    models={models}
                    selected={selected}
                    onToggle={toggleModel}
                    disabled={running}
                  />
                  <span className="text-[11px]">
                    {selected.size < 2
                      ? 'Pick at least 2 models — names stay hidden until you pick the best (or reveal).'
                      : `${selected.size} models · shuffled and kept anonymous until you pick the best (or reveal).`}
                  </span>
                </>
              ) : (
                <span>
                  {config?.blindModelCount ?? 3} models are chosen at random and kept anonymous
                  until you pick the best answer (or reveal).
                </span>
              )}
            </div>
          ) : (
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
          )}

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

      {contextInfo && <ContextDisclosure context={contextInfo} />}

      {leaderboard && !running && askLike && (
        <Leaderboard leaderboard={leaderboard} nameFor={nameFor} />
      )}

      {runMode === 'agent' && agentLeaderboard?.recommended && !running && (
        <div className="flex shrink-0 items-center gap-2 rounded border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-xs">
          <span>🏆</span>
          <span>
            Recommended: <span className="font-semibold">{nameFor(agentLeaderboard.recommended.modelId)}</span>{' '}
            <span className="text-vscode-desc">({agentLeaderboard.recommended.basis})</span>
          </span>
        </div>
      )}

      {runMode === 'agent' && hasResults && !running && !loadedRun && (
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {agentCleanedUp ? (
            <span className="text-vscode-desc">
              🧹 Sandboxes cleaned up — nothing was applied to your working tree.
            </span>
          ) : (
            <button
              className="rounded bg-vscode-btn-sec-bg px-3 py-1 text-vscode-btn-sec-fg hover:opacity-90"
              onClick={discardAgent}
              title="Delete all agent sandboxes without applying any changes"
            >
              🧹 Discard bake-off (apply nothing)
            </button>
          )}
        </div>
      )}

      {runMode === 'agent' ? (
        <AgentGrid
          order={order}
          columns={columns}
          titleFor={titleFor}
          board={agentLeaderboard}
          readOnly={Boolean(loadedRun) || agentCleanedUp}
          onApply={applyAgent}
          onPreview={previewAgent}
        />
      ) : (
        <ResultGrid
          order={order}
          columns={columns}
          titleFor={titleFor}
          leaderboard={leaderboard}
          winner={winner}
          readOnly={Boolean(loadedRun)}
          blind={blindActive}
          onRate={rate}
          onPickWinner={pickWinner}
        />
      )}

      <footer className="shrink-0 text-[10px] leading-snug text-vscode-desc">
        Costs are estimates from Copilot usage-based rates (1 AI credit = $0.01). Running
        comparisons — and the optional judge/verification — consume real tokens/credits against your
        plan.
      </footer>
    </div>
  );
}
