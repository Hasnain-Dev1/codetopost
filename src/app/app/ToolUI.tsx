"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toPng, toSvg, toBlob } from "html-to-image";

// ═══════════════════════════════════════════════════════════════
// THEME CONFIG (WITH LIGHT THEME SUPPORT)
// ═══════════════════════════════════════════════════════════════
interface ThemeConfig { 
  name: string; 
  style: string; 
  codeBg: string; 
  headerBg: string; 
  text: string; 
  windowText: string;
  isPro?: boolean; 
  isLight?: boolean;
}

const ALL_THEMES: Record<string, ThemeConfig> = {
  midnight: { name: "Midnight", style: "bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950", codeBg: "bg-zinc-900/95", headerBg: "bg-zinc-900/50", text: "text-zinc-300", windowText: "text-zinc-400" },
  noir: { name: "Noir", style: "bg-[#0b0b0b]", codeBg: "bg-[#1a1a1a]", headerBg: "bg-[#1a1a1a]", text: "text-[#f5f5f7]", windowText: "text-[#999]" },
  mono: { name: "Mono", style: "bg-zinc-800", codeBg: "bg-zinc-900", headerBg: "bg-zinc-900/50", text: "text-zinc-300", windowText: "text-zinc-500" },
  candy: { name: "Candy", style: "bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500", codeBg: "bg-[#1e1028]/90", headerBg: "bg-[#1e1028]/50", text: "text-pink-100", windowText: "text-pink-200/60", isPro: true },
  sunset: { name: "Sunset", style: "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500", codeBg: "bg-[#2d1b0e]/90", headerBg: "bg-[#2d1b0e]/50", text: "text-orange-100", windowText: "text-orange-200/60" },
  breeze: { name: "Breeze", style: "bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-700", codeBg: "bg-[#0c1929]/90", headerBg: "bg-[#0c1929]/50", text: "text-cyan-100", windowText: "text-cyan-200/60" },
  forest: { name: "Forest", style: "bg-gradient-to-br from-green-800 via-emerald-950 to-teal-950", codeBg: "bg-[#0a1a12]/90", headerBg: "bg-[#0a1a12]/50", text: "text-green-200", windowText: "text-green-300/60" },
  sand: { name: "Sand", style: "bg-gradient-to-br from-amber-200 via-orange-200 to-yellow-100", codeBg: "bg-white/90", headerBg: "bg-white/80", text: "text-amber-950", windowText: "text-amber-800/60", isLight: true },
  meadow: { name: "Meadow", style: "bg-gradient-to-br from-lime-500 via-emerald-500 to-green-700", codeBg: "bg-[#0a1f0e]/90", headerBg: "bg-[#0a1f0e]/50", text: "text-lime-200", windowText: "text-lime-300/60" },
  falcon: { name: "Falcon", style: "bg-gradient-to-br from-slate-700 via-slate-900 to-blue-950", codeBg: "bg-slate-900/90", headerBg: "bg-slate-900/50", text: "text-slate-300", windowText: "text-slate-400", isPro: true },
  crimson: { name: "Crimson", style: "bg-gradient-to-br from-red-800 via-rose-900 to-red-950", codeBg: "bg-[#1f0a0a]/90", headerBg: "bg-[#1f0a0a]/50", text: "text-red-200", windowText: "text-red-300/60", isPro: true },
  ice: { name: "Ice", style: "bg-gradient-to-br from-[#BEEEF9] via-[#4B8CAB] to-[#6AC6DE]", codeBg: "bg-white/80", headerBg: "bg-white/70", text: "text-slate-800", windowText: "text-slate-600/60", isLight: true, isPro: true },
};

const THEME_CATEGORIES = { 
  minimal: ["midnight", "noir", "mono"], 
  vibrant: ["candy", "sunset", "breeze"], 
  earthy: ["forest", "sand", "meadow"], 
  pro: ["falcon", "crimson", "ice"] 
};

