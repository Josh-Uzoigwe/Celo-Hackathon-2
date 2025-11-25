import { GoogleGenAI } from "@google/genai";
import { Asset, PricePoint } from "../types";

// Vite uses import.meta.env for environment variables
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const getMarketAnalysis = async (
  asset: Asset,
  priceHistory: PricePoint[]
): Promise<{ sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; reasoning: string }> => {

  if (!API_KEY) {
    return {
      sentiment: 'NEUTRAL',
      reasoning: 'API Key missing. Please configure VITE_GEMINI_API_KEY in .env to enable AI analysis.'
    };
  }

  try {
    const recentPrices = priceHistory.slice(-20).map(p => p.price.toFixed(4)).join(', ');

    const prompt = `
      Analyze the following recent price trend for ${asset} (Crypto).
      Prices (oldest to newest): [${recentPrices}]
      
      Act as a senior crypto technical analyst.
      1. Determine if the immediate short-term trend (next 1-5 minutes) is BULLISH (Up) or BEARISH (Down).
      2. Provide a strict one-sentence reasoning based on momentum.
      
      Return JSON format: { "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL", "reasoning": "string" }
    `;

    // Using gemini-1.5-flash as it is a stable and fast model for this use case
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text; // response.text is a getter/property in this SDK version
    // @google/genai usually returns response.text()

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