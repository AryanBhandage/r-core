"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Minus, Plus, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { SemanticComponent, SemanticExplorerResult, SemanticMatrixCell } from "@/lib/ml/types";
import { Badge, Card, Progress } from "@/components/ui";

const W = 640;
const H = 320;

export function SemanticIntelligenceExplorer({ explorer }: { explorer?: SemanticExplorerResult }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [hoveredId, setHoveredId] = useState<string>("");
  const [selectedCell, setSelectedCell] = useState<SemanticMatrixCell | null>(null);
  const [showCandidate, setShowCandidate] = useState(true);
  const [showJob, setShowJob] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const candidateComponents = explorer?.candidateComponents ?? [];
  const jobComponents = explorer?.jobComponents ?? [];
  const visibleCandidates = showCandidate ? candidateComponents : [];
  const visibleJobs = showJob ? jobComponents : [];
  const selected = [...candidateComponents, ...jobComponents].find((item) => item.id === selectedId) ?? null;
  const hovered = [...candidateComponents, ...jobComponents].find((item) => item.id === hoveredId) ?? null;

  const selectedMatrix = useMemo(() => {
    if (!selectedId) return selectedCell;
    return explorer?.matrix.find((cell) => cell.candidateId === selectedId || cell.jobId === selectedId) ?? selectedCell;
  }, [explorer?.matrix, selectedCell, selectedId]);

  if (!explorer || !explorer.projectionAvailable || !explorer.candidateVector?.length || !explorer.jobVector?.length) {
    return (
      <Card className="p-5">
        <div className="text-sm font-bold text-ink">Semantic Intelligence Explorer</div>
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Semantic projection unavailable — embeddings were not generated.
        </div>
      </Card>
    );
  }

  const point = (component: SemanticComponent) => ({
    x: W / 2 + component.projected.x * 230,
    y: H / 2 - component.projected.y * 190,
  });

  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStart) return;
    setPan({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  };
  const onPointerUp = () => setDragStart(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Search size={16} className="text-brand-600" />
            Semantic Intelligence Explorer
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {explorer.projectionNote} Cosine is computed from the original {explorer.vectorDimensions}-dimensional vectors.
          </div>
        </div>
        <div className="rounded-xl bg-brand-600 px-3 py-2 text-right text-white">
          <div className="text-[10px] uppercase tracking-wide text-brand-100">Cosine similarity</div>
          <div className="text-xl font-bold">{explorer.cosineSimilarity.toFixed(3)}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden border-brand-100 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={showCandidate} onChange={(e) => setShowCandidate(e.target.checked)} /> Candidate components</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={showJob} onChange={(e) => setShowJob(e.target.checked)} /> Job components</label>
            </div>
            <div className="flex items-center gap-1">
              <button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.7, value - 0.15))} className="rounded-lg p-1.5 text-brand-700 hover:bg-brand-50"><Minus size={14} /></button>
              <span className="w-10 text-center text-[11px] text-slate-500">{Math.round(zoom * 100)}%</span>
              <button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2.5, value + 0.15))} className="rounded-lg p-1.5 text-brand-700 hover:bg-brand-50"><Plus size={14} /></button>
              <button aria-label="Reset view" onClick={reset} className="rounded-lg p-1.5 text-brand-700 hover:bg-brand-50"><RotateCcw size={14} /></button>
            </div>
          </div>
          <div className="grid-bg overflow-hidden rounded-xl border border-brand-100 bg-white">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto min-h-[270px] w-full cursor-grab touch-none active:cursor-grabbing"
              onWheel={(event) => {
                event.preventDefault();
                setZoom((value) => Math.max(0.7, Math.min(2.5, value + (event.deltaY > 0 ? -0.08 : 0.08))));
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <g transform={`translate(${pan.x} ${pan.y}) translate(${W / 2} ${H / 2}) scale(${zoom}) translate(${-W / 2} ${-H / 2})`}>
                <line x1={W / 2} y1={12} x2={W / 2} y2={H - 12} stroke="#eee9ff" strokeWidth="1" />
                <line x1={12} y1={H / 2} x2={W - 12} y2={H / 2} stroke="#eee9ff" strokeWidth="1" />
                {visibleCandidates.map((component) => <ExplorerPoint key={component.id} component={component} point={point(component)} selected={selectedId === component.id} hovered={hoveredId === component.id} onSelect={() => setSelectedId(component.id)} onHover={() => setHoveredId(component.id)} onLeave={() => setHoveredId("")} />)}
                {visibleJobs.map((component) => <ExplorerPoint key={component.id} component={component} point={point(component)} selected={selectedId === component.id} hovered={hoveredId === component.id} onSelect={() => setSelectedId(component.id)} onHover={() => setHoveredId(component.id)} onLeave={() => setHoveredId("")} />)}
              </g>
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-brand-700" /> Candidate</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-brand-300 ring-2 ring-brand-100" /> Job</span>
            <span className="text-slate-400">Drag to pan · scroll to zoom · points use PCA coordinates</span>
          </div>
        </Card>

        <ComponentDetails component={selected ?? hovered} technicalOpen={technicalOpen} onTechnical={() => setTechnicalOpen((value) => !value)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <SimilarityMatrix explorer={explorer} onSelect={setSelectedCell} selectedCell={selectedMatrix} />
        <RelationshipPanel explorer={explorer} selected={selected} selectedCell={selectedMatrix} />
      </div>

      <div className="grid gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-brand-700">Semantic layer</div>
          <div className="mt-1 text-sm font-semibold text-ink">How conceptually similar are the representations?</div>
          <div className="mt-1 text-xs text-slate-600">Cosine similarity: <b>{explorer.cosineSimilarity.toFixed(3)}</b> — not a qualification percentage.</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-brand-700">Deterministic requirement layer</div>
          <div className="mt-1 text-sm font-semibold text-ink">Does the candidate explicitly satisfy the requirement?</div>
          <div className="mt-1 text-xs text-slate-600">Requirement status is evidence-checked separately in the Skill Gaps tab.</div>
        </div>
      </div>
    </div>
  );
}

function ExplorerPoint({ component, point, selected, hovered, onSelect, onHover, onLeave }: { component: SemanticComponent; point: { x: number; y: number }; selected: boolean; hovered: boolean; onSelect: () => void; onHover: () => void; onLeave: () => void }) {
  const isCandidate = component.type === "candidate";
  const fill = isCandidate ? "#6d28d9" : component.tier === "REQUIRED" ? "#a583f7" : "#ddd3ff";
  const radius = selected || hovered ? 9 : component.category === "profile" ? 7 : 6;
  return (
    <g onClick={(event) => { event.stopPropagation(); onSelect(); }} onMouseEnter={onHover} onMouseLeave={onLeave} className="cursor-pointer">
      {(selected || hovered) && <circle cx={point.x} cy={point.y} r={radius + 7} fill="none" stroke="#c2b0fb" strokeWidth="1.5" strokeDasharray="3 3" />}
      <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={point.x} cy={point.y} r={radius} fill={fill} stroke="white" strokeWidth="2" />
      <text x={point.x + 11} y={point.y + 3} fontSize="10" fill={isCandidate ? "#5b21b6" : "#6d28d9"}>{component.label.length > 24 ? `${component.label.slice(0, 24)}…` : component.label}</text>
    </g>
  );
}

function ComponentDetails({ component, technicalOpen, onTechnical }: { component: SemanticComponent | null; technicalOpen: boolean; onTechnical: () => void }) {
  if (!component) return <Card className="grid min-h-[250px] place-items-center p-5 text-center"><div><SlidersHorizontal className="mx-auto text-brand-300" size={24} /><div className="mt-2 text-sm font-semibold text-ink">Select a point</div><div className="mt-1 text-xs text-slate-500">Click a candidate component or job concept to inspect provenance.</div></div></Card>;
  return <Card className="min-h-[250px] p-4">
    <div className="flex items-start justify-between gap-2"><div><div className="text-xs font-bold uppercase tracking-wide text-brand-600">{component.type} component</div><div className="mt-1 text-lg font-bold text-ink">{component.label}</div></div><Badge tone={component.tier === "REQUIRED" ? "purple" : "brand"}>{component.category}</Badge></div>
    <div className="mt-4 space-y-2 text-xs"><DetailRow label="Source section" value={component.sourceSection} /><DetailRow label="Source text" value={component.sourceText || "No source text in verified profile."} /><DetailRow label="Embedding model" value="ReqCore hashed TF word/bigram + character-trigram" /><DetailRow label="Vector dimensionality" value={`${component.vector.length} dimensions`} /><DetailRow label="Closest concepts" value={component.closestConcepts.join(" · ") || "None"} /></div>
    <button onClick={onTechnical} className="mt-3 text-xs font-semibold text-brand-700 hover:text-brand-900">{technicalOpen ? "Hide" : "Show"} technical vector metadata</button>
    {technicalOpen && <div className="mt-2 rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-500">PCA x: {component.projected.x.toFixed(5)} · PCA y: {component.projected.y.toFixed(5)}<br />Vector preview: [{component.vector.slice(0, 8).map((value) => value.toFixed(4)).join(", ")} …]</div>}
  </Card>;
}

function DetailRow({ label, value }: { label: string; value: string }) { return <div><div className="font-bold uppercase tracking-wide text-brand-500">{label}</div><div className="mt-0.5 max-h-16 overflow-auto text-slate-700">{value}</div></div>; }

function SimilarityMatrix({ explorer, onSelect, selectedCell }: { explorer: SemanticExplorerResult; onSelect: (cell: SemanticMatrixCell) => void; selectedCell: SemanticMatrixCell | null }) {
  return <Card className="overflow-hidden p-4"><div className="flex items-center justify-between gap-2"><div><div className="text-sm font-bold text-ink">Semantic Similarity Matrix</div><div className="text-[11px] text-slate-500">Actual cosine values between candidate components and job concepts.</div></div><Badge tone="neutral">{explorer.matrix.length} cells</Badge></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] border-separate border-spacing-1 text-[10px]"><thead><tr><th className="p-2 text-left text-slate-400">Candidate \ Job</th>{explorer.jobComponents.map((job) => <th key={job.id} className="max-w-24 p-2 text-left font-semibold text-brand-700">{job.label}</th>)}</tr></thead><tbody>{explorer.candidateComponents.map((candidate) => <tr key={candidate.id}><th className="max-w-32 p-2 text-left font-semibold text-ink">{candidate.label}</th>{explorer.jobComponents.map((job) => { const cell = explorer.matrix.find((item) => item.candidateId === candidate.id && item.jobId === job.id); if (!cell) return <td key={job.id} />; const hot = cell.similarity >= 0.65; const active = selectedCell?.candidateId === cell.candidateId && selectedCell?.jobId === cell.jobId; return <td key={job.id}><button onClick={() => onSelect(cell)} title={`${cell.evidence} · ${cell.similarity.toFixed(3)}`} className={`w-full rounded-md border p-2 text-left transition-colors ${active ? "border-brand-600 ring-2 ring-brand-200" : "border-transparent"} ${hot ? "bg-brand-200 text-brand-900" : "bg-brand-50 text-slate-600"}`}><b>{cell.similarity.toFixed(3)}</b>{cell.requirementStatus && <span className="mt-0.5 block text-[9px]">{cell.requirementStatus}</span>}</button></td>; })}</tr>)}</tbody></table></div></Card>;
}

