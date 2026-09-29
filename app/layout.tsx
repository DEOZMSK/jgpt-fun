import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { SiteLocaleProvider } from "./components/SiteLocaleProvider";
import "./globals.css";
export const metadata: Metadata = {metadataBase:new URL("https://jgpt.fun"),title:"JGPT-FUN · Jyotish laboratory",description:"Open Jyotish calculation laboratory",manifest:"/manifest.webmanifest",robots:{index:false,follow:true}};
export const viewport: Viewport = {width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#ffffff"};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="ru"><body><Suspense><SiteLocaleProvider locale="ru">{children}</SiteLocaleProvider></Suspense></body></html>;
}
