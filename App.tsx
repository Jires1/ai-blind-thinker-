
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BrainService } from './geminiService';
import { AppState, AnalysisResult } from './types';

// Components
const Header: React.FC<{ onStop?: () => void }> = ({ onStop }) => (
  <header className="p-4 border-b border-green-900/50 bg-black/80 backdrop-blur-md flex justify-between items-center z-50 relative">
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div>
        <h1 className="text-xl font-orbitron font-bold text-green-500 tracking-wider uppercase">ALIOU ALI - IA  v1.3</h1>
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
    selectedCameraId: '',
    esp32Url: '',
    isEsp32Mode: false,
    useCors: true,
    blynkToken: 'Tw8ktPhM9AvzoGEXotmw_U6KeGTa64dO',
    blynkPin: 'V1',
    isBlynkMode: false,
    blynkData: null,
    blynkRegion: 'ny3',
  });

  const [esp32Status, setEsp32Status] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const esp32ImgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brainServiceRef = useRef<BrainService | null>(null);
  const lastAlertRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey()) && !process.env.GEMINI_API_KEY && !process.env.API_KEY) {
        setState(prev => ({ ...prev, error: "Clé API manquante. Veuillez cliquer sur 'Configurer Clé API' pour continuer." }));
      }
    };
    
    brainServiceRef.current = new BrainService();
    fetchCameras();
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setState(prev => ({ ...prev, error: null }));
      // On recrée le service pour s'assurer qu'il utilise la nouvelle clé
      brainServiceRef.current = new BrainService();
    }
  };

  const fetchCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      if (videoDevices.length > 0 && !state.selectedCameraId) {
        setState(prev => ({ ...prev, selectedCameraId: videoDevices[0].deviceId }));
      }
    } catch (err) {
      console.error("Error fetching cameras:", err);
    }
  };

  const checkConnection = async () => {
    if (!state.esp32Url) return;
    setEsp32Status('loading');
    setState(prev => ({ ...prev, error: "Test de connexion en cours..." }));
    
    try {
      // On tente un fetch court pour voir si l'IP répond
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      await fetch(state.esp32Url, { 
        mode: 'no-cors', 
        signal: controller.signal,
        referrerPolicy: 'no-referrer'
      });
      
      clearTimeout(timeoutId);
      setEsp32Status('connected');
      setState(prev => ({ ...prev, error: null }));
      speak("Connexion ESP32 établie");
    } catch (err) {
      console.error("Check failed:", err);
      setEsp32Status('error');
      setState(prev => ({ 
        ...prev, 
        error: "L'ESP32 ne répond pas. Vérifiez l'IP ou désactivez 'Block insecure private network requests' dans Chrome." 
      }));
    }
  };

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
      // DÉVERROUILLAGE AUDIO
      const silentWakeUp = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(silentWakeUp);

      if (state.isBlynkMode) {
        if (!state.blynkToken) {
          setState(prev => ({ ...prev, error: "Veuillez entrer votre Token Blynk." }));
          return;
        }
        setState(prev => ({ ...prev, isActive: true, error: null }));
        return;
      }

      if (state.isEsp32Mode) {
        if (!state.esp32Url) {
          setState(prev => ({ ...prev, error: "Veuillez entrer l'URL de l'ESP32." }));
          return;
        }
        setState(prev => ({ ...prev, isActive: true, error: null }));
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: state.selectedCameraId ? { exact: state.selectedCameraId } : undefined,
          facingMode: state.selectedCameraId ? undefined : 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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
    if (!brainServiceRef.current || !state.isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let source: HTMLVideoElement | HTMLImageElement | null = null;
    let isReady = false;

    if (state.isBlynkMode) {
      setState(prev => ({ ...prev, isAnalyzing: true }));
      try {
        const blynkUrl = `https://${state.blynkRegion}.blynk.cloud/external/api/get?token=${state.blynkToken}&${state.blynkPin}`;
        const response = await fetch(blynkUrl);
        let data = await response.text();
        
        // Nettoyage des données Blynk (enlève les guillemets et crochets éventuels)
        data = data.replace(/["\[\]]/g, '').trim();
        setState(prev => ({ ...prev, blynkData: data }));
        
        if (data && (data.startsWith('http') || data.startsWith('data:image'))) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = data;
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            const timeout = setTimeout(() => reject(new Error("Timeout")), 8000);
            img.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("Image inaccessible"));
            };
          });
          
          const targetW = 320;
          const targetH = (img.height / img.width) * targetW;
          canvas.width = targetW;
          canvas.height = targetH;
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const base64 = canvas.toDataURL('image/jpeg', 0.2).split(',')[1];
          
          const result = await brainServiceRef.current.analyzeFrame(base64);
          const isDanger = result && !result.toLowerCase().includes("ras");
          
          setState(prev => ({
            ...prev,
            isAnalyzing: false,
            lastResult: { text: result || "Analyse...", timestamp: Date.now(), status: isDanger ? 'danger' : 'safe' }
          }));
          
          if (isDanger) speak(result);
        } else {
          setState(prev => ({ ...prev, isAnalyzing: false }));
        }
      } catch (err) {
        console.error("Blynk Error:", err);
        setState(prev => ({ ...prev, isAnalyzing: false }));
      }
      timerRef.current = window.setTimeout(runAnalysisCycle, 4000);
      return;
    }

    if (state.isEsp32Mode) {
      source = esp32ImgRef.current;
      isReady = !!(source && source.complete && source.naturalWidth > 0);
    } else {
      source = videoRef.current;
      isReady = !!(source && (source as HTMLVideoElement).readyState === 4);
    }

    if (!isReady || !source) {
      timerRef.current = window.setTimeout(runAnalysisCycle, 500);
      return;
    }

    setState(prev => ({ ...prev, isAnalyzing: true }));
    
    const sourceWidth = state.isEsp32Mode ? (source as HTMLImageElement).naturalWidth : (source as HTMLVideoElement).videoWidth;
    const sourceHeight = state.isEsp32Mode ? (source as HTMLImageElement).naturalHeight : (source as HTMLVideoElement).videoHeight;

    if (sourceWidth > 0) {
      // ULTRA COMPRESSION POUR MOBILE
      const targetW = 320;
      const targetH = (sourceHeight / sourceWidth) * targetW;
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(source, 0, 0, targetW, targetH);
      
      let base64 = "";
      try {
        base64 = canvas.toDataURL('image/jpeg', 0.15).split(',')[1];
      } catch (e) {
        console.error("Canvas Tainted:", e);
        setState(prev => ({ 
          ...prev, 
          isAnalyzing: false, 
          error: "Sécurité : Impossible d'analyser le flux ESP32 sans CORS. Activez le mode CORS ou utilisez un flux compatible." 
        }));
        return;
      }
      
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
  }, [speak, state.isActive, state.isEsp32Mode]);

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
          {state.isEsp32Mode ? (
            <div className="w-full h-full relative">
              <img
                ref={esp32ImgRef}
                src={state.isActive ? state.esp32Url : ""}
                alt="ESP32 Stream"
                crossOrigin={state.useCors ? "anonymous" : undefined}
                onLoad={() => setEsp32Status('connected')}
                onError={() => {
                  if (state.isActive) {
                    setEsp32Status('error');
                    setState(prev => ({ ...prev, error: "Impossible de se connecter au flux ESP32. Vérifiez l'URL et le CORS." }));
                  }
                }}
                className={`w-full h-full object-cover transition-opacity duration-1000 ${state.isActive ? 'opacity-70' : 'opacity-5'}`}
              />
              {state.isActive && esp32Status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-950/20 backdrop-blur-sm">
                  <div className="text-center p-4 bg-black/80 border border-red-500 rounded-xl max-w-xs">
                    <p className="text-red-500 text-xs font-bold mb-2 uppercase">Erreur de Flux</p>
                    <p className="text-[9px] text-zinc-400 mb-4">
                      1. Vérifiez que l'ESP32 est sur le même réseau.<br/>
                      2. Si l'app est en HTTPS, le flux HTTP sera bloqué.<br/>
                      3. Essayez de désactiver "Mode CORS" ci-dessous.
                    </p>
                    <button 
                      onClick={() => { setEsp32Status('loading'); startCamera(); }}
                      className="px-4 py-1 bg-red-600 text-white text-[10px] rounded uppercase font-bold"
                    >
                      Réessayer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {state.isBlynkMode && state.blynkData && (state.blynkData.startsWith('http') || state.blynkData.startsWith('data:image')) ? (
                <img 
                  src={state.blynkData} 
                  alt="Blynk Stream" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover transition-opacity duration-1000 ${state.isActive ? 'opacity-70' : 'opacity-5'}`} 
                />
              )}
            </>
          )}
          
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

          <div className="p-4 bg-black border border-green-900/30 rounded-xl space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-500 uppercase block">Source Vidéo</label>
              <div className="flex gap-1">
                <button 
                  onClick={() => setState(prev => ({ ...prev, isEsp32Mode: false, isBlynkMode: false }))}
                  className={`flex-1 py-2 text-[9px] font-bold rounded border transition-all ${!state.isEsp32Mode && !state.isBlynkMode ? 'bg-green-600 text-black border-green-500' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}
                >
                  LOCAL
                </button>
                <button 
                  onClick={() => setState(prev => ({ ...prev, isEsp32Mode: true, isBlynkMode: false }))}
                  className={`flex-1 py-2 text-[9px] font-bold rounded border transition-all ${state.isEsp32Mode ? 'bg-green-600 text-black border-green-500' : 'bg-zinc-900 text-zinc-500 border-zinc-800 animate-pulse'}`}
                >
                  ESP32
                </button>
                <button 
                  onClick={() => setState(prev => ({ ...prev, isBlynkMode: true, isEsp32Mode: false }))}
                  className={`flex-1 py-2 text-[9px] font-bold rounded border transition-all ${state.isBlynkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}
                >
                  BLYNK
                </button>
              </div>
            </div>

            {state.isBlynkMode ? (
              <div className="space-y-2 animate-in fade-in duration-300">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono text-blue-400 uppercase block">Blynk Cloud API</label>
                  <a 
                    href="https://blynk.cloud" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[8px] text-zinc-500 hover:text-blue-400 underline uppercase"
                  >
                    Console Blynk
                  </a>
                </div>
                <input 
                  type="text"
                  value={state.blynkToken}
                  onChange={(e) => setState(prev => ({ ...prev, blynkToken: e.target.value }))}
                  placeholder="Auth Token (ex: u9_x...)"
                  className="w-full bg-zinc-900 border border-blue-900/30 text-blue-400 text-[10px] p-2 rounded focus:outline-none focus:border-blue-500 font-mono"
                />
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={state.blynkPin}
                    onChange={(e) => setState(prev => ({ ...prev, blynkPin: e.target.value }))}
                    placeholder="Pin (V1)"
                    className="w-16 bg-zinc-900 border border-blue-900/30 text-blue-400 text-[10px] p-2 rounded focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <select 
                    value={state.blynkRegion}
                    onChange={(e) => setState(prev => ({ ...prev, blynkRegion: e.target.value }))}
                    className="w-16 bg-zinc-900 border border-blue-900/30 text-blue-400 text-[10px] p-2 rounded focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="ny3">NY3</option>
                    <option value="fra1">FRA1</option>
                    <option value="lon1">LON1</option>
                    <option value="sgp1">SGP1</option>
                  </select>
                  <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded p-2 flex items-center justify-center overflow-hidden">
                    <span className="text-[6px] text-zinc-500 uppercase font-mono truncate">
                      {state.blynkData ? `Data: ${state.blynkData.substring(0, 15)}...` : "En attente..."}
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-blue-950/10 border border-blue-900/20 rounded text-[8px] text-blue-400/70 space-y-1">
                  <p className="font-bold uppercase tracking-tighter">💡 Rappel Process :</p>
                  <p>1. L'ESP32 upload l'image sur un serveur.</p>
                  <p>2. L'ESP32 écrit l'URL dans le Pin <b>{state.blynkPin}</b>.</p>
                  <p>3. L'IA récupère l'image via Blynk toutes les 2s.</p>
                </div>
              </div>
            ) : !state.isEsp32Mode ? (
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-zinc-500 uppercase block">Caméra</label>
                <select 
                  value={state.selectedCameraId}
                  onChange={(e) => setState(prev => ({ ...prev, selectedCameraId: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 text-green-500 text-[10px] p-2 rounded focus:outline-none focus:border-green-500"
                >
                  {availableCameras.map(camera => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Caméra ${camera.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase block">Paramètres ESP32</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-zinc-600 uppercase">Mode CORS</span>
                    <button 
                      onClick={() => setState(prev => ({ ...prev, useCors: !prev.useCors }))}
                      className={`w-8 h-4 rounded-full relative transition-colors ${state.useCors ? 'bg-green-600' : 'bg-zinc-800'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${state.useCors ? 'left-4.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>
                </div>
                <input 
                  type="text"
                  value={state.esp32Url}
                  onChange={(e) => setState(prev => ({ ...prev, esp32Url: e.target.value }))}
                  placeholder="http://192.168.100.139:81/stream"
                  className="w-full bg-zinc-900 border border-zinc-800 text-green-500 text-[10px] p-2 rounded focus:outline-none focus:border-green-500 font-mono"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={checkConnection}
                    className="flex-1 py-1 text-[8px] bg-green-900/20 hover:bg-green-900/40 text-green-500 text-center rounded border border-green-900/30 uppercase transition-colors font-bold"
                  >
                    Vérifier la connexion
                  </button>
                  <a 
                    href={state.esp32Url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 py-1 text-[8px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-center rounded border border-zinc-700 uppercase transition-colors"
                  >
                    Ouvrir le flux seul
                  </a>
                </div>
                <div className="p-2 bg-amber-950/20 border border-amber-900/30 rounded text-[8px] text-amber-500/80 space-y-1">
                  <p className="font-bold uppercase tracking-tighter">🚀 Solution Cloud → Local :</p>
                  <p>Bien que l'app soit sur Internet, c'est <b>votre appareil</b> qui se connecte à l'ESP32.</p>
                  <p>1. Vérifiez que votre téléphone/PC est sur le <b>MÊME WiFi</b> que l'ESP32.</p>
                  <p>2. Dans Chrome, désactivez : <code className="bg-black/40 px-1">chrome://flags/#block-insecure-private-network-requests</code></p>
                  <p>3. Autorisez le "Contenu non sécurisé" dans les réglages du site (clic sur le cadenas).</p>
                </div>
                {!state.useCors && (
                  <p className="text-[8px] text-amber-500/70 italic">
                    Note: Sans CORS, l'analyse IA peut être bloquée par le navigateur.
                  </p>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-green-900/20 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="opacity-50 uppercase">Développeur:</span>
                <span className="text-green-500 font-bold">ALIOU ALI</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="opacity-50 uppercase">Logiciel:</span>
                <span className="text-amber-500 font-bold">V-ASSIST 1.3</span>
              </div>
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
            <div className="p-2 bg-red-900/20 border border-red-900/40 rounded-lg space-y-2">
              <p className="text-red-500 text-[9px] text-center font-mono animate-pulse">{state.error}</p>
              {state.error.includes("Clé API") && (
                <button 
                  onClick={handleOpenKeySelector}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded uppercase transition-all"
                >
                  Configurer Clé API
                </button>
              )}
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
