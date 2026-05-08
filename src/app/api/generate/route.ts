import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import satori from "satori";
import fs from "fs";
import { codeToTokens } from "shiki";

// Initialize Groq
const groq = new Groq();

// --- SATORI FONT FIX (WINDOWS NATIVE) ---
let fontData: Buffer | null = null;
function getSystemFont() {
  if (!fontData) {
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
    if (!fontData) throw new Error("Could not find Windows fonts");
  }
  return fontData;
}

export async function POST(req: NextRequest) {
  try {
    const { code, language, platform } = await req.json();
    if (!code) return NextResponse.json({ error: "No code provided" }, { status: 400 });

    // Run both at the exact same time for maximum speed
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

// --- HELPER 2: SATORI IMAGE (PREMIUM SYNTAX HIGHLIGHTING) ---
async function generateImage(code: string, language: string) {
  const systemFont = getSystemFont();

  // 1. Get pure color tokens directly from Shiki (Skips HTML completely!)
  const result = await codeToTokens(code, { 
    lang: language as any, 
    theme: 'github-dark' 
  });

  // 2. Convert tokens straight to Satori JSON (Tokens is a 2D array!)
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

  // 3. Generate the SVG
  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0d1117", // GitHub Dark BG
          borderRadius: "12px",
          padding: "0px",
          overflow: "hidden",
        },
        children: [
          // Top Bar (Mac dots, filename, branding)
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
                { type: "span", props: { style: { color: "#8b949e", fontSize: "14px", fontFamily: "Consolas" }, children: `script.${language}` } },
                { type: "span", props: { style: { color: "#8b949e", fontSize: "12px", fontFamily: "Consolas" }, children: "CodeToPost" } }
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
                fontFamily: "Consolas",
                display: "flex",
                flexDirection: "column",
                whiteSpace: "pre",
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
      fonts: [{ name: "Consolas", data: systemFont, weight: 400, style: "normal" }],
    } as any
  );

  // 4. Return as base64 image string
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}