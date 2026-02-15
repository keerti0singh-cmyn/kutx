'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { Database } from '@/types/database'
import { Search, Plus, MessageSquare, Camera } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/date-formatting'
import { StoryUpload, StoryModal } from './StoryComponents'

type Profile = Database['public']['Tables']['profiles']['Row']

interface ConversationPreview {
    userId: string
    username: string
    profilePhoto: string | null
    lastMessage: string
    lastMessageTime: string
    status: string
}

export default function ChatPage() {
    const supabase = createClient() as any
    const { user } = useAuthStore()
    const [conversations, setConversations] = useState<ConversationPreview[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [stories, setStories] = useState<any[]>([])
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [activeStory, setActiveStory] = useState<any | null>(null)
    const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (!user) return

        const fetchConversations = async () => {
            // Get blocked users
            const { data: blocked } = await supabase
                .from('blocks')
                .select('blocked_id')
                .eq('blocker_id', user.id)

            const blockedIdsList = blocked?.map((b: any) => b.blocked_id) || []

            // Get all friends
            const { data: friends } = await supabase
                .from('friends')
                .select('friend_id')
                .eq('user_id', user.id)
                .not('friend_id', 'in', `(${blockedIdsList.join(',')})`)

            if (!friends || friends.length === 0) {
                setLoading(false)
                return
            }

            const friendIds = friends.map((f: any) => f.friend_id)

            // Get profiles for friends
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('user_id', friendIds)

            if (!profiles) {
                setLoading(false)
                return
            }

            // Get last message for each friend
            const conversationsData: ConversationPreview[] = await Promise.all(
                profiles.map(async (profile: any) => {
                    const { data: messages } = await supabase
                        .from('messages')
                        .select('content, created_at')
                        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                        .or(`sender_id.eq.${profile.user_id},receiver_id.eq.${profile.user_id}`)
                        .order('created_at', { ascending: false })
                        .limit(1)

                    return {
                        userId: profile.user_id,
                        username: profile.username,
                        profilePhoto: profile.profile_photo_url,
                        lastMessage: messages?.[0]?.content || 'No messages yet',
                        lastMessageTime: messages?.[0]?.created_at || profile.created_at,
                        status: profile.status,
                    }
                })
            )

            // Sort by most recent message
            conversationsData.sort((a, b) =>
                new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
            )

            setConversations(conversationsData)
            setLoading(false)
        }

        const fetchStories = async () => {
            const { data: storiesData } = await supabase
                .from('stories')
                .select('*, profiles(username, profile_photo_url)')
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })

            if (storiesData) setStories(storiesData)

            // Fetch views for the current user
            const { data: views } = await supabase
                .from('story_views')
                .select('story_id')
                .eq('viewer_id', user.id)

            if (views) {
                setViewedStoryIds(new Set(views.map((v: any) => v.story_id)))
            }
        }

        fetchConversations()
        fetchStories()

        // Subscribe to new messages
        const channel = supabase
            .channel('messages-updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${user.id}`,
                },
                () => {
                    fetchConversations()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, supabase])

    const filteredConversations = conversations.filter(conv =>
        conv.username.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="h-full flex">
            {/* Conversations list */}
            <div className="w-full md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h1 className="text-2xl font-bold mb-4">Chats</h1>

                    {/* Stories Tray */}
                    <div className="flex gap-4 overflow-x-auto pb-4 mb-4 scrollbar-hide no-scrollbar">
                        <button
                            onClick={() => setIsUploadOpen(true)}
                            className="flex-shrink-0 flex flex-col items-center gap-1 group"
                        >
                            <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center group-hover:border-primary transition">
                                <Plus className="w-6 h-6 text-gray-400 group-hover:text-primary" />
                            </div>
                            <span className="text-xs text-gray-500">My Story</span>
                        </button>

                        {stories.map((story) => {
                            const isSeen = viewedStoryIds.has(story.id)
                            return (
                                <button
                                    key={story.id}
                                    onClick={() => setActiveStory(story)}
                                    className="flex-shrink-0 flex flex-col items-center gap-1 group"
                                >
                                    <div className={`w-14 h-14 rounded-full p-[2px] transition-all duration-300 ${isSeen ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gradient-to-tr from-yellow-400 via-red-500 to-fuchsia-600 animate-gradient-xy'}`}>
                                        <div className="w-full h-full rounded-full border-2 border-white dark:border-gray-800 overflow-hidden">
                                            {story.profiles.profile_photo_url ? (
                                                <img
                                                    src={story.profiles.profile_photo_url}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                                    alt={story.profiles.username}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                                                    {story.profiles.username[0].toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-gray-500 truncate w-14 text-center mt-0.5">
                                        {story.profiles.username}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredConversations.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                            <p className="mb-2">No conversations yet</p>
                            <Link
                                href="/friends"
                                className="text-primary hover:underline flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add friends to start chatting
                            </Link>
                        </div>
                    ) : (
                        filteredConversations.map((conv) => (
                            <Link
                                key={conv.userId}
                                href={`/chat/${conv.userId}`}
                                className="block p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        {conv.profilePhoto ? (
                                            <img
                                                src={conv.profilePhoto}
                                                alt={conv.username}
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                                                {conv.username[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${conv.status === 'online' ? 'bg-online' : 'bg-offline'
                                            }`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold truncate">{conv.username}</h3>
                                        <p className="text-sm text-gray-500 truncate">{conv.lastMessage}</p>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {formatDate(conv.lastMessageTime)}
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>

            {/* Empty state - no chat selected */}
            <div className="hidden md:flex flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center text-gray-500">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Select a conversation to start messaging</p>
                </div>
            </div>

            {/* Modals */}
            {isUploadOpen && user && (
                <StoryUpload
                    userId={user.id}
                    onClose={() => setIsUploadOpen(false)}
                    onSuccess={() => {
                        // Refresh stories would be handled by a re-fetch or subscription
                        window.location.reload()
                    }}
                />
            )}

            {activeStory && (
                <StoryModal
                    story={activeStory}
                    onClose={() => setActiveStory(null)}
                    onViewed={() => setViewedStoryIds(prev => new Set(prev).add(activeStory.id))}
                />
            )}
        </div>
    )
}
