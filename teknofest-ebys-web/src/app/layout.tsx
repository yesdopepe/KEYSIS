import type { Metadata } from "next";
import { Lexend, Source_Sans_3 } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TEMA_ON_YUKLEME_SCRIPTI } from "@/lib/tema";

const lexend = Lexend({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/**
 * Tinos is what the PDF export embeds — loading the same face here makes the
 * on-screen document preview match the exported file rather than merely
 * resembling it.
 */
const belgeFont = localFont({
  variable: "--font-belge",
  display: "swap",
  src: [
    { path: "../../assets/fonts/Tinos-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../assets/fonts/Tinos-Italic.ttf", weight: "400", style: "italic" },
    { path: "../../assets/fonts/Tinos-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../assets/fonts/Tinos-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
});

export const metadata: Metadata = {
  title: "e-Başvuru — Akıllı Evrak ve Yazışma Sistemi",
  description: "Kamu evrak ve yazışma süreçleri için yapay zeka destekli agent sistemi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={cn("h-full", "antialiased", lexend.variable, sourceSans.variable, belgeFont.variable)}
      // The head script below adds/removes `dark` on this element while the
      // browser parses the HTML, so the class list React hydrates against is
      // deliberately not the one it rendered.
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before the first paint. In <head> and
            inline on purpose: anything that waits for the bundle (or for an
            effect) paints the light palette first and flashes. */}
        <script dangerouslySetInnerHTML={{ __html: TEMA_ON_YUKLEME_SCRIPTI }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)] font-body">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
