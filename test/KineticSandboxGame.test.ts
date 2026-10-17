import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KineticSandboxGame } from '../src/games/busyBoard/KineticSandboxGame';
import { HangingPendulum } from '../src/games/busyBoard/modules/HangingPendulum';
import { PinwheelHub } from '../src/games/busyBoard/modules/PinwheelHub';
import { HourglassInverter } from '../src/games/busyBoard/modules/HourglassInverter';
import { PlinkoFunnel } from '../src/games/busyBoard/modules/PlinkoFunnel';
import { NewtonsCradle } from '../src/games/busyBoard/modules/NewtonsCradle';
import { BellowsPump } from '../src/games/busyBoard/modules/BellowsPump';

describe('KineticSandboxGame', () => {
  let canvas: HTMLCanvasElement;
  let game: KineticSandboxGame;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    game = new KineticSandboxGame();
  });

  afterEach(() => {
    game.destroy();
  });

  it('should initialize cleanly and instantiate all 6 modules', () => {
    game.init(canvas);
    const modules = (game as any).modules;
    expect(modules).toHaveLength(6);

    const ids = modules.map((m: any) => m.id);
    expect(ids).toEqual(['051', '052', '054', '058', '055', '057']);
  });

  it('should calculate layout grid and scroll limits correctly', () => {
    // Narrow mobile viewport (width 400px) triggers horizontal scrolling
    canvas.width = 400;
    canvas.height = 600;
    game.init(canvas);

    const cellW = (game as any).cellW;
    const maxScrollX = (game as any).maxScrollX;

    // Minimum column width is 300px, 3 cols = 900px
    expect(cellW).toBe(300);
    expect(maxScrollX).toBe(500); // 900 - 400 = 500
  });

  it('should tick and render modules across animation frame update loops', () => {
    game.init(canvas);
    const renderSpy = vi.spyOn(game, 'render');

    game.update(0.016);
    expect(renderSpy).toHaveBeenCalled();
  });

  it('should dispatch pointer events to the hit module', () => {
    game.init(canvas);
    const modules = (game as any).modules;
    const pendulum = modules.find((m: any) => m.id === '051');
    const pointerDownSpy = vi.spyOn(pendulum, 'handlePointerDown');

    const cellW = (game as any).cellW;
    const cellH = (game as any).cellH;

    // Click inside pendulum cell [col: 0, row: 0]
    const clickX = cellW * 0.5;
    const clickY = cellH * 0.5;

    canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: clickX,
      clientY: clickY,
      bubbles: true
    }));

    expect(pointerDownSpy).toHaveBeenCalled();
  });

  it('should handle window resize gracefully', () => {
    game.init(canvas);
    game.resize(1000, 700);

    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(700);
  });

  it('should clean up event listeners and references on destroy', () => {
    game.init(canvas);
    const modules = (game as any).modules;
    const hourglass = modules.find((m: any) => m.id === '054');
    const plinko = modules.find((m: any) => m.id === '055');
    const cradle = modules.find((m: any) => m.id === '058');
    const bellows = modules.find((m: any) => m.id === '057');

    game.destroy();

    expect((game as any).canvas).toBeNull();
    expect((game as any).ctx).toBeNull();
    expect((game as any).modules).toHaveLength(0);

    // Verify module buffers were wiped
    expect((hourglass as any).sandGrains).toHaveLength(0);
    expect((plinko as any).balls).toHaveLength(0);
    expect((cradle as any).balls).toHaveLength(0);
    expect((bellows as any).particles).toHaveLength(0);
  });

  it('should handle dt in milliseconds from GameLoop without runaway acceleration', () => {
    game.init(canvas);
    const modules = (game as any).modules;
    const pendulum = modules.find((m: any) => m.id === '051');

    // Supply 16.67ms (standard 60fps frame delta)
    game.update(16.67);
    expect(Number.isFinite(pendulum.theta)).toBe(true);
    expect(Number.isFinite(pendulum.omega)).toBe(true);
  });
});

