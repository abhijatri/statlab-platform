'use client'

import { useState, useMemo } from 'react'

// ── Math ───────────────────────────────────────────────────────────────────────

function lgamma(z: number): number {
  const c=[76.18009172947146,-86.50532032941677,24.01409824083091,
    -1.231739572450155,1.208650973866179e-3,-5.395239384953e-6]
  let y = z
  const tmp = z+5.5
  const ser = c.reduce((s,ci,i)=>s+ci/(y+i+1), 1.000000000190015)
  return Math.log(2.5066282746310005)+Math.log(ser)-tmp+(z+0.5)*Math.log(tmp)
}
function lbeta(a:number,b:number){return lgamma(a)+lgamma(b)-lgamma(a+b)}
function erf(x:number){
  const t=1/(1+0.3275911*Math.abs(x))
  const p=t*(0.254829592+t*(-0.284496736+t*(1.421413741+t*(-1.453152027+t*1.061405429))))
  const v=1-p*Math.exp(-x*x); return x>=0?v:-v
}
function normPDF(x:number,mu:number,sigma:number){
  return Math.exp(-0.5*((x-mu)/sigma)**2)/(sigma*Math.sqrt(2*Math.PI))
}
function normCDF(x:number,mu:number,sigma:number){return 0.5*(1+erf((x-mu)/(sigma*Math.SQRT2)))}
function normInv(p:number){
  const a=[2.515517,0.802853,0.010328],b=[1.432788,0.189269,0.001308]
  if(p<=0)return -Infinity;if(p>=1)return Infinity
  const q=p<0.5?p:1-p,t=Math.sqrt(-2*Math.log(q))
  const x=t-(a[0]+a[1]*t+a[2]*t*t)/(1+b[0]*t+b[1]*t*t+b[2]*t*t*t)
  return p<0.5?-x:x
}

function betaPDF(x:number,a:number,b:number){
  if(x<=0||x>=1) return 0
  return Math.exp((a-1)*Math.log(x)+(b-1)*Math.log(1-x)-lbeta(a,b))
}
function gammaPDF(x:number,alpha:number,beta:number){
  if(x<=0) return 0
  return Math.exp(alpha*Math.log(beta)+(alpha-1)*Math.log(x)-beta*x-lgamma(alpha))
}

// ── Conjugate family definitions ──────────────────────────────────────────────

type FamilyKey = 'beta-binomial' | 'gamma-poisson' | 'normal-normal' | 'gamma-exponential' | 'beta-geometric'

interface FamilyDef {
  name: string
  priorLabel: string
  likelihoodLabel: string
  paramLabels: { key:string; label:string; min:number; max:number; step:number; default:number }[]
  dataParams: { key:string; label:string; min:number; max:number; step:number; default:number }[]
  priorMean: (hp:Record<string,number>)=>number
  posteriorParams: (hp:Record<string,number>, data:Record<string,number>)=>Record<string,number>
  posteriorMean: (pp:Record<string,number>)=>number
  posteriorCI: (pp:Record<string,number>, level:number)=>[number,number]
  thetaRange: ()=>[number,number]
  priorPDF: (theta:number, hp:Record<string,number>)=>number
  posteriorPDF: (theta:number, pp:Record<string,number>)=>number
  likelihoodSummary: (data:Record<string,number>)=>string
  updateSummary: (hp:Record<string,number>, pp:Record<string,number>)=>string
}

