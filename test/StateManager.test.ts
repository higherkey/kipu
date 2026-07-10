import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../src/core/StateManager';

describe('StateManager', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset singleton instance for testing
    (StateManager as any).instance = undefined;
  });

  it('should be a singleton', () => {
    const instance1 = StateManager.getInstance();
    const instance2 = StateManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should set and get values', () => {
    const manager = StateManager.getInstance();
    manager.set('testKey', 'testValue');
    expect(manager.get('testKey')).toBe('testValue');
  });

  it('should persist values to localStorage', () => {
    const manager = StateManager.getInstance();
    manager.set('testKey', 'persistedValue');
    
    expect(localStorage.getItem('kidsGamesState')).toContain('persistedValue');
  });

  it('should load initial state from localStorage', () => {
    localStorage.setItem('kidsGamesState', JSON.stringify({ existingKey: 'existingValue' }));
    
    const manager = StateManager.getInstance();
    expect(manager.get('existingKey')).toBe('existingValue');
  });
});
