import { useState } from 'react';
import {
  lookupViolation,
  lookupInspection,
  type ViolationLookupResult,
  type InspectionLookupResult,
} from '../services/api';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function ResultTable({ data }: { data: Record<string, string> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-700">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-b border-zinc-800 last:border-0">
              <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs uppercase whitespace-nowrap w-1/3">
                {k.replace(/_/g, ' ')}
              </td>
              <td className="px-4 py-2.5 text-zinc-100 font-medium break-words">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({ found }: { found: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold ${
        found
          ? 'bg-lime-400/10 text-lime-400 border border-lime-400/20'
          : 'bg-zinc-700/50 text-zinc-400 border border-zinc-700'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${found ? 'bg-lime-400' : 'bg-zinc-500'}`}
      />
      {found ? 'FOUND' : 'NOT FOUND'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Violation lookup panel
// ---------------------------------------------------------------------------

function ViolationPanel({ apiKey }: { apiKey: string }) {
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<'motorbike' | 'car' | 'electricbike'>('motorbike');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ViolationLookupResult | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plate.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await lookupViolation(plate.trim(), vehicleType, apiKey || undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex flex-col gap-5">
      <div className="card-header">
        <h2 className="card-title">Traffic Fine Lookup&nbsp;<span className="text-zinc-500 font-normal text-sm">(Tra cứu phạt nguội)</span></h2>
        <p className="text-zinc-500 text-sm mt-0.5">Check outstanding traffic fines from csgt.vn by license plate.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="field-label">License Plate</label>
            <input
              className="input"
              placeholder="e.g. 60A64685"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label">Vehicle Type</label>
            <select
              className="input"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as typeof vehicleType)}
            >
              <option value="motorbike">Motorbike (Xe máy)</option>
              <option value="car">Car (Ô tô)</option>
              <option value="electricbike">Electric bike (Xe điện)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !plate.trim()}
          className="self-start flex items-center gap-2 px-5 py-2 rounded-lg bg-lime-400 text-zinc-950 text-sm font-semibold hover:bg-lime-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Searching…
            </>
          ) : (
            'Search'
          )}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 text-sm">Result for <span className="text-zinc-200 font-mono">{plate}</span></span>
            <StatusChip found={result.found} />
          </div>
          {result.found && result.data ? (
            <ResultTable data={result.data} />
          ) : (
            <p className="text-zinc-500 text-sm">{result.message ?? 'No records found.'}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspection lookup panel
// ---------------------------------------------------------------------------

function InspectionPanel({ apiKey }: { apiKey: string }) {
  const [plate, setPlate] = useState('');
  const [vin, setVin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectionLookupResult | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plate.trim() || !vin.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await lookupInspection(plate.trim(), vin.trim(), apiKey || undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex flex-col gap-5">
      <div className="card-header">
        <h2 className="card-title">Inspection Lookup&nbsp;<span className="text-zinc-500 font-normal text-sm">(Tra cứu đăng kiểm)</span></h2>
        <p className="text-zinc-500 text-sm mt-0.5">Look up vehicle inspection details from csgt.vn using plate and chassis number.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="field-label">License Plate</label>
            <input
              className="input"
              placeholder="e.g. 64H00355"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label">Chassis / VIN Number</label>
            <input
              className="input"
              placeholder="e.g. RNHA39KHALT028519"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !plate.trim() || !vin.trim()}
          className="self-start flex items-center gap-2 px-5 py-2 rounded-lg bg-lime-400 text-zinc-950 text-sm font-semibold hover:bg-lime-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Searching…
            </>
          ) : (
            'Search'
          )}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 text-sm">Result for <span className="text-zinc-200 font-mono">{plate}</span></span>
            <StatusChip found={result.found} />
          </div>
          {result.found && result.data ? (
            <ResultTable data={result.data} />
          ) : (
            <p className="text-zinc-500 text-sm">{result.message ?? 'No records found.'}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LookupPage() {
  const [apiKey, setApiKey] = useState('');

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">Vehicle Lookup</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Tra cứu phạt nguội &amp; đăng kiểm — queries the official CSGT portal (csgt.vn) via
          headless browser.
        </p>
      </div>

      <div className="card flex flex-col gap-3">
        <div className="card-header">
          <h2 className="card-title">API Key</h2>
          <p className="text-zinc-500 text-sm mt-0.5">Required when the server is configured with FLOWPDF_API_KEY.</p>
        </div>
        <input
          type="password"
          className="input"
          placeholder="Leave blank if API key is not configured"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
        />
      </div>

      <ViolationPanel apiKey={apiKey} />
      <InspectionPanel apiKey={apiKey} />
    </div>
  );
}
