import { useState } from 'react';

// ── Types (mirror yaduha.experiments) ────────────────────────────────────────

interface SentenceInput {
  text: string;
  metadata: Record<string, string>;
}

interface ModelConfig {
  model: string;
  temperature: number;
}

interface ProviderConfig {
  provider: string;
  models: ModelConfig[];
  api_key: string;
}

interface ExperimentConfig {
  name: string;
  language_code: string;
  translator_type: 'pipeline' | 'agentic';
  providers: ProviderConfig[];
  sentences: SentenceInput[];
}

interface Translation {
  source: string;
  target: string;
  translation_time: number;
  prompt_tokens: number;
  completion_tokens: number;
  back_translation?: { source: string; target: string } | null;
}

interface SentenceResult {
  sentence: SentenceInput;
  provider: string;
  model: string;
  translation?: Translation;
  error?: string;
}

interface ExperimentResult {
  filename: string;
  name: string;
  results: SentenceResult[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDERS = ['openai', 'anthropic', 'gemini', 'ollama'] as const;
type Provider = (typeof PROVIDERS)[number];

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3',
};

const SENTENCE_TYPES = ['', 'simple', 'transitive', 'intransitive', 'complex'];

// ── Small reusable sub-components ─────────────────────────────────────────────

function SentenceRow({
  sentence,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  sentence: SentenceInput;
  index: number;
  onChange: (s: SentenceInput) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="sentence-row">
      <span className="sentence-index">#{index + 1}</span>
      <input
        className="field-input sentence-text-input"
        value={sentence.text}
        onChange={e => onChange({ ...sentence, text: e.target.value })}
        placeholder="Enter an English sentence…"
      />
      <select
        className="field-select sentence-type-select"
        value={sentence.metadata.sentence_type ?? ''}
        onChange={e =>
          onChange({
            ...sentence,
            metadata: { ...sentence.metadata, sentence_type: e.target.value },
          })
        }
      >
        {SENTENCE_TYPES.map(t => (
          <option key={t} value={t}>
            {t === '' ? '— type —' : t}
          </option>
        ))}
      </select>
      {canRemove && (
        <button className="icon-btn remove-btn" onClick={onRemove} title="Remove sentence">
          ✕
        </button>
      )}
    </div>
  );
}

function ModelRow({
  model,
  onChange,
  onRemove,
  canRemove,
}: {
  model: ModelConfig;
  onChange: (m: ModelConfig) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="model-row">
      <input
        className="field-input model-name-input"
        value={model.model}
        onChange={e => onChange({ ...model, model: e.target.value })}
        placeholder="model name"
      />
      <label className="temp-label">T</label>
      <input
        className="field-input temp-input"
        type="number"
        min={0}
        max={2}
        step={0.1}
        value={model.temperature}
        onChange={e => onChange({ ...model, temperature: parseFloat(e.target.value) || 0 })}
      />
      {canRemove && (
        <button className="icon-btn remove-btn" onClick={onRemove} title="Remove model">
          ✕
        </button>
      )}
    </div>
  );
}

function ProviderCard({
  prov,
  onChange,
  onRemove,
  canRemove,
}: {
  prov: ProviderConfig;
  onChange: (p: ProviderConfig) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function addModel() {
    onChange({
      ...prov,
      models: [...prov.models, { model: DEFAULT_MODELS[prov.provider as Provider] ?? '', temperature: 0 }],
    });
  }

  function updateModel(i: number, m: ModelConfig) {
    const models = [...prov.models];
    models[i] = m;
    onChange({ ...prov, models });
  }

  function removeModel(i: number) {
    onChange({ ...prov, models: prov.models.filter((_, j) => j !== i) });
  }

  function changeProvider(p: string) {
    onChange({
      ...prov,
      provider: p,
      models: [{ model: DEFAULT_MODELS[p as Provider] ?? '', temperature: 0 }],
    });
  }

  return (
    <div className="provider-card">
      <div className="provider-card-header">
        <div className="toggle-group">
          {PROVIDERS.map(p => (
            <button
              key={p}
              className={`toggle-btn ${prov.provider === p ? 'active' : ''}`}
              onClick={() => changeProvider(p)}
            >
              {p}
            </button>
          ))}
        </div>
        {canRemove && (
          <button className="icon-btn remove-btn" onClick={onRemove} title="Remove provider">
            ✕
          </button>
        )}
      </div>

      <div className="field-group">
        <label className="field-label">API Key</label>
        <input
          className="field-input"
          type="password"
          value={prov.api_key}
          onChange={e => onChange({ ...prov, api_key: e.target.value })}
          placeholder={prov.provider === 'ollama' ? 'Not required' : 'sk-… (or set env var on server)'}
          disabled={prov.provider === 'ollama'}
        />
      </div>

      <div className="field-group">
        <label className="field-label">Models</label>
        <div className="model-list">
          {prov.models.map((m, i) => (
            <ModelRow
              key={i}
              model={m}
              onChange={updated => updateModel(i, updated)}
              onRemove={() => removeModel(i)}
              canRemove={prov.models.length > 1}
            />
          ))}
        </div>
        <button className="add-btn" onClick={addModel}>
          + Add model
        </button>
      </div>
    </div>
  );
}

// ── Results display ───────────────────────────────────────────────────────────

function ResultsPanel({ result }: { result: ExperimentResult }) {
  // Group by provider+model
  const groups = new Map<string, SentenceResult[]>();
  for (const r of result.results) {
    const key = `${r.provider} / ${r.model}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const totalOk = result.results.filter(r => r.translation).length;
  const totalErr = result.results.filter(r => r.error).length;

  return (
    <div className="experiment-results-card">
      <div className="results-header">
        <h3>Results — {result.filename}</h3>
        <div className="results-summary">
          <span className="results-badge success">{totalOk} ok</span>
          {totalErr > 0 && <span className="results-badge failure">{totalErr} failed</span>}
          <span className="results-badge info">Log loaded in viewer</span>
        </div>
      </div>

      {Array.from(groups.entries()).map(([key, rows]) => (
        <div key={key} className="result-group">
          <div className="result-group-header">{key}</div>
          <div className="results-list">
            {rows.map((r, i) => (
              <div key={i} className={`result-row ${r.error ? 'result-error' : 'result-ok'}`}>
                <div className="result-sentence">
                  <span className="result-index">#{i + 1}</span>
                  <span className="result-source">{r.sentence.text}</span>
                  {r.sentence.metadata.sentence_type && (
                    <span className="event-tag functionality">{r.sentence.metadata.sentence_type}</span>
                  )}
                </div>
                {r.translation && (
                  <div className="result-translation">
                    <div className="result-target">{r.translation.target}</div>
                    {r.translation.back_translation && (
                      <div className="result-back-translation">
                        Back: {r.translation.back_translation.source}
                      </div>
                    )}
                    <div className="result-meta">
                      {r.translation.translation_time.toFixed(2)}s &middot;{' '}
                      {(r.translation.prompt_tokens + r.translation.completion_tokens).toLocaleString()} tok
                    </div>
                  </div>
                )}
                {r.error && <div className="result-error-msg">{r.error}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  apiUrl: string;
  onLogLoaded: (filename: string, content: string) => void;
}

function makeDefaultProvider(provider: Provider = 'openai'): ProviderConfig {
  return {
    provider,
    models: [{ model: DEFAULT_MODELS[provider], temperature: 0 }],
    api_key: '',
  };
}

function makeDefaultSentence(): SentenceInput {
  return { text: '', metadata: {} };
}

export default function RunExperiment({ apiUrl, onLogLoaded }: Props) {
  const [name, setName] = useState('my-experiment');
  const [translatorType, setTranslatorType] = useState<'pipeline' | 'agentic'>('pipeline');
  const [languageCode, setLanguageCode] = useState('');
  const [providers, setProviders] = useState<ProviderConfig[]>([makeDefaultProvider()]);
  const [sentences, setSentences] = useState<SentenceInput[]>([makeDefaultSentence()]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Provider helpers ──

  function addProvider() {
    setProviders(prev => [...prev, makeDefaultProvider()]);
  }

  function updateProvider(i: number, p: ProviderConfig) {
    setProviders(prev => prev.map((x, j) => (j === i ? p : x)));
  }

  function removeProvider(i: number) {
    setProviders(prev => prev.filter((_, j) => j !== i));
  }

  // ── Sentence helpers ──

  function addSentence() {
    setSentences(prev => [...prev, makeDefaultSentence()]);
  }

  function updateSentence(i: number, s: SentenceInput) {
    setSentences(prev => prev.map((x, j) => (j === i ? s : x)));
  }

  function removeSentence(i: number) {
    setSentences(prev => prev.filter((_, j) => j !== i));
  }

  // ── Run ──

  async function handleRun() {
    const validSentences = sentences.filter(s => s.text.trim());
    if (validSentences.length === 0) {
      setError('Add at least one sentence to translate.');
      return;
    }
    if (!languageCode.trim()) {
      setError('Language code is required.');
      return;
    }
    if (!name.trim()) {
      setError('Experiment name is required.');
      return;
    }
    if (providers.length === 0) {
      setError('Add at least one provider.');
      return;
    }
    for (const p of providers) {
      if (p.models.some(m => !m.model.trim())) {
        setError(`All model names must be filled in (provider: ${p.provider}).`);
        return;
      }
    }

    const config: ExperimentConfig = {
      name: name.trim(),
      language_code: languageCode.trim(),
      translator_type: translatorType,
      providers: providers.map(p => ({
        ...p,
        api_key: p.api_key.trim() || undefined as unknown as string,
      })),
      sentences: validSentences.map(s => ({
        text: s.text.trim(),
        metadata: Object.fromEntries(
          Object.entries(s.metadata).filter(([, v]) => v !== '')
        ),
      })),
    };

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${apiUrl}/api/experiments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }

      const data: ExperimentResult = await res.json();
      setResult(data);

      // Fetch the generated log and hand it to the viewer
      const logRes = await fetch(`${apiUrl}/api/experiments/logs/${data.filename}`);
      if (logRes.ok) {
        onLogLoaded(data.filename, await logRes.text());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const providerModelCount = providers.reduce((n, p) => n + p.models.length, 0);
  const sentenceCount = sentences.filter(s => s.text.trim()).length;
  const totalRuns = providerModelCount * sentenceCount;

  return (
    <div className="experiment-container">
      <div className="experiment-form-card">
        <h2 className="experiment-title">Run Translation Experiment</h2>
        <p className="experiment-subtitle">
          Translate sentences across multiple LLM providers and models. All events are logged
          to a JSONL file you can explore in the Events and Charts tabs.
        </p>

        {/* ── Experiment settings ── */}
        <div className="experiment-grid">
          <div className="experiment-col">
            <h3 className="experiment-section-title">Experiment</h3>

            <div className="field-group">
              <label className="field-label">Name</label>
              <input
                className="field-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="my-experiment"
              />
              <span className="field-hint">Saved as {name || 'name'}.jsonl</span>
            </div>

            <div className="field-group">
              <label className="field-label">Translator</label>
              <div className="toggle-group">
                {(['pipeline', 'agentic'] as const).map(t => (
                  <button
                    key={t}
                    className={`toggle-btn ${translatorType === t ? 'active' : ''}`}
                    onClick={() => setTranslatorType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Language Code</label>
              <input
                className="field-input"
                value={languageCode}
                onChange={e => setLanguageCode(e.target.value)}
                placeholder="ovp"
              />
            </div>
          </div>
        </div>

        {/* ── Providers ── */}
        <div className="field-group">
          <div className="section-header">
            <h3 className="experiment-section-title">Providers &amp; Models</h3>
            <button className="add-btn" onClick={addProvider}>
              + Add provider
            </button>
          </div>
          <div className="provider-list">
            {providers.map((p, i) => (
              <ProviderCard
                key={i}
                prov={p}
                onChange={updated => updateProvider(i, updated)}
                onRemove={() => removeProvider(i)}
                canRemove={providers.length > 1}
              />
            ))}
          </div>
        </div>

        {/* ── Sentences ── */}
        <div className="field-group">
          <div className="section-header">
            <h3 className="experiment-section-title">
              Sentences
              <span className="field-hint-inline">
                &nbsp;({sentenceCount} sentence{sentenceCount !== 1 ? 's' : ''})
              </span>
            </h3>
            <button className="add-btn" onClick={addSentence}>
              + Add sentence
            </button>
          </div>
          <div className="sentence-list">
            {sentences.map((s, i) => (
              <SentenceRow
                key={i}
                sentence={s}
                index={i}
                onChange={updated => updateSentence(i, updated)}
                onRemove={() => removeSentence(i)}
                canRemove={sentences.length > 1}
              />
            ))}
          </div>
        </div>

        {/* ── Run summary + button ── */}
        {totalRuns > 0 && (
          <p className="field-hint run-summary">
            Will run {providerModelCount} model{providerModelCount !== 1 ? 's' : ''} ×{' '}
            {sentenceCount} sentence{sentenceCount !== 1 ? 's' : ''} = {totalRuns} translation
            {totalRuns !== 1 ? 's' : ''}
          </p>
        )}

        {error && <div className="experiment-error">{error}</div>}

        <button className="run-btn" onClick={handleRun} disabled={running}>
          {running ? 'Running…' : 'Run Experiment'}
        </button>
      </div>

      {result && <ResultsPanel result={result} />}
    </div>
  );
}
