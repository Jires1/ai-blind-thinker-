
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Tu es le module "CERVEAU", système de vision pour lunettes connectées.
OBJECTIF : Sécurité immédiate des personnes aveugles.

CRITÈRES D'ALERTE :
- Un obstacle central (mur, poteau, porte, trou, personne, meuble, escalier) à moins de 3 mètres.
- Un changement brutal de sol ou une marche.

REPONSES STRICTES :
- Si danger : "{Nom de l'objet} droit devant, faites attention !" (Ex: "Mur droit devant, faites attention !")
- Sinon : "RAS"

CONSIGNE : Sois précis et n'alerte que pour les obstacles réels bloquant le passage.
`;

export class BrainService {
  constructor() {}

  async analyzeFrame(base64Image: string): Promise<string> {
    if (!base64Image) return "RAS";

    try {
      // Priorité à la clé de l'environnement, sinon clé de secours
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || 'AIzaSyASIVpkeby03oDQd_f11HWdBeJ6vz19dng';
      
      if (!apiKey || apiKey === 'VOTRE_CLE_ICI') {
        console.error("Clé API manquante pour le prototype");
        return "ERREUR : Clé API non configurée";
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
          temperature: 0.4, // Un peu plus de flexibilité
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
