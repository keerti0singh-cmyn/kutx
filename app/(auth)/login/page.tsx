'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient() as any

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        let loginEmail = identifier

        // If identifier is not an email, try to resolve it from profiles
        if (!identifier.includes('@')) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .ilike('username', identifier)
                .maybeSingle()

            if (profileError || !profile || !profile.email) {
                setError('Username not found or invalid identifier')
                setLoading(false)
                return
            }
            loginEmail = profile.email
        }

        const { data, error: authError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password,
        })

        if (authError) {
            setError(authError.message)
            setLoading(false)
        } else if (data.user) {
            if (!data.user.email_confirmed_at) {
                setError('Please verify your email before logging in.')
                await supabase.auth.signOut()
                setLoading(false)
                return
            }
            router.push('/chat')
            router.refresh()
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Login to KUTX</h2>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded transition-all animate-in fade-in duration-300">
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label htmlFor="identifier" className="block text-sm font-medium mb-2">
                        Email or Username
                    </label>
                    <input
                        type="text"
                        id="identifier"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 transition-all font-medium"
                        placeholder="you@example.com or username"
                    />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label htmlFor="password" className="block text-sm font-medium">
                            Password
                        </label>
                        <Link href="/forgot-password" summer-friendly="true" className="text-xs text-primary hover:underline font-medium">
                            Forgot Password?
                        </Link>
                    </div>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 transition-all font-medium"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-primary/20 active:scale-95 mt-2"
                >
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>

            <div className="mt-8 text-center text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                    Don't have an account?{' '}
                    <Link href="/signup" className="text-primary hover:underline font-semibold">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    )
}
