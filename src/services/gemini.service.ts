import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';

export interface SafetyTip {
  title: string;
  tip: string;
  icon: string;
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface RiskAnalysisResult {
  riskLevel: RiskLevel;
  reason: string;
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;
  
  constructor() {
    // This is a placeholder for the API key.
    // In a real Applet environment, process.env.API_KEY would be available.
    const apiKey = (window as any).process?.env?.API_KEY ?? 'YOUR_API_KEY_PLACEHOLDER';
    if (apiKey === 'YOUR_API_KEY_PLACEHOLDER') {
        console.warn("Using placeholder API key for Gemini. Please provide a real API key.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async getSafetyTips(): Promise<SafetyTip[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Provide 10 concise and practical safety tips for women. Focus on awareness, prevention, and de-escalation. For each tip, suggest a relevant Font Awesome 6 Solid icon class name (e.g., 'fa-shield-halved', 'fa-key', 'fa-person-running').",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tips: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: 'A short, catchy title for the safety tip.'
                    },
                    tip: {
                      type: Type.STRING,
                      description: 'The detailed safety tip.'
                    },
                    icon: {
                      type: Type.STRING,
                      description: 'A single Font Awesome 6 Solid icon class name relevant to the tip (e.g., "fa-shield-halved").'
                    }
                  },
                   required: ["title", "tip", "icon"]
                }
              }
            },
            required: ["tips"]
          }
        }
      });

      const jsonText = response.text.trim();
      const result = JSON.parse(jsonText);
      const tips = result.tips || [];
      if (tips.length === 0) {
        console.warn('Gemini API returned no tips, falling back to default.');
        return this.getDefaultSafetyTips();
      }
      return tips;
    } catch (error) {
      console.error('Error fetching safety tips from Gemini API:', error);
      console.warn('Falling back to default safety tips.');
      return this.getDefaultSafetyTips();
    }
  }

  private getDefaultSafetyTips(): SafetyTip[] {
    return [
      {
        title: "Be Aware of Surroundings",
        tip: "Pay attention to who and what is around you. Avoid distractions like your phone when walking alone.",
        icon: "fa-eye"
      },
      {
        title: "Trust Your Instincts",
        tip: "If a situation or person feels unsafe, it probably is. Remove yourself from the situation immediately.",
        icon: "fa-brain"
      },
      {
        title: "Share Your Plans",
        tip: "Let a trusted friend or family member know your plans, where you're going, and when you expect to be back.",
        icon: "fa-share-nodes"
      },
      {
        title: "Walk Confidently",
        tip: "Walk with purpose and maintain good posture. Projecting confidence can make you appear as a less likely target.",
        icon: "fa-person-walking"
      },
      {
        title: "Secure Your Home",
        tip: "Always lock doors and windows, even when you're home. Use peepholes to see who is at the door.",
        icon: "fa-key"
      },
      {
        title: "Parking Lot Safety",
        tip: "Have your keys ready as you approach your car. Check the back seat before getting in. Park in well-lit areas.",
        icon: "fa-car"
      },
      {
        title: "Public Transport Smarts",
        tip: "Try to sit near the driver or in a well-populated car. Be aware of your stops and stay awake and alert.",
        icon: "fa-bus-simple"
      },
      {
        title: "Online Safety",
        tip: "Be cautious about sharing personal information online. Be wary of meeting someone in person you only know online.",
        icon: "fa-globe"
      }
    ];
  }

  async analyzeAudioForRisk(audioBase64: string): Promise<RiskAnalysisResult> {
    try {
      const audioPart = {
        inlineData: {
          mimeType: 'audio/webm',
          data: audioBase64,
        },
      };
      
      const textPart = {
        text: `You are an AI safety system. Analyze this audio for signs of distress, danger, or aggression. Categorize the risk into one of four levels: "none", "low" (e.g., raised voices, minor argument), "medium" (e.g., shouting, clear distress), or "high" (e.g., screaming for help, sounds of a physical struggle). Respond with ONLY a JSON object. The object must contain a "riskLevel" (one of the four levels) and a brief "reason" for the assessment. If there is no risk, set riskLevel to "none".`,
      };

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [audioPart, textPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              riskLevel: { 
                type: Type.STRING,
                enum: ['none', 'low', 'medium', 'high']
              },
              reason: { type: Type.STRING }
            },
            required: ['riskLevel', 'reason']
          }
        }
      });
      
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as RiskAnalysisResult;

    } catch (error) {
      console.error('Error analyzing audio with Gemini API:', error);
      // Return a non-threatening result in case of an API error to avoid false positives
      return { riskLevel: 'none', reason: 'API error' };
    }
  }
}