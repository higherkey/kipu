export class StateManager {
  private static instance: StateManager;
  private state: Record<string, any> = {};

  private constructor() {
    this.loadState();
  }

  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  private loadState() {
    const saved = localStorage.getItem('kidsGamesState');
    if (saved) {
      try {
        this.state = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved state.', e);
        this.state = {};
      }
    }
  }

  private saveState() {
    localStorage.setItem('kidsGamesState', JSON.stringify(this.state));
  }

  public set(key: string, value: any) {
    this.state[key] = value;
    this.saveState();
  }

  public get(key: string, defaultValue: any = null) {
    return this.state[key] !== undefined ? this.state[key] : defaultValue;
  }
}
