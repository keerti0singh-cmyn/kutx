import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PresenceProvider from "@/components/PresenceProvider";
import GlobalCallProvider from "@/components/GlobalCallProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "KUTX - Real-Time Messaging",
    description: "Secure 1-to-1 messaging platform with real-time communication",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <PresenceProvider>
                    <GlobalCallProvider>
                        {children}
                    </GlobalCallProvider>
                </PresenceProvider>
            </body>
        </html>
    );
}
