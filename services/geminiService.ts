import { GoogleGenAI } from "@google/genai";
import { Asset, PricePoint } from "../types";

// In a real production app, this would be a backend call to hide the key.
// For this demo, we assume the environment variable is injected.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getMarketAnalysis = async (
  asset: Asset,
  priceHistory: PricePoint[]
): Promise<{ sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; reasoning: string }> => {
  
  if (!process.env.API_KEY) {
    return {
      sentiment: 'NEUTRAL',
      reasoning: 'API Key missing. Please configure Gemini API Key to enable AI analysis.'
    };
  }

  try {
    const recentPrices = priceHistory.slice(-20).map(p => p.price.toFixed(2)).join(', ');
    
    const prompt = `
      Analyze the following recent price trend for ${asset} (Crypto).
      Prices (oldest to newest): [${recentPrices}]
      
      Act as a senior crypto technical analyst.
      1. Determine if the immediate short-term trend (next 1-5 minutes) is BULLISH (Up) or BEARISH (Down).
      2. Provide a strict one-sentence reasoning based on momentum.
      
      Return JSON format: { "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL", "reasoning": "string" }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text);
    return {
      sentiment: result.sentiment || 'NEUTRAL',
      reasoning: result.reasoning || 'AI analysis inconclusive.'
    };

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      sentiment: 'NEUTRAL',
      reasoning: 'AI is currently recalibrating its neural pathways.'
    };
  }
};