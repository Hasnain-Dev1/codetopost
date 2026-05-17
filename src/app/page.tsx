"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");

  const loginWithGithub = async () => {
    setIsGithubLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) setError(error.message);
    } catch (err) { setError("An error occurred."); } 
    finally { setIsGithubLoading(false); }
  };

  const loginWithEmail = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setIsEmailLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) setError(error.message);
      if (!error) setEmailSent(true);
    } catch (err) { setError("An error occurred."); } 
    finally { setIsEmailLoading(false); }
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
        <header className="flex h-16 shrink-0 items-center border-b border-white/10 px-4 sm:px-6 relative z-10">
          <div className="flex items-center gap-2.5 anim-fade-up">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7"><path d="M8 4C6 4 5 5 5 7V10C5 11 4 12 2 12C4 12 5 13 5 14V17C5 19 6 20 8 20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/><path d="M14 12H22M22 12L18 8M22 12L18 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/></svg>
            <span className="text-sm font-semibold tracking-tight"><span className="font-mono">Code</span><span className="font-sans">ToPost</span></span>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6 relative z-10">
          <div className="max-w-md w-full text-center space-y-6">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-none anim-fade-up" style={{ animationDelay: "0.2s" }}>Beautiful Code.<br /><span className="text-zinc-500">Zero Effort.</span></h1>
            <p className="text-base sm:text-lg text-zinc-400 font-light leading-relaxed anim-fade-up" style={{ animationDelay: "0.4s" }}>Stop taking ugly screenshots. Sign in to unlock AI captions, premium themes, and custom branding.</p>

            <div className="space-y-3 anim-fade-up" style={{ animationDelay: "0.6s" }}>
              {/* GITHUB BUTTON */}
              <Button onClick={loginWithGithub} disabled={isGithubLoading} className="w-full h-12 px-8 bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                {isGithubLoading ? "Connecting..." : "Continue with GitHub"}
              </Button>

              <div className="flex items-center gap-4 py-2">
                <Separator className="flex-grow h-px bg-white/10" />
                <span className="text-xs text-zinc-600 font-medium">OR</span>
                <Separator className="flex-grow h-px bg-white/10" />
              </div>

              {/* EMAIL FORM */}
              {emailSent ? (
                <div className="bg-zinc-900 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-emerald-400 mb-1">Check your inbox! 📬</h3>
                  <p className="text-sm text-zinc-400">We sent a magic link to your email. Click it to log in.</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 h-12 px-4 rounded-xl border border-white/10 bg-zinc-950 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  />
                  <Button onClick={loginWithEmail} disabled={isEmailLoading} variant="outline" className="h-12 px-6 border-white/10 hover:bg-zinc-800 hover:text-white text-sm transition-colors shrink-0">
                    {isEmailLoading ? "Sending..." : "Send Link"}
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500 font-medium anim-fade-up">{error}</p>}
          </div>
        </div>

        <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[500px] h-[500px] opacity-10 pointer-events-none select-none z-0 anim-float">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500 rounded-full blur-[120px]" />
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full drop-shadow-2xl"><path d="M8 4C6 4 5 5 5 7V10C5 11 4 12 2 12C4 12 5 13 5 14V17C5 19 6 20 8 20" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"/><path d="M14 12H22M22 12L18 8M22 12L18 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"/></svg>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </main>
    </>
  );
}