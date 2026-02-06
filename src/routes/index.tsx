import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PinScreen } from '@/components/pin-screen'
import { Dashboard } from '@/components/dashboard'
import { API_URL } from '@/lib/constants'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Re-validate stored PIN on every page load
  useEffect(() => {
    const validatePin = async () => {
      const storedPin = sessionStorage.getItem('pin')
      if (!storedPin) {
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_URL}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: storedPin }),
        })
        const data = await res.json()

        if (data.success) {
          setIsAuthed(true)
        } else {
          sessionStorage.removeItem('pin')
        }
      } catch {
        sessionStorage.removeItem('pin')
      } finally {
        setIsLoading(false)
      }
    }

    validatePin()
  }, [])

  if (isLoading) return null

  if (!isAuthed) return <PinScreen onSuccess={() => setIsAuthed(true)} />
  return <Dashboard />
}
