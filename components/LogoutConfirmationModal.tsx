'use client'

import { AlertTriangle, LogOut, X } from 'lucide-react'

interface LogoutConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
}

export default function LogoutConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
}: LogoutConfirmationModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-300">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Confirm Logout
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        Are you sure you want to logout? You will need to login again to access your chats and friends.
                    </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-6 flex flex-col sm:flex-row-reverse gap-3">
                    <button
                        onClick={onConfirm}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition shadow-lg shadow-red-600/20"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
