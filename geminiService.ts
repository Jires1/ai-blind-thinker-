
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
      // On utilise la variable d'environnement standard GEMINI_API_KEY
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Clé API GEMINI_API_KEY manquante");
        return "Erreur Configuration";
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
