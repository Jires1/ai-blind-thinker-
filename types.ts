
export interface AnalysisResult {
  text: string;
  timestamp: number;
  status: 'danger' | 'safe' | 'idle';
}

export interface AppState {
  isActive: boolean;
  isAnalyzing: boolean;
  lastResult: AnalysisResult | null;
  error: string | null;
  selectedCameraId: string;
  esp32Url: string;
  isEsp32Mode: boolean;
  useCors: boolean;
  blynkToken: string;
  blynkPin: string;
  isBlynkMode: boolean;
  blynkData: string | null;
  blynkRegion: string;
}
