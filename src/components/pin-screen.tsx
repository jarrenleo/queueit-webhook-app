import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { API_URL } from '@/lib/constants'

export function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const errorTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (!error) return
    errorTimer.current = setTimeout(() => setError(''), 5000)
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [error])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()

      if (data.success) {
        sessionStorage.setItem('pin', pin)
        onSuccess()
      } else {
        setError('Incorrect PIN')
        setPin('')
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4 p-4"
      >
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-foreground">
            Queue-it Webhooks
          </h1>
          <p className="text-sm text-muted-foreground">Enter PIN to continue</p>
        </div>
        <Input
          className="rounded-sm text-foreground"
          type="password"
          inputMode="numeric"
          placeholder="Enter PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
        />
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
        <Button
          type="submit"
          disabled={loading || !pin}
          className="cursor-pointer rounded-sm"
        >
          {loading ? 'Verifying...' : 'Submit'}
        </Button>
      </form>
    </div>
  )
}
