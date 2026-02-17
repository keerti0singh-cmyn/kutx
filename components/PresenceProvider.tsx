'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'

export default function PresenceProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore()
    const supabase = createClient() as any
    const lastHeartbeatRef = useRef<number>(0)

    useEffect(() => {
        if (!user) return

        const sendHeartbeat = async () => {
            // throttle to prevent accidental double calls
            const now = Date.now()
            if (now - lastHeartbeatRef.current < 20000) return
            lastHeartbeatRef.current = now

            try {
                await supabase.rpc('handle_user_heartbeat', { p_user_id: user.id })
            } catch (err) {
                console.error('Presence heartheat failed', err)
            }
        }

        // 1. Initial heartbeat
        sendHeartbeat()

        // 2. Refresh heartbeat every 45 seconds
        // (mark_inactive_users_offline checks for 60s timeout)
        const interval = setInterval(sendHeartbeat, 45000)

        // 3. Tab close / visibility handling
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                sendHeartbeat()
            }
        }

        const handleBeforeUnload = () => {
            // Use RPC to ensure consistency
            supabase.rpc('handle_user_heartbeat', { p_user_id: user.id })
        }

        window.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            clearInterval(interval)
            window.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [user, supabase])

    return <>{children}</>
}
