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

        const markOffline = async () => {
            try {
                await supabase
                    .from('profiles')
                    .update({ status: 'offline', last_seen_at: new Date().toISOString() })
                    .eq('user_id', user.id)
            } catch (err) {
                console.error('Failed to mark offline', err)
            }
        }

        const sendHeartbeat = async () => {
            // throttle to prevent accidental double calls
            const now = Date.now()
            if (now - lastHeartbeatRef.current < 20000) return
            lastHeartbeatRef.current = now

            try {
                await supabase.rpc('handle_user_heartbeat', { p_user_id: user.id })
                // Trigger inactivity cleanup for other users occasionally
                if (Math.random() < 0.1) {
                    supabase.rpc('mark_inactive_users_offline')
                }
            } catch (err) {
                console.error('Presence heartheat failed', err)
            }
        }

        // 1. Initial heartbeat
        sendHeartbeat()

        // 2. Refresh heartbeat every 45 seconds
        const interval = setInterval(sendHeartbeat, 45000)

        // 3. Tab close / visibility handling
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                sendHeartbeat()
            } else {
                // Optionally mark away, but user said "mark offline" if no activity
                // Let's stick to heartbeats for 60s timeout
            }
        }

        const handleBeforeUnload = () => {
            // Navigator.sendBeacon could also be used for immediate offline update
            const { url, key } = (supabase as any).supabaseUrl ? { url: (supabase as any).supabaseUrl, key: (supabase as any).supabaseKey } : { url: '', key: '' };
            if (url && key) {
                const body = JSON.stringify({ status: 'offline', last_seen_at: new Date().toISOString() });
                const headers = {
                    'Content-Type': 'application/json',
                    'apikey': key,
                    'Authorization': `Bearer ${supabase.auth.session?.access_token || ''}`
                };
                // Fallback for immediate update on close
                fetch(`${url}/rest/v1/profiles?user_id=eq.${user.id}`, {
                    method: 'PATCH',
                    headers,
                    body,
                    keepalive: true
                });
            }
        }

        window.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            clearInterval(interval)
            window.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('beforeunload', handleBeforeUnload)
            markOffline()
        }
    }, [user, supabase])

    return <>{children}</>
}
