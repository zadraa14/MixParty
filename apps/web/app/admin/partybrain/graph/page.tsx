"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, Network, RefreshCw, Search, Sparkles } from "lucide-react";
import { getApiBaseUrl } from "../../../../lib/config";

type GraphNode = { id: string; label: string; songs: number; searches: number; weight: number };
type GraphEdge = { fromKey: string; toKey: string; fromName: string; toName: string; count: number };
type GraphData = { nodes: GraphNode[]; edges: GraphEdge[]; updatedAt: number };

const width = 1120;
const height = 700;
const center = { x: width / 2, y: height / 2 };

export default function PartyBrainGraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/graph`, { cache: "no-store" });
      const json = await response.json();
      setData(json);
      if (!selected && json.nodes?.length) setSelected(json.nodes[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    const query = filter.trim().toLowerCase();
    const selectedEdges = selected ? data.edges.filter((edge) => edge.fromKey === selected || edge.toKey === selected) : data.edges;
    const neighborIds = new Set<string>(selected ? [selected] : []);
    selectedEdges.forEach((edge) => { neighborIds.add(edge.fromKey); neighborIds.add(edge.toKey); });
    let nodes = selected ? data.nodes.filter((node) => neighborIds.has(node.id)) : data.nodes.slice(0, 24);
    if (query) nodes = data.nodes.filter((node) => node.label.toLowerCase().includes(query)).slice(0, 24);
    const ids = new Set(nodes.map((node) => node.id));
    const edges = data.edges.filter((edge) => ids.has(edge.fromKey) && ids.has(edge.toKey));
    return { nodes, edges };
  }, [data, selected, filter]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const nodes = visible.nodes;
    if (!nodes.length) return map;
    const selectedNode = nodes.find((node) => node.id === selected) || nodes[0];
    map.set(selectedNode.id, center);
    const others = nodes.filter((node) => node.id !== selectedNode.id);
    others.forEach((node, index) => {
      const ring = index < 10 ? 1 : 2;
      const ringIndex = ring === 1 ? index : index - 10;
      const ringCount = ring === 1 ? Math.min(10, others.length) : Math.max(1, others.length - 10);
      const angle = (Math.PI * 2 * ringIndex) / ringCount - Math.PI / 2;
      const radius = ring === 1 ? 220 : 315;
      map.set(node.id, { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
    });
    return map;
  }, [visible.nodes, selected]);

  const selectedNode = data?.nodes.find((node) => node.id === selected);
  const selectedLinks = data?.edges.filter((edge) => edge.fromKey === selected || edge.toKey === selected) || [];

  return (
    <main className="min-h-screen bg-[#05030c] px-4 py-6 text-white sm:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-fuchsia-600/15 blur-[130px]" />
        <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-[140px]" />
      </div>
      <section className="relative mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/musicbrain" className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/10 hover:bg-white/15"><ArrowLeft /></Link>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-600 to-cyan-500 shadow-[0_0_35px_rgba(168,85,247,.35)]"><Network /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.28em] text-fuchsia-300">PartyBrain V2</p>
              <h1 className="text-3xl font-black">Constellation musicale</h1>
              <p className="text-sm text-white/50">Les artistes et collaborations réellement appris par MixParty.</p>
            </div>
          </div>
          <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black hover:bg-white/15"><RefreshCw className={loading ? "animate-spin" : ""} size={17}/>Actualiser</button>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
          <section className="overflow-hidden rounded-[30px] border border-fuchsia-400/15 bg-gradient-to-br from-[#10071d] via-[#070611] to-[#04131c] shadow-[0_0_80px_rgba(124,58,237,.12)]">
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-black uppercase tracking-[.22em] text-cyan-300">Graphe vivant</p><p className="text-sm text-white/50">Clique sur un artiste pour explorer son univers.</p></div>
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2"><Search size={16} className="text-white/40"/><input value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder="Chercher un artiste…" className="w-56 bg-transparent text-sm outline-none placeholder:text-white/30"/></label>
            </div>
            <div className="overflow-auto">
              <svg viewBox={`0 0 ${width} ${height}`} className="min-h-[620px] min-w-[900px] w-full">
                <defs>
                  <filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  <linearGradient id="nodeGradient" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d946ef"/><stop offset=".55" stopColor="#7c3aed"/><stop offset="1" stopColor="#22d3ee"/></linearGradient>
                </defs>
                {visible.edges.map((edge) => {
                  const a=positions.get(edge.fromKey), b=positions.get(edge.toKey); if(!a||!b) return null;
                  return <g key={`${edge.fromKey}-${edge.toKey}`}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(217,70,239,.34)" strokeWidth={Math.min(8,1+edge.count)} /><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-6} fill="rgba(255,255,255,.6)" fontSize="13" textAnchor="middle">{edge.count}×</text></g>
                })}
                {visible.nodes.map((node) => {
                  const pos=positions.get(node.id); if(!pos) return null; const active=node.id===selected; const radius=active?58:Math.max(32,Math.min(48,28+node.weight));
                  return <g key={node.id} onClick={()=>{setSelected(node.id);setFilter("")}} className="cursor-pointer" filter={active?"url(#glow)":undefined}>
                    <circle cx={pos.x} cy={pos.y} r={radius+8} fill={active?"rgba(217,70,239,.20)":"rgba(255,255,255,.03)"} stroke={active?"#f0abfc":"rgba(255,255,255,.16)"}/>
                    <circle cx={pos.x} cy={pos.y} r={radius} fill="url(#nodeGradient)" opacity={active?1:.72}/>
                    <text x={pos.x} y={pos.y-2} fill="white" fontSize={active?17:13} fontWeight="900" textAnchor="middle">{node.label.length>18?`${node.label.slice(0,16)}…`:node.label}</text>
                    <text x={pos.x} y={pos.y+18} fill="rgba(255,255,255,.7)" fontSize="11" textAnchor="middle">{node.songs} morceaux</text>
                  </g>
                })}
              </svg>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl">
              <BrainCircuit className="mb-4 text-fuchsia-300"/>
              <p className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-300">Artiste sélectionné</p>
              <h2 className="mt-2 text-2xl font-black">{selectedNode?.label || "Aucun artiste"}</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 text-center"><div className="rounded-2xl bg-black/25 p-3"><p className="text-2xl font-black">{selectedNode?.songs || 0}</p><p className="text-xs text-white/45">Morceaux</p></div><div className="rounded-2xl bg-black/25 p-3"><p className="text-2xl font-black">{selectedNode?.searches || 0}</p><p className="text-xs text-white/45">Recherches</p></div></div>
            </section>
            <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2"><Sparkles className="text-cyan-300" size={19}/><h3 className="font-black">Relations apprises</h3></div>
              <div className="mt-4 space-y-2">{selectedLinks.slice(0,12).map((edge)=>{const other=edge.fromKey===selected?edge.toName:edge.fromName;return <button key={`${edge.fromKey}-${edge.toKey}`} onClick={()=>setSelected(edge.fromKey===selected?edge.toKey:edge.fromKey)} className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-left hover:bg-white/10"><span className="font-bold">{other}</span><span className="rounded-full bg-fuchsia-500/15 px-2 py-1 text-xs font-black text-fuchsia-200">{edge.count} lien{edge.count>1?"s":""}</span></button>})}{!selectedLinks.length&&<p className="text-sm text-white/45">Les collaborations apparaîtront après de nouvelles recherches.</p>}</div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
