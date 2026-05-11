"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [platform, setPlatform] = useState("twitter");
  const [image, setImage] = useState("");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  
  // --- MOBILE/UX STATES ---
  const [lineCount, setLineCount] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false); // NEW
  
  // --- PAYWALL STATE ---
  const [generationsLeft, setGenerationsLeft] = useState(3);
  const [showPaywall, setShowPaywall] = useState(false);

  const handleGenerate = async () => {
    if (!code.trim()) return;
    if (generationsLeft <= 0) {
      setShowPaywall(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, platform }),
      });
      const data = await res.json();
      setImage(data.image);
      setCaption(data.caption);
      setGenerationsLeft((prev) => prev - 1);
      setCopySuccess(false); // Reset copy state on new generation
    } catch (error) {
      console.error("Error generating:", error);
    } finally {
      setLoading(false);
    }
  };

  // FIX 2: Proper Async Copy with fallback for strict mobile browsers
  const handleCopy = async () => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Fallback for older mobile browsers that block clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = caption;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (e) {
        console.error("Fallback copy failed", e);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleDownload = async () => {
    if (!image) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 1600, 1200);
      
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "codetopost.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/png", 1.0);
    };
    img.src = image;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    setLineCount(val.split('\n').length);
  };

  return (
    <main className="flex flex-col lg:flex-row h-screen w-full bg-black text-white relative">
      {/* Top Nav */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <div className="flex items-center gap-2.5 select-none shrink-0">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-7">
            <path d="M8 4C6 4 5 5 5 7V10C5 11 4 12 2 12C4 12 5 13 5 14V17C5 19 6 20 8 20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/>
            <path d="M14 12H22M22 12L18 8M22 12L18 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"/>
          </svg>
          <span className="text-sm font-semibold tracking-tight">
            <span className="font-mono">Code</span>
            <span className="font-sans">ToPost</span>
          </span>
        </div>
        {/* FIX 1: Added shrink-0 and ml-auto to prevent cramping into logo */}
        <div className={`text-xs font-medium shrink-0 ml-auto sm:ml-0 ${generationsLeft <= 1 ? "text-red-500" : "text-zinc-500"}`}>
          {generationsLeft} free left
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex flex-col lg:flex-row min-h-0 flex-1 overflow-hidden">
        
        {/* LEFT PANEL: INPUT */}
        <div className="flex w-full lg:w-1/2 flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">INPUT</h2>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[120px] h-8 text-xs border-white/10 bg-zinc-950">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="z-50 border-white/10 bg-zinc-950 text-white">
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="typescript">TypeScript</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="rust">Rust</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Textarea 
            value={code} 
            onChange={handleCodeChange} 
            placeholder="Paste your code here..." 
            className="flex-1 resize-none rounded-lg border-white/10 bg-zinc-950 p-4 font-mono text-sm focus-visible:ring-1 focus-visible:ring-white/20" 
          />

          <div className="mt-2 flex items-center justify-between h-4">
            <span className="text-xs text-zinc-700">{lineCount} lines</span>
            {lineCount > 45 && (
              <span className="text-xs text-yellow-500 font-medium">
                ⚠️ Long code may get cropped on X/LinkedIn
              </span>
            )}
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={loading} 
            className="mt-3 h-11 w-full shrink-0 bg-white text-black font-semibold text-sm hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Post 🚀"}
          </Button>
        </div>

        {/* RIGHT PANEL: OUTPUT */}
        <div className="flex w-full lg:w-1/2 flex-col overflow-hidden p-4 sm:p-6 min-h-0">
          <div className="mb-4"><h2 className="text-sm font-medium text-zinc-400">OUTPUT</h2></div>

          <Tabs defaultValue="image" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mb-4 h-9 w-fit shrink-0 rounded-md bg-zinc-900 p-0.5">
              <TabsTrigger value="image" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">Image</TabsTrigger>
              <TabsTrigger value="caption" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">Caption</TabsTrigger>
              <TabsTrigger value="platform" className="text-xs data-[state=active]:bg-zinc-100 data-[state=active]:text-black">Platform</TabsTrigger>
            </TabsList>

            <TabsContent value="image" className="flex flex-1 flex-col rounded-lg border border-dashed border-white/10 bg-zinc-950/50 mt-0 p-4 min-h-0 overflow-hidden">
              <div className="flex flex-1 min-h-0 items-center justify-center overflow-auto p-2">
                {image ? (
                  <img 
                    src={image} 
                    alt="Generated Code" 
                    className="max-w-full max-h-full object-contain rounded-md shadow-2xl" 
                  />
                ) : (
                  <p className="text-xs text-zinc-600">Image preview will appear here</p>
                )}
              </div>

              {image && (
                <div className="flex-shrink-0 mt-4 pt-4 border-t border-white/5">
                  <Button onClick={handleDownload} className="w-full bg-white text-black font-semibold text-sm hover:bg-zinc-200">
                    Download PNG 📸
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="caption" className="flex flex-1 flex-col rounded-lg border border-white/10 bg-zinc-950/50 p-4 mt-0 min-h-0 overflow-auto">
              <p className="flex-1 text-sm text-zinc-300 whitespace-pre-wrap">{caption || "AI generated hook and caption will appear here..."}</p>
              <div className="mt-4 flex gap-2 shrink-0">
                {/* FIX 2: Visual feedback for copy */}
                <Button variant="outline" size="sm" className="border-white/10 text-xs hover:bg-zinc-800" onClick={handleCopy} disabled={!caption}>
                  {copySuccess ? "Copied! ✅" : "Copy"}
                </Button>
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
              <p className="text-xs text-zinc-600">Adjusts image aspect ratio and caption tone automatically.</p>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* SOFT PAYWALL POPUP */}
      {showPaywall && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-8 max-w-sm text-center">
            <h3 className="text-xl font-bold mb-2">You're out of free generations! 🛑</h3>
            <p className="text-sm text-zinc-400 mb-6">You've used your 3 free generations for this week. Check back soon for premium unlimited access!</p>
            <Button onClick={() => setShowPaywall(false)} className="w-full bg-white text-black hover:bg-zinc-200">
              Got it
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}