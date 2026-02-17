'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            setSuccess(true)
            setLoading(false)
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-auto">
            <Link href="/login" className="flex items-center gap-2 text-primary hover:underline mb-6 text-sm font-medium">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
            </Link>

            <h2 className="text-2xl font-bold mb-2">Forgot Password?</h2>
            <p className="text-gray-500 mb-8 text-sm">
                Enter your email address and we'll send you a link to reset your password.
            </p>

            {success ? (
                <div className="text-center py-8 animate-in zoom-in duration-300">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Check your email</h3>
                    <p className="text-gray-500 mb-6 text-sm px-4">
                        We've sent a password reset link to <span className="font-bold text-gray-700 dark:text-gray-300">{email}</span>.
                    </p>
                    <button
                        onClick={() => setSuccess(false)}
                        className="text-primary hover:underline font-medium"
                    >
                        Didn't receive it? Try again
                    </button>
                </div>
            ) : (
                <form onSubmit={handleResetRequest} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm animate-in fade-in duration-300">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium mb-2">
                            Email Address
                        </label>
                        <div className="relative">
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none dark:bg-gray-700 dark:border-gray-600 transition-all font-medium"
                                placeholder="you@example.com"
                            />
                            <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold shadow-lg shadow-primary/20 active:scale-95"
                    >
                        {loading ? 'Sending link...' : 'Send Reset Link'}
                    </button>
                </form>
            )}
        </div>
    )
}
