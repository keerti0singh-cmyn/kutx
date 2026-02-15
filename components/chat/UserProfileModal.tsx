'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, User, MessageCircle, MoreVertical, Shield, BellOff, Bell } from 'lucide-react'

interface UserProfileModalProps {
    userId: string
    onClose: () => void
}

export default function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
    const supabase = createClient() as any
    const [profile, setProfile] = useState<any>(null)
    const [friendCount, setFriendCount] = useState(0)
    const [storyCount, setStoryCount] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchFullProfile = async () => {
            setLoading(true)

            // Fetch basic profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (profileData) setProfile(profileData)

            // Fetch friend count
            const { count: fCount } = await supabase
                .from('friends')
                .select('*', { count: 'exact', head: true })
                .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

            setFriendCount(fCount || 0)

            // Fetch active story count
            const { count: sCount } = await supabase
                .from('stories')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gt('expires_at', new Date().toISOString())

            setStoryCount(sCount || 0)

            setLoading(false)
        }

        fetchFullProfile()
    }, [userId, supabase])

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 animate-pulse text-center">
                    <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mx-auto" />
                </div>
            </div>
        )
    }

    if (!profile) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] w-full max-w-sm overflow-hidden relative shadow-2xl border border-white/10">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-all z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 pb-4 flex flex-col items-center">
                    {/* Avatar */}
                    <div className="relative mb-6">
                        <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary to-blue-400">
                            <div className="w-full h-full rounded-full border-4 border-white dark:border-gray-800 overflow-hidden bg-gray-100 dark:bg-gray-700">
                                {profile.profile_photo_url ? (
                                    <img src={profile.profile_photo_url} className="w-full h-full object-cover" alt={profile.username} />
                                ) : (
                                    <User className="w-full h-full p-6 text-gray-400" />
                                )}
                            </div>
                        </div>
                        <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-white dark:border-gray-800 ${profile.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    </div>

                    {/* Name & Bio */}
                    <h2 className="text-2xl font-bold mb-2">{profile.username}</h2>
                    <p className={`text-sm px-3 py-1 rounded-full mb-4 ${profile.status === 'online' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'} dark:bg-opacity-10`}>
                        {profile.status === 'online' ? 'Online' : 'Offline'}
                    </p>
                    {profile.bio ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 mb-8 max-w-xs leading-relaxed italic">
                            "{profile.bio}"
                        </p>
                    ) : (
                        <p className="text-center text-gray-400 mb-8 italic">No bio yet</p>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 w-full mb-8">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-3xl text-center border border-gray-100 dark:border-white/5">
                            <p className="text-2xl font-extrabold text-primary">{storyCount}</p>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Stories</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-3xl text-center border border-gray-100 dark:border-white/5">
                            <p className="text-2xl font-extrabold text-primary">{friendCount}</p>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Friends</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3 w-full">
                        <button className="w-full py-4 flex items-center justify-center gap-2 bg-primary text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95">
                            <MessageCircle className="w-5 h-5" />
                            Message
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                            <button className="py-3 flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium">
                                <BellOff className="w-4 h-4" />
                                Mute
                            </button>
                            <button className="py-3 flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition font-medium">
                                <Shield className="w-4 h-4" />
                                Block
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Privacy Secured by KUTX</p>
                </div>
            </div>
        </div>
    )
}
