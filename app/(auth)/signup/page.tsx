'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Check, X, Loader2 } from 'lucide-react'

export default function SignupPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [emailError, setEmailError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null)
    const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(null)
    const [checkingUsername, setCheckingUsername] = useState(false)
    const [checkingEmail, setCheckingEmail] = useState(false)

    const router = useRouter()
    const supabase = createClient() as any

    // Real-time Username Check
    useEffect(() => {
        const checkUsername = async () => {
            if (username.length < 3) {
                setIsUsernameAvailable(null)
                return
            }

            setCheckingUsername(true)
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .ilike('username', username) // Use ILIKE for case-insensitive check
                .maybeSingle()

            setCheckingUsername(false)
            if (!error) {
                setIsUsernameAvailable(!data)
            }
        }

        const debounceTimer = setTimeout(checkUsername, 500)
        return () => clearTimeout(debounceTimer)
    }, [username, supabase])

    // Real-time Email Check
    useEffect(() => {
        const checkEmail = async () => {
            if (email.length < 5 || !email.includes('@')) {
                setIsEmailAvailable(null)
                return
            }

            setCheckingEmail(true)
            // Note: In Supabase, testing email existence is trickier because auth.users is protected.
            // However, we can try to RPC or assume unique constraint will catch it if we can't query it.
            // For now, let's just use the existing signup error handling, but we can try a dummy lookup if profiles had emails.
            // Since profiles don't consistently have emails in this schema, we'll keep email check as 'pending' until submit or use a helper if available.
            setCheckingEmail(false)
        }

        const debounceTimer = setTimeout(checkEmail, 500)
        return () => clearTimeout(debounceTimer)
    }, [email])

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setEmailError(null)
        setLoading(true)

        // Validate password
        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            setLoading(false)
            return
        }

        // Validate username
        if (username.length < 3 || username.length > 20) {
            setError('Username must be between 3 and 20 characters')
            setLoading(false)
            return
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError('Username can only contain letters, numbers, and underscores')
            setLoading(false)
            return
        }

        // Check if username is already taken (Double check on submit)
        if (isUsernameAvailable === false) {
            setError('Username already taken')
            setLoading(false)
            return
        }

        // Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        })

        if (authError) {
            const msg = authError.message.toLowerCase()
            if (msg.includes('already registered') ||
                msg.includes('already exists') ||
                msg.includes('unique constraint') ||
                authError.status === 422) {
                setEmailError('This email is already registered. Please login.')
            } else {
                setError(authError.message)
            }
            setLoading(false)
            return
        }

        if (authData.user) {
            // Update the auto-generated profile with the chosen username
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ username })
                .eq('user_id', authData.user.id)

            if (profileError) {
                setError('Failed to create profile. Please try again.')
                setLoading(false)
                return
            }

            router.push('/chat')
            router.refresh()
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Create Account</h2>

            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded transition-all animate-in fade-in duration-300">
                    {error}
                </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium mb-2 flex justify-between items-center">
                        Username
                        {checkingUsername && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                        {!checkingUsername && isUsernameAvailable === true && <Check className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />}
                        {!checkingUsername && isUsernameAvailable === false && <X className="w-4 h-4 text-red-500 animate-in zoom-in duration-300" />}
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 transition-all ${isUsernameAvailable === false ? 'border-red-500 ring-1 ring-red-500' :
                                isUsernameAvailable === true ? 'border-green-500' : ''
                                }`}
                            placeholder="johndoe"
                            minLength={3}
                            maxLength={20}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        3-20 characters, letters, numbers, and underscores only
                    </p>
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2 flex justify-between items-center">
                        Email
                        {checkingEmail && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                        {!checkingEmail && isEmailAvailable === true && <Check className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />}
                        {emailError && <X className="w-4 h-4 text-red-500 animate-in zoom-in duration-300" />}
                    </label>
                    <div className="relative">
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                if (emailError) setEmailError(null)
                                if (isEmailAvailable !== null) setIsEmailAvailable(null)
                            }}
                            required
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 transition-all ${emailError ? 'border-red-500 ring-1 ring-red-500' :
                                isEmailAvailable === true ? 'border-green-500' : ''
                                }`}
                            placeholder="you@example.com"
                        />
                    </div>
                    {emailError && (
                        <p className="text-xs text-red-500 mt-1 font-medium animate-in slide-in-from-top-1 duration-200">
                            {emailError}
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-2">
                        Password
                    </label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600"
                        placeholder="••••••••"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        At least 8 characters
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-primary/20"
                >
                    {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
            </form>

            <div className="mt-6 text-center text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                    Already have an account?{' '}
                    <Link href="/login" className="text-primary hover:underline font-semibold">
                        Login
                    </Link>
                </p>
            </div>
        </div>
    )
}
