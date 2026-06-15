import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Bridge between this React app (hosted on CloudFront)
 * and the Salesforce Experience site that embeds it via iframe.
 *
 * Usage:
 *   const { sfContext, ready, showToast, navigateTo } = useSalesforceBridge()
 */
export function useSalesforceBridge() {
  const [sfContext, setSfContext] = useState(null)
  const [ready, setReady] = useState(false)
  const sfOriginRef = useRef(null)

  const isEmbedded = window.self !== window.top

  useEffect(() => {
    if (!isEmbedded) {
      // Running standalone (dev/direct URL) — mock context
      setSfContext({
        recordId: 'STANDALONE_MODE',
        userId: 'local-user',
        baseUrl: window.location.origin,
        env: import.meta.env.VITE_APP_ENV
      })
      setReady(true)
      return
    }

    const handleMessage = (event) => {
      const sfBase = import.meta.env.VITE_SF_BASE_URL || ''
      const allowedOrigins = [
        sfBase,
        'https://yourdomain.my.site.com',
        'https://yourdomain.lightning.force.com'
      ].filter(Boolean)

      const originAllowed = allowedOrigins.some(o => event.origin.startsWith(o))
      if (!originAllowed) return

      sfOriginRef.current = event.origin
      const { type, payload } = event.data || {}

      switch (type) {
        case 'SF_INIT':
          setSfContext(payload)
          setReady(true)
          event.source.postMessage({ type: 'REACT_READY' }, event.origin)
          break
        case 'SF_RECORD_CHANGE':
          setSfContext(prev => ({ ...prev, recordId: payload?.recordId }))
          break
        default:
          break
      }
    }

    window.addEventListener('message', handleMessage)

    // Signal to Salesforce parent that React app has loaded
    window.parent.postMessage({ type: 'REACT_LOADED' }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [isEmbedded])

  const sendToSalesforce = useCallback((type, payload) => {
    if (!sfOriginRef.current) return
    window.parent.postMessage({ type, payload }, sfOriginRef.current)
  }, [])

  return {
    sfContext,
    ready,
    isEmbedded,
    showToast: (title, message, variant = 'info') =>
      sendToSalesforce('SHOW_TOAST', { title, message, variant }),
    navigateTo: (recordId) =>
      sendToSalesforce('NAVIGATE', { recordId }),
    resizeFrame: (height) =>
      sendToSalesforce('RESIZE', { height })
  }
}
