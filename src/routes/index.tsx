import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

const API_URL = 'https://queueit-webhook-api-production.up.railway.app'

interface WebhookData {
  id: string
  bot_name: string
  link: string
  click_count: number
  timestamp: number
}

interface State {
  items: Record<string, WebhookData>
  order: string[]
}

export const Route = createFileRoute('/')({ component: App })

function App() {
  const [state, setState] = useState<State>({ items: {}, order: [] })
  const [isConnected, setIsConnected] = useState(false)

  // Fetch initial data and setup SSE
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/data`)
        const data: WebhookData[] = await res.json()
        setState({
          items: Object.fromEntries(data.map((item) => [item.id, item])),
          order: data.map((item) => item.id),
        })
      } catch (error) {
        console.error(error)
      }
    }

    fetchData()

    // Setup SSE connection
    const eventSource = new EventSource(`${API_URL}/sse`)

    eventSource.onopen = () => setIsConnected(true)
    eventSource.onerror = () => {
      // Only show disconnected if connection is fully closed (not just reconnecting)
      if (eventSource.readyState === EventSource.CLOSED) setIsConnected(false)
    }

    // Handle new webhook data - O(1)
    eventSource.addEventListener('new_data', (e) => {
      const newItem: WebhookData = JSON.parse(e.data)
      setState((prev) => ({
        items: { ...prev.items, [newItem.id]: newItem },
        order: [newItem.id, ...prev.order],
      }))
    })

    // Handle click updates - O(1)
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
  }, [])

  // Handle row click - increment count and open link
  async function handleClick(item: WebhookData) {
    window.open(item.link, '_blank')
    await fetch(`${API_URL}/click/${item.id}`, { method: 'POST' })
  }

  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-6 px-4 bg-background">
      <div className="w-full max-w-4xl">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Queue-it Webhooks
            </h1>
            <p className="text-sm text-muted-foreground">
              {state.order.length === 0
                ? 'Waiting for webhooks...'
                : `${state.order.length} webhook(s) received`}
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

        <Table>
          <TableHeader>
            <TableRow className="border-b-muted">
              <TableHead className="text-center text-md font-semibold">
                Bot
              </TableHead>
              <TableHead className="text-center text-md font-semibold">
                Link
              </TableHead>
              <TableHead className="text-center text-md font-semibold">
                Clicks
              </TableHead>
              <TableHead className="text-center text-md font-semibold">
                Timestamp
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.order.map((id) => {
              const item = state.items[id]
              return (
                <TableRow key={id} className="text-foreground">
                  <TableCell className="text-md text-center">
                    {item.bot_name}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      className="rounded-md cursor-pointer"
                      onClick={() => handleClick(item)}
                    >
                      Open Link
                    </Button>
                  </TableCell>
                  <TableCell className="text-md text-center">
                    {item.click_count}
                  </TableCell>
                  <TableCell className="text-md text-center">
                    {formatTime(item.timestamp)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
