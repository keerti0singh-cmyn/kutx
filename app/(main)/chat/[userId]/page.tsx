'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { Database } from '@/types/database'
import UserProfileModal from '@/components/chat/UserProfileModal'
import { ArrowLeft, Send, Paperclip, X, Check, Shield, FileText, MessageCircle, Phone } from 'lucide-react'
import AudioCall from '@/components/chat/AudioCall'
import { formatMessageTime, formatLastSeen } from '@/lib/utils/date-formatting'

type Message = Database['public']['Tables']['messages']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

export default function ChatWithUserPage() {
    const params = useParams()
    const router = useRouter()
    const friendId = params.userId as string
    const supabase = createClient() as any
    const { user } = useAuthStore()

    const [messages, setMessages] = useState<Message[]>([])
    const [friendProfile, setFriendProfile] = useState<Profile | null>(null)
    const [newMessage, setNewMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isTyping, setIsTyping] = useState(false)
    const [showProfile, setShowProfile] = useState(false)
    const [showCall, setShowCall] = useState(false)
    const [incomingCall, setIncomingCall] = useState<any>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const chatChannelRef = useRef<any>(null)

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        if (!user || !friendId) return

        const fetchData = async () => {
            // Get friend profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', friendId)
                .single()

            if (profile) setFriendProfile(profile)

            // Get messages
            const { data: messagesData } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true })
                .limit(50)

            if (messagesData) {
                setMessages(messagesData)
                // Mark unread messages from friend as seen
                const unreadIds = messagesData
                    .filter((m: any) => m.sender_id === friendId && m.status !== 'seen')
                    .map((m: any) => m.id)

                if (unreadIds.length > 0) {
                    await supabase
                        .from('messages')
                        .update({ status: 'seen', read_at: new Date().toISOString() })
                        .in('id', unreadIds)
                }
            }

            setLoading(false)
        }

        fetchData()

        // Subscribe to real-time messages
        const channel = supabase
            .channel(`messages-${friendId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${user.id}`,
                },
                (payload: any) => {
                    const newMsg = payload.new as Message
                    if (newMsg.sender_id === friendId) {
                        setMessages(prev => [...prev, newMsg])
                        // Mark as seen immediately
                        supabase
                            .from('messages')
                            .update({ status: 'seen', read_at: new Date().toISOString() })
                            .eq('id', newMsg.id)
                            .then(() => { })
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'typing' },
                (payload: any) => {
                    if (payload.payload.userId === friendId) {
                        setIsTyping(payload.payload.isTyping)
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'call-signal' },
                ({ payload }: any) => {
                    if (payload.type === 'request' && payload.from === friendId) {
                        setIncomingCall(payload)
                        setShowCall(true)
                    }
                }
            )
            .subscribe()

        chatChannelRef.current = channel

        // Subscribe to friend's status changes
        const profileChannel = supabase
            .channel(`profile-${friendId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `user_id=eq.${friendId}`,
                },
                (payload: any) => {
                    setFriendProfile(payload.new as Profile)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
            supabase.removeChannel(profileChannel)
        }
    }, [user, friendId, supabase])

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || !user || sending) return

        const messageContent = newMessage.trim()
        setNewMessage('')

        // Add pending message to UI immediately for better UX
        const tempId = `temp-${Date.now()}`
        const pendingMsg: Message = {
            id: tempId,
            content: messageContent,
            sender_id: user.id,
            receiver_id: friendId,
            message_type: 'text',
            status: 'sent', // UI will show as 'sending' if we add a local flag, or just use 'sent' as a placeholder
            created_at: new Date().toISOString(),
            delivered_at: null,
            edited_at: null,
            file_id: null,
            is_deleted: false,
            read_at: null,
            file_url: null,
            file_size: null
        }

        setMessages(prev => [...prev, pendingMsg])
        setSending(true)

        const maxRetries = 3
        let retryCount = 0
        let success = false

        const attemptSend = async () => {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: friendId,
                    content: messageContent,
                    message_type: 'text',
                    status: 'sent'
                })
                .select()
                .single()

            if (error) {
                console.error(`Attempt ${retryCount + 1} failed:`, error)
                if (retryCount < maxRetries) {
                    retryCount++
                    const delay = Math.pow(2, retryCount) * 1000
                    setTimeout(attemptSend, delay)
                } else {
                    setSending(false)
                    // Update the temp message to show failure
                    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, is_deleted: true } : m))
                    alert('Failed to send message after multiple attempts. Please check your connection.')
                }
            } else if (data) {
                // Replace temp message with actual data from DB
                setMessages(prev => prev.map(m => m.id === tempId ? data : m))
                setSending(false)
                success = true
            }
        }

        await attemptSend()
    }

    const handleSendFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user || !friendId) return

        if (file.size > 5 * 1024 * 1024) {
            alert('File must be less than 5MB')
            return
        }

        const isImg = file.type.startsWith('image/')
        const allowedDocs = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']

        if (!isImg && !allowedDocs.includes(file.type)) {
            alert('Only images, PDFs, Word docs, and TXT files are allowed')
            return
        }

        setSending(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}-${Date.now()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('chat-files')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('chat-files')
                .getPublicUrl(filePath)

            const { data: msgData, error: msgError } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: friendId,
                    content: isImg ? 'Shared an image' : `Shared a file: ${file.name}`,
                    message_type: isImg ? 'image' : 'file',
                    file_url: publicUrl,
                    file_size: file.size,
                    status: 'sent'
                })
                .select()
                .single()

            if (msgError) throw msgError
            if (msgData) setMessages(prev => [...prev, msgData])
        } catch (err) {
            console.error('Error sending file:', err)
            alert('Image upload failed. Please try again.')
        } finally {
            setSending(false)
        }
    }

    const handleTyping = () => {
        if (!user || !friendId) return
        supabase.channel(`messages-${friendId}`).send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: user.id, isTyping: true },
        })

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => {
            supabase.channel(`messages-${friendId}`).send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user.id, isTyping: false },
            })
        }, 3000)
    }

    const handleBlockUser = async () => {
        if (!user || !friendId || !friendProfile) return
        if (!confirm(`Are you sure you want to block ${friendProfile.username}?`)) return
        const { error } = await supabase
            .from('blocks')
            .insert({ blocker_id: user.id, blocked_id: friendId })

        if (!error) {
            alert('User blocked')
            router.push('/chat')
        } else {
            alert('Failed to block user')
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage(e as any)
        }
    }

    if (loading) return <div className="h-full flex items-center justify-center animate-pulse"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
    if (!friendProfile) return <div className="h-full flex items-center justify-center text-gray-500">User not found</div>

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b p-3 md:p-4 flex items-center gap-2 md:gap-4 sticky top-0 z-20">
                <Link href="/chat" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>

                <div className="relative cursor-pointer group" onClick={() => setShowProfile(true)}>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 group-hover:ring-2 ring-primary transition-all">
                        {friendProfile.profile_photo_url ? (
                            <img src={friendProfile.profile_photo_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                                {friendProfile.username[0].toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${friendProfile.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>

                <div className="flex-1 cursor-pointer" onClick={() => setShowProfile(true)}>
                    <h2 className="font-semibold group-hover:text-primary transition-colors">{friendProfile.username}</h2>
                    <p className="text-sm text-gray-500">
                        {friendProfile.status === 'online'
                            ? (isTyping ? <span className="text-primary italic animate-pulse text-xs">typing...</span> : 'Online')
                            : `Last seen ${formatLastSeen(friendProfile.last_seen_at || new Date().toISOString())}`
                        }
                    </p>
                </div>

                <button
                    onClick={() => setShowCall(true)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition"
                    title="Audio Call"
                >
                    <Phone className="w-5 h-5" />
                </button>

                <button onClick={handleBlockUser} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                    <Shield className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <MessageCircle size={48} className="mb-4" />
                        <p>Say hello to {friendProfile.username}!</p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex flex-col ${message.sender_id === user?.id ? 'items-end' : 'items-start'} w-full max-w-[75%] md:max-w-[70%]`}>
                                <div className={`message-bubble ${message.sender_id === user?.id ? 'message-sender' : 'message-receiver shadow-sm'}`}>
                                    {message.message_type === 'image' && message.file_url ? (
                                        <div className="mb-2 rounded-xl overflow-hidden border border-white/10 group relative">
                                            <img
                                                src={message.file_url || '/placeholder-image.png'}
                                                className="max-w-[200px] md:max-w-xs h-auto rounded-lg object-cover cursor-zoom-in hover:brightness-90 transition shadow-md"
                                                onClick={() => message.file_url && window.open(message.file_url, '_blank')}
                                                alt="Shared image"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = 'https://placehold.co/200x200?text=Image+Not+Found';
                                                }}
                                            />
                                            {!message.file_url && (
                                                <p className="text-xs text-red-400 mt-1 italic">Image failed to load</p>
                                            )}
                                        </div>
                                    ) : message.message_type === 'file' && message.file_url ? (
                                        <div
                                            className="mb-2 p-3 bg-white/10 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-white/20 transition group"
                                            onClick={() => window.open(message.file_url!, '_blank')}
                                        >
                                            <div className="p-2 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition">
                                                <FileText className="w-6 h-6 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{message.content.replace('Shared a file: ', '')}</p>
                                                <p className="text-[10px] opacity-60 uppercase tracking-tighter">
                                                    {message.file_size ? (message.file_size / (1024 * 1024)).toFixed(2) + ' MB' : 'DOC'}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                    )}
                                    {message.sender_id === user?.id && (
                                        <div className="flex justify-end mt-1">
                                            {message.status === 'seen' ? (
                                                <div className="flex -space-x-1"><Check className="w-3 h-3 text-blue-400" /><Check className="w-3 h-3 text-blue-400" /></div>
                                            ) : (
                                                <Check className={`w-3 h-3 ${message.status === 'delivered' ? 'text-gray-400' : 'text-gray-400/50'}`} />
                                            )}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] text-gray-400 mt-1">
                                    {formatMessageTime(message.created_at || new Date().toISOString())}
                                </span>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-800 border-t">
                <div className="flex items-center gap-2 max-w-4xl mx-auto">
                    <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" id="chat-file" className="hidden" onChange={handleSendFile} />
                    <label htmlFor="chat-file" className="p-2 text-gray-400 hover:text-primary rounded-full cursor-pointer transition">
                        <Paperclip className="w-6 h-6" />
                    </label>

                    <input
                        className="flex-1 bg-gray-100 dark:bg-gray-700 px-4 py-2.5 rounded-2xl outline-none focus:ring-2 ring-primary/20 transition"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => { setNewMessage(e.target.value); handleTyping() }}
                        onKeyPress={handleKeyPress}
                    />

                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="p-3 bg-primary text-white rounded-full hover:shadow-lg hover:shadow-primary/20 hover:scale-105 transition active:scale-95 disabled:opacity-50"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>

            {showProfile && <UserProfileModal userId={friendId} onClose={() => setShowProfile(false)} />}

            {showCall && chatChannelRef.current && (
                <AudioCall
                    user={user}
                    otherUser={friendProfile}
                    channel={chatChannelRef.current}
                    onClose={() => {
                        setShowCall(false)
                        setIncomingCall(null)
                    }}
                />
            )}
        </div>
    )
}


