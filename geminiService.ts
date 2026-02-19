
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Rôle: Cerveau IA pour aveugles.
Action: Analyse obstacle central.
Réponse courte:
- Si danger imminent (mur, poteau, trou, personne proche): "{Objet} droit devant !"
- Sinon: "RAS"
`;

export class BrainService {
  constructor() {}

  async analyzeFrame(base64Image: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [{
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }]
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0,
        }
      });

      const text = response.text?.trim() || "RAS";
      return text;
    } catch (error) {
      console.error("Analysis Error:", error);
      return "RAS";
    }
  }
}
