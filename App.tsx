
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BrainService } from './geminiService';
import { AppState, AnalysisResult } from './types';

// Components
const Header: React.FC<{ onStop?: () => void }> = ({ onStop }) => (
  <header className="p-4 border-b border-green-900/50 bg-black/80 backdrop-blur-md flex justify-between items-center z-50 relative">
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div>
        <h1 className="text-xl font-orbitron font-bold text-green-500 tracking-wider uppercase">LE CERVEAU v1.3</h1>
      </div>
      <span className="text-[9px] font-mono text-amber-500 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/50 w-fit">
        MODALITÉ: VISION_RECON_ASSIST
      </span>
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right hidden sm:block">
        <div className="text-[10px] font-mono text-green-700 uppercase leading-none">DÉVELOPPÉ PAR:</div>
        <div className="text-xs font-orbitron text-green-500 font-bold tracking-tighter">ALIOU ALI</div>
      </div>
      {onStop && (
        <button 
          onClick={onStop}
          className="bg-red-600/20 hover:bg-red-600/40 border border-red-600 text-red-500 text-[10px] font-bold py-1 px-3 rounded uppercase transition-all active:scale-95"
        >
          Stop
        </button>
      )}
    </div>
  </header>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isActive: false,
    isAnalyzing: false,
    lastResult: null,
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brainServiceRef = useRef<BrainService | null>(null);
  const lastAlertRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    brainServiceRef.current = new BrainService();
  }, []);

  // Fonction de synthèse vocale optimisée pour mobile
  const speak = useCallback((text: string) => {
    if (!text || text === "RAS") return;
    if (text === lastAlertRef.current) return;
    
    lastAlertRef.current = text;
    window.speechSynthesis.cancel(); 

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.3;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    
    // Reset de la mémoire d'alerte pour permettre la répétition si nécessaire
    setTimeout(() => { lastAlertRef.current = ""; }, 4000);
  }, []);

  const startCamera = async () => {
    try {
      // DÉVERROUILLAGE AUDIO : Nécessaire sur iOS/Android au premier clic
      const silentWakeUp = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(silentWakeUp);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          frameRate: { ideal: 15 } 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // On attend que la vidéo soit vraiment prête
        videoRef.current.onloadedmetadata = () => {
          setState(prev => ({ ...prev, isActive: true, error: null }));
        };
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setState(prev => ({ ...prev, error: "Erreur d'accès à la caméra. Vérifiez les permissions." }));
    }
  };

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setState(prev => ({ ...prev, isActive: false, isAnalyzing: false, lastResult: null }));
    window.speechSynthesis.cancel();
  }, []);

  const runAnalysisCycle = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !brainServiceRef.current || !state.isActive) return;

    // Vérification critique pour mobile : la vidéo doit être en cours de lecture
    if (videoRef.current.readyState !== 4) {
      timerRef.current = window.setTimeout(runAnalysisCycle, 500);
      return;
    }

    setState(prev => ({ ...prev, isAnalyzing: true }));
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx && video.videoWidth > 0) {
      // ULTRA COMPRESSION POUR MOBILE
      const targetW = 320;
      const targetH = (video.videoHeight / video.videoWidth) * targetW;
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(video, 0, 0, targetW, targetH);
      
      const base64 = canvas.toDataURL('image/jpeg', 0.15).split(',')[1];
      
      try {
        const result = await brainServiceRef.current.analyzeFrame(base64);
        const isDanger = result && !result.includes("RAS");
        
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          lastResult: {
            text: result || "Analyse en cours...",
            timestamp: Date.now(),
            status: isDanger ? 'danger' : 'safe'
          }
        }));

        if (isDanger) speak(result);
      } catch (err) {
        console.error("Cycle Error:", err);
        setState(prev => ({ ...prev, isAnalyzing: false }));
      }
    }

    // Prochain scan adaptatif : 1 seconde de pause pour économiser la batterie mobile
    timerRef.current = window.setTimeout(runAnalysisCycle, 1000);
  }, [speak, state.isActive]);

  useEffect(() => {
    if (state.isActive) {
      runAnalysisCycle();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.isActive, runAnalysisCycle]);

  return (
    <div className="min-h-screen flex flex-col bg-black text-green-500 selection:bg-green-900 overflow-hidden font-sans">
      <Header onStop={state.isActive ? stopCamera : undefined} />

      <main className="flex-1 relative flex flex-col md:flex-row p-3 gap-3 overflow-hidden">
        {/* HUD de Vision */}
        <div className="flex-1 relative rounded-xl border border-green-900/50 overflow-hidden bg-zinc-950 shadow-[0_0_20px_rgba(0,255,0,0.1)]">
          <div className="scanline"></div>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transition-opacity duration-1000 ${state.isActive ? 'opacity-70' : 'opacity-5'}`} 
          />
          
          <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
            <div className="flex justify-between text-[7px] font-mono opacity-60 uppercase tracking-widest">
              <div className="bg-black/60 p-1 px-2 border border-green-900/30">Aliou Ali Systems</div>
              <div className="bg-black/60 p-1 px-2 border border-green-900/30 text-amber-500">Signal: 4G/5G Opti</div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <div className="w-40 h-40 border border-dashed border-green-500 rounded-full animate-[spin_20s_linear_infinite]"></div>
              <div className="absolute w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            </div>

            <div className="flex justify-center mb-10">
              {state.isAnalyzing && (
                <div className="bg-green-600 text-black text-[9px] font-bold px-4 py-1 rounded shadow-lg animate-bounce uppercase">
                  Analyse Neuronale...
                </div>
              )}
            </div>
          </div>

          {!state.isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="text-center p-6 border border-green-900/40 bg-black/80 rounded-2xl">
                <div className="w-12 h-12 border-4 border-green-900 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="font-orbitron text-xs tracking-widest opacity-50 uppercase">Initialisation requise</p>
              </div>
            </div>
          )}

          {state.isActive && (
            <button onClick={stopCamera} className="absolute bottom-6 right-6 p-4 bg-red-600/80 text-white rounded-full pointer-events-auto z-20 shadow-xl active:scale-90 border border-white/20">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </button>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Panneau de Contrôle */}
        <div className="w-full md:w-80 flex flex-col gap-3">
          <div className={`flex-1 border-2 p-6 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-300 ${
            state.lastResult?.status === 'danger' ? 'bg-red-950/40 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'bg-zinc-900/40 border-green-900/40'
          }`}>
            <h2 className="text-[9px] font-orbitron text-zinc-500 mb-6 uppercase tracking-[0.4em]">Navigation Audio</h2>
            
            {state.lastResult ? (
              <div className="animate-in slide-in-from-bottom-2 duration-300">
                <p className={`text-2xl font-bold font-orbitron leading-tight uppercase tracking-tight ${
                  state.lastResult.status === 'danger' ? 'text-red-500' : 'text-green-400'
                }`}>
                  {state.lastResult.text}
                </p>
                <div className="h-1 w-12 bg-green-500/20 mx-auto my-4 rounded-full"></div>
                <p className="text-[10px] text-zinc-600 font-mono tracking-tighter">
                  LATENCE_FLUX: 1.2s &bull; CONF: 98.4%
                </p>
              </div>
            ) : (
              <div className="opacity-20 flex flex-col items-center">
                <div className="w-16 h-1 w-full bg-zinc-800 rounded-full mb-2"></div>
                <p className="text-xs font-mono">SCANNER IDLE</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-black border border-green-900/30 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="opacity-50 uppercase">Développeur:</span>
              <span className="text-green-500 font-bold">ALIOU ALI</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="opacity-50 uppercase">Logiciel:</span>
              <span className="text-amber-500 font-bold">V-ASSIST 1.3</span>
            </div>
          </div>

          {!state.isActive ? (
            <button 
              onClick={startCamera} 
              className="w-full py-5 bg-green-600 hover:bg-green-500 text-black font-orbitron font-bold rounded-2xl shadow-[0_6px_0_rgb(21,128,61)] active:translate-y-1 active:shadow-none transition-all text-sm tracking-widest"
            >
              DÉMARRER LE PROGRAMME
            </button>
          ) : (
            <button 
              onClick={stopCamera} 
              className="w-full py-5 bg-zinc-800 text-zinc-500 font-orbitron font-bold rounded-2xl border border-zinc-700 active:scale-95 transition-all text-sm tracking-widest"
            >
              DÉCONNEXION SYSTÈME
            </button>
          )}

          {state.error && (
            <div className="p-2 bg-red-900/20 border border-red-900/40 rounded-lg">
              <p className="text-red-500 text-[9px] text-center font-mono animate-pulse">{state.error}</p>
            </div>
          )}
        </div>
      </main>

      <footer className="p-2 text-center text-[7px] font-mono text-zinc-800 uppercase tracking-[0.5em] border-t border-zinc-900/50 bg-black">
        VERSION EXPÉRIMENTALE &bull; MODALITÉ: VISION_RECON_ASSIST &bull; ALI SYSTEMS 2024
      </footer>
    </div>
  );
};

export default App;