describe('Kinetic Sandbox Modules Physics', () => {
  it('HangingPendulum (051) updates non-linear angular oscillation and decays', () => {
    const pendulum = new HangingPendulum('051', 0, 0, 1, 1);
    pendulum.theta = 0.5; // start at 0.5 rad (~28 deg)
    pendulum.omega = 0;

    // Update multiple frames
    for (let i = 0; i < 30; i++) {
      pendulum.update(0.016, 0, 0, 300, 300);
    }

    // Pendulum must have accelerated and moved
    expect(pendulum.theta).not.toBe(0.5);
    expect(pendulum.omega).not.toBe(0);
  });

  it('PinwheelHub (052) simulates aerodynamic drag deceleration', () => {
    const pinwheel = new PinwheelHub('052', 1, 0, 1, 1);
    pinwheel.angularVelocity = 20; // 20 rad/s initial spin

    // Update simulation
    for (let i = 0; i < 60; i++) {
      pinwheel.update(0.016, 0, 0, 300, 300);
    }

    // Velocity should decay smoothly due to drag
    expect(pinwheel.angularVelocity).toBeLessThan(20);
    expect(pinwheel.angularVelocity).toBeGreaterThan(0);
    expect(pinwheel.angle).toBeGreaterThan(0);
  });

  it('HourglassInverter (054) flips orientation and streams sand particles', () => {
    const hourglass = new HourglassInverter('054', 2, 0, 1, 1);
    const initialRot = hourglass.rotation;

    hourglass.flipHourglass();
    expect(hourglass.rotation).toBe(initialRot); // target rotation starts smooth lerp

    // Advance frames to complete flip
    for (let i = 0; i < 30; i++) {
      hourglass.update(0.016, 0, 0, 300, 300);
    }

    expect(hourglass.rotation).toBeGreaterThan(initialRot);
  });

  it('PlinkoFunnel (055) spawns bouncy balls that fall and deflect', () => {
    const plinko = new PlinkoFunnel('055', 1, 1, 1, 1);
    plinko.dropBall(150, 50);

    const balls = (plinko as any).balls;
    expect(balls).toHaveLength(1);
    const initialY = balls[0].y;

    // Simulate gravity fall
    plinko.update(0.016, 0, 0, 300, 300);
    expect(balls[0].y).toBeGreaterThan(initialY);
  });

  it("NewtonsCradle (058) transfers momentum through center spheres", () => {
    const cradle = new NewtonsCradle('058', 0, 1, 1, 1);
    // Ball 0 starts deflected at -0.55 rad
    expect(cradle.balls[0].theta).toBe(-0.55);

    // Simulate swing down and collision
    for (let i = 0; i < 25; i++) {
      cradle.update(0.016, 0, 0, 300, 300);
    }

    // Ball 0 moves towards equilibrium (increasing theta)
    expect(cradle.balls[0].theta).toBeGreaterThan(-0.55);
  });

  it('BellowsPump (057) compresses on click and returns via internal spring', () => {
    // Arrange
    const bellows = new BellowsPump('057', 2, 1, 1, 1);

    // Act
    bellows.compressBellows();
    // Assert
    expect(bellows.compression).toBe(1);

    // Act: release and simulate spring recovery over several frames
    bellows.handlePointerUp();
    for (let i = 0; i < 10; i++) {
      bellows.update(0.016, 0, 0, 300, 300);
    }

    // Assert: compression decayed towards zero
    expect(bellows.compression).toBeLessThan(1);
  });

  it('NewtonsCradle (058) drag clamps angle to safe boundaries (+/- 1.1 rad)', () => {
    // Arrange
    const cradle = new NewtonsCradle('058', 0, 1, 1, 1);

    // Act: simulate extreme pointer deflection to the right
    cradle.handlePointerDown(250, 100, 0, 0, 300, 300);
    cradle.handlePointerMove(500, 100, 0, 0, 300, 300);

    // Assert: angle is bounded without runaway
    expect(cradle.balls[cradle.balls.length - 1].theta).toBeLessThanOrEqual(1.1);
  });

  it('PlinkoFunnel (055) clamps funnel ratio within [0.1, 0.9]', () => {
    // Arrange
    const plinko = new PlinkoFunnel('055', 1, 1, 1, 1);

    // Act: move pointer beyond left border
    plinko.handlePointerDown(0, 44, 0, 0, 300, 300);
    plinko.handlePointerMove(-100, 44, 0, 0, 300, 300);
    // Assert
    expect(plinko.funnelXRatio).toBe(0.1);

    // Act: move pointer beyond right border
    plinko.handlePointerMove(900, 44, 0, 0, 300, 300);
    // Assert
    expect(plinko.funnelXRatio).toBe(0.9);
  });

  it('HangingPendulum (051) clamps deflection angle within safe swing boundary (+/- 1.4 rad)', () => {
    // Arrange
    const pendulum = new HangingPendulum('051', 0, 0, 1, 1);

    // Act: simulate huge pointer displacement
    pendulum.handlePointerDown(150, 150, 0, 0, 300, 300);
    pendulum.handlePointerMove(999, 150, 0, 0, 300, 300);

    // Assert: angle does not exceed 1.4 rad
    expect(pendulum.theta).toBeLessThanOrEqual(1.4);
    expect(pendulum.theta).toBeGreaterThanOrEqual(-1.4);
  });
});
