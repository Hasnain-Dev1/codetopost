import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import satori from "satori";
import { codeToTokens } from "shiki";

const groq = new Groq();

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

async function generateImage(code: string, language: string) {
  const result = await codeToTokens(code, { 
    lang: language as any, 
    theme: 'github-dark' 
  });

  const parsedCode = result.tokens.map((line: any) => ({
    type: "div" as const,
    props: {
      style: { display: "flex", lineHeight: "1.6" } as const,
      children: line.map((token: any) => ({
        type: "span" as const,
        props: {
          style: { color: token.color || "#ffffff" } as const,
          children: token.content || " "
        }
      }))
    }
  }));

  const svg = await satori(
    {
      type: "div" as const,
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
        } as const,
        children: [
          {
            type: "div" as const,
            props: {
              style: { 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                padding: "16px 24px", 
                backgroundColor: "#161b22",
                borderBottom: "1px solid #30363d" 
              } as const,
              children: [
                { type: "div" as const, props: { style: { display: "flex", gap: "8px" } as const, children: [
                  { type: "div" as const, props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ff5f57" } as const } },
                  { type: "div" as const, props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#febc2e" } as const } },
                  { type: "div" as const, props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#28c840" } as const } },
                ]}},
                { type: "span" as const, props: { style: { color: "#8b949e", fontSize: "14px", fontFamily: "monospace" } as const, children: `script.${language}` } },
                { type: "span" as const, props: { style: { color: "#8b949e", fontSize: "12px", fontFamily: "monospace" } as const, children: "CodeToPost" } }
              ]
            }
          },
          {
            type: "div" as const,
            props: {
              style: { 
                padding: "24px", 
                fontSize: "18px", 
                lineHeight: "1.6", 
                fontFamily: "monospace",
                display: "flex",
                flexDirection: "column",
                whiteSpace: "pre" 
              } as const,
              children: parsedCode
            }
          }
        ],
      },
    } as any,
    {
      width: 800,
      height: 600,
      fonts: [],
    }
  );

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}