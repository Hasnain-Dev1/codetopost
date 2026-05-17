"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toPng } from "html-to-image"; // THE DOWNLOAD FIX

interface ThemeConfig { name: string; style: string; codeBg: string; headerBg: string; text: string; isPro?: boolean; }
const ALL_THEMES: Record<string, ThemeConfig> = {
  midnight: { name: "Midnight", style: "bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950", codeBg: "bg-zinc-900/95", headerBg: "bg-zinc-900/50", text: "text-zinc-300" },
  noir: { name: "Noir", style: "bg-[#0b0b0b]", codeBg: "bg-[#1a1a1a]", headerBg: "bg-[#1a1a1a]", text: "text-[#f5f5f7]" },
  mono: { name: "Mono", style: "bg-zinc-800", codeBg: "bg-zinc-900", headerBg: "bg-zinc-900/50", text: "text-zinc-300" },
  candy: { name: "Candy", style: "bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500", codeBg: "bg-[#1e1028]/90", headerBg: "bg-[#1e1028]/50", text: "text-pink-100", isPro: true },
  sunset: { name: "Sunset", style: "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500", codeBg: "bg-[#2d1b0e]/90", headerBg: "bg-[#2d1b0e]/50", text: "text-orange-100" },
  breeze: { name: "Breeze", style: "bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-700", codeBg: "bg-[#0c1929]/90", headerBg: "bg-[#0c1929]/50", text: "text-cyan-100" },
  forest: { name: "Forest", style: "bg-gradient-to-br from-green-800 via-emerald-950 to-teal-950", codeBg: "bg-[#0a1a12]/90", headerBg: "bg-[#0a1a12]/50", text: "text-green-200" },
  sand: { name: "Sand", style: "bg-gradient-to-br from-amber-200 via-orange-200 to-yellow-100", codeBg: "bg-[#29201a]/95", headerBg: "bg-[#29201a]/50", text: "text-amber-200" },
  meadow: { name: "Meadow", style: "bg-gradient-to-br from-lime-500 via-emerald-500 to-green-700", codeBg: "bg-[#0a1f0e]/90", headerBg: "bg-[#0a1f0e]/50", text: "text-lime-200" },
  falcon: { name: "Falcon", style: "bg-gradient-to-br from-slate-700 via-slate-900 to-blue-950", codeBg: "bg-slate-900/90", headerBg: "bg-slate-900/50", text: "text-slate-300", isPro: true },
  crimson: { name: "Crimson", style: "bg-gradient-to-br from-red-800 via-rose-900 to-red-950", codeBg: "bg-[#1f0a0a]/90", headerBg: "bg-[#1f0a0a]/50", text: "text-red-200", isPro: true },
  ice: { name: "Ice", style: "bg-gradient-to-br from-[#BEEEF9] via-[#4B8CAB] to-[#6AC6DE]", codeBg: "bg-white/60 border border-white/30", headerBg: "bg-white/40 border-b border-white/20", text: "text-slate-800", isPro: true },
};
const THEME_CATEGORIES = { minimal: ["midnight", "noir", "mono"], vibrant: ["candy", "sunset", "breeze"], earthy: ["forest", "sand", "meadow"], pro: ["falcon", "crimson", "ice"] };

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

const paddings = [{ label: "S", value: "p-4" }, { label: "M", value: "p-8" }, { label: "L", value: "p-16" }];

