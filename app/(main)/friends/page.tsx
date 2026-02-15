'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { Database } from '@/types/database'
import { Search, UserPlus, Check, X, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatLastSeen } from '@/lib/utils/date-formatting'

type Profile = Database['public']['Tables']['profiles']['Row']
type FriendRequest = Database['public']['Tables']['friend_requests']['Row']

interface FriendWithProfile {
    friendId: string
    profile: Profile
}

export default function FriendsPage() {
    const supabase = createClient() as any
    const router = useRouter()
    const { user } = useAuthStore()

    const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'search' | 'blocked'>('friends')
    const [friends, setFriends] = useState<FriendWithProfile[]>([])
    const [pendingRequests, setPendingRequests] = useState<(FriendRequest & { sender_profile: Profile })[]>([])
    const [searchResults, setSearchResults] = useState<Profile[]>([])
    const [blockedUsers, setBlockedUsers] = useState<Profile[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(false)
    const [sendingRequest, setSendingRequest] = useState<string | null>(null)

    // Fetch friends
    useEffect(() => {
        if (!user) return

        const fetchFriends = async () => {
            const { data: friendsList } = await supabase
                .from('friends')
                .select('friend_id')
                .eq('user_id', user.id)

            if (!friendsList) return

            const friendIds = friendsList.map((f: any) => f.friend_id)
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('user_id', friendIds)

            if (profiles) {
                setFriends(
                    profiles.map((p: any) => ({ friendId: p.user_id, profile: p }))
                )
            }
        }

        fetchFriends()
    }, [user, supabase])

    // Fetch pending requests
    useEffect(() => {
        if (!user) return

        const fetchPendingRequests = async () => {
            const { data: requests } = await supabase
                .from('friend_requests')
                .select('*')
                .eq('receiver_id', user.id)
                .eq('status', 'pending')

            if (!requests) return

            const requestsWithProfiles = await Promise.all(
                requests.map(async (req: any) => {
                    const { data: senderProfile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('user_id', req.sender_id)
                        .single()

                    return {
                        ...req,
                        sender_profile: senderProfile!,
                    }
                })
            )

            setPendingRequests(requestsWithProfiles)
        }

        fetchPendingRequests()
    }, [user, supabase])

    // Search users
    useEffect(() => {
        const term = searchTerm.trim()
        if (!term || !user) {
            setSearchResults([])
            return
        }

        const searchUsers = async () => {
            setLoading(true)
            try {
                const { data: profiles, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .ilike('username', `%${term}%`)
                    .neq('user_id', user.id)
                    .limit(20)

                if (error) throw error
                console.log('Search results:', profiles)
                if (profiles) {
                    setSearchResults(profiles)
                }
            } catch (error: any) {
                console.error('Error searching users:', error)
                alert(`Search failed: ${error.message || 'Unknown error'}`)
            } finally {
                setLoading(false)
            }
        }

        const debounce = setTimeout(searchUsers, 500)
        return () => clearTimeout(debounce)
    }, [searchTerm, user, supabase])

    const handleSendFriendRequest = async (receiverId: string) => {
        if (!user) return
        setSendingRequest(receiverId)

        const { error } = await supabase
            .from('friend_requests')
            .insert({
                sender_id: user.id,
                receiver_id: receiverId,
                status: 'pending',
            })

        if (!error) {
            alert('Friend request sent!')

            // Trigger Notification
            await supabase
                .from('notifications')
                .insert({
                    user_id: receiverId,
                    type: 'friend_request',
                    reference_id: user.id,
                    content: `${useAuthStore.getState().profile?.username || 'Someone'} sent you a friend request!`
                })
        }

        setSendingRequest(null)
    }

    const handleAcceptRequest = async (requestId: string, senderId: string) => {
        if (!user) return

        // Update request status
        await supabase
            .from('friend_requests')
            .update({ status: 'accepted', responded_at: new Date().toISOString() })
            .eq('id', requestId)

        // Create friendship (both directions)
        await supabase.rpc('create_friendship', {
            user1_id: user.id,
            user2_id: senderId,
        })

        // Refresh pending requests
        setPendingRequests(prev => prev.filter(req => req.id !== requestId))

        // Refresh friends list
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', senderId)
            .single()

        if (profile) {
            setFriends(prev => [...prev, { friendId: senderId, profile }])

            // Trigger Notification for the sender
            await supabase
                .from('notifications')
                .insert({
                    user_id: senderId,
                    type: 'request_accepted',
                    reference_id: user.id,
                    content: `${useAuthStore.getState().profile?.username || 'Someone'} accepted your friend request!`
                })
        }
    }

    const handleRejectRequest = async (requestId: string) => {
        await supabase
            .from('friend_requests')
            .update({ status: 'rejected', responded_at: new Date().toISOString() })
            .eq('id', requestId)

        setPendingRequests(prev => prev.filter(req => req.id !== requestId))
    }

    const handleBlockUser = async (blockedId: string) => {
        if (!user) return
        if (!confirm('Are you sure you want to block this user?')) return

        const { error } = await supabase
            .from('blocks')
            .insert({ blocker_id: user.id, blocked_id: blockedId })

        if (!error) {
            setFriends(prev => prev.filter(f => f.friendId !== blockedId))
            setSearchResults(prev => prev.filter(p => p.user_id !== blockedId))
            alert('User blocked')
        }
    }

    const handleUnblockUser = async (blockedId: string) => {
        if (!user) return

        const { error } = await supabase
            .from('blocks')
            .delete()
            .eq('blocker_id', user.id)
            .eq('blocked_id', blockedId)

        if (!error) {
            setBlockedUsers(prev => prev.filter(p => p.user_id !== blockedId))
            alert('User unblocked')
        }
    }

    // Fetch blocked users when tab changes
    useEffect(() => {
        if (activeTab === 'blocked' && user) {
            const fetchBlocked = async () => {
                const { data: blocks } = await supabase
                    .from('blocks')
                    .select('blocked_id')
                    .eq('blocker_id', user.id)

                if (blocks) {
                    const blockedIds = blocks.map((b: any) => b.blocked_id)
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('*')
                        .in('user_id', blockedIds)

                    if (profiles) setBlockedUsers(profiles)
                }
            }
            fetchBlocked()
        }
    }, [activeTab, user, supabase])

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-800">
            {/* Header with tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="p-4">
                    <h1 className="text-2xl font-bold mb-4">Friends</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('friends')}
                            className={`px-4 py-2 rounded-lg transition ${activeTab === 'friends'
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Friends ({friends.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-4 py-2 rounded-lg transition ${activeTab === 'pending'
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Pending ({pendingRequests.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('search')}
                            className={`px-4 py-2 rounded-lg transition ${activeTab === 'search'
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <UserPlus className="w-5 h-5 inline mr-2" />
                            Add Friend
                        </button>
                        <button
                            onClick={() => setActiveTab('blocked')}
                            className={`px-4 py-2 rounded-lg transition ${activeTab === 'blocked'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Blocked
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'friends' && (
                    <div className="space-y-3">
                        {friends.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">
                                No friends yet. Search for users to add!
                            </p>
                        ) : (
                            friends.map(({ friendId, profile }) => (
                                <div
                                    key={friendId}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                >
                                    <div className="relative">
                                        {profile.profile_photo_url ? (
                                            <img
                                                src={profile.profile_photo_url}
                                                alt={profile.username}
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                                                {profile.username[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${profile.status === 'online' ? 'bg-online' : 'bg-offline'
                                            }`} />
                                    </div>

                                    <div className="flex-1">
                                        <h3 className="font-semibold">{profile.username}</h3>
                                        <p className="text-sm text-gray-500">
                                            {profile.status === 'online'
                                                ? 'Online'
                                                : `Last seen ${formatLastSeen(profile.last_seen_at || new Date().toISOString())}`}
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => router.push(`/chat/${friendId}`)}
                                            className="p-2 bg-primary text-white rounded-lg hover:bg-blue-700"
                                        >
                                            <MessageSquare className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleBlockUser(friendId)}
                                            className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 transition"
                                            title="Block User"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'pending' && (
                    <div className="space-y-3">
                        {pendingRequests.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No pending requests</p>
                        ) : (
                            pendingRequests.map((request) => (
                                <div
                                    key={request.id}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                >
                                    {request.sender_profile.profile_photo_url ? (
                                        <img
                                            src={request.sender_profile.profile_photo_url}
                                            alt={request.sender_profile.username}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                                            {request.sender_profile.username[0].toUpperCase()}
                                        </div>
                                    )}

                                    <div className="flex-1">
                                        <h3 className="font-semibold">{request.sender_profile.username}</h3>
                                        <p className="text-sm text-gray-500">Sent you a friend request</p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAcceptRequest(request.id, request.sender_id)}
                                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                                            title="Accept"
                                        >
                                            <Check className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleRejectRequest(request.id)}
                                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                            title="Reject"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'search' && (
                    <div className="flex-1 p-4">
                        <div className="flex gap-2 mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by username..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    setSearchTerm(searchTerm.trim())
                                }}
                                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-medium"
                            >
                                Search
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                                <p className="text-gray-500">Searching for "{searchTerm}"...</p>
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="text-center text-gray-500 py-12">
                                <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="text-lg">
                                    {searchTerm ? `No users found matching "${searchTerm}"` : 'Enter a username to find new friends'}
                                </p>
                                {searchTerm && (
                                    <p className="text-sm mt-2 font-medium">
                                        Check for typos or try a different name.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {searchResults.map((profile) => {
                                    const isFriend = friends.some(f => f.friendId === profile.user_id)

                                    return (
                                        <div
                                            key={profile.user_id}
                                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                        >
                                            {profile.profile_photo_url ? (
                                                <img
                                                    src={profile.profile_photo_url}
                                                    alt={profile.username}
                                                    className="w-12 h-12 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                                                    {profile.username[0].toUpperCase()}
                                                </div>
                                            )}

                                            <div className="flex-1">
                                                <h3 className="font-semibold">{profile.username}</h3>
                                                {profile.bio && (
                                                    <p className="text-sm text-gray-500 truncate">{profile.bio}</p>
                                                )}
                                            </div>

                                            {isFriend ? (
                                                <span className="text-sm text-green-600">Already friends</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleSendFriendRequest(profile.user_id)}
                                                    disabled={sendingRequest === profile.user_id}
                                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                    {sendingRequest === profile.user_id ? 'Sending...' : 'Add Friend'}
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'blocked' && (

                    <div className="space-y-3">
                        {blockedUsers.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No blocked users</p>
                        ) : (
                            blockedUsers.map((profile) => (
                                <div
                                    key={profile.user_id}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                >
                                    <div className="relative">
                                        {profile.profile_photo_url ? (
                                            <img
                                                src={profile.profile_photo_url}
                                                alt={profile.username}
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                                                {profile.username[0].toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        <h3 className="font-semibold">{profile.username}</h3>
                                    </div>

                                    <button
                                        onClick={() => handleUnblockUser(profile.user_id)}
                                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 transition"
                                    >
                                        Unblock
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
