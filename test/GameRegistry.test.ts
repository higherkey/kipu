import { describe, it, expect } from 'vitest';
import { GameRegistry } from '../src/core/GameRegistry';

describe('GameRegistry', () => {
  it('should maintain a singleton instance', () => {
    const registry1 = GameRegistry.getInstance();
    const registry2 = GameRegistry.getInstance();
    expect(registry1).toBe(registry2);
  });

  it('should have all games registered correctly', () => {
    const registry = GameRegistry.getInstance();
    const allGames = registry.getAll();

    expect(allGames.length).toBe(25);
  });

  it('should retrieve registered games by ID', () => {
    const registry = GameRegistry.getInstance();
    const balloonPop = registry.get('balloonPop');

    expect(balloonPop).toBeDefined();
    expect(balloonPop?.name).toBe('Tapa');
    expect(balloonPop?.portal).toBe('workshop');

    const soundMemory = registry.get('soundMemory');
    expect(soundMemory).toBeDefined();
    expect(soundMemory?.name).toBe('Yuyay');
    expect(soundMemory?.subtitle).toBe('Sound Memory');
    expect(soundMemory?.portal).toBe('workshop');

    const pawana = registry.get('pawana');
    expect(pawana).toBeDefined();
    expect(pawana?.name).toBe('Pawana');
    expect(pawana?.portal).toBe('lab');
    expect(pawana?.category).toBe('brain');
  });

  it('should return undefined for unregistered game IDs', () => {
    const registry = GameRegistry.getInstance();
    expect(registry.get('nonExistentGame')).toBeUndefined();
  });
});
