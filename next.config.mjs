/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Crossroads Private Line (Legal-Leaf-Market/messaging) is proxied in at
  // /messaging. netlify.toml does this at Netlify's edge; this copy does the
  // same on any other host. Next strips the trailing slash before rewrites
  // run, so /messaging/ arrives here as /messaging, and the page loads its
  // script by absolute path so it works at either URL.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/messaging", destination: "https://messging.netlify.app/messaging/" },
        { source: "/messaging/:path*", destination: "https://messging.netlify.app/messaging/:path*" },
      ],
    };
  },
};

export default nextConfig;
