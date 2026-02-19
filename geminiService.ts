
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Tu es le "Cerveau", IA de navigation pour aveugles.
MISSION : Détecter obstacles proches au centre de la vue.

RÈGLES RAPIDES :
- Mur/Porte fermée/Trou/Véhicule/Poteau/Personne bloquant le passage : ALERTE.
- Si objet occupe >40% de l'image ou est très central : ALERTE.
- Sinon : RAS.

FORMAT SORTIE :
- Danger : "{Objet} droit devant, attention !"
- Sinon : "RAS"

Sois ultra-concis.
`;

export class BrainService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async analyzeFrame(base64Image: string): Promise<string> {
    try {
      // Utilisation d'une instance fraîche pour garantir la clé API
      const aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await aiInstance.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: "Scan rapide obstacles." },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            }
          ]
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0, // Zéro pour une rapidité et une constance maximale
          topP: 0.8,
        }
      });

      return response.text?.trim() || "RAS";
    } catch (error) {
      console.error("Erreur d'analyse Gemini:", error);
      throw error;
    }
  }
}