const FAMILIES: Record<FamilyKey, FamilyDef> = {
  'beta-binomial': {
    name: 'Beta-Binomial',
    priorLabel: 'Beta(α, β)',
    likelihoodLabel: 'Binomial(n, p)',
    paramLabels: [
      {key:'alpha', label:'α (prior successes)', min:0.5,max:20,step:0.5,default:2},
      {key:'beta', label:'β (prior failures)', min:0.5,max:20,step:0.5,default:2},
    ],
    dataParams: [
      {key:'k', label:'k (observed successes)', min:0,max:100,step:1,default:15},
      {key:'n', label:'n (trials)', min:1,max:100,step:1,default:30},
    ],
    priorMean: hp => hp.alpha/(hp.alpha+hp.beta),
    posteriorParams: (hp,d) => ({alpha: hp.alpha+d.k, beta: hp.beta+d.n-d.k}),
    posteriorMean: pp => pp.alpha/(pp.alpha+pp.beta),
    posteriorCI: (pp,level) => {
      // Beta quantile via bisection
      const cdf = (x:number) => {
        if(x<=0)return 0;if(x>=1)return 1
        // regularized incomplete beta via simple numerical integration
        const n=500
        let s=0
        for(let i=0;i<n;i++){
          const xi=(i+0.5)/n*x
          s+=betaPDF(xi,pp.alpha,pp.beta)*x/n
        }
        return s
      }
      const q = (p:number,lo=0.001,hi=0.999)=>{
        for(let i=0;i<50;i++){const m=(lo+hi)/2;cdf(m)<p?lo=m:hi=m}
        return (lo+hi)/2
      }
      return [q((1-level)/2), q((1+level)/2)]
    },
    thetaRange: ()=>[0,1],
    priorPDF: (theta,hp)=>betaPDF(theta,hp.alpha,hp.beta),
    posteriorPDF: (theta,pp)=>betaPDF(theta,pp.alpha,pp.beta),
    likelihoodSummary: d=>`k=${d.k} successes in n=${d.n} trials. MLE p̂ = ${(d.k/d.n).toFixed(3)}`,
    updateSummary: (hp,pp)=>`Beta(${hp.alpha},${hp.beta}) + data → Beta(${pp.alpha.toFixed(1)},${pp.beta.toFixed(1)})`
  },
  'gamma-poisson': {
    name: 'Gamma-Poisson',
    priorLabel: 'Gamma(α, β)',
    likelihoodLabel: 'Poisson(λ)',
    paramLabels: [
      {key:'alpha', label:'α (shape)', min:0.5,max:20,step:0.5,default:3},
      {key:'beta', label:'β (rate)', min:0.1,max:10,step:0.1,default:1},
    ],
    dataParams: [
      {key:'sumx', label:'Σxᵢ (sum of counts)', min:0,max:200,step:1,default:45},
      {key:'n', label:'n (observations)', min:1,max:100,step:1,default:20},
    ],
    priorMean: hp=>hp.alpha/hp.beta,
    posteriorParams: (hp,d)=>({alpha:hp.alpha+d.sumx, beta:hp.beta+d.n}),
    posteriorMean: pp=>pp.alpha/pp.beta,
    posteriorCI: (pp,level)=>{
      // Gamma quantile via bisection (using CDF approximation)
      const cdf=(x:number)=>{
        if(x<=0)return 0
        const n=500
        let s=0
        for(let i=0;i<n;i++){const xi=(i+0.5)/n*x;s+=gammaPDF(xi,pp.alpha,pp.beta)*x/n}
        return s
      }
      const q=(p:number,lo=0.001,hi=pp.alpha/pp.beta*5+20)=>{
        for(let i=0;i<60;i++){const m=(lo+hi)/2;cdf(m)<p?lo=m:hi=m}
        return (lo+hi)/2
      }
      return [q((1-level)/2),q((1+level)/2)]
    },
    thetaRange: ()=>[0,1],  // will be scaled dynamically
    priorPDF:(theta,hp)=>gammaPDF(theta,hp.alpha,hp.beta),
    posteriorPDF:(theta,pp)=>gammaPDF(theta,pp.alpha,pp.beta),
    likelihoodSummary:d=>`Σxᵢ=${d.sumx}, n=${d.n}. MLE λ̂ = ${(d.sumx/d.n).toFixed(3)}`,
    updateSummary:(hp,pp)=>`Gamma(${hp.alpha},${hp.beta}) + data → Gamma(${pp.alpha.toFixed(1)},${pp.beta.toFixed(1)})`
  },
  'normal-normal': {
    name: 'Normal-Normal',
    priorLabel: 'N(μ₀, τ₀²)',
    likelihoodLabel: 'N(μ, σ²) σ known',
    paramLabels: [
      {key:'mu0', label:'μ₀ (prior mean)', min:-5,max:5,step:0.1,default:0},
      {key:'tau0', label:'τ₀ (prior std)', min:0.1,max:5,step:0.1,default:2},
      {key:'sigma', label:'σ (likelihood std, known)', min:0.1,max:5,step:0.1,default:1},
    ],
    dataParams: [
      {key:'xbar', label:'X̄ (sample mean)', min:-5,max:5,step:0.1,default:1.5},
      {key:'n', label:'n (sample size)', min:1,max:200,step:1,default:20},
    ],
    priorMean:hp=>hp.mu0,
    posteriorParams:(hp,d)=>{
      const tau1sq=1/(1/(hp.tau0**2)+d.n/(hp.sigma**2))
      const mu1=tau1sq*(hp.mu0/(hp.tau0**2)+d.n*d.xbar/(hp.sigma**2))
      return {mu1, tau1:Math.sqrt(tau1sq)}
    },
    posteriorMean:pp=>pp.mu1,
    posteriorCI:(pp,level)=>{
      const z=normInv((1+level)/2)
      return [pp.mu1-z*pp.tau1, pp.mu1+z*pp.tau1]
    },
    thetaRange:()=>[-5,5],
    priorPDF:(theta,hp)=>normPDF(theta,hp.mu0,hp.tau0),
    posteriorPDF:(theta,pp)=>normPDF(theta,pp.mu1,pp.tau1),
    likelihoodSummary:d=>`X̄=${d.xbar.toFixed(2)}, n=${d.n}. MLE μ̂ = ${d.xbar.toFixed(3)}`,
    updateSummary:(hp,pp)=>`N(${hp.mu0},${hp.tau0}²) + data → N(${pp.mu1.toFixed(3)},${pp.tau1.toFixed(3)}²)`
  },
  'gamma-exponential': {
    name: 'Gamma-Exponential',
    priorLabel: 'Gamma(α, β)',
    likelihoodLabel: 'Exponential(λ)',
    paramLabels: [
      {key:'alpha', label:'α (shape)', min:0.5,max:20,step:0.5,default:2},
      {key:'beta', label:'β (rate)', min:0.1,max:10,step:0.1,default:1},
    ],
    dataParams: [
      {key:'sumx', label:'Σxᵢ (sum of observations)', min:0.1,max:200,step:0.5,default:25},
      {key:'n', label:'n (observations)', min:1,max:100,step:1,default:10},
    ],
    priorMean:hp=>hp.alpha/hp.beta,
    posteriorParams:(hp,d)=>({alpha:hp.alpha+d.n, beta:hp.beta+d.sumx}),
    posteriorMean:pp=>pp.alpha/pp.beta,
    posteriorCI:(pp,level)=>{
      const cdf=(x:number)=>{
        if(x<=0)return 0
        const n=500,hi=pp.alpha/pp.beta*8
        let s=0
        for(let i=0;i<n;i++){const xi=(i+0.5)/n*x;s+=gammaPDF(xi,pp.alpha,pp.beta)*x/n}
        return s
      }
      const q=(p:number,lo=0.001,hi=pp.alpha/pp.beta*8+5)=>{
        for(let i=0;i<60;i++){const m=(lo+hi)/2;cdf(m)<p?lo=m:hi=m}
        return (lo+hi)/2
      }
      return [q((1-level)/2),q((1+level)/2)]
    },
    thetaRange:()=>[0,1],
    priorPDF:(theta,hp)=>gammaPDF(theta,hp.alpha,hp.beta),
    posteriorPDF:(theta,pp)=>gammaPDF(theta,pp.alpha,pp.beta),
    likelihoodSummary:d=>`Σxᵢ=${d.sumx}, n=${d.n}. MLE λ̂ = ${(d.n/d.sumx).toFixed(3)}`,
    updateSummary:(hp,pp)=>`Gamma(${hp.alpha},${hp.beta}) + data → Gamma(${pp.alpha.toFixed(1)},${pp.beta.toFixed(1)})`
  },
  'beta-geometric': {
    name: 'Beta-Geometric',
    priorLabel: 'Beta(α, β)',
    likelihoodLabel: 'Geometric(p)',
    paramLabels: [
      {key:'alpha', label:'α (prior successes)', min:0.5,max:20,step:0.5,default:1},
      {key:'beta', label:'β (prior failures)', min:0.5,max:20,step:0.5,default:1},
    ],
    dataParams: [
      {key:'n', label:'n (observations)', min:1,max:100,step:1,default:10},
      {key:'sumx', label:'Σxᵢ (total trials)', min:1,max:500,step:1,default:55},
    ],
    priorMean:hp=>hp.alpha/(hp.alpha+hp.beta),
    posteriorParams:(hp,d)=>({alpha:hp.alpha+d.n, beta:hp.beta+d.sumx-d.n}),
    posteriorMean:pp=>pp.alpha/(pp.alpha+pp.beta),
    posteriorCI:(pp,level)=>{
      const cdf=(x:number)=>{
        if(x<=0)return 0;if(x>=1)return 1
        const n=500;let s=0
        for(let i=0;i<n;i++){const xi=(i+0.5)/n*x;s+=betaPDF(xi,pp.alpha,pp.beta)*x/n}
        return s
      }
      const q=(p:number,lo=0.001,hi=0.999)=>{
        for(let i=0;i<50;i++){const m=(lo+hi)/2;cdf(m)<p?lo=m:hi=m}
        return (lo+hi)/2
      }
      return [q((1-level)/2),q((1+level)/2)]
    },
    thetaRange:()=>[0,1],
    priorPDF:(theta,hp)=>betaPDF(theta,hp.alpha,hp.beta),
    posteriorPDF:(theta,pp)=>betaPDF(theta,pp.alpha,pp.beta),
    likelihoodSummary:d=>`n=${d.n} obs, Σxᵢ=${d.sumx}. MLE p̂ = ${(d.n/d.sumx).toFixed(3)}`,
    updateSummary:(hp,pp)=>`Beta(${hp.alpha},${hp.beta}) + data → Beta(${pp.alpha.toFixed(1)},${pp.beta.toFixed(1)})`
  },
}

