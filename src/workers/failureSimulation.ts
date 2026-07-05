export type FailureMode = 'off' | 'fail20' | 'fail50' | 'alwaysFail' | 'timeout' | 'slow';

export interface FailureSimulationConfig {
  mode: FailureMode;
  slowMs: number;
  timeoutMs: number;
}

export class FailureSimulationService {
  private config: FailureSimulationConfig = { mode: 'off', slowMs: 1500, timeoutMs: 5000 };

  get() {
    return this.config;
  }

  set(config: Partial<FailureSimulationConfig>) {
    this.config = { ...this.config, ...config };
    return this.config;
  }

  shouldFail(): boolean {
    if (this.config.mode === 'alwaysFail') return true;
    if (this.config.mode === 'fail20') return Math.random() < 0.2;
    if (this.config.mode === 'fail50') return Math.random() < 0.5;
    return false;
  }
}

export const failureSimulation = new FailureSimulationService();
