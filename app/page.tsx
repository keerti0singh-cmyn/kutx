import Link from 'next/link'

export default function Home() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
            <h1 className="text-4xl font-bold mb-4">Welcome to KUTX</h1>
            <p className="text-xl text-gray-600 mb-8">Secure real-time messaging platform.</p>
            <div className="flex gap-4">
                <Link
                    href="/login"
                    className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition"
                >
                    Login
                </Link>
                <Link
                    href="/signup"
                    className="border border-primary text-primary px-6 py-2 rounded-lg hover:bg-primary/10 transition"
                >
                    Sign Up
                </Link>
            </div>
        </div>
    )
}
