
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
}
