import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import satori from "satori";
import { codeToTokens, type BundledLanguage } from "shiki";

const groq = new Groq();

let fontData: Buffer | null = null;

async function getSystemFont() {
  if (!fontData) {
    try {
      // Using an absolute URL is safer for server-side fetching in Next.js
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const res = await fetch(new URL("/JetBrainsMono.ttf", baseUrl));
      
      if (!res.ok) throw new Error("Failed to fetch font file.");
      const arrayBuffer = await res.arrayBuffer();
      fontData = Buffer.from(arrayBuffer);
    } catch (error) {
      console.error("Font fetch failed:", error);
      throw new Error("Could not load JetBrainsMono.ttf. Ensure it is in the public folder.");
    }
  }
  return fontData;
}

export async function POST(req: NextRequest) {
  try {
    const { code, language, platform } = await req.json();
    
    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const [captionResult, imageDataUri] = await Promise.all([
      generateCaption(code, language, platform),
      generateImage(code, language),
    ]);

    return NextResponse.json({ image: imageDataUri, caption: captionResult });
  } catch (error) {
    console.error("Generation failed:", error);
    return NextResponse.json({ error: "Failed to generate post assets" }, { status: 500 });
  }
}

async function generateCaption(code: string, language: string, platform: string) {
  const toneInstruction = platform === "twitter"
    ? "Keep it under 280 characters. Punchy, high engagement."
    : "Keep it under 1300 characters. Professional but engaging.";

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { 
        role: "system", 
        content: `You are an elite dev influencer. Write a social media post for the code below. Start with a strong hook. ${toneInstruction} Output ONLY the text.` 
      },
      { role: "user", content: `Language: ${language}\nCode:\n${code}` },
    ],
    model: "llama-3.1-8b-instant",
    temperature: 0.7,
  });

  return chatCompletion.choices[0]?.message?.content || "Could not generate caption.";
}

async function generateImage(code: string, language: string) {
  // Casting language as BundledLanguage fixes the 'string is not assignable' error
  const lang = (language || 'txt') as BundledLanguage;

  const result = await codeToTokens(code, { 
    lang: lang, 
    theme: "github-dark" 
  });

  // Convert Shiki tokens into Satori-compatible elements
  const parsedCode = result.tokens.map((line) => ({
    type: "div",
    props: {
      style: { display: "flex", minHeight: "1.6em" },
      children: line.map((token) => ({
        type: "span",
        props: {
          style: { color: token.color },
          children: token.content
        }
      }))
    },
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
          overflow: "hidden" 
        },
        children: [
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
                { 
                  type: "div", 
                  props: { 
                    style: { display: "flex", gap: "8px" }, 
                    children: [
                      { type: "div", props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ff5f57" } } },
                      { type: "div", props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#febc2e" } } },
                      { type: "div", props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#28c840" } } },
                    ]
                  } 
                },
                { 
                  type: "span", 
                  props: { 
                    style: { color: "#8b949e", fontSize: "14px", fontFamily: "JetBrains Mono" }, 
                    children: `script.${language}` 
                  } 
                }
              ]
            }
          },
          {
            type: "div",
            props: {
              style: { 
                padding: "24px", 
                fontSize: "18px", 
                fontFamily: "JetBrains Mono", 
                display: "flex", 
                flexDirection: "column" 
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
      fonts: [
        { 
          name: "JetBrains Mono", 
          data: await getSystemFont(), 
          weight: 400, 
          style: "normal" 
        }
      ],
    }
  );

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}