import { useEffect, useState, useRef, useCallback, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/copy-button'
import { API_URL } from '@/lib/constants'
import type { WebhookData, WebhookState } from '@/lib/types'

const ROW_HEIGHT = 49 // Estimated row height in px
const OVERSCAN = 20 // Extra rows rendered above/below viewport

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString()
}

// Memoized row — only re-renders when its specific item or callback changes
const WebhookRow = memo(function WebhookRow({
  item,
  onClickItem,
}: {
  item: WebhookData
  onClickItem: (item: WebhookData) => void
}) {
  return (
    <tr className="hover:bg-muted/50 border-b border-b-muted transition-colors text-foreground">
      <td className="p-2 align-middle whitespace-nowrap text-md text-center">
        {item.bot_name}
      </td>
      <td className="p-2 align-middle whitespace-nowrap text-center">
        <div className="flex items-center justify-center gap-2">
          <Button
            className="rounded-md cursor-pointer"
            onClick={() => onClickItem(item)}
          >
            Open Link
          </Button>
          <CopyButton link={item.link} />
        </div>
      </td>
      <td className="p-2 align-middle whitespace-nowrap text-md text-center">
        {item.click_count}
      </td>
      <td className="p-2 align-middle whitespace-nowrap text-md text-center">
        {formatTime(item.timestamp)}
      </td>
    </tr>
  )
})

export function Dashboard() {
  const [state, setState] = useState<WebhookState>({ items: {}, order: [] })
  const [isConnected, setIsConnected] = useState(false)
  // Read pin once on mount — avoids re-reading sessionStorage every render
  const [pin] = useState(() => sessionStorage.getItem('pin') ?? '')

  // --- Fetch initial data + SSE setup ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_URL}/data`, {
          headers: { 'x-access-pin': pin },
        })
        const data: WebhookData[] = await response.json()
        setState({
          items: Object.fromEntries(data.map((item) => [item.id, item])),
          order: data.map((item) => item.id),
        })
      } catch (error) {
        console.error(error)
      }
    }

    fetchData()

    const eventSource = new EventSource(
      `${API_URL}/sse?pin=${encodeURIComponent(pin)}`,
    )

    eventSource.onopen = () => setIsConnected(true)
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) setIsConnected(false)
    }

    // Handle new webhook data — O(1)
    eventSource.addEventListener('new_data', (e) => {
      const newItem: WebhookData = JSON.parse(e.data)
      setState((prev) => ({
        items: { ...prev.items, [newItem.id]: newItem },
        order: [newItem.id, ...prev.order],
      }))
    })

    // Handle click updates — O(1)
    eventSource.addEventListener('click_update', (e) => {
      const { data: updatedItem } = JSON.parse(e.data)
      setState((prev) => ({
        ...prev,
        items: { ...prev.items, [updatedItem.id]: updatedItem },
      }))
    })

    // Handle cleanup
    eventSource.addEventListener('cleanup', (e) => {
      const { data }: { data: WebhookData[] } = JSON.parse(e.data)
      setState({
        items: Object.fromEntries(data.map((item) => [item.id, item])),
        order: data.map((item) => item.id),
      })
    })

    return () => eventSource.close()
  }, [pin])

  // --- Virtualization ---
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: state.order.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0

  // Stable callback — won't change across renders so memoized rows stay put
  const handleClick = useCallback(
    async (item: WebhookData) => {
      window.open(item.link, '_blank')
      await fetch(`${API_URL}/click/${item.id}`, {
        method: 'POST',
        headers: { 'x-access-pin': pin },
      })
    },
    [pin],
  )

  return (
    <div className="h-screen flex flex-col items-center py-6 px-4 bg-background">
      <div className="w-full max-w-4xl flex flex-col flex-1 min-h-0">
        <div className="flex items-end justify-between mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Queue-it Webhooks
            </h1>
            <p className="text-sm text-muted-foreground">
              {`${state.order.length} webhook(s) received`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-green-500 animate-ping' : 'bg-red-500'}`}
              ></span>
              <span
                className={`relative inline-flex size-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              ></span>
            </span>
            <span className="text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-auto min-h-0 rounded-md border border-muted"
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-b-muted">
                <th className="text-foreground h-10 px-2 text-center text-md font-semibold whitespace-nowrap">
                  Bot
                </th>
                <th className="text-foreground h-10 px-2 text-center text-md font-semibold whitespace-nowrap">
                  Link
                </th>
                <th className="text-foreground h-10 px-2 text-center text-md font-semibold whitespace-nowrap">
                  Clicks
                </th>
                <th className="text-foreground h-10 px-2 text-center text-md font-semibold whitespace-nowrap">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody>
              {state.order.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center text-muted-foreground py-6 text-sm"
                  >
                    Waiting for webhooks...
                  </td>
                </tr>
              )}
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: paddingTop, padding: 0 }} />
                </tr>
              )}
              {virtualItems.map((virtualRow) => {
                const id = state.order[virtualRow.index]
                const item = state.items[id]
                if (!item) return null
                return (
                  <WebhookRow key={id} item={item} onClickItem={handleClick} />
                )
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: paddingBottom, padding: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