function ExportHub({ handleDownload }: { handleDownload: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative z-[200]"> {/* KEEPS IT ON TOP OF EVERYTHING */}
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 h-8 text-xs font-medium bg-zinc-800/50 border border-white/10 rounded-lg hover:bg-zinc-700/50 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export
      </button>
      {isOpen && (
        <div className="absolute right-0 top-10 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1 z-[300]"> {/* ULTRA HIGH Z-INDEX */}
          <button onClick={handleDownload} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-lg flex items-center gap-2">📸 Save as PNG</button>
          <button disabled className="w-full text-left px-3 py-2 text-xs text-zinc-400 opacity-50 rounded-lg flex items-center gap-2 cursor-not-allowed">📐 Save as SVG (Coming Soon)</button>
          <div className="h-px bg-white/5 my-1" />
          <button disabled className="w-full text-left px-3 py-2 text-xs text-zinc-400 opacity-50 rounded-lg flex items-center gap-2 cursor-not-allowed">📋 Copy Image (Coming Soon)</button>
          <button disabled className="w-full text-left px-3 py-2 text-xs text-zinc-400 opacity-50 rounded-lg flex items-center gap-2 cursor-not-allowed">🔗 Copy URL (Coming Soon)</button>
        </div>
      )}
    </div>
  )
}

