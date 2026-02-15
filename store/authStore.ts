import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
    user: User | null
    profile: Profile | null
    setUser: (user: User | null) => void
    setProfile: (profile: Profile | null) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    profile: null,
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    logout: () => set({ user: null, profile: null }),
}))
