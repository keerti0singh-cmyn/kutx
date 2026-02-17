'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Lock, ShieldCheck, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(true)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        // Check if we have a recovery session
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                // In some flows, the user is automatically logged in after clicking the link 
                // but needs to update their password.
                // If no session, we might be on a bad link.
                // However, Supabase often handles the redirect with a token in the URL.
                // Let's wait a bit for Supabase to parse the URL.
                setTimeout(async () => {
                    const { data: { session: retrySession } } = await supabase.auth.getSession()
                    if (!retrySession) {
                        setError('Invalid or expired reset link. Please request a new one.')
                    }
                    setVerifying(false)
                }, 1000)
            } else {
                setVerifying(false)
            }
        }
        checkSession()
    }, [supabase])

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setLoading(true)

        const { error } = await supabase.auth.updateUser({
            password: password
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            setSuccess(true)
            setLoading(false)
            setTimeout(() => {
                router.push('/login')
            }, 3000)
        }
    }

    if (verifying) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-auto text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Verifying reset link...</p>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-auto">
            <h2 className="text-2xl font-bold mb-2">Reset Password</h2>
            <p className="text-gray-500 mb-8 text-sm">
                Choose a strong new password for your account.
            </p>

            {success ? (
                <div className="text-center py-8 animate-in zoom-in duration-300">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Password Updated!</h3>
                    <p className="text-gray-500 mb-6 text-sm">
                        Your password has been changed successfully. Redirecting you to login...
                    </p>
                </div>
            ) : (
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm animate-in fade-in duration-300">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 transition-all font-medium"
                                    placeholder="••••••••"
                                />
                                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 transition-all font-medium"
                                    placeholder="••••••••"
                                />
                                <ShieldCheck className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold shadow-lg shadow-primary/20 active:scale-95 mt-4"
                    >
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            )}
        </div>
    )
}
