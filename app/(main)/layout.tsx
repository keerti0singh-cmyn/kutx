'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { MessageSquare, Users, User as UserIcon, LogOut, Bell } from 'lucide-react'
import Link from 'next/link'
import LogoutConfirmationModal from '@/components/LogoutConfirmationModal'

export default function MainLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const supabase = createClient() as any
    const { user, profile, setUser, setProfile, logout } = useAuthStore()
    const [loading, setLoading] = useState(true)
    const [notifications, setNotifications] = useState<any[]>([])
    const [showNotifications, setShowNotifications] = useState(false)
    const [showLogoutModal, setShowLogoutModal] = useState(false)
    const unreadCount = notifications.filter(n => !n.is_read).length

    useEffect(() => {
        // Get authenticated user and profile
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUser(user)

                // Fetch profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (profile) {
                    setProfile(profile)

                    // Set online status
                    await supabase
                        .from('profiles')
                        .update({ status: 'online', last_seen_at: new Date().toISOString() })
                        .eq('user_id', user.id)
                }
            }
            setLoading(false)
        }

        getUser()

        // Fetch notifications
        const fetchNotifications = async () => {
            if (!user) return
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20)
            if (data) setNotifications(data)
        }

        fetchNotifications()

        // Subscribe to notifications
        const notifChannel = supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user?.id}`,
                },
                (payload: any) => {
                    setNotifications(prev => [payload.new, ...prev])
                }
            )
            .subscribe()

        // Handle visibility change for online/offline status
        const handleVisibilityChange = async () => {
            if (user) {
                if (document.hidden) {
                    // Set offline when tab is not visible
                    await supabase
                        .from('profiles')
                        .update({ status: 'offline', last_seen_at: new Date().toISOString() })
                        .eq('user_id', user.id)
                } else {
                    // Set online when tab becomes visible
                    await supabase
                        .from('profiles')
                        .update({ status: 'online', last_seen_at: new Date().toISOString() })
                        .eq('user_id', user.id)
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            supabase.removeChannel(notifChannel)
            // Set offline on unmount
            if (user) {
                supabase
                    .from('profiles')
                    .update({ status: 'offline', last_seen_at: new Date().toISOString() })
                    .eq('user_id', user.id)
            }
        }
    }, [supabase, setUser, setProfile, user])

    const markAllAsRead = async () => {
        if (!user) return
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }

    const confirmLogout = async () => {
        if (user) {
            await supabase
                .from('profiles')
                .update({ status: 'offline', last_seen_at: new Date().toISOString() })
                .eq('user_id', user.id)
        }
        await supabase.auth.signOut()
        logout()
        router.push('/login')
    }

    const handleLogout = () => {
        setShowLogoutModal(true)
    }

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col md:flex-row bg-gray-100 dark:bg-gray-900 overflow-hidden relative">
            {/* Sidebar / Bottom Nav for Mobile */}
            <div className="w-full md:w-20 bg-white dark:bg-gray-800 border-t md:border-t-0 md:border-r border-gray-200 dark:border-gray-700 flex md:flex-col items-center py-2 md:py-6 px-4 md:px-0 space-y-0 md:space-y-8 fixed bottom-0 md:relative md:bottom-auto z-50 order-2 md:order-1">
                <div className="text-2xl font-bold text-primary hidden md:block">K</div>

                <nav className="flex-1 flex flex-row md:flex-col items-center justify-around md:justify-start w-full md:space-y-6">
                    <Link
                        href="/chat"
                        className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        title="Chats"
                    >
                        <MessageSquare className="w-6 h-6" />
                    </Link>

                    <Link
                        href="/friends"
                        className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        title="Friends"
                    >
                        <Users className="w-6 h-6" />
                    </Link>

                    <Link
                        href="/profile"
                        className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        title="Profile"
                    >
                        <UserIcon className="w-6 h-6" />
                    </Link>

                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition relative"
                            title="Notifications"
                        >
                            <Bell className="w-6 h-6" />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute left-0 bottom-16 md:bottom-0 md:left-16 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <h3 className="font-bold">Notifications</h3>
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        Mark all as read
                                    </button>
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <p className="p-8 text-center text-gray-500 text-sm">No notifications yet</p>
                                    ) : (
                                        notifications.map((n) => (
                                            <div
                                                key={n.id}
                                                className={`p-4 border-b border-gray-100 dark:border-gray-700 last:border-0 ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                            >
                                                <p className="text-sm">{n.content}</p>
                                                <span className="text-[10px] text-gray-400 mt-1 block">
                                                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </nav>

                <button
                    onClick={handleLogout}
                    className="p-3 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 text-red-600 transition md:mt-auto"
                    title="Logout"
                >
                    <LogOut className="w-6 h-6" />
                </button>

                {profile?.profile_photo_url ? (
                    <img
                        src={profile.profile_photo_url}
                        alt="Profile"
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover hidden md:block"
                    />
                ) : (
                    <div className="hidden md:flex w-10 h-10 rounded-full bg-primary items-center justify-center text-white font-bold">
                        {profile?.username?.[0]?.toUpperCase()}
                    </div>
                )}
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-hidden order-1 md:order-2 pb-16 md:pb-0">
                {children}
            </div>

            {/* Logout Confirmation Modal */}
            <LogoutConfirmationModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={confirmLogout}
            />
        </div>
    )
}
