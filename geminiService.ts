
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
      let apiKey = "";
      
      // 1. Priorité absolue aux variables d'environnement (Sécurité)
      try {
        apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
      } catch (e) {}

      if (!apiKey) {
        try {
          apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
        } catch (e) {}
      }
      
      // 2. Si aucune clé n'est trouvée, on arrête tout
      if (!apiKey || apiKey.includes("VOTRE_CLE")) {
        return "ERREUR : Clé API manquante. Ajoutez VITE_GEMINI_API_KEY dans les variables d'environnement Vercel.";
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
      console.error("Erreur de communication IA:", error);
      
      const msg = error.message || "";
      // Détection spécifique de la révocation ou clé invalide
      if (msg.includes("API key not valid") || msg.includes("403") || msg.includes("revoked")) {
        return "ERREUR : Clé API révoquée ou invalide. Générez-en une nouvelle sur Google AI Studio et mettez à jour Vercel.";
      }
      if (msg.includes("quota")) return "ERREUR : Quota dépassé.";
      
      return `ERREUR IA : ${msg.substring(0, 60)}`;
    }
  }
}