// ═══════════════════════════════════════════════════════════════
// LANGUAGE DETECTION
// ═══════════════════════════════════════════════════════════════
function detectLanguage(code: string): string {
  const t = code.trim();
  if (!t || t.length < 5) return "javascript";
  if (t.startsWith("#include") || /std::cout|vector<|int main\(/.test(t)) return "cpp";
  if (t.includes("<?php") || /\$\w+\s*=|->|::/.test(t)) return "php";
  if (/^#!\/bin\/(bash|sh)|^\$\s|export\s|echo\s/.test(t)) return "bash";
  if (/<[A-Z]\w/.test(t) || /from\s+['"]react['"]/.test(t)) return "tsx";
  if (/def\s+\w+\s*\(.*\):|:\s*(str|int|float|bool|list|dict)\b/.test(t)) return "python";
  if (/fn\s+\w+\s*\(|let mut\s|impl\s+\w+|::new\(\)/.test(t)) return "rust";
  if (/package\s+main|fmt\.Print|func\s+\w+|:=\s/.test(t)) return "go";
  if (/public\s+(static\s+)?(class|void|interface)|System\.out\.print/.test(t)) return "java";
  if (/using\s+System|namespace\s+\w+/.test(t)) return "csharp";
  if (/func\s+\w+\s*\(.*\)|var\s+\w+|let\s+\w+|import\s+UIKit/.test(t)) return "swift";
  if (/fun\s+\w+\s*\(.*\)|val\s+\w+|var\s+\w+|println/.test(t)) return "kotlin";
  if (/def\s+end|\.each\s+do|puts\s|require\s+'/.test(t)) return "ruby";
  if (/interface\s+\w+\s*\{|:\s*(string|number|boolean)\b/.test(t)) return "typescript";
  if (/<!DOCTYPE|<html|<div/.test(t)) return "html";
  if (/^[.#@]\w+|background-color:/.test(t)) return "css";
  return "javascript";
}

const paddings = [
  { label: "S", value: "p-4" }, 
  { label: "M", value: "p-8" }, 
  { label: "L", value: "p-16" }
];

// ═══════════════════════════════════════════════════════════════
// SKELETON LOADER COMPONENT
// ═══════════════════════════════════════════════════════════════
function CodeSkeleton({ theme }: { theme: ThemeConfig }) {
  return (
    <div className={`w-full h-full rounded-xl flex flex-col ${theme.style} p-8`}>
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-lg ${theme.headerBg} border-b ${theme.isLight ? 'border-black/10' : 'border-white/10'}`}>
        <div className="flex gap-1.5">
          <div className={`w-3 h-3 rounded-full ${theme.isLight ? 'bg-red-400' : 'bg-red-500'}`} />
          <div className={`w-3 h-3 rounded-full ${theme.isLight ? 'bg-yellow-400' : 'bg-yellow-500'}`} />
          <div className={`w-3 h-3 rounded-full ${theme.isLight ? 'bg-green-400' : 'bg-green-500'}`} />
        </div>
        <div className={`h-3 w-24 rounded ${theme.isLight ? 'bg-black/10' : 'bg-white/10'} animate-pulse`} />
      </div>
      <div className={`flex-grow rounded-b-lg ${theme.codeBg} p-6 space-y-3`}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded animate-pulse ${theme.isLight ? 'bg-black/8' : 'bg-white/8'}`}
            style={{ 
              width: `${Math.random() * 40 + 30}%`,
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXPORT HUB (FIXED: Click outside, Loading states, All buttons work)
// ═══════════════════════════════════════════════════════════════
function ExportHub({ 
  handleDownloadPng, 
  handleDownloadSvg, 
  handleCopyImage,
  handleCopyUrl,
  isExporting,
  copyImageSuccess,
  copyUrlSuccess 
}: { 
  handleDownloadPng: () => Promise<void>; 
  handleDownloadSvg: () => Promise<void>; 
  handleCopyImage: () => Promise<void>;
  handleCopyUrl: () => void;
  isExporting: boolean;
  copyImageSuccess: boolean;
  copyUrlSuccess: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // CLICK OUTSIDE TO CLOSE
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // CLOSE ON ESCAPE
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  return (
    <div className="relative z-[200]" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        disabled={isExporting}
        className="flex items-center gap-2 px-3 h-8 text-xs font-medium bg-zinc-800/50 border border-white/10 rounded-lg hover:bg-zinc-700/50 active:scale-95 active:bg-zinc-600 transition-all duration-100 disabled:opacity-50 disabled:active:scale-100"
      >
        {isExporting ? (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        )}
        {isExporting ? "Exporting..." : "Export"}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-10 w-52 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1.5 z-[300] animate-in fade-in slide-in-from-top-2 duration-150">
          <button 
            onClick={() => { handleDownloadPng(); setIsOpen(false); }} 
            disabled={isExporting}
            className="w-full text-left px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 active:scale-[0.98] active:bg-zinc-700 rounded-lg flex items-center gap-2.5 transition-all duration-75 disabled:opacity-50 disabled:active:scale-100"
          >
            <span>📸</span>
            <span>{isExporting ? "Generating..." : "Save as PNG"}</span>
            <span className="ml-auto text-[10px] text-zinc-600">2x</span>
          </button>
          
          <button 
            onClick={() => { handleDownloadSvg(); setIsOpen(false); }} 
            disabled={isExporting}
            className="w-full text-left px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 active:scale-[0.98] active:bg-zinc-700 rounded-lg flex items-center gap-2.5 transition-all duration-75 disabled:opacity-50 disabled:active:scale-100"
          >
            <span>📐</span>
            <span>{isExporting ? "Generating..." : "Save as SVG"}</span>
          </button>
          
          <div className="h-px bg-white/5 my-1" />
          
          <button 
            onClick={() => { handleCopyImage(); }} 
            disabled={isExporting}
            className="w-full text-left px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 active:scale-[0.98] active:bg-zinc-700 rounded-lg flex items-center gap-2.5 transition-all duration-75 disabled:opacity-50 disabled:active:scale-100"
          >
            <span>📋</span>
            <span>{copyImageSuccess ? "Copied! ✅" : "Copy Image"}</span>
          </button>
          
          <button 
            onClick={() => { handleCopyUrl(); }} 
            className="w-full text-left px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 active:scale-[0.98] active:bg-zinc-700 rounded-lg flex items-center gap-2.5 transition-all duration-75"
          >
            <span>🔗</span>
            <span>{copyUrlSuccess ? "Copied! ✅" : "Copy Base64"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// THEME CUSTOMIZER (FIXED: Mobile positioning)
// ═══════════════════════════════════════════════════════════════
function ThemeCustomizer({ settings, setSettings, isPro, onLockedClick }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <>
      {/* BUTTON - MOBILE SAFE POSITION */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`fixed z-50 w-12 h-12 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-2xl
          bottom-20 right-4 sm:bottom-6 sm:right-6
          ${isOpen ? 'bg-white text-black' : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      </button>
      
      {/* PANEL - MOBILE SAFE POSITION */}
      <div 
        ref={panelRef}
        className={`fixed z-50 w-72 bg-black/70 backdrop-blur-2xl border border-white/20 rounded-2xl p-3 shadow-2xl transition-all duration-300
          bottom-32 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-20 sm:w-72
          ${isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"}`}
      >
        <div className="flex items-center gap-0.5 bg-zinc-800/50 rounded-lg p-0.5 mb-3">
          {paddings.map((p) => (
            <button 
              key={p.value} 
              onClick={() => setSettings({ ...settings, padding: p.value })} 
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${settings.padding === p.value ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"}`}
            >
              {p.label}
            </button>
          ))}
          <div className="w-px h-5 bg-zinc-600 mx-1" />
          <button 
            onClick={() => setSettings({ ...settings, showLines: !settings.showLines })} 
            className={`px-2 py-1.5 text-[11px] font-bold rounded-md transition-all ${settings.showLines ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"}`}
          >
            #
          </button>
        </div>
        
        {Object.entries(THEME_CATEGORIES).map(([category, keys]) => (
          <div key={category} className="mb-2 last:mb-0">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 pl-1">
              {category} {category === 'pro' && '🔒'}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {keys.map((key) => { 
                const theme = ALL_THEMES[key]; 
                return (
                  <button 
                    key={key} 
                    onClick={() => theme.isPro && !isPro ? onLockedClick() : setSettings({ ...settings, bg: key })} 
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-all ${settings.bg === key ? "border-white bg-white/10" : "border-transparent hover:bg-white/5"}`}
                  >
                    <div className={`w-4 h-4 rounded-sm ${theme.style} ${theme.isLight ? 'border border-black/10' : ''}`} />
                    <span className="text-[10px] text-zinc-300 truncate">{theme.name}</span>
                    {theme.isPro && !isPro && <span className="text-[8px] ml-auto">🔒</span>}
                  </button>
                ); 
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// AUTOPost COMPONENT (PRO ONLY)
// ═══════════════════════════════════════════════════════════════
function AutoPostSection({ 
  caption, 
  isPro, 
  userId,
  onLockedClick,
  exportRef
}: { 
  caption: string; 
  isPro: boolean; 
  userId: string;
  onLockedClick: () => void;
  exportRef: React.RefObject<HTMLDivElement | null>;
}) { 
  
  const [twitterConnected, setTwitterConnected] = useState(false);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [isPostingTwitter, setIsPostingTwitter] = useState(false);
  const [isPostingLinkedin, setIsPostingLinkedin] = useState(false);
  const [postResult, setPostResult] = useState<{ platform: string; success: boolean; error?: string } | null>(null);

  const canPost = caption && caption.length > 0 && !caption.includes("Click 'Generate AI Caption'");

  // CHECK SUPABASE FOR EXISTING CONNECTIONS ON MOUNT
  useEffect(() => {
    const checkConnections = async () => {
      try {
        const res = await fetch(`/api/autopost/status?userId=${userId}`);
        const data = await res.json();
        if (data.connections) {
          setTwitterConnected(data.connections.includes("twitter"));
          setLinkedinConnected(data.connections.includes("linkedin"));
        }
      } catch (err) {
        console.error("Failed to check connection status");
      }
    };
    checkConnections();
  }, [userId]);

    // ADD THIS LISTENER INSIDE AutoPostSection, right under the other useEffect
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'TWITTER_CONNECTED') {
        setTwitterConnected(true);
      }
      if (event.data === 'LINKEDIN_CONNECTED') {
        setLinkedinConnected(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const connectTwitter = async () => {
    if (!isPro) { onLockedClick(); return; }
    // Open in a popup instead of redirecting!
    const width = 600;
    const height = 700;
    const left = (window.innerWidth / 2) - (width / 2);
    const top = (window.innerHeight / 2) - (height / 2);
    
    window.open(
      `/api/autopost/twitter/connect?userId=${userId}`,
      "TwitterOAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  const connectLinkedin = async () => {
    if (!isPro) { onLockedClick(); return; }
    const width = 600;
    const height = 700;
    const left = (window.innerWidth / 2) - (width / 2);
    const top = (window.innerHeight / 2) - (height / 2);

    window.open(
      `/api/autopost/linkedin/connect?userId=${userId}`,
      "LinkedInOAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  
  const postToTwitter = async () => {
    if (!canPost || !twitterConnected) return;
    setIsPostingTwitter(true);
    setPostResult(null);
    try {
      // Generate image from the export ref
      let imageBase64: string | undefined;
      
      if (exportRef?.current) {
        const dataUrl = await toPng(exportRef.current, { 
          cacheBust: true, 
          pixelRatio: 2 
        });
        imageBase64 = dataUrl;
      }

      const res = await fetch("/api/autopost/twitter/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, userId, imageBase64 })
      });
      const data = await res.json();
      setPostResult({ platform: "twitter", success: res.ok, error: data.error });
    } catch (err) {
      setPostResult({ platform: "twitter", success: false, error: "Failed to post" });
    } finally {
      setIsPostingTwitter(false);
    }
  };

  const postToLinkedin = async () => {
    if (!canPost || !linkedinConnected) return;
    setIsPostingLinkedin(true);
    setPostResult(null);
    try {
      const res = await fetch("/api/autopost/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, userId })
      });
      const data = await res.json();
      setPostResult({ platform: "linkedin", success: res.ok, error: data.error });
    } catch (err) {
      setPostResult({ platform: "linkedin", success: false, error: "Failed to post" });
    } finally {
      setIsPostingLinkedin(false);
    }
  };

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <span className="text-2xl">🚀</span>
        </div>
        <h3 className="text-lg font-bold mb-2">AutoPost is Pro Only</h3>
        <p className="text-sm text-zinc-500 mb-4 max-w-xs">
          Automatically post your code images + captions to Twitter and LinkedIn with one click.
        </p>
        <Button onClick={onLockedClick} className="bg-white text-black hover:bg-zinc-200 text-sm">
          Upgrade to Pro
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* TWITTER CARD */}
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="text-sm font-medium">X (Twitter)</span>
          </div>
          
          {!twitterConnected ? (
            <Button 
              onClick={connectTwitter} 
              variant="outline" 
              size="sm" 
              className="w-full border-white/20 text-xs hover:bg-zinc-800"
            >
              Connect Account
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Connected
              </div>
              <Button 
                onClick={postToTwitter} 
                disabled={!canPost || isPostingTwitter}
                className="w-full bg-white text-black hover:bg-zinc-200 text-xs h-9 disabled:opacity-50"
              >
                {isPostingTwitter ? (
                  <><svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Posting...</>
                ) : "Post Now"}
              </Button>
            </div>
          )}
        </div>

        {/* LINKEDIN CARD */}
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span className="text-sm font-medium">LinkedIn</span>
          </div>
          
          {!linkedinConnected ? (
            <Button 
              onClick={connectLinkedin} 
              variant="outline" 
              size="sm" 
              className="w-full border-white/20 text-xs hover:bg-zinc-800"
            >
              Connect Account
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Connected
              </div>
              <Button 
                onClick={postToLinkedin} 
                disabled={!canPost || isPostingLinkedin}
                className="w-full bg-white text-black hover:bg-zinc-200 text-xs h-9 disabled:opacity-50"
              >
                {isPostingLinkedin ? (
                  <><svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Posting...</>
                ) : "Post Now"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* POST RESULT TOAST */}
      {postResult && (
        <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${postResult.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {postResult.success ? '✅' : '❌'}
          <span>
            {postResult.success 
              ? `Posted to ${postResult.platform} successfully!` 
              : postResult.error || `Failed to post to ${postResult.platform}`}
          </span>
        </div>
      )}

      {!canPost && (
        <p className="text-xs text-zinc-600 text-center">
          Generate a caption first to enable posting
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN TOOL UI COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ToolUI({ 
  initialGenerationsLeft, 
  userId, 
  isPro 
}: { 
  initialGenerationsLeft: number; 
  userId: string; 
  isPro: boolean; 
}) {
  const [code, setCode] = useState(() => {
    // Restore code if returning from OAuth redirect
    if (typeof window !== "undefined") {
      const backup = localStorage.getItem("codetopost_code_backup");
      if (backup) {
        localStorage.removeItem("codetopost_code_backup"); // Clean up
        return backup;
      }
    }
    return `// Paste your code here to see the magic happen...\nfunction hello() {\n  console.log("Auto-detect is working!");\n}`;
  });
  const [language, setLanguage] = useState("auto");
  const [platform, setPlatform] = useState("twitter");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [generationsLeft, setGenerationsLeft] = useState(initialGenerationsLeft);
  const [showPaywall, setShowPaywall] = useState(false);
  const [settings, setSettings] = useState({ bg: "midnight", padding: "p-8", showLines: false });
  const [customFilename, setCustomFilename] = useState("");
  const [showFilenameInput, setShowFilenameInput] = useState(false);
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [copyImageSuccess, setCopyImageSuccess] = useState(false);
  const [copyUrlSuccess, setCopyUrlSuccess] = useState(false);
  
  // Skeleton state
  const [isRendering, setIsRendering] = useState(false);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const exportRef = useRef<HTMLDivElement>(null);

  const getActiveTheme = () => ALL_THEMES[settings.bg] || ALL_THEMES.midnight;
  const displayLang = language === "auto" ? detectLanguage(code) : language;
  
  // Determine the displayed filename
  const displayFilename = customFilename.trim() || `script.${displayLang}`;

  // SECURITY: Check if user can export
  const canExport = isPro || generationsLeft > 0;
  const isOutOfCredits = !isPro && generationsLeft <= 0;

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    setLineCount(val.split('\n').length);
    
    // Show skeleton while "rendering"
    setIsRendering(true);
    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    renderTimeoutRef.current = setTimeout(() => setIsRendering(false), 150);
  };

  const handleGenerate = async () => {
    if (!code.trim() || code.startsWith("// Paste your code")) return;
    if (generationsLeft <= 0 && !isPro) { setShowPaywall(true); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/generate", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ code, language: displayLang, platform, userId }) 
      });
      const data = await res.json();
      if (res.status === 402) { setShowPaywall(true); return; }
      setCaption(data.caption); 
      if (!isPro) setGenerationsLeft((prev) => prev - 1); 
      setCopySuccess(false);
    } catch (error) { 
      console.error(error); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleCopy = async () => { 
    if (!caption) return; 
    try { 
      await navigator.clipboard.writeText(caption); 
      setCopySuccess(true); 
      setTimeout(() => setCopySuccess(false), 2000); 
    } catch (err) { 
      console.error(err); 
    } 
  };

  // ═══════════════════════════════════════════════════════════════
  // EXPORT FUNCTIONS (ALL WORKING)
  // ═══════════════════════════════════════════════════════════════
  
    const handleDownloadPng = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    
    const node = exportRef.current;
    const codeArea = node.querySelector('.flex-grow') as HTMLElement;
    const origHeight = node.style.height;
    const origOverflow = codeArea?.style.overflow;
    
    node.style.height = 'auto';
    if (codeArea) codeArea.style.overflow = 'hidden';
    await new Promise(res => setTimeout(res, 50));

    try {
      const dataUrl = await toPng(node, { 
        cacheBust: true, 
        pixelRatio: 2,
        backgroundColor: undefined 
      });
      const filename = customFilename.trim() ? `${customFilename.replace(/\.[^.]+$/, '')}.png` : "codetopost.png";
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("PNG download failed:", err);
    } finally {
      node.style.height = origHeight;
      if (codeArea) codeArea.style.overflow = origOverflow || 'auto';
      setIsExporting(false);
    }
  };

  const handleDownloadSvg = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    
    const node = exportRef.current;
    const codeArea = node.querySelector('.flex-grow') as HTMLElement;
    const origHeight = node.style.height;
    const origOverflow = codeArea?.style.overflow;
    
    node.style.height = 'auto';
    if (codeArea) codeArea.style.overflow = 'hidden';
    await new Promise(res => setTimeout(res, 50));

    try {
      const dataUrl = await toSvg(node, { cacheBust: true });
      const filename = customFilename.trim() ? `${customFilename.replace(/\.[^.]+$/, '')}.svg` : "codetopost.svg";
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("SVG download failed:", err);
    } finally {
      node.style.height = origHeight;
      if (codeArea) codeArea.style.overflow = origOverflow || 'auto';
      setIsExporting(false);
    }
  };

  const handleCopyImage = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    
    const node = exportRef.current;
    const codeArea = node.querySelector('.flex-grow') as HTMLElement;
    const origHeight = node.style.height;
    const origOverflow = codeArea?.style.overflow;
    
    node.style.height = 'auto';
    if (codeArea) codeArea.style.overflow = 'hidden';
    await new Promise(res => setTimeout(res, 50));

    try {
      const blob = await toBlob(node, { 
        cacheBust: true, 
        pixelRatio: 2,
        backgroundColor: undefined  
      });
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopyImageSuccess(true);
        setTimeout(() => setCopyImageSuccess(false), 2000);
      }
    } catch (err) {
      console.error("Copy image failed:", err);
    } finally {
      node.style.height = origHeight;
      if (codeArea) codeArea.style.overflow = origOverflow || 'auto';
      setIsExporting(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!exportRef.current) return;
    try {
      const dataUrl = await toPng(exportRef.current, { 
        cacheBust: true, 
        pixelRatio: 1 
      });
      await navigator.clipboard.writeText(dataUrl);
      setCopyUrlSuccess(true);
      setTimeout(() => setCopyUrlSuccess(false), 2000);
    } catch (err) {
      console.error("Copy base64 failed:", err);
    }
  };

  return (
    <main className="flex flex-col lg:flex-row h-screen w-full bg-black text-white relative">
      {/* HEADER */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <div className="flex items-center gap-2.5 select-none shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
            <path d="M8 4C6 4 5 5 5 7V10C5 11 4 12 2 12C4 12 5 13 5 14V17C5 19 6 20 8 20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/>
            <path d="M14 12H22M22 12L18 8M22 12L18 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/>
          </svg>
          <span className="text-sm font-semibold tracking-tight">
            <span className="font-mono">Code</span>
            <span className="font-sans">ToPost</span>
          </span>
        </div>
        <div className={`text-xs font-medium shrink-0 ml-auto sm:ml-0 ${isOutOfCredits ? "text-red-500" : isPro ? "text-emerald-400" : "text-zinc-500"}`}>
          {isPro ? "Pro ✨" : isOutOfCredits ? "0 credits left" : `${generationsLeft} free left`}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-0 flex-1 overflow-hidden">
        {/* LEFT PANEL - INPUT */}
        <div className="flex w-full lg:w-1/2 flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">INPUT</h2>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[120px] h-8 text-xs border-white/10 bg-zinc-950">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="z-50 border-white/10 bg-zinc-950 text-white">
                <SelectItem value="auto">Auto ({displayLang})</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="typescript">TypeScript</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="rust">Rust</SelectItem>
                <SelectItem value="go">Go</SelectItem>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="cpp">C++</SelectItem>
                <SelectItem value="csharp">C#</SelectItem>
                <SelectItem value="php">PHP</SelectItem>
                <SelectItem value="swift">Swift</SelectItem>
                <SelectItem value="kotlin">Kotlin</SelectItem>
                <SelectItem value="ruby">Ruby</SelectItem>
                <SelectItem value="bash">Shell/Bash</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="css">CSS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Textarea 
            value={code} 
            onChange={handleCodeChange} 
            className="flex-1 resize-none rounded-lg border-white/10 bg-zinc-950 p-4 font-mono text-sm focus-visible:ring-1 focus-visible:ring-white/20" 
          />
          
          <div className="mt-2 flex items-center justify-between h-4">
            <span className="text-xs text-zinc-700">{lineCount} lines</span>
            {lineCount > 45 && <span className="text-xs text-yellow-500 font-medium">⚠️ Long code may get cropped</span>}
          </div>
          
          <Button 
            onClick={handleGenerate} 
            disabled={loading || isOutOfCredits} 
            className="mt-3 h-11 w-full shrink-0 bg-white text-black font-semibold text-sm hover:bg-zinc-200 disabled:opacity-50"
          >
            {isOutOfCredits ? "No Credits Left" : loading ? "Generating Caption..." : "Generate AI Caption 🚀"}
          </Button>
        </div>

        {/* RIGHT PANEL - PREVIEW */}
        <div className="flex w-full lg:w-1/2 flex-col overflow-hidden p-4 sm:p-6 min-h-0 relative">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">LIVE PREVIEW</h2>
            
            {/* SECURITY: Hide Export Hub entirely if out of credits */}
            {canExport ? (
              <ExportHub 
                handleDownloadPng={handleDownloadPng}
                handleDownloadSvg={handleDownloadSvg}
                handleCopyImage={handleCopyImage}
                handleCopyUrl={handleCopyUrl}
                isExporting={isExporting}
                copyImageSuccess={copyImageSuccess}
                copyUrlSuccess={copyUrlSuccess}
              />
            ) : (
              <button 
                onClick={() => setShowPaywall(true)}
                className="flex items-center gap-2 px-3 h-8 text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Locked
              </button>
            )}
          </div>
          
          <Tabs defaultValue="image" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mb-4 h-9 w-fit shrink-0 rounded-md bg-zinc-900 p-0.5">
              <TabsTrigger value="image" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">Image</TabsTrigger>
              <TabsTrigger value="caption" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">Caption</TabsTrigger>
              <TabsTrigger value="platform" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">Platform</TabsTrigger>
              <TabsTrigger value="autopost" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">
                AutoPost {isPro ? '' : '🔒'}
              </TabsTrigger>
            </TabsList>

            {/* IMAGE TAB */}
            <TabsContent value="image" className="relative flex flex-1 flex-col rounded-lg border border-dashed border-white/10 bg-zinc-950/50 mt-0 p-4 min-h-0 overflow-hidden">
  
  {/* THE EXPORT OVERLAY */}
  {isExporting && (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs text-zinc-300 font-medium">Exporting...</span>
      </div>
    </div>
  )}

  {/* CUSTOM FILENAME TOGGLE */}
  <div className="flex items-center justify-between mb-3 shrink-0">
    <button 
      onClick={() => setShowFilenameInput(!showFilenameInput)}
      className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      {showFilenameInput ? 'Hide filename' : 'Custom filename'}
    </button>
  </div>
  
  {showFilenameInput && (
    <div className="mb-3 shrink-0">
      <input
        type="text"
        placeholder={displayFilename}
        value={customFilename}
        onChange={(e) => setCustomFilename(e.target.value)}
        className="w-full h-8 px-3 rounded-lg border border-white/10 bg-zinc-900 text-xs text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
      />
    </div>
  )}
  
  <div className="flex flex-1 min-h-0 items-center justify-center overflow-hidden p-4">
    {isRendering ? (
      <CodeSkeleton theme={getActiveTheme()} />
    ) : (
      <div 
        ref={exportRef} 
        className={`w-full max-w-2xl h-full rounded-xl transition-all duration-300 flex flex-col ${getActiveTheme().style} ${settings.padding}`}
      >
        {/* MAC WINDOW HEADER */}
        <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 rounded-t-lg relative h-10 backdrop-blur-sm ${getActiveTheme().headerBg} border-b ${getActiveTheme().isLight ? 'border-black/10' : 'border-white/10'}`}>
          <div className="flex gap-1.5">
            <span className={`w-3 h-3 rounded-full ${getActiveTheme().isLight ? 'bg-red-400' : 'bg-red-500'} inline-block`} />
            <span className={`w-3 h-3 rounded-full ${getActiveTheme().isLight ? 'bg-yellow-400' : 'bg-yellow-500'} inline-block`} />
            <span className={`w-3 h-3 rounded-full ${getActiveTheme().isLight ? 'bg-green-400' : 'bg-green-500'} inline-block`} />
          </div>
          {!isPro && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 text-sm font-mono ${getActiveTheme().windowText}`}>
              <span>code</span>
              <span className={getActiveTheme().isLight ? 'text-orange-600' : 'text-orange-500'}>to</span>
              <span>post</span>
            </div>
          )}
          <span className={`text-xs font-mono ${getActiveTheme().windowText}`}>{displayFilename}</span>
        </div>
        
        {/* CODE AREA */}
        <div className={`flex-grow overflow-y-auto rounded-b-lg backdrop-blur-sm ${getActiveTheme().codeBg} font-mono text-sm`}>
          {code.split('\n').map((line, i) => (
            <div key={i} className={`flex hover:${getActiveTheme().isLight ? 'bg-black/5' : 'bg-white/5'} -mx-6 px-6 ${getActiveTheme().text}`}>
              {settings.showLines && (
                <span className={`w-8 text-right pr-4 select-none text-xs shrink-0 leading-6 ${getActiveTheme().isLight ? 'opacity-30' : 'opacity-40'}`}>{i + 1}</span>
              )}
              <span className="whitespace-pre leading-6">{line}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
</TabsContent>

            {/* CAPTION TAB */}
            <TabsContent value="caption" className="flex flex-1 flex-col rounded-lg border border-white/10 bg-zinc-950/50 p-4 mt-0 min-h-0 overflow-auto">
              <p className="flex-1 text-sm text-zinc-300 whitespace-pre-wrap">{caption || "Click 'Generate AI Caption' to write your post..."}</p>
              <div className="mt-4 flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="border-white/10 text-xs hover:bg-zinc-800" onClick={handleCopy} disabled={!caption}>
                  {copySuccess ? "Copied! ✅" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" className="border-white/10 text-xs hover:bg-zinc-800" onClick={handleGenerate} disabled={loading}>
                  Regenerate
                </Button>
              </div>
            </TabsContent>

            {/* PLATFORM TAB */}
            <TabsContent value="platform" className="flex flex-1 flex-col gap-4 rounded-lg border border-white/10 bg-zinc-950/50 p-4 mt-0 overflow-auto">
              <Label className="text-xs text-zinc-500">Target Platform</Label>
              <div className="flex gap-2">
                <Button 
                  variant={platform === "twitter" ? "default" : "outline"} 
                  className={`flex-1 text-xs ${platform === "twitter" ? "bg-white text-black hover:bg-zinc-200" : "border-white/10 hover:bg-zinc-800"}`} 
                  onClick={() => setPlatform("twitter")}
                >
                  X (Twitter)
                </Button>
                <Button 
                  variant={platform === "linkedin" ? "default" : "outline"} 
                  className={`flex-1 text-xs ${platform === "linkedin" ? "bg-white text-black hover:bg-zinc-200" : "border-white/10 hover:bg-zinc-800"}`} 
                  onClick={() => setPlatform("linkedin")}
                >
                  LinkedIn
                </Button>
              </div>
              <Separator className="bg-white/10" />
              <p className="text-xs text-zinc-600">Adjusts caption tone automatically.</p>
            </TabsContent>

            {/* AUTOPOST TAB (NEW!) */}
            <TabsContent value="autopost" className="flex flex-1 flex-col rounded-lg border border-white/10 bg-zinc-950/50 p-4 mt-0 min-h-0 overflow-auto">
              <AutoPostSection 
                caption={caption}
                isPro={isPro}
                userId={userId}
                onLockedClick={() => setShowPaywall(true)}
                exportRef={exportRef}
              />
            </TabsContent>
          </Tabs>

          <ThemeCustomizer 
            settings={settings} 
            setSettings={setSettings} 
            isPro={isPro} 
            onLockedClick={() => setShowPaywall(true)} 
          />
        </div>
      </div>

      {/* PAYWALL - UN-CHEATABLE VERSION */}
      {showPaywall && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-8 max-w-sm text-center w-full">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">
                {isOutOfCredits ? "🔋" : "🛑"}
              </span>
            </div>
            <h3 className="text-xl font-bold mb-2">
              {isOutOfCredits ? "Out of Free Credits" : "Premium Features Locked"}
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              {isOutOfCredits 
                ? "You've used all your free generations. Upgrade to Pro for unlimited access!"
                : "Upgrade to Pro to unlock premium themes, hide the logo, and remove limits!"
              }
            </p>
            
            {isOutOfCredits ? (
              <>
                <p className="text-xs text-zinc-600 mb-4">
                  The Export button is now locked. Upgrade to continue.
                </p>
                <Button 
                  onClick={() => window.location.href = "/pricing"} 
                  className="w-full bg-white text-black hover:bg-zinc-200 mb-2"
                >
                  Upgrade to Pro
                </Button>
                <p className="text-[10px] text-zinc-700 mt-2">
                  This cannot be bypassed
                </p>
              </>
            ) : (
              <Button onClick={() => setShowPaywall(false)} className="w-full bg-white text-black hover:bg-zinc-200">
                Maybe Later
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}