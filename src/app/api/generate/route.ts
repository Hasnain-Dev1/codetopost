import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import satori from "satori";
import fs from "fs";
import { createRequire } from "module";
import { codeToTokens } from "shiki";

// Fix for Vercel ESM environments
const require = createRequire(import.meta.url);

// Initialize Groq
const groq = new Groq();

// --- ULTIMATE CROSS-PLATFORM FONT FIX ---
let fontData: Buffer | null = null;
function getSystemFont() {
  if (!fontData) {
    // 1. Try local Windows fonts first
    const possibleFonts = [
      "C:\\Windows\\Fonts\\consola.ttf",
      "C:\\Windows\\Fonts\\arial.ttf",
    ];
    for (const fontPath of possibleFonts) {
      if (fs.existsSync(fontPath)) {
        fontData = fs.readFileSync(fontPath);
        break;
      }
    }

    // 2. Fall back to NPM font for Vercel (Linux)
    if (!fontData) {
      try {
        const npmFontPath = require.resolve("@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2");
        fontData = fs.readFileSync(npmFontPath);
      } catch (e) {
        console.error("NPM font fallback failed");
      }
    }

    if (!fontData) throw new Error("Could not load any fonts");
  }
  return fontData;
}

export async function POST(req: NextRequest) {
  try {
    const { code, language, platform } = await req.json();
    if (!code) return NextResponse.json({ error: "No code provided" }, { status: 400 });

    const [captionResult, imageDataUri] = await Promise.all([
      generateCaption(code, language, platform),
      generateImage(code, language),
    ]);

    return NextResponse.json({ image: imageDataUri, caption: captionResult });
  } catch (error) {
    console.error("Generation failed:", error);
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}

// --- HELPER 1: GROQ AI CAPTION ---
async function generateCaption(code: string, language: string, platform: string) {
  const toneInstruction = platform === "twitter" 
    ? "Keep it under 280 characters. Punchy, high engagement." 
    : "Keep it under 1300 characters. Professional but engaging.";

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: `You are an elite dev influencer. Write a social media post for the code below. Start with a strong hook (bold claim or contrarian take). Do NOT just explain the code. ${toneInstruction} Output ONLY the post text.` },
      { role: "user", content: `Language: ${language}\nCode:\n${code}` },
    ],
    model: "llama-3.1-8b-instant", 
    temperature: 0.7,
  });
  
  return chatCompletion.choices[0]?.message?.content || "Could not generate caption.";
}

// --- HELPER 2: SATORI IMAGE ---
async function generateImage(code: string, language: string) {
  const systemFont = getSystemFont();

  const result = await codeToTokens(code, { 
    lang: language as any, 
    theme: 'github-dark' 
  });

  const parsedCode = result.tokens.map((line: any) => ({
    type: "div",
    props: {
      style: { display: "flex", lineHeight: "1.6" },
      children: line.map((token: any) => ({
        type: "span",
        props: {
          style: { color: token.color || "#ffffff" },
          children: token.content || " "
        }
      }))
    }
  }));

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0d1117",
          borderRadius: "12px",
          padding: "0px",
          overflow: "hidden",
        },
        children: [
          // Top Bar
          {
            type: "div",
            props: {
              style: { 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                padding: "16px 24px", 
                backgroundColor: "#161b22",
                borderBottom: "1px solid #30363d" 
              },
              children: [
                { type: "div", props: { style: { display: "flex", gap: "8px" }, children: [
                  { type: "div", props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ff5f57" } } },
                  { type: "div", props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#febc2e" } } },
                  { type: "div", props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#28c840" } } },
                ]}},
                { type: "span", props: { style: { color: "#8b949e", fontSize: "14px", fontFamily: "JetBrains Mono" }, children: `script.${language}` } },
                { type: "span", props: { style: { color: "#8b949e", fontSize: "12px", fontFamily: "JetBrains Mono" }, children: "CodeToPost" } }
              ]
            }
          },
          // Code Box
          {
            type: "div",
            props: {
              style: { 
                padding: "24px", 
                fontSize: "18px", 
                lineHeight: "1.6", 
                fontFamily: "JetBrains Mono",
                display: "flex",
                flexDirection: "column",
                whiteSpace: "pre" 
              },
              children: parsedCode
            }
          }
        ],
      },
    } as any,
    {
      width: 800,
      height: 600,
      fonts: [{ name: "JetBrains Mono", data: systemFont, weight: 400, style: "normal" }],
    } as any
  );

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}