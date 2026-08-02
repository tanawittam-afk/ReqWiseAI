import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const bodySans = Inter({
  variable: "--font-body-sans",
  subsets: ["latin"],
});

const displaySans = Space_Grotesk({
  variable: "--font-display-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReqWise AI",
  description:
    "AI-assisted requirements analysis: unstructured business input into validated, traceable, human-reviewable software requirements.",
};

/**
 * Sets `data-theme` before first paint so there is no light-then-dark flash. Reads a
 * stored preference first; falls back to the OS preference on a first visit. Inline
 * and tiny on purpose — anything heavier here is the flash it exists to prevent.
 */
const themeInitScript = `(function(){try{var s=localStorage.getItem("reqwise-theme");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodySans.variable} ${displaySans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
