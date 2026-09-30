import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/inter";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { ThemeProvider } from "@/components/theme-provider";
import MainLayout from "@/components/main-layout";
import { MotionProvider } from "@/components/motion-provider";

export const metadata: Metadata = {
  title: { default: "ProductSpace | Your tasks, in flow", template: "%s | ProductSpace" },
  description: "A focused home for your tasks. Organize workspaces, plan your next step, and move work forward with ProductSpace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <MotionProvider>
            <AuthProvider>
              <MainLayout>{children}</MainLayout>
            </AuthProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
