'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Phone, PhoneOff, Mic, MicOff, Volume2, User } from 'lucide-react'

interface AudioCallProps {
    user: any
    otherUser: any
    channel: any
    onClose: () => void
}

export default function AudioCall({ user, otherUser, channel, onClose }: AudioCallProps) {
    const supabase = createClient() as any
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'active'>('idle')
    const [isMuted, setIsMuted] = useState(false)
    const [timer, setTimer] = useState(0)

    const pc = useRef<RTCPeerConnection | null>(null)
    const localStream = useRef<MediaStream | null>(null)
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
    const timerInterval = useRef<NodeJS.Timeout | null>(null)

    const ICE_CONFIG = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }

    useEffect(() => {
        // Setup listeners for signaling
        const unsubscribe = channel.on('broadcast', { event: 'call-signal' }, async ({ payload }: any) => {
            const { type, from, signal } = payload
            if (from === user.id) return // Ignore own signals

            switch (type) {
                case 'request':
                    setCallStatus('incoming')
                    break
                case 'accept':
                    startPeerConnection(true)
                    break
                case 'reject':
                case 'end':
                    handleEndCall(false)
                    break
                case 'offer':
                    handleOffer(signal)
                    break
                case 'answer':
                    handleAnswer(signal)
                    break
                case 'candidate':
                    handleCandidate(signal)
                    break
            }
        })

        return () => {
            handleEndCall(true)
        }
    }, [])

    useEffect(() => {
        if (callStatus === 'active') {
            timerInterval.current = setInterval(() => setTimer(prev => prev + 1), 1000)
        } else {
            if (timerInterval.current) clearInterval(timerInterval.current)
        }
        return () => { if (timerInterval.current) clearInterval(timerInterval.current) }
    }, [callStatus])

    const formatTimer = (s: number) => {
        const mins = Math.floor(s / 60)
        const secs = s % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const sendSignal = (type: string, signal?: any) => {
        channel.send({
            type: 'broadcast',
            event: 'call-signal',
            payload: { type, from: user.id, signal }
        })
    }

    const startPeerConnection = async (isInitiator: boolean) => {
        pc.current = new RTCPeerConnection(ICE_CONFIG)

        pc.current.onicecandidate = (e) => {
            if (e.candidate) sendSignal('candidate', e.candidate)
        }

        pc.current.ontrack = (e) => {
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = e.streams[0]
            }
        }

        try {
            localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
            localStream.current.getTracks().forEach(track => {
                pc.current?.addTrack(track, localStream.current!)
            })

            if (isInitiator) {
                const offer = await pc.current.createOffer()
                await pc.current.setLocalDescription(offer)
                sendSignal('offer', offer)
            }
            setCallStatus('active')
        } catch (err) {
            console.error('Mic access error:', err)
            alert('Could not access microphone')
            handleEndCall(true)
        }
    }

    const handleOffer = async (offer: any) => {
        if (!pc.current) await startPeerConnection(false)
        await pc.current?.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.current?.createAnswer()
        await pc.current?.setLocalDescription(answer)
        sendSignal('answer', answer)
    }

    const handleAnswer = async (answer: any) => {
        await pc.current?.setRemoteDescription(new RTCSessionDescription(answer))
    }

    const handleCandidate = async (candidate: any) => {
        await pc.current?.addIceCandidate(new RTCIceCandidate(candidate))
    }

    const handleStartCall = () => {
        setCallStatus('calling')
        sendSignal('request')
    }

    const handleAcceptCall = () => {
        sendSignal('accept')
        startPeerConnection(false)
    }

    const handleRejectCall = () => {
        sendSignal('reject')
        handleEndCall(true)
    }

    const handleEndCall = (notify: boolean) => {
        if (notify) sendSignal('end')

        pc.current?.close()
        pc.current = null

        localStream.current?.getTracks().forEach(t => t.stop())
        localStream.current = null

        setCallStatus('idle')
        onClose()
    }

    const toggleMute = () => {
        if (localStream.current) {
            localStream.current.getAudioTracks()[0].enabled = isMuted
            setIsMuted(!isMuted)
        }
    }

    // Auto-initiate call if opened as caller
    useEffect(() => {
        if (callStatus === 'idle') handleStartCall()
    }, [])

    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <audio ref={remoteAudioRef} autoPlay />

            <div className="mb-12 flex flex-col items-center animate-bounce-slow">
                <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-primary/30 shadow-2xl relative mb-6">
                    {otherUser.profile_photo_url ? (
                        <img src={otherUser.profile_photo_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white text-5xl font-bold uppercase">
                            {otherUser.username[0]}
                        </div>
                    )}
                    {callStatus === 'active' && <div className="absolute inset-0 border-4 border-green-500 rounded-full animate-ping opacity-20" />}
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">{otherUser.username}</h2>
                <p className="text-primary font-medium tracking-widest uppercase text-sm">
                    {callStatus === 'calling' && 'Calling...'}
                    {callStatus === 'incoming' && 'Incoming Audio Call'}
                    {callStatus === 'active' && formatTimer(timer)}
                </p>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6">
                {callStatus === 'incoming' ? (
                    <>
                        <button
                            onClick={handleRejectCall}
                            className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition hover:scale-110 active:scale-90 shadow-xl"
                        >
                            <PhoneOff />
                        </button>
                        <button
                            onClick={handleAcceptCall}
                            className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition hover:scale-110 active:scale-90 shadow-xl animate-pulse"
                        >
                            <Phone />
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={toggleMute}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-90 shadow-lg ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            {isMuted ? <MicOff /> : <Mic />}
                        </button>
                        <button
                            onClick={() => handleEndCall(true)}
                            className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition hover:scale-110 active:scale-90 shadow-xl"
                        >
                            <PhoneOff />
                        </button>
                        <button className="w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition hover:scale-110 shadow-lg">
                            <Volume2 />
                        </button>
                    </>
                )}
            </div>

            <p className="mt-12 text-gray-500 text-xs text-center px-8">
                End-to-end encrypted audio call. Standard data rates may apply.
            </p>
        </div>
    )
}
