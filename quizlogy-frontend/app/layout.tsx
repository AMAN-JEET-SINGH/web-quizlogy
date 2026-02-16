import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Poppins } from "next/font/google";
import { VisitorTracker } from "@/components/VisitorTracker";
import { LarapushScript } from "@/components/LarapushScript";
import GlobalRipple from "@/components/GlobalRipple";
import SplashPreloader from "@/components/SplashPreloader";


export const metadata: Metadata = {
  title: "Quizwala - Play Quizzes, Earn Coins, Win Prizes",
  description:
    "Join Quizwala - India's leading quiz platform. Test your knowledge, compete in contests, earn coins, and win exciting prizes.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to important origins for faster loading */}
        <link rel="preconnect" href="https://api.quizlogy.com" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
        <link rel="dns-prefetch" href="https://api.quizlogy.com" />
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        <link rel="dns-prefetch" href="https://static.cloudflareinsights.com" />
        {/* Preload critical images */}
        <link rel="preload" as="image" href="/logo.svg" />
        <link rel="preload" as="image" href="/bg-quiz.svg" />
        <link rel="preload" as="image" href="/bg-black.svg" />
        <link rel="preload" as="image" href="/coin.svg" />
        <link rel="preload" as="image" href="/coin2.svg" />
        <link rel="preload" as="image" href="/trophy.svg" />
        <link rel="preload" as="image" href="/star.svg" />
       
        
      </head>
      <body className={`${poppins.variable} antialiased app-bg`}>
        
        
        {/* <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7998229594949316"
     crossOrigin="anonymous"></script> */}


        <VisitorTracker />
        <LarapushScript />
        <GlobalRipple />

        <SplashPreloader>
          <main className="mobile-container">
            {children}
          </main>
        </SplashPreloader>
      </body>
    </html>
  );
}
