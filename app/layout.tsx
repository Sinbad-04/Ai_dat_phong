import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "An Lành Bay — Trợ lý đặt phòng AI",
  description:
    "Trợ lý đặt phòng & tư vấn gói nghỉ dưỡng thông minh: hỏi nhu cầu, gợi ý phòng phù hợp, giải đáp chính sách 24/7.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-teal/10 py-8">
          <div className="container-px flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink/60">
            <span>© {new Date().getFullYear()} An Lành Bay Resort & Spa — Bãi Dài, Cam Ranh.</span>
            <span className="font-mono text-xs">AI20K-194 · RAG + LLM</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
