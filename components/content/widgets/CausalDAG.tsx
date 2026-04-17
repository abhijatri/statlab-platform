'use client'

import { useState, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DNode { id: string; label: string; x: number; y: number }
interface DEdge { id: string; from: string; to: string }
type Mode = 'add' | 'connect' | 'delete' | 'query'

// ── d-separation ──────────────────────────────────────────────────────────────

function getDescendants(nodeId: string, edges: DEdge[]): Set<string> {
  const desc = new Set<string>()
  const queue = [nodeId]
  while (queue.length > 0) {
    const cur = queue.pop()!
    for (const e of edges) {
      if (e.from === cur && !desc.has(e.to)) {
        desc.add(e.to)
        queue.push(e.to)
      }
    }
  }
  return desc
}

function findAllPaths(X: string, Y: string, nodes: DNode[], edges: DEdge[]): string[][] {
  // Build undirected adjacency
  const adj = new Map<string, string[]>(nodes.map(n => [n.id, []]))
  for (const e of edges) {
    adj.get(e.from)?.push(e.to)
    adj.get(e.to)?.push(e.from)
  }

  const paths: string[][] = []
  function dfs(cur: string, visited: Set<string>, path: string[]) {
    if (cur === Y) { paths.push([...path]); return }
    for (const next of (adj.get(cur) ?? [])) {
      if (!visited.has(next)) {
        visited.add(next)
        path.push(next)
        dfs(next, visited, path)
        path.pop()
        visited.delete(next)
      }
    }
  }
  const visited = new Set([X])
  dfs(X, visited, [X])
  return paths
}

function isPathBlocked(path: string[], Z: Set<string>, edges: DEdge[], descMap: Map<string, Set<string>>): boolean {
  for (let i = 1; i < path.length - 1; i++) {
    const A = path[i - 1], M = path[i], B = path[i + 1]
    const AtoM = edges.some(e => e.from === A && e.to === M)
    const BtoM = edges.some(e => e.from === B && e.to === M)
    const isCollider = AtoM && BtoM

    if (isCollider) {
      // Collider M blocks the path UNLESS M or a descendant of M is in Z
      const mOrDescInZ = Z.has(M) || [...(descMap.get(M) ?? [])].some(d => Z.has(d))
      if (!mOrDescInZ) return true
    } else {
      // Non-collider: blocks the path if M ∈ Z
      if (Z.has(M)) return true
    }
  }
  return false
}

interface DSepResult {
  dseparated: boolean
  paths: { path: string[]; blocked: boolean }[]
}

function computeDSep(X: string, Y: string, Z: string[], nodes: DNode[], edges: DEdge[]): DSepResult {
  const Zset = new Set(Z)
  const descMap = new Map(nodes.map(n => [n.id, getDescendants(n.id, edges)]))
  const paths = findAllPaths(X, Y, nodes, edges)

  if (paths.length === 0) return { dseparated: true, paths: [] }

  const annotated = paths.map(path => ({
    path,
    blocked: isPathBlocked(path, Zset, edges, descMap),
  }))

  return {
    dseparated: annotated.every(p => p.blocked),
    paths: annotated,
  }
}

// ── Graph structure identification ────────────────────────────────────────────

interface StructureInfo {
  forks: string[]     // "A ← M → B"
  chains: string[]    // "A → M → B"
  colliders: string[] // "A → M ← B"
}

function identifyStructures(nodes: DNode[], edges: DEdge[]): StructureInfo {
  const forks: string[] = [], chains: string[] = [], colliders: string[] = []

  for (const M of nodes) {
    const parents  = edges.filter(e => e.to   === M.id).map(e => e.from)
    const children = edges.filter(e => e.from === M.id).map(e => e.to)

    // Forks: two or more children, M has a parent
    for (let i = 0; i < children.length; i++)
      for (let j = i + 1; j < children.length; j++)
        forks.push(`${children[i]} ← ${M.label} → ${children[j]}`)

    // Chains: M has at least one parent and one child
    for (const p of parents)
      for (const c of children)
        chains.push(`${p} → ${M.label} → ${c}`)

    // Colliders: two or more parents
    for (let i = 0; i < parents.length; i++)
      for (let j = i + 1; j < parents.length; j++)
        colliders.push(`${parents[i]} → ${M.label} ← ${parents[j]}`)
  }

  return { forks, chains, colliders }
}

// ── Preset examples ───────────────────────────────────────────────────────────

const PRESETS: { label: string; nodes: DNode[]; edges: DEdge[] }[] = [
  {
    label: 'Fork',
    nodes: [
      { id:'Z', label:'Z', x:260, y:80  },
      { id:'X', label:'X', x:130, y:200 },
      { id:'Y', label:'Y', x:390, y:200 },
    ],
    edges: [
      { id:'ZX', from:'Z', to:'X' },
      { id:'ZY', from:'Z', to:'Y' },
    ],
  },
  {
    label: 'Chain',
    nodes: [
      { id:'X', label:'X', x:100, y:150 },
      { id:'Z', label:'Z', x:260, y:150 },
      { id:'Y', label:'Y', x:420, y:150 },
    ],
    edges: [
      { id:'XZ', from:'X', to:'Z' },
      { id:'ZY', from:'Z', to:'Y' },
    ],
  },
  {
    label: 'Collider',
    nodes: [
      { id:'X', label:'X', x:130, y:100 },
      { id:'Y', label:'Y', x:390, y:100 },
      { id:'Z', label:'Z', x:260, y:200 },
    ],
    edges: [
      { id:'XZ', from:'X', to:'Z' },
      { id:'YZ', from:'Y', to:'Z' },
    ],
  },
  {
    label: 'Complex',
    nodes: [
      { id:'A', label:'A', x:100, y:80  },
      { id:'B', label:'B', x:420, y:80  },
      { id:'C', label:'C', x:260, y:160 },
      { id:'D', label:'D', x:100, y:240 },
      { id:'E', label:'E', x:420, y:240 },
    ],
    edges: [
      { id:'AC', from:'A', to:'C' },
      { id:'BC', from:'B', to:'C' },
      { id:'CD', from:'C', to:'D' },
      { id:'CE', from:'C', to:'E' },
      { id:'AE', from:'A', to:'E' },
    ],
  },
]

// ── SVG constants ─────────────────────────────────────────────────────────────

const CANVAS_W = 520, CANVAS_H = 300
const NODE_R = 22

function edgeLine(from: DNode, to: DNode) {
  const dx = to.x - from.x, dy = to.y - from.y
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < 1) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
  const ux = dx / d, uy = dy / d
  return {
    x1: from.x + ux * NODE_R,
    y1: from.y + uy * NODE_R,
    x2: to.x - ux * (NODE_R + 10),
    y2: to.y - uy * (NODE_R + 10),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const LABEL_SEQ = 'ABCDEFGH'.split('')

export function CausalDAG() {
  const [nodes,       setNodes]       = useState<DNode[]>(PRESETS[0].nodes)
  const [edges,       setEdges]       = useState<DEdge[]>(PRESETS[0].edges)
  const [mode,        setMode]        = useState<Mode>('query')
  const [edgeSrc,     setEdgeSrc]     = useState<string | null>(null)
  const [queryX,      setQueryX]      = useState<string | null>('X')
  const [queryY,      setQueryY]      = useState<string | null>('Y')
  const [queryZ,      setQueryZ]      = useState<string[]>([])
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null)

  const dsepResult = queryX && queryY && queryX !== queryY
    ? computeDSep(queryX, queryY, queryZ, nodes, edges)
    : null
  const structures = identifyStructures(nodes, edges)

  // Highlight: edges on open paths
  const openPathEdges = new Set<string>()
  if (dsepResult) {
    for (const { path, blocked } of dsepResult.paths) {
      if (!blocked) {
        for (let i = 0; i < path.length - 1; i++) {
          // Find edge between path[i] and path[i+1] (either direction)
          for (const e of edges) {
            if ((e.from===path[i]&&e.to===path[i+1]) || (e.from===path[i+1]&&e.to===path[i]))
              openPathEdges.add(e.id)
          }
        }
      }
    }
  }

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement
    const nodeId = target.closest('[data-nodeid]')?.getAttribute('data-nodeid')

    if (nodeId) {
      if (mode === 'delete') {
        setNodes(prev => prev.filter(n => n.id !== nodeId))
        setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId))
        if (queryX === nodeId) setQueryX(null)
        if (queryY === nodeId) setQueryY(null)
        setQueryZ(prev => prev.filter(z => z !== nodeId))
        return
      }
      if (mode === 'connect') {
        if (!edgeSrc) {
          setEdgeSrc(nodeId)
        } else if (edgeSrc !== nodeId) {
          const id = `${edgeSrc}->${nodeId}`
          const exists = edges.some(e => e.from===edgeSrc&&e.to===nodeId)
          if (!exists) setEdges(prev => [...prev, { id, from: edgeSrc, to: nodeId }])
          setEdgeSrc(null)
        } else {
          setEdgeSrc(null)
        }
        return
      }
      if (mode === 'query') {
        if (!queryX || (queryX && queryY)) {
          // Start fresh query
          setQueryX(nodeId); setQueryY(null); setQueryZ([])
        } else if (!queryY && nodeId !== queryX) {
          setQueryY(nodeId)
        } else if (nodeId !== queryX && nodeId !== queryY) {
          setQueryZ(prev =>
            prev.includes(nodeId) ? prev.filter(z => z !== nodeId) : [...prev, nodeId]
          )
        } else if (nodeId === queryX) {
          setQueryX(null); setQueryY(null); setQueryZ([])
        } else if (nodeId === queryY) {
          setQueryY(null)
        }
        return
      }
      // Start drag (any mode)
      const svgRect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
      const node = nodes.find(n => n.id === nodeId)!
      dragRef.current = { id: nodeId, ox: e.clientX - svgRect.left - node.x, oy: e.clientY - svgRect.top - node.y }
      return
    }

    // Click on background
    if (mode === 'add') {
      const svgRect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
      const x = e.clientX - svgRect.left
      const y = e.clientY - svgRect.top
      const usedLabels = new Set(nodes.map(n => n.label))
      const label = LABEL_SEQ.find(l => !usedLabels.has(l)) ?? `N${nodes.length}`
      if (nodes.length >= 8) return
      setNodes(prev => [...prev, { id: label, label, x, y }])
    }
    if (mode === 'connect') setEdgeSrc(null)
  }, [mode, edgeSrc, edges, nodes, queryX, queryY])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    const svgRect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const x = Math.max(NODE_R, Math.min(CANVAS_W - NODE_R, e.clientX - svgRect.left - dragRef.current.ox))
    const y = Math.max(NODE_R, Math.min(CANVAS_H - NODE_R, e.clientY - svgRect.top - dragRef.current.oy))
    setNodes(prev => prev.map(n => n.id === dragRef.current!.id ? { ...n, x, y } : n))
  }, [])

  const handleMouseUp = useCallback(() => { dragRef.current = null }, [])

  const loadPreset = (p: typeof PRESETS[0]) => {
    setNodes(p.nodes); setEdges(p.edges)
    setQueryX(null); setQueryY(null); setQueryZ([]); setEdgeSrc(null)
  }

  const MODES: { id: Mode; label: string }[] = [
    { id:'add',     label:'+ Node' },
    { id:'connect', label:'→ Edge' },
    { id:'delete',  label:'✕ Delete' },
    { id:'query',   label:'⊥ Query' },
  ]

  const nodeColor = (n: DNode) => {
    if (n.id === queryX) return '#4E79A7'
    if (n.id === queryY) return '#E15759'
    if (queryZ.includes(n.id)) return '#F28E2B'
    if (n.id === edgeSrc) return '#59A14F'
    return '#888'
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, userSelect: 'none' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap', alignItems:'center' }}>
        {MODES.map(m=>(
          <button key={m.id} onClick={()=>{setMode(m.id);setEdgeSrc(null)}} style={{
            padding:'3px 10px', borderRadius:4, border:'none', cursor:'pointer',
            background: mode===m.id ? '#444' : '#ddd',
            color: mode===m.id ? '#fff' : '#444', fontSize:12,
          }}>{m.label}</button>
        ))}
        <span style={{color:'#ccc'}}>|</span>
        {PRESETS.map(p=>(
          <button key={p.label} onClick={()=>loadPreset(p)} style={{
            padding:'3px 10px', borderRadius:4, border:'1px solid #ccc',
            background:'transparent', color:'#666', cursor:'pointer', fontSize:11,
          }}>{p.label}</button>
        ))}
        <button onClick={()=>{setNodes([]);setEdges([]);setQueryX(null);setQueryY(null);setQueryZ([])}} style={{
          padding:'3px 10px', borderRadius:4, border:'1px solid #ccc',
          background:'transparent', color:'#999', cursor:'pointer', fontSize:11,
        }}>Clear</button>
      </div>

      {/* Canvas */}
      <svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ display:'block', background:'#fafafa', borderRadius:6, border:'1px solid #e0e0e0', cursor: mode==='add'?'crosshair':'default' }}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker id="dag-arrow-normal" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
            <polygon points="0 0,8 3.5,0 7" fill="#aaa" />
          </marker>
          <marker id="dag-arrow-open" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
            <polygon points="0 0,8 3.5,0 7" fill="#59A14F" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map(e => {
          const from = nodes.find(n=>n.id===e.from), to = nodes.find(n=>n.id===e.to)
          if (!from||!to) return null
          const { x1,y1,x2,y2 } = edgeLine(from, to)
          const open = openPathEdges.has(e.id)
          return (
            <line key={e.id} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={open ? '#59A14F' : '#ccc'} strokeWidth={open ? 2.5 : 1.8}
              markerEnd={`url(#dag-arrow-${open?'open':'normal'})`}
              style={{ cursor: mode==='delete'?'pointer':'default' }}
            />
          )
        })}

        {/* Pending edge line while connecting */}

        {/* Nodes */}
        {nodes.map(n => {
          const col = nodeColor(n)
          const isZ = queryZ.includes(n.id)
          return (
            <g key={n.id} data-nodeid={n.id} style={{ cursor: 'pointer' }}>
              {isZ && <rect x={n.x-NODE_R-3} y={n.y-NODE_R-3} width={(NODE_R+3)*2} height={(NODE_R+3)*2}
                rx={4} fill="none" stroke="#F28E2B" strokeWidth={2} strokeDasharray="4,2" />}
              <circle cx={n.x} cy={n.y} r={NODE_R}
                fill={col} opacity={0.85}
                stroke={col} strokeWidth={1.5}
              />
              <text x={n.x} y={n.y+5} textAnchor="middle" fill="#fff" fontSize={14} fontWeight={600}>
                {n.label}
              </text>
            </g>
          )
        })}

        {/* Empty state */}
        {nodes.length === 0 && (
          <text x={CANVAS_W/2} y={CANVAS_H/2} textAnchor="middle" fill="#bbb" fontSize={13}>
            Load a preset or use &quot;+Node&quot; to build a DAG
          </text>
        )}
      </svg>

      {/* Query legend */}
      <div style={{ display:'flex', gap:16, marginTop:8, fontSize:11, flexWrap:'wrap' }}>
        <span><span style={{color:'#4E79A7',fontWeight:600}}>Blue = X</span> (source)</span>
        <span><span style={{color:'#E15759',fontWeight:600}}>Red = Y</span> (target)</span>
        <span><span style={{color:'#F28E2B',fontWeight:600}}>Orange = Z</span> (conditioned)</span>
        <span style={{color:'#888'}}>Query mode: click X → Y → toggle Z nodes</span>
      </div>

      {/* d-sep result */}
      {dsepResult && queryX && queryY && (
        <div style={{ marginTop:10, padding:'10px 14px', borderRadius:6,
          background: dsepResult.dseparated ? '#f0f8f0' : '#fdf0f0',
          border: `1.5px solid ${dsepResult.dseparated ? '#59A14F' : '#E15759'}`,
          fontSize:12, lineHeight:1.6 }}>
          <strong style={{color: dsepResult.dseparated ? '#59A14F' : '#E15759', fontSize:14}}>
            {queryX} {dsepResult.dseparated ? '⊥' : '¬⊥'} {queryY}
            {queryZ.length > 0 ? ` | {${queryZ.join(',')}}` : ''}
          </strong>
          <div style={{color:'#555', marginTop:4}}>
            {dsepResult.dseparated
              ? `All ${dsepResult.paths.length} path(s) are blocked — d-separated (conditionally independent).`
              : `${dsepResult.paths.filter(p=>!p.blocked).length} open path(s) of ${dsepResult.paths.length} — d-connected (not independent).`
            }
          </div>
          {dsepResult.paths.length <= 8 && (
            <div style={{marginTop:6}}>
              {dsepResult.paths.map((p,i)=>(
                <div key={i} style={{color: p.blocked ? '#aaa' : '#59A14F', fontSize:11}}>
                  {p.blocked ? '✗' : '✓'} {p.path.join(' — ')} {p.blocked ? '(blocked)' : '(open)'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Structure panel */}
      {(structures.forks.length + structures.chains.length + structures.colliders.length > 0) && (
        <div style={{ marginTop:10, display:'flex', gap:12, flexWrap:'wrap', fontSize:11 }}>
          {structures.colliders.length > 0 && (
            <div style={{ background:'#fff3e0', borderRadius:4, padding:'6px 10px', border:'1px solid #ffcc80' }}>
              <div style={{fontWeight:600, color:'#E65100', marginBottom:3}}>Colliders (→M←)</div>
              {structures.colliders.slice(0,4).map((s,i)=><div key={i} style={{color:'#bf360c'}}>{s}</div>)}
            </div>
          )}
          {structures.forks.length > 0 && (
            <div style={{ background:'#e8f5e9', borderRadius:4, padding:'6px 10px', border:'1px solid #a5d6a7' }}>
              <div style={{fontWeight:600, color:'#2e7d32', marginBottom:3}}>Forks (←M→)</div>
              {structures.forks.slice(0,4).map((s,i)=><div key={i} style={{color:'#1b5e20'}}>{s}</div>)}
            </div>
          )}
          {structures.chains.length > 0 && (
            <div style={{ background:'#e3f2fd', borderRadius:4, padding:'6px 10px', border:'1px solid #90caf9' }}>
              <div style={{fontWeight:600, color:'#1565c0', marginBottom:3}}>Chains (→M→)</div>
              {structures.chains.slice(0,4).map((s,i)=><div key={i} style={{color:'#0d47a1'}}>{s}</div>)}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop:10, background:'#f5f5f5', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#444', lineHeight:1.6 }}>
        <strong>d-separation:</strong> X ⊥ Y | Z iff every path is blocked. Non-collider on path M is blocked by conditioning on M. Collider M is activated (unblocked) by conditioning on M or any descendant.
        Fork X←Z→Y: X,Y d-connected; blocked by Z. Collider X→Z←Y: X,Y d-sep; activated by conditioning on Z.
      </div>
    </div>
  )
}
