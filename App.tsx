
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BrainService } from './geminiService';
import { AppState, AnalysisResult } from './types';

// Components
const Header: React.FC<{ onStop?: () => void }> = ({ onStop }) => (
  <header className="p-4 border-b border-green-900/50 bg-black/80 backdrop-blur-md flex justify-between items-center z-50 relative">
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div>
        <h1 className="text-xl font-orbitron font-bold text-green-500 tracking-wider uppercase">LE CERVEAU v1.0</h1>
      </div>
      <span className="text-[9px] font-mono text-amber-500 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/50 w-fit">
        VERSION EXPÉRIMENTALE
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

  // Initialize Service
  useEffect(() => {
    brainServiceRef.current = new BrainService();
  }, []);

  // Text to Speech logic
  const speak = useCallback((text: string) => {
    if (text === "RAS") return;
    
    // Simple throttle for the same alert
    if (text === lastAlertRef.current) return;
    lastAlertRef.current = text;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
    
    // Clear last alert after 3 seconds to allow repeating if same danger persists
    setTimeout(() => {
      lastAlertRef.current = "";
    }, 3000);
  }, []);

  // Camera Management
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setState(prev => ({ ...prev, isActive: true, error: null }));
      }
    } catch (err) {
      console.error("Camera error:", err);
      setState(prev => ({ ...prev, error: "Accès caméra refusé ou indisponible." }));
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setState(prev => ({ ...prev, isActive: false, isAnalyzing: false, lastResult: null }));
    window.speechSynthesis.cancel();
    lastAlertRef.current = "";
  }, []);

  // Analysis Loop
  const captureAndAnalyze = useCallback(async () => {
    if (!state.isActive || !videoRef.current || !canvasRef.current || !brainServiceRef.current || state.isAnalyzing) return;

    setState(prev => ({ ...prev, isAnalyzing: true }));

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      
      try {
        const resultText = await brainServiceRef.current.analyzeFrame(base64Image);
        const status = resultText.includes("RAS") ? 'safe' : 'danger';
        
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          lastResult: {
            text: resultText,
            timestamp: Date.now(),
            status: status as 'danger' | 'safe'
          }
        }));

        if (status === 'danger') {
          speak(resultText);
        }
      } catch (err) {
        console.error("Analysis failed:", err);
        setState(prev => ({ ...prev, isAnalyzing: false }));
      }
    }
  }, [state.isActive, state.isAnalyzing, speak]);

  // Main Loop Timer
  useEffect(() => {
    let intervalId: number | undefined;
    if (state.isActive) {
      intervalId = window.setInterval(captureAndAnalyze, 2500); // Check every 2.5s
    } else {
      clearInterval(intervalId);
    }
    return () => clearInterval(intervalId);
  }, [state.isActive, captureAndAnalyze]);

  return (
    <div className="min-h-screen flex flex-col bg-black text-green-500 selection:bg-green-900 selection:text-white overflow-hidden">
      <Header onStop={state.isActive ? stopCamera : undefined} />

      <main className="flex-1 relative flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
        {/* Camera Feed HUD */}
        <div className="flex-1 relative rounded-xl border-2 border-green-900 overflow-hidden bg-zinc-900 shadow-[0_0_20px_rgba(0,100,0,0.3)]">
          <div className="scanline"></div>
          
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transition-opacity duration-700 ${state.isActive ? 'opacity-100' : 'opacity-20'}`}
          />
          
          {/* Overlay UI */}
          <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="p-2 border border-green-500/30 bg-black/50 backdrop-blur-sm rounded">
                <p className="text-[10px] font-mono uppercase opacity-70">COORD_X: 48.8566</p>
                <p className="text-[10px] font-mono uppercase opacity-70">COORD_Y: 2.3522</p>
              </div>
              <div className="p-2 border border-green-500/30 bg-black/50 backdrop-blur-sm rounded text-right">
                <p className="text-[10px] font-mono uppercase opacity-70">SIGNAL: STRONG</p>
                <p className="text-[10px] font-mono uppercase opacity-70">BATT: 88%</p>
              </div>
            </div>

            {/* Target Reticle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border border-green-500/20 rounded-full flex items-center justify-center">
                <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                <div className="absolute w-8 h-[1px] bg-green-500 left-0"></div>
                <div className="absolute w-8 h-[1px] bg-green-500 right-0"></div>
                <div className="absolute h-8 w-[1px] bg-green-500 top-0"></div>
                <div className="absolute h-8 w-[1px] bg-green-500 bottom-0"></div>
              </div>
            </div>

            <div className="flex justify-center">
              {state.isAnalyzing && (
                <div className="bg-green-600 text-black font-orbitron font-bold px-4 py-1 rounded animate-pulse">
                  SCAN EN COURS...
                </div>
              )}
            </div>
          </div>

          {/* Bouton STOP Flottant dans le HUD */}
          {state.isActive && (
            <button 
              onClick={stopCamera}
              className="absolute bottom-6 right-6 p-4 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-all active:scale-95 pointer-events-auto z-20 group"
              title="Arrêter le programme"
            >
              <span className="font-bold font-orbitron text-xs">STOP</span>
              <div className="absolute -inset-1 rounded-full border border-red-600 animate-ping opacity-25"></div>
            </button>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Sidebar Status */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          <div className="bg-zinc-900/80 border border-green-900 p-4 rounded-xl">
            <h2 className="text-xs font-orbitron text-green-700 mb-3 uppercase tracking-tighter">État du Système</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Caméra</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${state.isActive ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                  {state.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">IA (Cerveau)</span>
                <span className="px-2 py-0.5 bg-blue-900/40 text-blue-400 rounded text-[10px] font-bold uppercase">
                  {state.isActive ? 'Analyse...' : 'Veille'}
                </span>
              </div>
            </div>
          </div>

          <div className={`flex-1 border-2 p-6 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-300 ${
            state.lastResult?.status === 'danger' 
              ? 'bg-red-950/30 border-red-600 shadow-[inset_0_0_20px_rgba(220,38,38,0.2)]' 
              : 'bg-zinc-900/80 border-green-900'
          }`}>
            <h2 className="text-xs font-orbitron text-zinc-500 mb-4 uppercase tracking-widest">Dernière Alerte</h2>
            
            {state.lastResult ? (
              <div className="animate-in fade-in duration-500">
                <p className={`text-xl font-bold font-orbitron leading-tight ${
                  state.lastResult.status === 'danger' ? 'text-red-500' : 'text-green-500'
                }`}>
                  {state.lastResult.text}
                </p>
                <p className="text-[10px] text-zinc-500 mt-2 font-mono">
                  DÉTECTÉ À: {new Date(state.lastResult.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <p className="text-zinc-700 font-mono italic text-sm opacity-50">Aucun obstacle détecté</p>
            )}
          </div>

          <div className="flex flex-col gap-2 sticky bottom-4">
            {!state.isActive ? (
              <button 
                onClick={startCamera}
                className="w-full py-4 bg-green-600 hover:bg-green-500 text-black font-orbitron font-bold rounded-xl transition-all active:scale-95 shadow-[0_4px_0_rgb(22,101,52)]"
              >
                ACTIVER LE SYSTÈME
              </button>
            ) : (
              <button 
                onClick={stopCamera}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-orbitron font-bold rounded-xl transition-all active:scale-95 shadow-[0_4px_0_rgb(153,27,27)]"
              >
                STOPPER LE PROGRAMME
              </button>
            )}
            
            {state.error && (
              <p className="text-red-500 text-[10px] text-center font-mono mt-1">{state.error}</p>
            )}
          </div>
        </div>
      </main>

      <footer className="p-2 text-center text-[8px] font-mono text-zinc-800 uppercase tracking-[0.3em]">
        System Architecture: Neural-Link Glasses &bull; AI Model: Gemini-Brain-3 &bull; Privacy Protected
      </footer>
    </div>
  );
};

export default App;
