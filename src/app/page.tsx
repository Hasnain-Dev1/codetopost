"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const loginWithGithub = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) alert(`Login failed: ${error.message}`);
    } catch (err) {
      alert(`JS Error: ${err}`);
    }
  };

  return (
    <>
      <style jsx global>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        .anim-fade-up { opacity: 0; animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .anim-float { animation: float 6s ease-in-out infinite; }
      `}</style>

      <main className="relative flex min-h-screen flex-col bg-black text-white overflow-hidden">
        <header className="flex h-16 shrink-0 items-center border-b border-white/10 px-6 relative z-10">
          <div className="flex items-center gap-2.5 anim-fade-up">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path d="M8 4C6 4 5 5 5 7V10C5 11 4 12 2 12C4 12 5 13 5 14V17C5 19 6 20 8 20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/>
              <path d="M14 12H22M22 12L18 8M22 12L18 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/>
            </svg>
            <span className="text-sm font-semibold tracking-tight"><span className="font-mono">Code</span><span className="font-sans">ToPost</span></span>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6 relative z-10">
          <div className="max-w-2xl text-center space-y-6">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-none anim-fade-up" style={{ animationDelay: "0.2s" }}>Beautiful Code.<br /><span className="text-zinc-500">Zero Effort.</span></h1>
            <p className="text-base sm:text-lg text-zinc-400 font-light leading-relaxed max-w-md mx-auto anim-fade-up" style={{ animationDelay: "0.4s" }}>Stop taking ugly screenshots. Sign in to unlock AI captions, premium themes, and custom branding.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 anim-fade-up" style={{ animationDelay: "0.6s" }}>
              <Button className="w-full sm:w-auto h-12 px-8 bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]" onClick={loginWithGithub}>Continue with GitHub</Button>
              <Separator orientation="vertical" className="hidden sm:block h-8 bg-white/10" />
              <Button variant="outline" className="w-full sm:w-auto h-12 px-8 border-white/20 text-sm opacity-50 cursor-not-allowed" disabled>Email (Soon)</Button>
            </div>
          </div>
        </div>

        <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[500px] h-[500px] opacity-10 pointer-events-none select-none z-0 anim-float">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500 rounded-full blur-[120px]" />
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full drop-shadow-2xl">
            <path d="M8 4C6 4 5 5 5 7V10C5 11 4 12 2 12C4 12 5 13 5 14V17C5 19 6 20 8 20" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"/>
            <path d="M14 12H22M22 12L18 8M22 12L18 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"/>
          </svg>
        </div>
      </main>
    </>
  );
}