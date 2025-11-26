import { GoogleGenAI } from "@google/genai";
import { Asset, PricePoint } from "../types";
import { getTechnicalSignals } from "./technicalAnalysis";

// Vite uses import.meta.env for environment variables
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const getMarketAnalysis = async (
  asset: Asset,
  priceHistory: PricePoint[]
): Promise<{ sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; reasoning: string }> => {

  // Calculate indicators locally first
  const signals = getTechnicalSignals(priceHistory);

  if (!API_KEY) {
    // Fallback if no API key: use local technical signals
    const isBullish = signals.trend === 'UPTREND' || signals.signal.includes('Buy');
    const isBearish = signals.trend === 'DOWNTREND' || signals.signal.includes('Sell');

    return {
      sentiment: isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL',
      reasoning: `Technical Analysis (Offline Mode): RSI is ${signals.rsi} (${signals.signal}). Trend is ${signals.trend}.`
    };
  }

  try {
    const recentPrices = priceHistory.slice(-20).map(p => p.price.toFixed(4)).join(', ');

    const prompt = `
      Analyze the following market data for ${asset} (Crypto).
      
      Technical Indicators (Calculated):
      - RSI (14): ${signals.rsi}
      - Signal: ${signals.signal}
      - Trend (SMA Cross): ${signals.trend}
      - SMA (7): ${signals.smaShort}
      - SMA (25): ${signals.smaLong}
      
      Recent Prices (oldest to newest): [${recentPrices}]
      
      Act as a senior crypto technical analyst.
      1. Determine if the immediate short-term trend (next 1-5 minutes) is BULLISH (Up) or BEARISH (Down).
      2. Provide a strict one-sentence reasoning that cites the specific indicators (RSI, Trend) provided above.
      
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

    const text = response.text;
    // @google/genai usually returns response.text()

    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text);
    return {
      sentiment: result.sentiment || 'NEUTRAL',
      reasoning: result.reasoning || 'AI analysis inconclusive.'
    };

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    // Fallback to local signals on error
    return {
      sentiment: signals.trend === 'UPTREND' ? 'BULLISH' : 'BEARISH',
      reasoning: `AI unavailable. Fallback Analysis: RSI ${signals.rsi}, Trend ${signals.trend}.`
    };
  }
};