import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import Groq from "groq-sdk";
import satori from "satori";
import { codeToTokens, type BundledLanguage } from "shiki";
import { createClient } from "@/lib/supabase/server";

const groq = new Groq();

let fontData: Buffer | null = null;

async function getSystemFont() {
  if (!fontData) {
    try {
      fontData = readFileSync(join(process.cwd(), "public", "JetBrainsMono.ttf"));
    } catch (error) {
      throw new Error("Could not read JetBrainsMono.ttf.");
    }
  }
  return fontData;
}

export async function POST(req: NextRequest) {
  try {
    const { code, language, platform, userId } = await req.json();

    if (!code) return NextResponse.json({ error: "No code provided" }, { status: 400 });

    // --- SECURE CREDIT CHECK ---
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("generations_left, is_pro")
      .eq("id", userId)
      .single();

    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 403 });
    if (!profile.is_pro && profile.generations_left <= 0) {
      return NextResponse.json({ error: "Out of credits" }, { status: 402 }); 
    }

    if (!profile.is_pro) {
      await supabase.from("profiles").update({ generations_left: profile.generations_left - 1 }).eq("id", userId);
    }
    // -------------------------

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
  const toneInstruction = platform === "twitter" ? "Keep it under 280 characters." : "Keep it under 1300 characters.";
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: `You are an elite dev influencer. Write a social media post for the code below. ${toneInstruction} Output ONLY the text.` },
      { role: "user", content: `Language: ${language}\nCode:\n${code}` },
    ],
    model: "llama-3.1-8b-instant",
    temperature: 0.7,
  });
  return chatCompletion.choices[0]?.message?.content || "Could not generate caption.";
}

async function generateImage(code: string, language: string) {
  const lang = (language || "txt") as BundledLanguage;
  const result = await codeToTokens(code, { lang, theme: "github-dark" });

  const parsedCode = result.tokens.map((line) => ({
    type: "div",
    props: {
      style: { display: "flex", minHeight: "1.6em", flexWrap: "wrap", wordBreak: "break-all" },
      children: line.map((token) => ({ type: "span", props: { style: { color: token.color }, children: token.content.replace(/ /g, "\u00A0") } })),
    },
  }));

  const imageWidth = 800;
  const paddingX = 48;
  const availableWidth = imageWidth - paddingX;
  const charWidthPx = 14; 
  let totalWrappedLines = 0;
  
  for (const line of result.tokens) {
    const lineStrLength = line.reduce((sum, token) => sum + token.content.length, 0);
    const linesNeeded = Math.max(1, Math.ceil((lineStrLength * charWidthPx) / availableWidth));
    totalWrappedLines += linesNeeded;
  }

  const headerHeight = 60; const codePadding = 60; const lineHeightPx = 32; const bottomBuffer = 40;
  const calculatedHeight = headerHeight + codePadding + (totalWrappedLines * lineHeightPx) + bottomBuffer;
  const dynamicHeight = Math.max(600, Math.ceil(calculatedHeight));

  const svg = await satori(
    {
      type: "div",
      props: {
        style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#0d1117", borderRadius: "12px", overflow: "hidden" },
        children: [
          { type: "div", props: { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", backgroundColor: "#161b22", borderBottom: "1px solid #30363d", position: "relative" }, children: [
            { type: "div", props: { style: { display: "flex", gap: "8px" }, children: [ { type: "div", props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ff5f57" } } }, { type: "div", props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#febc2e" } } }, { type: "div", props: { style: { width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#28c840" } } } ] } },
            { type: "div", props: { style: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", gap: "2px", fontSize: "14px", fontFamily: "JetBrains Mono" }, children: [ { type: "span", props: { style: { color: "#e8e8f0" }, children: "code" } }, { type: "span", props: { style: { color: "#e89b20" }, children: "to" } }, { type: "span", props: { style: { color: "#e8e8f0" }, children: "post" } } ] } },
            { type: "span", props: { style: { color: "#8b949e", fontSize: "14px", fontFamily: "JetBrains Mono" }, children: `script.${language}` } }
          ] } },
          { type: "div", props: { style: { padding: "24px", fontSize: "18px", fontFamily: "JetBrains Mono", display: "flex", flexDirection: "column" }, children: parsedCode } }
        ],
      },
    } as any,
    { width: 800, height: dynamicHeight, fonts: [{ name: "JetBrains Mono", data: await getSystemFont(), weight: 400, style: "normal" }] }
  );

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}