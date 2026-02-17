'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { X, Upload, Send, Type, Palette, MoreHorizontal, Eye, Clock } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface StoryUploadProps {
    userId: string
    onClose: () => void
    onSuccess: () => void
}

export function StoryUpload({ userId, onClose, onSuccess }: StoryUploadProps) {
    const supabase = createClient() as any
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [caption, setCaption] = useState('')
    const [uploading, setUploading] = useState(false)

    // Text Overlay states
    const [textOverlay, setTextOverlay] = useState('')
    const [textColor, setTextColor] = useState('#ffffff')
    const [fontStyle, setFontStyle] = useState('sans-serif')
    const [textPos, setTextPos] = useState({ x: 50, y: 50 })
    const [bgStyle, setBgStyle] = useState('bg-gradient-to-br from-purple-600 to-blue-500')
    const [isDragging, setIsDragging] = useState(false)
    const [showTextControls, setShowTextControls] = useState(true)
    const [editorMode, setEditorMode] = useState<'choose' | 'edit'>('choose')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0]
        if (selected) {
            // 5MB limit check
            if (selected.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB')
                return
            }
            const isImage = selected.type.startsWith('image/')
            const isVideo = selected.type.startsWith('video/')

            if (!isImage && !isVideo) {
                alert('Only images and videos are allowed')
                return
            }

            setFile(selected)
            setPreview(URL.createObjectURL(selected))
            setEditorMode('edit')
        }
    }

    const handleDrag = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        let clientX, clientY

        if ('touches' in e) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else {
            clientX = e.clientX
            clientY = e.clientY
        }

        const x = ((clientX - rect.left) / rect.width) * 100
        const y = ((clientY - rect.top) / rect.height) * 100

        setTextPos({
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y))
        })
    }

    const handleUpload = async () => {
        if (!file && !textOverlay.trim()) return
        setUploading(true)
        try {
            let publicUrl = null
            let mediaType = 'text'

            if (file) {
                const fileExt = file.name.split('.').pop()
                const fileName = `${userId}-${Date.now()}.${fileExt}`
                const filePath = `${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('stories')
                    .upload(filePath, file)

                if (uploadError) throw uploadError

                const { data: { publicUrl: url } } = supabase.storage
                    .from('stories')
                    .getPublicUrl(filePath)

                publicUrl = url
                mediaType = file.type.startsWith('video/') ? 'video' : 'image'
            }

            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

            const { error: insertError } = await supabase
                .from('stories')
                .insert({
                    user_id: userId,
                    media_url: publicUrl,
                    media_type: mediaType,
                    caption,
                    text_overlay: textOverlay,
                    text_position_x: textPos.x,
                    text_position_y: textPos.y,
                    text_color: textColor,
                    font_style: fontStyle,
                    background_style: bgStyle,
                    expires_at: expiresAt
                })

            if (insertError) throw insertError

            onSuccess()
            onClose()
        } catch (error) {
            console.error('Error uploading story:', error)
            alert('Failed to upload story')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden relative my-auto shadow-2xl">
                <button onClick={onClose} className="absolute top-2 right-2 md:top-4 md:right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white z-10">
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                <div className="p-4 md:p-6">
                    <h2 className="text-xl font-bold mb-4">Post a Story</h2>

                    {editorMode === 'choose' ? (
                        <div className="space-y-4">
                            <label className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 md:p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-primary transition">
                                <Upload className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
                                <span className="text-sm md:text-base text-gray-500">Photo or Video</span>
                                <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                                <span className="text-xs text-gray-400 font-medium">OR</span>
                                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                            </div>
                            <button
                                onClick={() => {
                                    setTextOverlay('Type something...')
                                    setEditorMode('edit')
                                }}
                                className="w-full py-3 border-2 border-primary text-primary rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition"
                            >
                                <Type className="w-5 h-5" />
                                Create Text Story
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 md:space-y-4">
                            <div
                                className={`aspect-[9/16] max-h-[50vh] md:max-h-none rounded-xl overflow-hidden relative cursor-crosshair ${!file ? bgStyle : 'bg-black'}`}
                                onMouseMove={handleDrag}
                                onTouchMove={handleDrag}
                                onMouseUp={() => setIsDragging(false)}
                                onTouchEnd={() => setIsDragging(false)}
                            >
                                {file && (
                                    file.type.startsWith('video/') ? (
                                        <video src={preview!} className="w-full h-full object-contain" autoPlay muted loop />
                                    ) : (
                                        <img src={preview!} className="w-full h-full object-contain pointer-events-none shadow-2xl" alt="Preview" />
                                    )
                                )}

                                {textOverlay && (
                                    <div
                                        onMouseDown={() => setIsDragging(true)}
                                        onTouchStart={() => setIsDragging(true)}
                                        style={{
                                            position: 'absolute',
                                            left: `${textPos.x}%`,
                                            top: `${textPos.y}%`,
                                            transform: 'translate(-50%, -50%)',
                                            color: textColor,
                                            fontFamily: fontStyle,
                                            userSelect: 'none',
                                            cursor: 'move',
                                            whiteSpace: 'nowrap',
                                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                            fontSize: 'clamp(1rem, 5vw, 1.5rem)',
                                            fontWeight: 'bold',
                                        }}
                                        className="px-2 py-1 rounded-md transition-all active:scale-110"
                                    >
                                        {textOverlay}
                                    </div>
                                )}

                                <div className="absolute top-4 left-4 flex flex-col gap-2">
                                    <button
                                        onClick={() => setShowTextControls(!showTextControls)}
                                        className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition"
                                    >
                                        <Type className="w-5 h-5" />
                                    </button>
                                    {!file && (
                                        <button
                                            onClick={() => {
                                                const bgs = [
                                                    'bg-gradient-to-br from-purple-600 to-blue-500',
                                                    'bg-gradient-to-br from-pink-500 to-orange-400',
                                                    'bg-gradient-to-br from-green-400 to-cyan-500',
                                                    'bg-gradient-to-br from-gray-900 to-gray-600',
                                                    'bg-red-500'
                                                ];
                                                const currentIndex = bgs.indexOf(bgStyle);
                                                setBgStyle(bgs[(currentIndex + 1) % bgs.length]);
                                            }}
                                            className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition"
                                        >
                                            <Palette className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {showTextControls && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Text Overlay (Optional)</label>
                                        <button onClick={() => setShowTextControls(false)} className="text-xs text-primary hover:underline">Hide</button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Add text to your story..."
                                        value={textOverlay}
                                        onChange={(e) => setTextOverlay(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 font-medium"
                                        autoFocus
                                    />

                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <Palette className="w-4 h-4 text-gray-400" />
                                            <input
                                                type="color"
                                                value={textColor}
                                                onChange={(e) => setTextColor(e.target.value)}
                                                className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                                            />
                                        </div>

                                        <select
                                            value={fontStyle}
                                            onChange={(e) => setFontStyle(e.target.value)}
                                            className="flex-1 px-3 py-1.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm outline-none"
                                        >
                                            <option value="sans-serif">Modern Sans</option>
                                            <option value="serif">Classic Serif</option>
                                            <option value="monospace">Tech Mono</option>
                                            <option value="cursive">Fancy Script</option>
                                        </select>
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-center italic">Tip: Drag text on the image to position it</p>
                                </div>
                            )}

                            <input
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:border-gray-600"
                            />

                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="w-full py-3 md:py-4 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-500/20 active:scale-95 text-sm md:text-base"
                            >
                                {uploading ? 'Posting Story...' : 'Share Story'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

interface StoryModalProps {
    story: any
    onClose: () => void
    onViewed?: () => void
}

export function StoryModal({ story, onClose, onViewed }: StoryModalProps) {
    const supabase = createClient() as any
    const { user } = useAuthStore()
    const [viewers, setViewers] = useState<any[]>([])
    const [showViewers, setShowViewers] = useState(false)
    const isOwner = story.user_id === user?.id

    useEffect(() => {
        if (!user || !story) return

        const recordView = async () => {
            if (isOwner) return
            await supabase
                .from('story_views')
                .insert({
                    story_id: story.id,
                    viewer_id: user.id
                })
        }

        const fetchViewers = async () => {
            if (!isOwner) return
            const { data, error } = await supabase
                .from('story_views')
                .select('*, profiles(*)')
                .eq('story_id', story.id)
                .order('viewed_at', { ascending: false })

            if (!error && data) {
                setViewers(data)
            }
        }

        recordView()
        fetchViewers()
    }, [story.id, user?.id, isOwner])

    const formatViewTime = (timestamp: string) => {
        const date = new Date(timestamp)
        const now = new Date()
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

        if (diffInHours < 24) {
            return format(date, 'h:mm a')
        } else {
            return formatDistanceToNow(date) + ' ago'
        }
    }

    return (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
            <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-20">
                <X className="w-8 h-8" />
            </button>

            <div className="relative w-full max-w-lg aspect-[9/16] bg-black overflow-hidden flex flex-col">
                {/* User Info Header */}
                <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center gap-3">
                    {story.profiles.profile_photo_url ? (
                        <img src={story.profiles.profile_photo_url} className="w-10 h-10 rounded-full object-cover border-2 border-primary" alt="" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                            {story.profiles.username[0].toUpperCase()}
                        </div>
                    )}
                    <span className="text-white font-bold">{story.profiles.username}</span>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex items-center justify-center relative bg-gray-900 overflow-hidden">
                    {story.media_type === 'image' && story.media_url ? (
                        <img src={story.media_url} className="w-full h-full object-contain pointer-events-none" alt="" />
                    ) : story.media_type === 'video' && story.media_url ? (
                        <video src={story.media_url} className="w-full h-full object-contain" autoPlay muted loop playsInline />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center p-8 ${story.background_style || 'bg-gradient-to-br from-purple-600 to-blue-500'}`}>
                            {/* Text story content is layered below the overlay */}
                        </div>
                    )}

                    {story.text_overlay && (
                        <div
                            style={{
                                position: 'absolute',
                                left: `${story.text_position_x}%`,
                                top: `${story.text_position_y}%`,
                                transform: 'translate(-50%, -50%)',
                                color: story.text_color,
                                fontFamily: story.font_style,
                                fontSize: 'clamp(1rem, 6vw, 2.5rem)',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                                pointerEvents: 'none',
                                width: '90%',
                                wordBreak: 'break-word',
                                whiteSpace: 'normal'
                            }}
                        >
                            {story.text_overlay}
                        </div>
                    )}
                </div>

                {/* Footer / Caption */}
                {story.caption && !showViewers && (
                    <div className="absolute bottom-20 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white text-base md:text-lg text-center break-words">{story.caption}</p>
                    </div>
                )}

                {/* Owner View Controls */}
                {isOwner && (
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20 px-6">
                        <button
                            onClick={() => setShowViewers(!showViewers)}
                            className="bg-black/40 hover:bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 transition"
                        >
                            <Eye className="w-4 h-4" />
                            <span className="text-sm font-medium">{viewers.length} Views</span>
                        </button>
                    </div>
                )}

                {/* Viewers List Drawer */}
                {showViewers && (
                    <div className="absolute inset-0 bg-black/90 z-30 animate-in slide-in-from-bottom flex flex-col">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Eye className="w-5 h-5 text-primary" />
                                Views ({viewers.length})
                            </h3>
                            <button onClick={() => setShowViewers(false)} className="text-white/60 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-2">
                            {viewers.length > 0 ? (
                                <div className="space-y-1">
                                    {viewers.map((view: any) => (
                                        <div key={view.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition">
                                            <div className="flex items-center gap-3">
                                                {view.profiles?.profile_photo_url ? (
                                                    <img src={view.profiles.profile_photo_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                                                        {view.profiles?.username?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="text-white font-medium text-sm md:text-base">{view.profiles?.username}</span>
                                                    <span className="text-white/40 text-xs flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatViewTime(view.viewed_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-white/40 gap-2">
                                    <Eye className="w-12 h-12 opacity-20" />
                                    <p>No views yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
