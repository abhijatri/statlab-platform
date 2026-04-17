'use client'

import dynamic from 'next/dynamic'

// Dynamic import with ssr:false must live in a Client Component.
// Server Components (page.tsx files) import this wrapper instead of
// using next/dynamic directly.

const DistributionEngine = dynamic(
  () => import('./DistributionEngine').then(m => ({ default: m.DistributionEngine })),
  { ssr: false }
)

interface Props {
  initialDist?: string
}

export function DistributionEngineLoader({ initialDist }: Props) {
  return <DistributionEngine initialDist={initialDist} />
}
