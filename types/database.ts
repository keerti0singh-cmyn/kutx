export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            blocks: {
                Row: {
                    blocked_id: string
                    blocker_id: string
                    created_at: string
                    id: string
                }
                Insert: {
                    blocked_id: string
                    blocker_id: string
                    created_at?: string
                    id?: string
                }
                Update: {
                    blocked_id?: string
                    blocker_id?: string
                    created_at?: string
                    id?: string
                }
            }
            files: {
                Row: {
                    file_size: number
                    file_type: string
                    id: string
                    message_id: string
                    original_filename: string
                    storage_url: string
                    stored_filename: string
                    uploaded_at: string | null
                    uploaded_by: string
                }
                Insert: {
                    file_size: number
                    file_type: string
                    id?: string
                    message_id: string
                    original_filename: string
                    storage_url: string
                    stored_filename: string
                    uploaded_at?: string | null
                    uploaded_by: string
                }
                Update: {
                    file_size?: number
                    file_type?: string
                    id?: string
                    message_id?: string
                    original_filename?: string
                    storage_url?: string
                    stored_filename?: string
                    uploaded_at?: string | null
                    uploaded_by?: string
                }
            }
            friend_requests: {
                Row: {
                    id: string
                    reason: string | null
                    receiver_id: string
                    responded_at: string | null
                    sender_id: string
                    sent_at: string | null
                    status: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    reason?: string | null
                    receiver_id: string
                    responded_at?: string | null
                    sender_id: string
                    sent_at?: string | null
                    status?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    reason?: string | null
                    receiver_id?: string
                    responded_at?: string | null
                    sender_id?: string
                    sent_at?: string | null
                    status?: string | null
                    updated_at?: string | null
                }
            }
            friends: {
                Row: {
                    created_at: string | null
                    friend_id: string
                    id: string
                    user_id: string
                }
                Insert: {
                    created_at?: string | null
                    friend_id: string
                    id?: string
                    user_id: string
                }
                Update: {
                    created_at?: string | null
                    friend_id?: string
                    id?: string
                    user_id?: string
                }
            }
            messages: {
                Row: {
                    content: string
                    created_at: string | null
                    delivered_at: string | null
                    edited_at: string | null
                    file_id: string | null
                    id: string
                    is_deleted: boolean | null
                    message_type: string | null
                    read_at: string | null
                    receiver_id: string
                    sender_id: string
                    status: 'sent' | 'delivered' | 'seen' | null
                    file_url: string | null
                    file_size: number | null
                }
                Insert: {
                    content: string
                    created_at?: string | null
                    delivered_at?: string | null
                    edited_at?: string | null
                    file_id?: string | null
                    id?: string
                    is_deleted?: boolean | null
                    message_type?: string | null
                    read_at?: string | null
                    receiver_id: string
                    sender_id: string
                    status?: 'sent' | 'delivered' | 'seen' | null
                    file_url?: string | null
                    file_size?: number | null
                }
                Update: {
                    content?: string
                    created_at?: string | null
                    delivered_at?: string | null
                    edited_at?: string | null
                    file_id?: string | null
                    id?: string
                    is_deleted?: boolean | null
                    message_type?: string | null
                    read_at?: string | null
                    receiver_id?: string
                    sender_id?: string
                    status?: 'sent' | 'delivered' | 'seen' | null
                    file_url?: string | null
                    file_size?: number | null
                }
            }
            notifications: {
                Row: {
                    content: string | null
                    created_at: string | null
                    id: string
                    is_read: boolean | null
                    reference_id: string | null
                    type: string
                    user_id: string
                }
                Insert: {
                    content?: string | null
                    created_at?: string | null
                    id?: string
                    is_read?: boolean | null
                    reference_id?: string | null
                    type: string
                    user_id: string
                }
                Update: {
                    content?: string | null
                    created_at?: string | null
                    id?: string
                    is_read?: boolean | null
                    reference_id?: string | null
                    type?: string
                    user_id?: string
                }
            }
            profiles: {
                Row: {
                    bio: string | null
                    created_at: string | null
                    deleted_at: string | null
                    id: string
                    last_seen_at: string | null
                    profile_photo_url: string | null
                    status: string | null
                    updated_at: string | null
                    user_id: string
                    username: string
                }
                Insert: {
                    bio?: string | null
                    created_at?: string | null
                    deleted_at?: string | null
                    id?: string
                    last_seen_at?: string | null
                    profile_photo_url?: string | null
                    status?: string | null
                    updated_at?: string | null
                    user_id: string
                    username: string
                }
                Update: {
                    bio?: string | null
                    created_at?: string | null
                    deleted_at?: string | null
                    id?: string
                    last_seen_at?: string | null
                    profile_photo_url?: string | null
                    status?: string | null
                    updated_at?: string | null
                    user_id?: string
                    username?: string
                }
            }
            stories: {
                Row: {
                    caption: string | null
                    created_at: string
                    expires_at: string
                    id: string
                    media_type: string
                    media_url: string
                    user_id: string
                    text_overlay: string | null
                    text_position_x: number | null
                    text_position_y: number | null
                    text_color: string | null
                    font_style: string | null
                }
                Insert: {
                    caption?: string | null
                    created_at?: string
                    expires_at?: string
                    id?: string
                    media_type?: string
                    media_url: string
                    user_id: string
                    text_overlay?: string | null
                    text_position_x?: number | null
                    text_position_y?: number | null
                    text_color?: string | null
                    font_style?: string | null
                }
                Update: {
                    caption?: string | null
                    created_at?: string
                    expires_at?: string
                    id?: string
                    media_type?: string
                    media_url?: string
                    user_id?: string
                    text_overlay?: string | null
                    text_position_x?: number | null
                    text_position_y?: number | null
                    text_color?: string | null
                    font_style?: string | null
                }
            }
            story_views: {
                Row: {
                    id: string
                    story_id: string
                    viewed_at: string | null
                    viewer_id: string
                }
                Insert: {
                    id?: string
                    story_id: string
                    viewed_at?: string | null
                    viewer_id: string
                }
                Update: {
                    id?: string
                    story_id?: string
                    viewed_at?: string | null
                    viewer_id?: string
                }
            }
        }
        Enums: {
            message_status: "sent" | "delivered" | "seen"
        }
    }
}
