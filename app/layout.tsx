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
 * Sets `data-theme` and `data-locale` before first paint so there is no light-then-dark
 * flash and no English-then-Thai flash. Theme reads a stored preference first, falling
 * back to the OS preference on a first visit; locale has no OS signal to fall back to,
 * so an unset preference simply stays English (the default the server already rendered).
 * Inline and tiny on purpose — anything heavier here is the flash it exists to prevent.
 */
const themeInitScript = `(function(){try{var s=localStorage.getItem("reqwise-theme");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);var l=localStorage.getItem("reqwise-locale");if(l==="th"){document.documentElement.setAttribute("data-locale","th");document.documentElement.setAttribute("lang","th");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
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
