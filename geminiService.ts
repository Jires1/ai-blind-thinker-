
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
      // Priorité à la clé de l'environnement (Vite/Vercel support)
      // Note: process.env est utilisé par AI Studio, import.meta.env par Vite/Vercel
      const apiKey = 
        process.env.GEMINI_API_KEY || 
        process.env.API_KEY || 
        (import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : null) ||
        'AIzaSyASIVpkeby03oDQd_f11HWdBeJ6vz19dng';
      
      if (!apiKey || apiKey === 'VOTRE_CLE_ICI') {
        return "ERREUR : Clé API non configurée. Veuillez la définir dans Vercel (VITE_GEMINI_API_KEY).";
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
          temperature: 0.4,
        }
      });

      const text = response.text?.trim();
      return text || "RAS";
    } catch (error: any) {
      console.error("Erreur de communication IA:", error);
      
      // Message d'erreur plus explicite pour le débogage sur Vercel
      if (error.message?.includes("API key not valid")) {
        return "ERREUR : Clé API invalide ou expirée.";
      }
      if (error.message?.includes("quota")) {
        return "ERREUR : Quota API dépassé.";
      }
      
      return `ERREUR IA : ${error.message || "Problème de connexion"}`;
    }
  }
}
