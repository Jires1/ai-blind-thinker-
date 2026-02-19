
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Tu es le module "CERVEAU", système de vision pour lunettes connectées.
OBJECTIF : Sécurité immédiate des personnes aveugles.

CRITÈRES D'ALERTE :
- Un obstacle central (mur, poteau, porte, trou, personne) à moins de 2 mètres.
- Un changement brutal de sol.

REPONSES STRICTES :
- Si danger : "{Nom de l'objet} droit devant !" (Ex: "Mur droit devant !")
- Sinon : "RAS"

CONSIGNE : Sois précis et n'alerte que pour les obstacles réels bloquant le passage.
`;

export class BrainService {
  constructor() {}

  async analyzeFrame(base64Image: string): Promise<string> {
    if (!base64Image) return "RAS";

    try {
      // On initialise l'instance à chaque appel pour garantir la récupération de la clé process.env à jour
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        console.error("Clé API manquante dans l'environnement");
        return "Erreur Système";
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
          temperature: 0.1,
          topK: 1,
        }
      });

      const text = response.text?.trim();
      return text || "RAS";
    } catch (error) {
      console.error("Erreur de communication IA:", error);
      // En cas d'erreur de quota ou réseau, on renvoie RAS pour ne pas paniquer l'utilisateur inutilement
      return "RAS";
    }
  }
}
