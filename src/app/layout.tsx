import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "סטודיו דב אברמסון | ניהול פרויקטים",
  description: "מערכת ניהול הסטודיו - לוחות, משימות, זמנים וקטלוג פרויקטים",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={assistant.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
