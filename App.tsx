
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BrainService } from './geminiService';
import { AppState, AnalysisResult } from './types';

// Components
const Header: React.FC<{ onStop?: () => void }> = ({ onStop }) => (
  <header className="p-4 border-b border-green-900/50 bg-black/80 backdrop-blur-md flex justify-between items-center z-50 relative">
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div>
        <h1 className="text-xl font-orbitron font-bold text-green-500 tracking-wider uppercase">LE CERVEAU v1.2</h1>
      </div>
      <span className="text-[9px] font-mono text-amber-500 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/50 w-fit">
        MOBILE OPTIMIZED
      </span>
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right hidden sm:block">
        <div className="text-[10px] font-mono text-green-700 uppercase leading-none">DÉVELOPPÉ PAR:</div>
        <div className="text-xs font-orbitron text-green-500 font-bold">ALIOU ALI</div>
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

  const speak = useCallback((text: string) => {
    if (text === "RAS" || !text) return;
    if (text === lastAlertRef.current) return;
    
    lastAlertRef.current = text;
    window.speechSynthesis.cancel(); // Coupe l'alerte précédente pour la nouvelle

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.3; // Encore plus rapide pour l'urgence
    window.speechSynthesis.speak(utterance);
    
    setTimeout(() => { lastAlertRef.current = ""; }, 3000);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', 
          width: { ideal: 480 }, // Résolution native plus basse pour moins de CPU
          height: { ideal: 360 },
          frameRate: { ideal: 10 } 
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setState(prev => ({ ...prev, isActive: true, error: null }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: "Caméra indisponible." }));
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

  // ANALYSE ADAPTATIVE : On ne lance la suite qu'une fois la précédente terminée
  const runAnalysisCycle = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !brainServiceRef.current) return;

    setState(prev => ({ ...prev, isAnalyzing: true }));
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimisation canvas

    if (ctx && video.videoWidth > 0) {
      // ULTRA LOW RES : 320px de large
      const w = 320;
      const h = (video.videoHeight / video.videoWidth) * w;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      
      // ULTRA COMPRESSION : 0.2
      const base64 = canvas.toDataURL('image/jpeg', 0.2).split(',')[1];
      
      try {
        const result = await brainServiceRef.current.analyzeFrame(base64);
        const isDanger = !result.includes("RAS");
        
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          lastResult: {
            text: result,
            timestamp: Date.now(),
            status: isDanger ? 'danger' : 'safe'
          }
        }));

        if (isDanger) speak(result);
      } catch (err) {
        setState(prev => ({ ...prev, isAnalyzing: false }));
      }
    }

    // On planifie le prochain scan seulement APRES la réponse (boucle récursive)
    // Délai court de 500ms entre deux scans pour laisser respirer le processeur mobile
    timerRef.current = window.setTimeout(runAnalysisCycle, 800);
  }, [speak]);

  useEffect(() => {
    if (state.isActive) {
      runAnalysisCycle();
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.isActive, runAnalysisCycle]);

  return (
    <div className="min-h-screen flex flex-col bg-black text-green-500 selection:bg-green-900 overflow-hidden font-sans">
      <Header onStop={state.isActive ? stopCamera : undefined} />

      <main className="flex-1 relative flex flex-col md:flex-row p-3 gap-3 overflow-hidden">
        {/* HUD */}
        <div className="flex-1 relative rounded-xl border border-green-900/50 overflow-hidden bg-black shadow-[0_0_15px_rgba(0,100,0,0.2)]">
          <div className="scanline"></div>
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity duration-500 ${state.isActive ? 'opacity-80' : 'opacity-10'}`} />
          
          <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
            <div className="flex justify-between text-[8px] font-mono opacity-50">
              <div className="bg-black/40 p-1">MODE: FAST_SCAN_v1.2</div>
              <div className="bg-black/40 p-1">NET: MOBILE_OPTIMIZED</div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="w-32 h-32 border border-green-500 rounded-full"></div>
              <div className="absolute w-10 h-10 border-t border-l border-green-500 top-[40%] left-[40%]"></div>
            </div>

            <div className="flex justify-center">
              {state.isAnalyzing && (
                <div className="bg-green-600 text-black text-[10px] font-bold px-3 py-0.5 rounded animate-pulse">
                  TRANSMISSION...
                </div>
              )}
            </div>
          </div>

          {state.isActive && (
            <button onClick={stopCamera} className="absolute bottom-4 right-4 p-3 bg-red-600 text-white rounded-full pointer-events-auto z-20">
              <span className="font-bold text-[10px]">OFF</span>
            </button>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Status */}
        <div className="w-full md:w-72 flex flex-col gap-3">
          <div className={`flex-1 border p-4 rounded-xl flex flex-col items-center justify-center text-center transition-colors duration-200 ${
            state.lastResult?.status === 'danger' ? 'bg-red-950/40 border-red-600' : 'bg-zinc-900/50 border-green-900/30'
          }`}>
            <span className="text-[10px] font-mono opacity-40 uppercase mb-2">Flux de navigation</span>
            {state.lastResult ? (
              <p className={`text-lg font-bold font-orbitron leading-tight ${state.lastResult.status === 'danger' ? 'text-red-500' : 'text-green-400'}`}>
                {state.lastResult.text}
              </p>
            ) : (
              <p className="text-zinc-600 text-sm italic">Système en attente</p>
            )}
          </div>

          <div className="p-3 bg-zinc-900/30 border border-green-900/20 rounded-lg flex justify-between items-center">
             <span className="text-[10px] uppercase font-mono opacity-60">Status:</span>
             <span className={`text-[10px] font-bold ${state.isActive ? 'text-green-500' : 'text-zinc-600'}`}>
               {state.isActive ? 'RUNNING' : 'STANDBY'}
             </span>
          </div>

          {!state.isActive ? (
            <button onClick={startCamera} className="w-full py-4 bg-green-600 text-black font-bold rounded-xl shadow-[0_4px_0_rgb(22,101,52)] active:translate-y-1 active:shadow-none transition-all">
              DÉMARRER LE CERVEAU
            </button>
          ) : (
            <button onClick={stopCamera} className="w-full py-4 bg-red-900/50 text-red-500 border border-red-900 font-bold rounded-xl">
              ARRÊTER
            </button>
          )}
        </div>
      </main>

      <footer className="p-1 text-center text-[7px] font-mono text-zinc-700 uppercase">
        Aliou Ali &bull; Experimental v1.2 &bull; Nano-Scan Technology
      </footer>
    </div>
  );
};

export default App;