function ThemeCustomizer({ settings, setSettings, isPro, onLockedClick }: any) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-2xl">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>
      </button>
      <div className={`fixed bottom-20 right-6 z-50 w-72 bg-black/70 backdrop-blur-2xl border border-white/20 rounded-2xl p-3 shadow-2xl transition-all duration-300 ${isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"}`}>
        <div className="flex items-center gap-0.5 bg-zinc-800/50 rounded-lg p-0.5 mb-3">
          {paddings.map((p) => (<button key={p.value} onClick={() => setSettings({ ...settings, padding: p.value })} className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${settings.padding === p.value ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"}`}>{p.label}</button>))}
          <div className="w-px h-5 bg-zinc-600 mx-1" />
          <button onClick={() => setSettings({ ...settings, showLines: !settings.showLines })} className={`px-2 py-1.5 text-[11px] font-bold rounded-md transition-all ${settings.showLines ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"}`}>#</button>
        </div>
        {Object.entries(THEME_CATEGORIES).map(([category, keys]) => (
          <div key={category} className="mb-2 last:mb-0">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 pl-1">{category}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {keys.map((key) => { const theme = ALL_THEMES[key]; return (
                <button key={key} onClick={() => theme.isPro && !isPro ? onLockedClick() : setSettings({ ...settings, bg: key })} className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-all ${settings.bg === key ? "border-white bg-white/10" : "border-transparent hover:bg-white/5"}`}>
                  <div className={`w-4 h-4 rounded-sm ${theme.style}`} />
                  <span className="text-[10px] text-zinc-300 truncate">{theme.name}</span>
                  {theme.isPro && !isPro && <span className="text-[8px] ml-auto">🔒</span>}
                </button>
              ); })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function ToolUI({ initialGenerationsLeft, userId, isPro }: { initialGenerationsLeft: number, userId: string, isPro: boolean }) {
  const [code, setCode] = useState(`// Paste your code here to see the magic happen...\nfunction hello() {\n  console.log("Auto-detect is working!");\n}`);
  const [language, setLanguage] = useState("auto");
  const [platform, setPlatform] = useState("twitter");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [generationsLeft, setGenerationsLeft] = useState(initialGenerationsLeft);
  const [showPaywall, setShowPaywall] = useState(false);
  const [settings, setSettings] = useState({ bg: "midnight", padding: "p-8", showLines: false });
  const exportRef = useRef<HTMLDivElement>(null); // REF FOR THE DOWNLOAD

  const getActiveTheme = () => ALL_THEMES[settings.bg] || ALL_THEMES.midnight;
  const displayLang = language === "auto" ? detectLanguage(code) : language;

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { const val = e.target.value; setCode(val); setLineCount(val.split('\n').length); };
  
  const handleGenerate = async () => {
    if (!code.trim() || code.startsWith("// Paste your code")) return;
    if (generationsLeft <= 0) { setShowPaywall(true); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, language: displayLang, platform, userId }) });
      const data = await res.json();
      if (res.status === 402) { setShowPaywall(true); return; }
      setCaption(data.caption); setGenerationsLeft((prev) => prev - 1); setCopySuccess(false);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleCopy = async () => { if (!caption) return; try { await navigator.clipboard.writeText(caption); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); } catch (err) { console.error(err); } };

  // THE REAL DOWNLOAD FUNCTION
  const handleDownload = async () => {
    if (!exportRef.current) return;
    try {
      const dataUrl = await toPng(exportRef.current, { cacheBust: true, pixelRatio: 2 }); // 2x quality
      const link = document.createElement("a");
      link.download = "codetopost.png";
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <main className="flex flex-col lg:flex-row h-screen w-full bg-black text-white relative">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <div className="flex items-center gap-2.5 select-none shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7"><path d="M8 4C6 4 5 5 5 7V10C5 11 4 12 2 12C4 12 5 13 5 14V17C5 19 6 20 8 20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/><path d="M14 12H22M22 12L18 8M22 12L18 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/></svg>
          <span className="text-sm font-semibold tracking-tight"><span className="font-mono">Code</span><span className="font-sans">ToPost</span></span>
        </div>
        <div className={`text-xs font-medium shrink-0 ml-auto sm:ml-0 ${generationsLeft <= 1 ? "text-red-500" : "text-zinc-500"}`}>{isPro ? "Pro ✨" : `${generationsLeft} free left`}</div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-0 flex-1 overflow-hidden">
        <div className="flex w-full lg:w-1/2 flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">INPUT</h2>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[120px] h-8 text-xs border-white/10 bg-zinc-950"><SelectValue placeholder="Language" /></SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="z-50 border-white/10 bg-zinc-950 text-white">
                <SelectItem value="auto">Auto ({displayLang})</SelectItem><SelectItem value="javascript">JavaScript</SelectItem><SelectItem value="typescript">TypeScript</SelectItem><SelectItem value="python">Python</SelectItem><SelectItem value="rust">Rust</SelectItem><SelectItem value="go">Go</SelectItem><SelectItem value="java">Java</SelectItem><SelectItem value="cpp">C++</SelectItem><SelectItem value="csharp">C#</SelectItem><SelectItem value="php">PHP</SelectItem><SelectItem value="swift">Swift</SelectItem><SelectItem value="kotlin">Kotlin</SelectItem><SelectItem value="ruby">Ruby</SelectItem><SelectItem value="bash">Shell/Bash</SelectItem><SelectItem value="html">HTML</SelectItem><SelectItem value="css">CSS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea value={code} onChange={handleCodeChange} className="flex-1 resize-none rounded-lg border-white/10 bg-zinc-950 p-4 font-mono text-sm focus-visible:ring-1 focus-visible:ring-white/20" />
          <div className="mt-2 flex items-center justify-between h-4">
            <span className="text-xs text-zinc-700">{lineCount} lines</span>
            {lineCount > 45 && <span className="text-xs text-yellow-500 font-medium">⚠️ Long code may get cropped</span>}
          </div>
          <Button onClick={handleGenerate} disabled={loading} className="mt-3 h-11 w-full shrink-0 bg-white text-black font-semibold text-sm hover:bg-zinc-200 disabled:opacity-50">{loading ? "Generating Caption..." : "Generate AI Caption 🚀"}</Button>
        </div>

        <div className="flex w-full lg:w-1/2 flex-col overflow-hidden p-4 sm:p-6 min-h-0 relative">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">LIVE PREVIEW</h2>
            <ExportHub handleDownload={handleDownload} /> {/* EXPORT IS NOW UP HERE, NOT AT THE BOTTOM */}
          </div>
          
          <Tabs defaultValue="image" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mb-4 h-9 w-fit shrink-0 rounded-md bg-zinc-900 p-0.5">
              <TabsTrigger value="image" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">Image</TabsTrigger>
              <TabsTrigger value="caption" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">Caption</TabsTrigger>
              <TabsTrigger value="platform" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">Platform</TabsTrigger>
            </TabsList>

            <TabsContent value="image" className="flex flex-1 flex-col rounded-lg border border-dashed border-white/10 bg-zinc-950/50 mt-0 p-4 min-h-0 overflow-hidden">
              <div className="flex flex-1 min-h-0 items-center justify-center overflow-hidden p-4">
                {/* THE REF GOES HERE SO WE CAN CAPTURE IT */}
                <div ref={exportRef} className={`w-full max-w-2xl h-full rounded-xl transition-all duration-300 flex flex-col ${getActiveTheme().style} ${settings.padding}`}>
                  <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 rounded-t-lg relative h-10 backdrop-blur-sm ${getActiveTheme().headerBg} border-b border-white/10`}>
                    <div className="flex gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /></div>
                    {!isPro && (<div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 text-sm font-mono ${getActiveTheme().text} opacity-80`}><span>code</span><span className="text-orange-500">to</span><span>post</span></div>)}
                    <span className={`text-xs font-mono ${getActiveTheme().text} opacity-60`}>script.{displayLang}</span>
                  </div>
                  <div className={`flex-grow overflow-y-auto rounded-b-lg backdrop-blur-sm ${getActiveTheme().codeBg} font-mono text-sm`}>
                    {code.split('\n').map((line, i) => (<div key={i} className={`flex hover:bg-white/5 -mx-6 px-6 ${getActiveTheme().text}`}>{settings.showLines && (<span className="w-8 text-right pr-4 select-none text-xs shrink-0 leading-6 opacity-40">{i + 1}</span>)}<span className="whitespace-pre leading-6">{line}</span></div>))}
                    <div className="h-6" />
                  </div>
                </div>
              </div>
              {/* NO BOTTOM BUTTON HERE ANYMORE */}
            </TabsContent>

            <TabsContent value="caption" className="flex flex-1 flex-col rounded-lg border border-white/10 bg-zinc-950/50 p-4 mt-0 min-h-0 overflow-auto">
              <p className="flex-1 text-sm text-zinc-300 whitespace-pre-wrap">{caption || "Click 'Generate AI Caption' to write your post..."}</p>
              <div className="mt-4 flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="border-white/10 text-xs hover:bg-zinc-800" onClick={handleCopy} disabled={!caption}>{copySuccess ? "Copied! ✅" : "Copy"}</Button>
                <Button variant="outline" size="sm" className="border-white/10 text-xs hover:bg-zinc-800" onClick={handleGenerate} disabled={loading}>Regenerate</Button>
              </div>
            </TabsContent>

            <TabsContent value="platform" className="flex flex-1 flex-col gap-4 rounded-lg border border-white/10 bg-zinc-950/50 p-4 mt-0 overflow-auto">
              <Label className="text-xs text-zinc-500">Target Platform</Label>
              <div className="flex gap-2">
                <Button variant={platform === "twitter" ? "default" : "outline"} className={`flex-1 text-xs ${platform === "twitter" ? "bg-white text-black hover:bg-zinc-200" : "border-white/10 hover:bg-zinc-800"}`} onClick={() => setPlatform("twitter")}>X (Twitter)</Button>
                <Button variant={platform === "linkedin" ? "default" : "outline"} className={`flex-1 text-xs ${platform === "linkedin" ? "bg-white text-black hover:bg-zinc-200" : "border-white/10 hover:bg-zinc-800"}`} onClick={() => setPlatform("linkedin")}>LinkedIn</Button>
              </div>
              <Separator className="bg-white/10" />
              <p className="text-xs text-zinc-600">Adjusts caption tone automatically.</p>
            </TabsContent>
          </Tabs>

          <ThemeCustomizer settings={settings} setSettings={setSettings} isPro={isPro} onLockedClick={() => setShowPaywall(true)} />
        </div>
      </div>

      {showPaywall && (<div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"><div className="bg-zinc-950 border border-white/10 rounded-xl p-8 max-w-sm text-center"><h3 className="text-xl font-bold mb-2">Premium Features Locked 🛑</h3><p className="text-sm text-zinc-400 mb-6">Upgrade to Pro to unlock premium themes, hide the logo, and remove limits!</p><Button onClick={() => setShowPaywall(false)} className="w-full bg-white text-black hover:bg-zinc-200">Maybe Later</Button></div></div>)}
    </main>
  );
}