
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Tu es le module "CERVEAU", système de vision pour lunettes connectées pour aveugles.
Analyse l'image et identifie les obstacles (murs, personnes, meubles, escaliers, trous, portes).

RÈGLES DE RÉPONSE :
1. Si tu vois un obstacle à moins de 3 mètres : Réponds UNIQUEMENT "{Nom de l'objet} droit devant, faites attention !"
2. Si le chemin est libre : Réponds UNIQUEMENT "RAS"

Sois extrêmement vigilant. Si tu as un doute sur un objet, signale-le par sécurité.
`;

export class BrainService {
  constructor() {}

  async analyzeFrame(base64Image: string): Promise<string> {
    if (!base64Image || base64Image.length < 100) {
      return "ERREUR : Image corrompue.";
    }

    try {
      // Sur Vite/Vercel, seule la variable VITE_ est exposée au navigateur
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
      
      if (!apiKey || apiKey.length < 10 || apiKey.includes("VOTRE_CLE")) {
        return "ERREUR : Configuration Vercel incorrecte. Nommez la variable : VITE_GEMINI_API_KEY";
      }

      const ai = new GoogleGenAI({ apiKey });
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
          temperature: 0.7,
        }
      });

      const text = response.text?.trim();
      return text || "RAS";

    } catch (error: any) {
      console.error("Erreur IA:", error);
      const msg = error.message || "";
      
      if (msg.includes("403") || msg.includes("API key not valid") || msg.includes("revoked")) {
        return "ERREUR : La clé API dans Vercel est invalide ou révoquée. Créez-en une NOUVELLE.";
      }
      
      return `ERREUR : ${msg.substring(0, 50)}`;
    }
  }
}
