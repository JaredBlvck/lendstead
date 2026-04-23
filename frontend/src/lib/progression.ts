// Civilization progression stages. Derived from population + infrastructure
// so it works whether or not the backend tracks it explicitly.

export type Stage = 'Camp' | 'Village' | 'Settlement' | 'City';

export interface StageInfo {
  stage: Stage;
  next: Stage | null;
  threshold: number; // population needed for next stage
  progress: number;  // 0..1 toward next stage
  accent: string;    // CSS color
}

const STAGES: Array<{ name: Stage; min: number; accent: string }> = [
  { name: 'Camp', min: 0, accent: '#fbbf24' },
  { name: 'Village', min: 10, accent: '#5eead4' },
  { name: 'Settlement', min: 25, accent: '#818cf8' },
  { name: 'City', min: 60, accent: '#f472b6' },
];

export function deriveStage(population: number): StageInfo {
  let current = STAGES[0];
  let nextIdx = 1;
  for (let i = 0; i < STAGES.length; i++) {
    if (population >= STAGES[i].min) {
      current = STAGES[i];
      nextIdx = i + 1;
    }
  }
  const next = STAGES[nextIdx];
  if (!next) {
    return {
      stage: current.name,
      next: null,
      threshold: current.min,
      progress: 1,
      accent: current.accent,
    };
  }
  const span = next.min - current.min;
  const progress = Math.min(1, (population - current.min) / span);
  return {
    stage: current.name,
    next: next.name,
    threshold: next.min,
    progress,
    accent: current.accent,
  };
}
