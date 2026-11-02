import type { NextConfig } from "next";

const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const remotePatterns:NonNullable<NextConfig["images"]>["remotePatterns"]=[];
if(supabaseUrl){const url=new URL(supabaseUrl);remotePatterns.push({protocol:url.protocol.slice(0,-1) as "http"|"https",hostname:url.hostname,port:url.port,pathname:"/storage/v1/object/public/public-professional-images/**"});}
const nextConfig: NextConfig = { poweredByHeader: false, images:{remotePatterns}, experimental: { serverActions: { bodySizeLimit: "12mb" } } };
export default nextConfig;
