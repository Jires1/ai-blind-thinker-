
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
      return "ERREUR : Image corrompue ou vide.";
    }

    try {
      // Détection de la clé API avec support multi-environnement
      let apiKey = "";
      
      // 1. Essayer import.meta.env (Vite/Vercel standard)
      try {
        apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
      } catch (e) {}

      // 2. Essayer process.env (AI Studio / Node fallback)
      if (!apiKey) {
        try {
          apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
        } catch (e) {}
      }

      // 3. Clé de secours (si aucune autre n'est trouvée)
      if (!apiKey) {
        apiKey = 'AIzaSyASIVpkeby03oDQd_f11HWdBeJ6vz19dng';
      }
      
      if (!apiKey || apiKey === 'VOTRE_CLE_ICI') {
        return "ERREUR : Clé API non configurée. Ajoutez VITE_GEMINI_API_KEY dans Vercel.";
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
          temperature: 0.7, // Augmenté pour plus de "créativité" dans la détection
        }
      });

      const text = response.text?.trim();
      
      if (!text) return "RAS";
      
      // Si l'IA répond par quelque chose de trop long ou bizarre, on essaie de filtrer
      if (text.length > 100) {
        return text.substring(0, 100) + "...";
      }

      return text;
    } catch (error: any) {
      console.error("Erreur de communication IA:", error);
      
      const msg = error.message || "";
      if (msg.includes("API key not valid")) return "ERREUR : Clé API invalide.";
      if (msg.includes("quota")) return "ERREUR : Quota dépassé.";
      if (msg.includes("safety")) return "RAS (Bloqué par filtre de sécurité)";
      
      return `ERREUR IA : ${msg.substring(0, 50)}`;
    }
  }
}
