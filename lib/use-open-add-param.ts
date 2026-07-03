'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Auto-opens a page's "add" modal when visited with `?add=1` (from the
 * dashboard Quick add menu). Waits until `ready` (initial data loaded),
 * fires once, then strips the param so refresh/back doesn't re-open it.
 */
export function useOpenAddParam(openAdd: () => void, ready: boolean) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current || !ready) return
    if (searchParams.get('add') !== '1') return
    fired.current = true
    openAdd()
    router.replace(pathname, { scroll: false })
  }, [ready, searchParams, pathname, router, openAdd])
}
