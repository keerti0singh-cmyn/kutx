'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { Camera, Save } from 'lucide-react'
import { validateProfilePhoto } from '@/lib/utils/file-validation'

export default function ProfilePage() {
    const supabase = createClient() as any
    const { user, profile, setProfile } = useAuthStore()

    const [username, setUsername] = useState(profile?.username || '')
    const [bio, setBio] = useState(profile?.bio || '')
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const [initialized, setInitialized] = useState(false)

    useEffect(() => {
        if (profile && !initialized) {
            setUsername(profile.username)
            if (profile.bio) setBio(profile.bio)
            setInitialized(true)
        }
    }, [profile, initialized])


    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user) return

        const validation = validateProfilePhoto(file)
        if (!validation.valid) {
            setMessage({ type: 'error', text: validation.error! })
            return
        }

        setUploading(true)

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}-${Date.now()}.${fileExt}`
            const filePath = `${fileName}`

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('chat-profiles')
                .upload(filePath, file, { upsert: true })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('chat-profiles')
                .getPublicUrl(filePath)

            // Update profile with photo URL
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ profile_photo_url: publicUrl })
                .eq('user_id', user.id)

            if (updateError) throw updateError

            // Update local state
            if (profile) {
                setProfile({ ...profile, profile_photo_url: publicUrl })
            }

            setMessage({ type: 'success', text: 'Profile photo updated!' })
        } catch (error) {
            console.error('Error uploading photo:', error)
            setMessage({ type: 'error', text: 'Failed to upload photo' })
        } finally {
            setUploading(false)
        }
    }

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setSaving(true)
        setMessage(null)

        const trimmedUsername = username.trim()
        const trimmedBio = bio.trim()

        try {
            // Validate username format
            if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
                throw new Error('Username must be between 3 and 20 characters')
            }

            // Allow underscores and periods, but mostly alphanumeric
            if (!/^[a-zA-Z0-9_.]+$/.test(trimmedUsername)) {
                throw new Error('Username can only contain letters, numbers, underscores, and periods')
            }

            // Check if username is already taken (if changed)
            if (trimmedUsername !== profile?.username) {
                const { data: existingProfile, error: searchError } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('username', trimmedUsername)
                    .neq('user_id', user.id)
                    .maybeSingle()

                if (existingProfile) {
                    throw new Error('Username already taken')
                }
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    username: trimmedUsername,
                    bio: trimmedBio,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id)

            if (error) throw error

            // Update local state
            if (profile) {
                setProfile({ ...profile, username: trimmedUsername, bio: trimmedBio })
            }

            setMessage({ type: 'success', text: 'Profile updated successfully!' })
        } catch (error: any) {
            console.error('Error updating profile:', error)
            setMessage({
                type: 'error',
                text: error.message || 'Failed to update profile'
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>

                {message && (
                    <div
                        className={`mb-6 p-4 rounded-lg ${message.type === 'success'
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                {/* Profile Photo */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Profile Photo</h2>
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            {profile?.profile_photo_url ? (
                                <img
                                    src={profile.profile_photo_url}
                                    alt="Profile"
                                    className="w-24 h-24 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-semibold">
                                    {profile?.username?.[0]?.toUpperCase() || 'U'}
                                </div>
                            )}
                            {uploading && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition">
                                <Camera className="w-5 h-5" />
                                <span>{uploading ? 'Uploading...' : 'Change Photo'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    className="hidden"
                                    disabled={uploading}
                                />
                            </label>
                            <p className="text-sm text-gray-500 mt-2">
                                JPG, PNG or GIF. Max size 2MB.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Profile Information */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                minLength={3}
                                maxLength={20}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                3-20 characters, letters, numbers, and underscores only
                            </p>
                        </div>

                        <div>
                            <label htmlFor="bio" className="block text-sm font-medium mb-2">
                                Bio (Optional)
                            </label>
                            <textarea
                                id="bio"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={160}
                                rows={3}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 resize-none"
                                placeholder="Tell others about yourself..."
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                {bio.length}/160 characters
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Email</label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="w-full px-4 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 cursor-not-allowed"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                Email cannot be changed
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
