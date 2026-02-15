/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'oxtomavjxpzjvqbybbfw.supabase.co',
            },
        ],
    },
};

export default nextConfig;