// ── Density SVG Plot ──────────────────────────────────────────────────────────

function DensityPlot({
  priorFn, posteriorFn, thetaRange, ci95, posteriorMean,
}: {
  priorFn:(t:number)=>number
  posteriorFn:(t:number)=>number
  thetaRange:[number,number]
  ci95:[number,number]
  posteriorMean:number
}) {
  const W=500,H=200,PL=44,PR=16,PT=12,PB=36
  const pw=W-PL-PR, ph=H-PT-PB
  const [lo,hi]=thetaRange

  const pts=useMemo(()=>{
    const n=250
    return Array.from({length:n},(_,i)=>{
      const t=lo+(hi-lo)*i/(n-1)
      return {t,prior:priorFn(t),post:posteriorFn(t)}
    }).filter(p=>isFinite(p.prior)&&isFinite(p.post))
  },[priorFn,posteriorFn,lo,hi])

  if(!pts.length) return null
  const yMax=Math.max(...pts.map(p=>Math.max(p.prior,p.post)))*1.1||1
  const sx=(t:number)=>PL+(t-lo)/(hi-lo)*pw
  const sy=(y:number)=>PT+(1-y/yMax)*ph

  const mkPath=(vals:number[])=>pts.filter((_,i)=>isFinite(vals[i])).reduce((acc,p,i)=>
    acc+(i===0?`M${sx(p.t).toFixed(1)},${sy(vals[i]).toFixed(1)}`
              :` L${sx(p.t).toFixed(1)},${sy(vals[i]).toFixed(1)}`), '')

  const priorPath=mkPath(pts.map(p=>p.prior))
  const postPath=mkPath(pts.map(p=>p.post))

  // CI fill
  const ciFill=pts.filter(p=>p.t>=ci95[0]&&p.t<=ci95[1]).reduce((acc,p,i,arr)=>{
    if(i===0)return `M${sx(p.t).toFixed(1)},${sy(0).toFixed(1)} L${sx(p.t).toFixed(1)},${sy(p.post).toFixed(1)}`
    if(i===arr.length-1)return acc+` L${sx(p.t).toFixed(1)},${sy(p.post).toFixed(1)} L${sx(p.t).toFixed(1)},${sy(0).toFixed(1)} Z`
    return acc+` L${sx(p.t).toFixed(1)},${sy(p.post).toFixed(1)}`
  },'')

  const xTicks=5
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}}>
      {/* CI fill */}
      {ciFill&&<path d={ciFill} fill="var(--color-accent)" opacity="0.12"/>}
      {/* Grid */}
      {[0.25,0.5,0.75,1].map(f=>(
        <line key={f} x1={PL} y1={sy(f*yMax)} x2={PL+pw} y2={sy(f*yMax)}
          stroke="var(--color-border)" strokeWidth="0.5"/>
      ))}
      {/* Prior */}
      <path d={priorPath} fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="5,3"/>
      {/* Posterior */}
      <path d={postPath} fill="none" stroke="var(--color-accent)" strokeWidth="2"/>
      {/* Posterior mean */}
      {isFinite(sx(posteriorMean))&&(
        <line x1={sx(posteriorMean)} y1={PT} x2={sx(posteriorMean)} y2={PT+ph}
          stroke="var(--color-accent)" strokeWidth="1" strokeDasharray="3,2" opacity="0.7"/>
      )}
      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT+ph} stroke="var(--color-border-strong)" strokeWidth="1"/>
      <line x1={PL} y1={PT+ph} x2={PL+pw} y2={PT+ph} stroke="var(--color-border-strong)" strokeWidth="1"/>
      {Array.from({length:xTicks+1},(_,i)=>{
        const t=lo+(hi-lo)*i/xTicks
        const x=sx(t)
        return (
          <g key={i}>
            <line x1={x} y1={PT+ph} x2={x} y2={PT+ph+4} stroke="var(--color-border-strong)" strokeWidth="1"/>
            <text x={x} y={PT+ph+13} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">{t.toFixed(2)}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function ConjugateAnalysis() {
  const [familyKey, setFamilyKey] = useState<FamilyKey>('beta-binomial')
  const [hyperparams, setHyperparams] = useState<Record<string,number>>({alpha:2,beta:2})
  const [dataParams, setDataParams] = useState<Record<string,number>>({k:15,n:30})

  const family=FAMILIES[familyKey]

  function switchFamily(key:FamilyKey){
    setFamilyKey(key)
    const hp:Record<string,number>={};FAMILIES[key].paramLabels.forEach(p=>{hp[p.key]=p.default})
    const dp:Record<string,number>={};FAMILIES[key].dataParams.forEach(p=>{dp[p.key]=p.default})
    setHyperparams(hp);setDataParams(dp)
  }

  const pp=useMemo(()=>family.posteriorParams(hyperparams,dataParams),[family,hyperparams,dataParams])
  const priorMean=family.priorMean(hyperparams)
  const postMean=family.posteriorMean(pp)
  const ci95=useMemo(()=>family.posteriorCI(pp,0.95),[family,pp])

  // Dynamic theta range for Gamma families
  const thetaRange=useMemo(():[number,number]=>{
    const base=family.thetaRange()
    if(familyKey==='gamma-poisson'||familyKey==='gamma-exponential'){
      const mode=Math.max(postMean,priorMean)
      return [0, Math.max(mode*3, 5)]
    }
    if(familyKey==='normal-normal'){
      const center=(hyperparams.mu0+dataParams.xbar)/2
      const spread=Math.max(hyperparams.tau0*4, Math.abs(dataParams.xbar-hyperparams.mu0)+3)
      return [center-spread, center+spread]
    }
    return base
  },[family,familyKey,hyperparams,dataParams,postMean,priorMean])

  // Posterior predictive (point estimate only)
  const mle=familyKey==='beta-binomial'?dataParams.k/dataParams.n
    :familyKey==='gamma-poisson'||familyKey==='gamma-exponential'?
      (familyKey==='gamma-poisson'?dataParams.sumx/dataParams.n:dataParams.n/dataParams.sumx)
    :familyKey==='normal-normal'?dataParams.xbar
    :dataParams.n/dataParams.sumx

  return (
    <div className="flex h-full min-h-0 text-xs" style={{fontFamily:'var(--font-inter, system-ui, sans-serif)'}}>

      {/* Left */}
      <div className="flex flex-col w-52 shrink-0 border-r border-border bg-elevated overflow-y-auto">

        <div className="px-3 pt-3 pb-2">
          <p className="label-xs mb-2">Conjugate Family</p>
          <div className="space-y-0.5">
            {(Object.entries(FAMILIES) as [FamilyKey,FamilyDef][]).map(([key,f])=>(
              <button key={key} onClick={()=>switchFamily(key)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  familyKey===key?'bg-accent-light text-accent font-medium':'text-text-secondary hover:bg-border/50'
                }`}
              >{f.name}</button>
            ))}
          </div>
        </div>

        <div className="mx-3 border-t border-border"/>

        <div className="px-3 py-2">
          <p className="label-xs mb-1">{family.priorLabel} — Prior</p>
          {family.paramLabels.map(ps=>(
            <div key={ps.key} className="mb-2">
              <div className="flex justify-between mb-0.5">
                <span className="font-mono text-text-muted truncate">{ps.label}</span>
                <span className="font-mono text-text-secondary tabular-nums ml-1">
                  {(hyperparams[ps.key]??ps.default).toFixed(ps.step<0.1?2:1)}
                </span>
              </div>
              <input type="range" min={ps.min} max={ps.max} step={ps.step}
                value={hyperparams[ps.key]??ps.default}
                onChange={e=>setHyperparams(prev=>({...prev,[ps.key]:parseFloat(e.target.value)}))}
                className="w-full h-1 cursor-pointer accent-accent"
              />
            </div>
          ))}
        </div>

        <div className="mx-3 border-t border-border"/>

        <div className="px-3 py-2">
          <p className="label-xs mb-1">{family.likelihoodLabel} — Data</p>
          {family.dataParams.map(ps=>(
            <div key={ps.key} className="mb-2">
              <div className="flex justify-between mb-0.5">
                <span className="font-mono text-text-muted truncate">{ps.label}</span>
                <span className="font-mono text-text-secondary tabular-nums ml-1">
                  {(dataParams[ps.key]??ps.default).toFixed(0)}
                </span>
              </div>
              <input type="range" min={ps.min} max={ps.max} step={ps.step}
                value={dataParams[ps.key]??ps.default}
                onChange={e=>setDataParams(prev=>({...prev,[ps.key]:parseFloat(e.target.value)}))}
                className="w-full h-1 cursor-pointer accent-accent"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-border">
          <div className="rounded-md bg-elevated border border-border px-3 py-2">
            <p className="label-xs mb-1">Prior Mean</p>
            <p className="font-mono text-base text-text-secondary">{priorMean.toFixed(4)}</p>
            <p className="text-text-muted text-[10px] mt-0.5">{family.priorLabel}</p>
          </div>
          <div className="rounded-md bg-elevated border border-border px-3 py-2">
            <p className="label-xs mb-1">MLE</p>
            <p className="font-mono text-base text-text-secondary">{mle.toFixed(4)}</p>
            <p className="text-text-muted text-[10px] mt-0.5">Frequentist estimate</p>
          </div>
          <div className="rounded-md bg-elevated border border-border px-3 py-2">
            <p className="label-xs mb-1">Posterior Mean</p>
            <p className="font-mono text-base text-accent">{postMean.toFixed(4)}</p>
            <p className="text-text-muted text-[10px] mt-0.5">{family.updateSummary(hyperparams,pp)}</p>
          </div>
        </div>

        {/* Density plot */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-4 mb-2">
            <p className="label-xs">Prior vs Posterior density</p>
            <div className="flex items-center gap-3 ml-auto text-[10px]">
              <span className="flex items-center gap-1">
                <span className="inline-block w-6 border-t-2 border-dashed border-text-muted"/>
                Prior
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-6 border-t-2 border-accent"/>
                Posterior
              </span>
            </div>
          </div>
          <div className="bg-surface rounded-md border border-border p-2 overflow-hidden">
            <DensityPlot
              priorFn={(t)=>family.priorPDF(t,hyperparams)}
              posteriorFn={(t)=>family.posteriorPDF(t,pp)}
              thetaRange={thetaRange}
              ci95={ci95}
              posteriorMean={postMean}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-text-muted text-center">
            Shaded region = 95% posterior credible interval [{ci95[0].toFixed(3)}, {ci95[1].toFixed(3)}]
          </p>
        </div>

        {/* Data summary */}
        <div className="p-4">
          <p className="label-xs mb-2">Data summary</p>
          <div className="rounded-md bg-elevated border border-border px-4 py-3 text-xs text-text-secondary leading-relaxed">
            <p><span className="text-text-muted">Observed: </span>{family.likelihoodSummary(dataParams)}</p>
            <p className="mt-1"><span className="text-text-muted">Update: </span>{family.updateSummary(hyperparams,pp)}</p>
            <p className="mt-1"><span className="text-text-muted">95% credible interval: </span>
              [{ci95[0].toFixed(4)}, {ci95[1].toFixed(4)}]
            </p>
            <p className="mt-1 text-text-muted text-[10px]">
              Prior has strength n₀ ≈ {Object.values(hyperparams).reduce((s,v)=>s+v,0).toFixed(1)} pseudo-observations.
              As data grows, posterior mean converges to MLE.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
