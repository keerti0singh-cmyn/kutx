'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import AudioCall from './chat/AudioCall'

export default function GlobalCallProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore()
    const supabase = createClient() as any
    const [incomingCall, setIncomingCall] = useState<any>(null)
    const [callerProfile, setCallerProfile] = useState<any>(null)

    useEffect(() => {
        if (!user) return

        const channel = supabase
            .channel('active_calls_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'active_calls',
                    filter: `receiver_id=eq.${user.id}`,
                },
                async (payload: any) => {
                    const call = payload.new
                    if (call.status === 'ringing') {
                        // Fetch caller profile
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('user_id', call.caller_id)
                            .single()

                        setCallerProfile(profile)
                        setIncomingCall(call)
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'active_calls',
                    filter: `receiver_id=eq.${user.id}`,
                },
                (payload: any) => {
                    const call = payload.new
                    if (call.status === 'ended' || call.status === 'rejected') {
                        setIncomingCall(null)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, supabase])

    return (
        <>
            {children}
            {incomingCall && callerProfile && (
                <AudioCall
                    user={user}
                    otherUser={callerProfile}
                    channel={supabase.channel(`call-${incomingCall.id}`)}
                    onClose={() => setIncomingCall(null)}
                    callId={incomingCall.id}
                />
            )}
        </>
    )
}
