
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Tu es le "Cerveau", un module d'intelligence artificielle embarqué dans des lunettes connectées pour personnes aveugles.
TA MISSION : Analyser le flux visuel pour détecter les obstacles immédiats et prévenir l'utilisateur pour éviter une collision.

RÈGLES D'ANALYSE :
1. Détection : Identifie les objets ou structures situés au centre de l'image ou occupant une grande partie de la vue (Murs, Personnes, Poteaux, Véhicules, Escaliers, Trous).
2. Estimation de Proximité (Virtuelle) :
   - Si un objet occupe moins de 20% de l'image : Il est loin -> IGNORE.
   - Si un objet occupe plus de 40% de l'image : Il est proche -> ALERTE.
   - Si un objet bloque la vue (mur, porte fermée) : C'est un obstacle immédiat -> ALERTE PRIORITAIRE.

FORMAT DE SORTIE (Strict) :
- Si aucun danger immédiat n'est détecté, réponds simplement : "RAS"
- Si un danger est détecté, génère UNIQUEMENT la phrase : "{Nom_de_l_objet} droit devant, faites attention !"

EXEMPLES :
- "Une personne droit devant, faites attention !"
- "Un mur droit devant, faites attention !"
- "RAS"
`;

export class BrainService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async analyzeFrame(base64Image: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: "Analyse cet environnement pour la sécurité de l'utilisateur." },
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
          temperature: 0.1,
          topP: 0.95,
        }
      });

      return response.text?.trim() || "RAS";
    } catch (error) {
      console.error("Erreur d'analyse Gemini:", error);
      throw error;
    }
  }
}