function RelationshipPanel({ explorer, selected, selectedCell }: { explorer: SemanticExplorerResult; selected: SemanticComponent | null; selectedCell: SemanticMatrixCell | null }) {
  const cell = selectedCell ?? (selected ? explorer.matrix.find((item) => item.candidateId === selected.id || item.jobId === selected.id) : undefined);
  const candidate = cell ? explorer.candidateComponents.find((item) => item.id === cell.candidateId) : null;
  const job = cell ? explorer.jobComponents.find((item) => item.id === cell.jobId) : null;
  return <Card className="p-4"><div className="text-sm font-bold text-ink">Semantic Relationship</div><div className="mt-1 text-[11px] text-slate-500">Similarity is descriptive; requirement satisfaction remains evidence-checked.</div>{candidate && job && cell ? <div className="mt-4 space-y-3"><div className="rounded-xl bg-brand-50 p-3"><div className="text-[10px] font-bold uppercase text-brand-500">Candidate component</div><div className="font-bold text-ink">{candidate.label}</div><div className="mt-1 text-xs text-slate-600">{candidate.sourceText}</div></div><div className="text-center text-brand-400">↓</div><div className="rounded-xl bg-brand-50 p-3"><div className="text-[10px] font-bold uppercase text-brand-500">Job component</div><div className="font-bold text-ink">{job.label}</div><div className="mt-1 text-xs text-slate-600">{job.sourceText}</div></div><div className="rounded-xl border border-brand-200 p-3"><div className="flex justify-between text-xs"><span>Cosine similarity</span><b className="text-brand-700">{cell.similarity.toFixed(3)}</b></div><Progress value={Math.max(0, Math.min(100, cell.similarity * 100))} /><div className="mt-2 text-xs text-slate-600"><b>Evidence:</b> {cell.evidence}</div>{cell.requirementStatus && <div className="mt-1 text-xs font-semibold text-brand-800"><b>Requirement status:</b> {cell.requirementStatus}</div>}</div></div> : <div className="grid min-h-[240px] place-items-center text-center"><div className="text-xs text-slate-500">Select a matrix cell to compare a candidate component with a job component.</div></div>}</Card>;
}
