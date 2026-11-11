import { BaseGame } from '../../core/BaseGame';
import { PawanaCurriculum, type PawanaMode, type PawanaDifficulty, type GateQuestion } from './PawanaCurriculum';
import './PawanaGame.css';

export interface PawanaFlyer {
  id: string;
  name: string;
  badge: string;
  unlocked: boolean;
  color: string;
  accentColor: string;
  wingSpeed: number;
}

interface SplitGate {
  x: number;
  width: number;
  question: GateQuestion;
  topGapY: number;
  bottomGapY: number;
  gapHeight: number;
  passed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export type WindState = 'idle' | 'warning' | 'active';

export interface WindGust {
  state: WindState;
  direction: 'up' | 'down';
  timer: number; // Duration countdown in ms
  warningDuration: number; // Lead time in ms (e.g. 1800ms)
  activeDuration: number; // Active gust time in ms (e.g. 2400ms)
  force: number; // Vertical acceleration in px/frame^2
}

const STORAGE_UNLOCKED_KEY = 'kipu_pawana_unlocked_v1';
const STORAGE_HIGHSCORE_KEY = 'kipu_pawana_highscores_v1';

export class PawanaGame extends BaseGame {
  private overlayContainer: HTMLDivElement | null = null;
  private state: 'menu' | 'playing' | 'paused' | 'gameover' | 'victory' = 'menu';

  // Game Settings
  private currentMode: PawanaMode = 'numbers';
  private currentDifficulty: PawanaDifficulty = 'normal';
  private activeFlyerId = 'qinti';

  // Available Characters
  private flyers: PawanaFlyer[] = [
    { id: 'qinti', name: "Q'inti", badge: 'Hummingbird', unlocked: true, color: '#10B981', accentColor: '#F59E0B', wingSpeed: 1.5 },
    { id: 'pisqu', name: 'Pisqu', badge: 'Mountain Bird', unlocked: false, color: '#3B82F6', accentColor: '#FBBF24', wingSpeed: 1.0 },
    { id: 'kuntur', name: 'Kuntur', badge: 'Baby Condor', unlocked: false, color: '#4B5563', accentColor: '#D97706', wingSpeed: 0.8 },
    { id: 'wayra', name: 'Wayra', badge: 'Clockwork Glider', unlocked: false, color: '#B45309', accentColor: '#FCD34D', wingSpeed: 1.2 },
  ];

  // Flight Physics
  private flyerY = 300;
  private flyerVy = 0;
  private flyerRadius = 22;
  private flapImpulse = -6.2;
  private gravity = 0.32;
  private maxFallSpeed = 8.5;
  private wingAngle = 0;

  // Collision & Health
  private hearts = 3;
  private maxHearts = 3;
  private invulnerableTimer = 0;
  private isWobbling = false;

  // Obstacles & Spawning
  private gates: SplitGate[] = [];
  private gateScrollSpeed = 2.4;
  private nextGateDistance = 380;
  private currentQuestionIndex = 0;
  private score = 0;
  private highScore = 0;
  private hasWonRound = false;
  private particles: Particle[] = [];

  // Parallax Background & Sky Cycle
  private bgCloudOffset = 0;
  private bgMountainOffset = 0;
  private skyCycleProgress = 0; // 0 (morning) -> 0.33 (midday) -> 0.66 (sunset) -> 1.0 (night)

  // Andean Wind Gust Hazards (Wayra draft mechanics)
  private windGust: WindGust = {
    state: 'idle',
    direction: 'up',
    timer: 5000,
    warningDuration: 1800,
    activeDuration: 2400,
    force: 0
  };

  // Event Listeners references for deterministic teardown
  private onKeyDownBound: ((e: KeyboardEvent) => void) | null = null;
  private onPointerDownBound: ((e: PointerEvent) => void) | null = null;
  private prefersReducedMotion = false;

  constructor() {
    super();
    this.audio.registerSound('pop', '/sounds/pop.ogg');
  }

  protected onInit(): void {
    if (!this.canvas) return;

    this.loadPersistence();
    this.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    // Setup input listeners
    this.onKeyDownBound = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.onPointerDownBound = (e: PointerEvent) => this.handlePointerDown(e);

    window.addEventListener('keydown', this.onKeyDownBound);
    this.canvas.addEventListener('pointerdown', this.onPointerDownBound);

    this.mountOverlay();
    this.resetToMenu();
  }

  private loadPersistence(): void {
    try {
      const stored = localStorage.getItem(STORAGE_UNLOCKED_KEY);
      if (stored) {
        const unlockedIds: string[] = JSON.parse(stored);
        this.flyers.forEach(f => {
          if (unlockedIds.includes(f.id)) f.unlocked = true;
        });
      }
      const storedHigh = localStorage.getItem(STORAGE_HIGHSCORE_KEY);
      if (storedHigh) {
        this.highScore = parseInt(storedHigh, 10) || 0;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  private savePersistence(): void {
    try {
      const unlockedIds = this.flyers.filter(f => f.unlocked).map(f => f.id);
      localStorage.setItem(STORAGE_UNLOCKED_KEY, JSON.stringify(unlockedIds));
    } catch (e) {
      // Ignore
    }
  }

  private mountOverlay(): void {
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.className = 'pawana-overlay-container';
    this.canvas?.parentElement?.appendChild(this.overlayContainer);
  }

  private resetToMenu(): void {
    this.state = 'menu';
    this.flyerY = (this.canvas?.height ?? 600) / 2;
    this.flyerVy = 0;
    this.renderMenuOverlay();
  }

  private startFlight(): void {
    this.state = 'playing';
    this.score = 0;
    this.hasWonRound = false;
    this.currentQuestionIndex = 0;
    this.gates = [];
    this.particles = [];
    this.invulnerableTimer = 0;
    this.skyCycleProgress = 0;
    this.windGust = {
      state: 'idle',
      direction: 'up',
      timer: 5000 + Math.random() * 4000,
      warningDuration: 2000,
      activeDuration: 2500,
      force: 0
    };

    // Apply difficulty parameters
    if (this.currentDifficulty === 'easy') {
      this.maxHearts = 5;
      this.hearts = 5;
      this.gravity = 0.28;
      this.gateScrollSpeed = 2.0;
      this.flapImpulse = -5.8;
    } else if (this.currentDifficulty === 'normal') {
      this.maxHearts = 3;
      this.hearts = 3;
      this.gravity = 0.32;
      this.gateScrollSpeed = 2.4;
      this.flapImpulse = -6.2;
    } else {
      this.maxHearts = 2;
      this.hearts = 2;
      this.gravity = 0.36;
      this.gateScrollSpeed = 2.9;
      this.flapImpulse = -6.5;
    }

    const h = this.canvas?.height ?? 600;
    this.flyerY = h / 2;
    this.flyerVy = 0;

    // Spawn first gate
    this.spawnGate((this.canvas?.width ?? 800) + 100);

    this.renderFlightHUD();
    this.audio.play('pop');
    this.haptics.lightTap();
  }

  private spawnGate(x: number): void {
    if (!this.canvas) return;
    const h = this.canvas.height;
    const groundH = 26;
    const availableH = h - groundH - 50;
    const baseGapHeight = this.currentDifficulty === 'easy' ? 135 : this.currentDifficulty === 'normal' ? 120 : 105;
    const gapHeight = Math.min(baseGapHeight, Math.max(75, availableH * 0.36));
    const minMiddlePillar = Math.max(24, availableH * 0.12);
    const maxBottomEnd = h - groundH - 15;

    // Safe top gap: starts at minimum 30, ends before (h * 0.44)
    const maxTopY = Math.max(30, (h * 0.44) - gapHeight);
    const topGapY = 30 + Math.random() * Math.max(10, maxTopY - 30);

    // Safe bottom gap: starts after topGapY + gapHeight + minMiddlePillar, ends before ground
    const minBottomY = topGapY + gapHeight + minMiddlePillar;
    const maxBottomY = maxBottomEnd - gapHeight;
    const bottomGapY = minBottomY + Math.random() * Math.max(10, maxBottomY - minBottomY);

    const question = PawanaCurriculum.generateQuestion(
      this.currentMode,
      this.currentDifficulty,
      this.currentQuestionIndex,
      Math.random()
    );

    this.gates.push({
      x,
      width: 75,
      question,
      topGapY,
      bottomGapY,
      gapHeight,
      passed: false
    });

    this.currentQuestionIndex++;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (this.state === 'playing') {
        e.preventDefault();
        this.flap();
      } else if (this.state === 'menu') {
        const targetEl = e.target as HTMLElement | null;
        if (targetEl?.tagName !== 'BUTTON') {
          e.preventDefault();
          this.startFlight();
        }
      }
    } else if (e.code === 'Escape') {
      if (this.state === 'playing') {
        this.pause();
      } else if (this.state === 'paused') {
        this.resume();
      }
    }
  }

  private handlePointerDown(_e: PointerEvent): void {
    if (this.state === 'playing') {
      this.flap();
    }
  }

  private flap(): void {
    this.flyerVy = this.flapImpulse;
    this.wingAngle = -0.8;
    this.haptics.lightTap();

    // Spawn subtle puff particles behind
    const flyer = this.getActiveFlyer();
    this.addParticleBurst(80, this.flyerY + 5, flyer.accentColor, 3);
  }

  public update(dt: number): void {
    // Clamp delta-time to avoid tunneling
    const clampedDt = Math.min(dt, 100) / 16.666;
    const rawDtMs = Math.min(dt, 100);

    if (this.state === 'playing') {
      this.updateSkyCycle(rawDtMs);
      this.updateWindGust(rawDtMs);
      this.updatePhysics(clampedDt);
      this.updateGates(clampedDt);
      this.updateParticles(clampedDt);
    }

    this.render();
  }

  private updateSkyCycle(dtMs: number): void {
    // Smoothly progress day/night cycle based on score + subtle time progression
    // Target advances with score (0 -> score 5 -> score 10 -> score 15+)
    const targetCycle = Math.min(1.0, this.score / 15);
    // Smooth interpolation towards targetCycle (or looping continuously)
    const step = (dtMs / 3000);
    if (this.skyCycleProgress < targetCycle) {
      this.skyCycleProgress = Math.min(targetCycle, this.skyCycleProgress + step * 0.1);
    } else {
      this.skyCycleProgress = targetCycle;
    }
  }

  private updateWindGust(dtMs: number): void {
    this.windGust.timer -= dtMs;

    if (this.windGust.state === 'idle') {
      if (this.windGust.timer <= 0) {
        // Transition to warning state: 2 seconds visual lead time before gust hits
        this.windGust.state = 'warning';
        this.windGust.direction = Math.random() > 0.5 ? 'up' : 'down';
        this.windGust.warningDuration = 2000;
        this.windGust.timer = this.windGust.warningDuration;
        this.updateWindHUD();
      }
    } else if (this.windGust.state === 'warning') {
      if (this.windGust.timer <= 0) {
        // Transition to active gust state
        this.windGust.state = 'active';
        this.windGust.activeDuration = 2200 + Math.random() * 800; // 2.2s - 3.0s
        this.windGust.timer = this.windGust.activeDuration;
        // Moderate gentle draft force
        this.windGust.force = this.windGust.direction === 'up' ? -0.16 : 0.14;
        this.updateWindHUD();
        this.haptics.lightTap();
      }
    } else if (this.windGust.state === 'active') {
      // Spawn wind stream particles
      if (!this.prefersReducedMotion && Math.random() < 0.4) {
        const w = this.canvas?.width ?? 800;
        const h = this.canvas?.height ?? 600;
        const startY = this.windGust.direction === 'up' ? h - 30 : 30;
        const vy = this.windGust.direction === 'up' ? -3 - Math.random() * 2 : 3 + Math.random() * 2;
        this.particles.push({
          x: Math.random() * w,
          y: startY,
          vx: -(this.gateScrollSpeed * 1.5) + (Math.random() - 0.5),
          vy,
          color: 'rgba(255, 255, 255, 0.65)',
          size: 2 + Math.random() * 3,
          life: 0,
          maxLife: 600
        });
      }

      if (this.windGust.timer <= 0) {
        // Return to idle
        this.windGust.state = 'idle';
        this.windGust.force = 0;
        this.windGust.timer = 5000 + Math.random() * 6000; // Next gust in 5-11 seconds
        this.updateWindHUD();
      }
    }
  }

  private updatePhysics(dtScale: number): void {
    const h = this.canvas?.height ?? 600;

    // Gravity & Velocity (including wind gust drafts)
    this.flyerVy += (this.gravity + (this.windGust.state === 'active' ? this.windGust.force : 0)) * dtScale;
    if (this.flyerVy > this.maxFallSpeed) this.flyerVy = this.maxFallSpeed;
    this.flyerY += this.flyerVy * dtScale;

    // Floor and ceiling collisions
    const groundY = h - 25;
    if (this.flyerY > groundY - this.flyerRadius) {
      this.flyerY = groundY - this.flyerRadius;
      this.flyerVy = -3.5;
      this.takeHit('Bounced off ground!');
    } else if (this.flyerY < this.flyerRadius + 10) {
      this.flyerY = this.flyerRadius + 10;
      this.flyerVy = 1.0;
    }

    // Wing flap oscillation
    const flyer = this.getActiveFlyer();
    this.wingAngle += 0.12 * flyer.wingSpeed * dtScale;

    // Invulnerability timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= 16.66 * dtScale;
      if (this.invulnerableTimer <= 0) {
        this.invulnerableTimer = 0;
        this.isWobbling = false;
      }
    }

    // Parallax background scroll
    if (!this.prefersReducedMotion) {
      this.bgCloudOffset = (this.bgCloudOffset + 0.3 * dtScale) % 800;
      this.bgMountainOffset = (this.bgMountainOffset + 0.7 * dtScale) % 800;
    }
  }

  private updateGates(dtScale: number): void {
    const flyerX = 100;
    const flyerR = this.flyerRadius * 0.75; // Forgiving hitbox

    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.x -= this.gateScrollSpeed * dtScale;

      // Check passage & collision
      const gateLeft = g.x;
      const gateRight = g.x + g.width;

      if (!g.passed && gateRight < flyerX - flyerR) {
        g.passed = true;
        this.updateFlightHUDPrompt();
      }

      // Check collision while flyer is within gate column
      if (flyerX + flyerR > gateLeft && flyerX - flyerR < gateRight) {
        // Gate has 2 openings: Top Gap and Bottom Gap
        const inTopGap = this.flyerY > g.topGapY && this.flyerY < g.topGapY + g.gapHeight;
        const inBottomGap = this.flyerY > g.bottomGapY && this.flyerY < g.bottomGapY + g.gapHeight;

        if (inTopGap && !g.passed) {
          this.evaluateOptionChoice(g, g.question.topOption);
          g.passed = true;
        } else if (inBottomGap && !g.passed) {
          this.evaluateOptionChoice(g, g.question.bottomOption);
          g.passed = true;
        } else if (!inTopGap && !inBottomGap && this.invulnerableTimer <= 0) {
          // Hit the pipe structure!
          this.takeHit('Bumped into column wall!');
        }
      }

      // Remove offscreen gates
      if (gateRight < -50) {
        this.gates.splice(i, 1);
      }
    }

    // Spawn new gate if needed
    const lastGate = this.gates[this.gates.length - 1];
    const w = this.canvas?.width ?? 800;
    if (!lastGate || lastGate.x < w - this.nextGateDistance) {
      this.spawnGate(w + 20);
    }
  }

  private evaluateOptionChoice(gate: SplitGate, option: { text: string; isCorrect: boolean; isEmpty?: boolean }): void {
    if (option.isCorrect) {
      this.score++;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        try {
          localStorage.setItem(STORAGE_HIGHSCORE_KEY, String(this.highScore));
        } catch {
          // Ignore
        }
      }
      this.audio.play('pop');
      this.haptics.lightTap();

      const flyer = this.getActiveFlyer();
      this.addParticleBurst(gate.x + gate.width / 2, this.flyerY, flyer.color, 12);
      this.updateFlightHUDPrompt();

      // Check progression unlocks
      this.checkUnlocks();

      // Check victory for bounded rounds (8 on easy, 10 on normal, 12 on hard)
      const targetScore = this.currentDifficulty === 'easy' ? 8 : this.currentDifficulty === 'normal' ? 10 : 12;
      if (this.score >= targetScore && !this.hasWonRound && this.state === 'playing') {
        this.hasWonRound = true;
        this.triggerVictory();
      }
    } else {
      this.takeHit(`Oops! "${option.text}" wasn't correct.`);
    }
  }

  private takeHit(reason: string): void {
    if (this.invulnerableTimer > 0) return;

    this.hearts--;
    this.invulnerableTimer = 1500; // 1500ms bounded invulnerability
    this.isWobbling = true;
    this.flyerVy = -4.0; // gentle bounce

    this.audio.play('pop');
    this.haptics.lightTap();
    this.addParticleBurst(100, this.flyerY, '#E53E3E', 8);
    this.renderFlightHUD();

    if (this.hearts <= 0) {
      this.triggerGameOver(reason);
    }
  }

  private checkUnlocks(): void {
    let newlyUnlocked = false;

    // Pisqu: Unlock after 5 score in numbers
    if (this.currentMode === 'numbers' && this.score >= 5) {
      const pisqu = this.flyers.find(f => f.id === 'pisqu');
      if (pisqu && !pisqu.unlocked) {
        pisqu.unlocked = true;
        newlyUnlocked = true;
      }
    }

    // Kuntur: Unlock after 5 score in spelling
    if (this.currentMode === 'spelling' && this.score >= 5) {
      const kuntur = this.flyers.find(f => f.id === 'kuntur');
      if (kuntur && !kuntur.unlocked) {
        kuntur.unlocked = true;
        newlyUnlocked = true;
      }
    }

    // Wayra: Unlock after 5 score in shapes
    if (this.currentMode === 'shapes' && this.score >= 5) {
      const wayra = this.flyers.find(f => f.id === 'wayra');
      if (wayra && !wayra.unlocked) {
        wayra.unlocked = true;
        newlyUnlocked = true;
      }
    }

    if (newlyUnlocked) {
      this.savePersistence();
    }
  }

  private triggerGameOver(reason: string): void {
    this.state = 'gameover';
    this.renderGameOverModal(reason);
  }

  private triggerVictory(): void {
    this.state = 'victory';
    this.renderVictoryModal();
  }

  private updateParticles(dtScale: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtScale;
      p.y += p.vy * dtScale;
      p.life += 16.66 * dtScale;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  private addParticleBurst(x: number, y: number, color: string, count: number): void {
    if (this.prefersReducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 3 + Math.random() * 4,
        life: 0,
        maxLife: 350 + Math.random() * 300
      });
    }
  }

  /* --------------------------------------------------------------------------
     Canvas Rendering (Layered Andean Mountains, Gates, Flyers)
     -------------------------------------------------------------------------- */
  private render(): void {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.clearRect(0, 0, w, h);

    // 1. Dynamic Day / Twilight / Night Andean Sky Gradient
    this.drawSky(w, h);

    // 2. Parallax Mountain Peaks
    this.drawMountains(w, h);

    // 3. Ground / Highland Grass
    this.drawGround(w, h);

    // 4. Split Gates
    this.drawGates();

    // 5. Andean Wind Gust Currents & Streams
    this.drawWindGusts(w, h);

    // 6. Particles
    this.drawParticles();

    // 7. Flyer Character
    this.drawFlyer();
  }

  private drawSky(w: number, h: number): void {
    if (!this.ctx) return;
    const p = this.skyCycleProgress; // 0.0 (Morning) -> 0.4 (Midday) -> 0.75 (Twilight) -> 1.0 (Night)

    // Interpolate sky colors based on progress p
    // Morning (p=0): #FEF08A -> #7DD3FC -> #BAE6FD
    // Midday (p=0.33): #38BDF8 -> #7DD3FC -> #E0F2FE
    // Sunset / Inti Twilight (p=0.66): #4C1D95 -> #C026D3 -> #F97316
    // Andean Night (p=1.0): #0F172A -> #1E1B4B -> #312E81
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, h);

    if (p < 0.4) {
      // Transition from Morning Gold to High Noon Alpine Sky
      const t = p / 0.4;
      const r0 = Math.round(254 + (56 - 254) * t);
      const g0 = Math.round(240 + (189 - 240) * t);
      const b0 = Math.round(138 + (248 - 138) * t);

      const r1 = Math.round(125 + (125 - 125) * t);
      const g1 = Math.round(211 + (211 - 211) * t);
      const b1 = Math.round(252 + (252 - 252) * t);

      skyGrad.addColorStop(0, `rgb(${r0}, ${g0}, ${b0})`);
      skyGrad.addColorStop(0.6, `rgb(${r1}, ${g1}, ${b1})`);
      skyGrad.addColorStop(1, '#E0F2FE');
    } else if (p < 0.75) {
      // Transition from Alpine Noon to Golden Andean Sunset (Inti Twilight)
      const t = (p - 0.4) / 0.35;
      const r0 = Math.round(56 + (76 - 56) * t);
      const g0 = Math.round(189 + (29 - 189) * t);
      const b0 = Math.round(248 + (149 - 248) * t);

      const r1 = Math.round(125 + (192 - 125) * t);
      const g1 = Math.round(211 + (38 - 211) * t);
      const b1 = Math.round(252 + (211 - 252) * t);

      const r2 = Math.round(224 + (249 - 224) * t);
      const g2 = Math.round(242 + (115 - 242) * t);
      const b2 = Math.round(254 + (22 - 254) * t);

      skyGrad.addColorStop(0, `rgb(${r0}, ${g0}, ${b0})`);
      skyGrad.addColorStop(0.6, `rgb(${r1}, ${g1}, ${b1})`);
      skyGrad.addColorStop(1, `rgb(${r2}, ${g2}, ${b2})`);
    } else {
      // Transition from Sunset to Andean Starlit Night
      const t = (p - 0.75) / 0.25;
      const r0 = Math.round(76 + (15 - 76) * t);
      const g0 = Math.round(29 + (23 - 29) * t);
      const b0 = Math.round(149 + (42 - 149) * t);

      const r1 = Math.round(192 + (30 - 192) * t);
      const g1 = Math.round(38 + (27 - 38) * t);
      const b1 = Math.round(211 + (75 - 211) * t);

      const r2 = Math.round(249 + (49 - 249) * t);
      const g2 = Math.round(115 + (46 - 115) * t);
      const b2 = Math.round(22 + (129 - 22) * t);

      skyGrad.addColorStop(0, `rgb(${r0}, ${g0}, ${b0})`);
      skyGrad.addColorStop(0.6, `rgb(${r1}, ${g1}, ${b1})`);
      skyGrad.addColorStop(1, `rgb(${r2}, ${g2}, ${b2})`);
    }

    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, w, h);

    // If night (p >= 0.7), render subtle stars
    if (p >= 0.7) {
      const starAlpha = (p - 0.7) / 0.3;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha * 0.8})`;
      // Static deterministic stars
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 137.5) % w);
        const sy = ((i * 83.3) % (h * 0.45));
        this.ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }

  private drawWindGusts(w: number, h: number): void {
    if (!this.ctx || this.windGust.state === 'idle') return;

    this.ctx.save();
    const isUp = this.windGust.direction === 'up';

    if (this.windGust.state === 'warning') {
      // Clear visual lead time indicator: gentle shimmering wind chevron cues
      const remainingRatio = Math.max(0, this.windGust.timer / this.windGust.warningDuration);
      const pulseAlpha = this.prefersReducedMotion
        ? 0.3
        : 0.25 + 0.25 * Math.sin(this.windGust.timer * 0.012);

      this.ctx.strokeStyle = isUp ? `rgba(245, 158, 11, ${pulseAlpha})` : `rgba(14, 165, 233, ${pulseAlpha})`;
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([8, 8]);

      // Draw 3 horizontal wind warning trail guides across player flight corridor
      for (let i = 0; i < 3; i++) {
        const lineY = h * 0.25 + i * (h * 0.22);
        this.ctx.beginPath();
        this.ctx.moveTo(30, lineY);
        this.ctx.lineTo(w - 30, lineY);
        this.ctx.stroke();

        // Arrowhead indicator pointing in draft direction
        const arrowX = 140 + (1 - remainingRatio) * 120;
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.beginPath();
        if (isUp) {
          this.ctx.moveTo(arrowX, lineY - 14);
          this.ctx.lineTo(arrowX - 8, lineY + 4);
          this.ctx.lineTo(arrowX + 8, lineY + 4);
        } else {
          this.ctx.moveTo(arrowX, lineY + 14);
          this.ctx.lineTo(arrowX - 8, lineY - 4);
          this.ctx.lineTo(arrowX + 8, lineY - 4);
        }
        this.ctx.fill();
      }
    } else if (this.windGust.state === 'active') {
      // Active wind streams flowing across the canvas
      const streamAlpha = this.prefersReducedMotion ? 0.3 : 0.45;
      this.ctx.strokeStyle = isUp ? `rgba(255, 255, 255, ${streamAlpha})` : `rgba(186, 230, 253, ${streamAlpha})`;
      this.ctx.lineWidth = 4;
      this.ctx.setLineDash([16, 12]);

      const offset = this.prefersReducedMotion ? 0 : (this.windGust.timer * 0.2) % 40;
      this.ctx.lineDashOffset = offset;

      for (let i = 0; i < 4; i++) {
        const streamY = (h * 0.2) + i * (h * 0.18) + (this.prefersReducedMotion ? 0 : (isUp ? -offset * 0.5 : offset * 0.5));
        this.ctx.beginPath();
        this.ctx.moveTo(0, streamY);
        // Gentle wave curve
        this.ctx.bezierCurveTo(
          w * 0.33, streamY + (isUp ? -20 : 20),
          w * 0.66, streamY + (isUp ? 20 : -20),
          w, streamY
        );
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  private drawMountains(w: number, h: number): void {
    if (!this.ctx) return;
    // Distant soft blue peaks
    this.ctx.fillStyle = '#93C5FD';
    this.ctx.beginPath();
    this.ctx.moveTo(0, h * 0.7);
    for (let x = 0; x <= w + 100; x += 120) {
      const peakY = h * 0.45 + Math.sin((x + this.bgMountainOffset) * 0.015) * 60;
      this.ctx.lineTo(x, peakY);
    }
    this.ctx.lineTo(w, h);
    this.ctx.lineTo(0, h);
    this.ctx.closePath();
    this.ctx.fill();

    // Closer Andean green-slate foothills
    this.ctx.fillStyle = '#6EE7B7';
    this.ctx.beginPath();
    this.ctx.moveTo(0, h * 0.75);
    for (let x = 0; x <= w + 80; x += 90) {
      const peakY = h * 0.6 + Math.cos((x + this.bgCloudOffset) * 0.02) * 45;
      this.ctx.lineTo(x, peakY);
    }
    this.ctx.lineTo(w, h);
    this.ctx.lineTo(0, h);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawGround(w: number, h: number): void {
    if (!this.ctx) return;
    const groundH = 26;
    this.ctx.fillStyle = '#059669'; // Emerald moss
    this.ctx.fillRect(0, h - groundH, w, groundH);

    // Soil layer
    this.ctx.fillStyle = '#78350F';
    this.ctx.fillRect(0, h - 8, w, 8);
  }

  private drawGates(): void {
    if (!this.ctx || !this.canvas) return;
    const h = this.canvas.height;

    for (const g of this.gates) {
      // Gate consists of 3 pillar sections:
      // Top section: from 0 to g.topGapY
      // Middle section: from g.topGapY + g.gapHeight to g.bottomGapY
      // Bottom section: from g.bottomGapY + g.gapHeight to h

      this.ctx.fillStyle = '#0284C7'; // Blueprint Lab pillar color
      this.ctx.strokeStyle = '#0C4A6E';
      this.ctx.lineWidth = 3;

      // 1. Top Pillar
      if (g.topGapY > 0) {
        this.ctx.fillRect(g.x, 0, g.width, g.topGapY);
        this.ctx.strokeRect(g.x, 0, g.width, g.topGapY);
        // Rounded cap
        this.ctx.fillStyle = '#38BDF8';
        this.ctx.fillRect(g.x - 4, g.topGapY - 14, g.width + 8, 14);
        this.ctx.strokeRect(g.x - 4, g.topGapY - 14, g.width + 8, 14);
      }

      // 2. Middle Pillar Block
      const midStartY = g.topGapY + g.gapHeight;
      const midHeight = g.bottomGapY - midStartY;
      if (midHeight > 0) {
        this.ctx.fillStyle = '#0284C7';
        this.ctx.fillRect(g.x, midStartY, g.width, midHeight);
        this.ctx.strokeRect(g.x, midStartY, g.width, midHeight);
        // Top and bottom caps of middle block
        this.ctx.fillStyle = '#38BDF8';
        this.ctx.fillRect(g.x - 4, midStartY, g.width + 8, 14);
        this.ctx.strokeRect(g.x - 4, midStartY, g.width + 8, 14);
        this.ctx.fillRect(g.x - 4, g.bottomGapY - 14, g.width + 8, 14);
        this.ctx.strokeRect(g.x - 4, g.bottomGapY - 14, g.width + 8, 14);
      }

      // 3. Bottom Pillar
      const botStartY = g.bottomGapY + g.gapHeight;
      const botHeight = h - botStartY;
      if (botHeight > 0) {
        this.ctx.fillStyle = '#0284C7';
        this.ctx.fillRect(g.x, botStartY, g.width, botHeight);
        this.ctx.strokeRect(g.x, botStartY, g.width, botHeight);
        // Cap
        this.ctx.fillStyle = '#38BDF8';
        this.ctx.fillRect(g.x - 4, botStartY, g.width + 8, 14);
        this.ctx.strokeRect(g.x - 4, botStartY, g.width + 8, 14);
      }

      // 4. Render Target Tokens inside Top and Bottom gaps
      this.drawGateToken(g.x + g.width / 2, g.topGapY + g.gapHeight / 2, g.question.topOption);
      this.drawGateToken(g.x + g.width / 2, g.bottomGapY + g.gapHeight / 2, g.question.bottomOption);
    }
  }

  private drawGateToken(cx: number, cy: number, option: { text: string; isCorrect: boolean; shape?: string; color?: string; isEmpty?: boolean }): void {
    if (!this.ctx) return;

    if (option.isEmpty) {
      // Clear sky target (indicated by soft dashed ring and cloud cue)
      this.ctx.save();
      this.ctx.strokeStyle = '#0284C7';
      this.ctx.setLineDash([4, 4]);
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.fillStyle = '#0369A1';
      this.ctx.font = '600 12px Fredoka, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('Clear Sky', cx, cy);
      this.ctx.restore();
      return;
    }

    // Filled Choice Gate: Draw card/token
    this.ctx.save();
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.strokeStyle = '#0C4A6E';
    this.ctx.lineWidth = 2.5;

    // Card background
    this.ctx.beginPath();
    this.ctx.roundRect(cx - 30, cy - 24, 60, 48, 12);
    this.ctx.fill();
    this.ctx.stroke();

    // Shape or Text rendering
    if (option.shape && option.color) {
      this.ctx.fillStyle = option.color;
      this.ctx.strokeStyle = '#1E293B';
      this.ctx.lineWidth = 2;

      if (option.shape === 'circle') {
        this.ctx.beginPath();
        this.ctx.arc(cx, cy - 4, 12, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      } else if (option.shape === 'square') {
        this.ctx.fillRect(cx - 10, cy - 14, 20, 20);
        this.ctx.strokeRect(cx - 10, cy - 14, 20, 20);
      } else if (option.shape === 'triangle') {
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - 16);
        this.ctx.lineTo(cx - 12, cy + 6);
        this.ctx.lineTo(cx + 12, cy + 6);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      } else if (option.shape === 'star') {
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          this.ctx.lineTo(
            cx + Math.cos((18 + i * 72) * Math.PI / 180) * 12,
            cy - 4 - Math.sin((18 + i * 72) * Math.PI / 180) * 12
          );
          this.ctx.lineTo(
            cx + Math.cos((54 + i * 72) * Math.PI / 180) * 5,
            cy - 4 - Math.sin((54 + i * 72) * Math.PI / 180) * 5
          );
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }

      this.ctx.fillStyle = '#0F172A';
      this.ctx.font = '700 11px Fredoka, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(option.text, cx, cy + 16);
    } else {
      // Standard Numbers or Letter Text
      this.ctx.fillStyle = '#0F172A';
      this.ctx.font = '800 20px Fredoka, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(option.text, cx, cy);
    }

    this.ctx.restore();
  }

  private drawFlyer(): void {
    if (!this.ctx) return;
    const flyer = this.getActiveFlyer();
    const x = 100;
    const y = this.flyerY;

    this.ctx.save();
    this.ctx.translate(x, y);

    // Alpha blink during invulnerability (WCAG compliant < 3 Hz, constant alpha on prefers-reduced-motion)
    if (this.invulnerableTimer > 0) {
      if (this.prefersReducedMotion) {
        this.ctx.globalAlpha = 0.7;
      } else {
        this.ctx.globalAlpha = Math.sin(this.invulnerableTimer * 0.012) > 0 ? 0.45 : 0.85;
      }
    }

    // Pitch rotation based on velocity + gentle wobble on hit
    const wobbleAngle = this.isWobbling ? Math.sin(this.invulnerableTimer * 0.03) * 0.2 : 0;
    const rotation = Math.max(-0.5, Math.min(0.6, this.flyerVy * 0.06));
    this.ctx.rotate(rotation + wobbleAngle);

    // 1. Bird Body
    this.ctx.fillStyle = flyer.color;
    this.ctx.strokeStyle = '#1E293B';
    this.ctx.lineWidth = 2.5;

    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, this.flyerRadius + 2, this.flyerRadius - 3, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // 2. Belly Accent
    this.ctx.fillStyle = flyer.accentColor;
    this.ctx.beginPath();
    this.ctx.ellipse(4, 5, this.flyerRadius * 0.5, this.flyerRadius * 0.4, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // 3. Wing (Animated Flapping)
    const flapOffset = Math.sin(this.wingAngle) * 9;
    this.ctx.fillStyle = flyer.accentColor;
    this.ctx.beginPath();
    this.ctx.ellipse(-6, flapOffset, 12, 7, -0.2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // 4. Eye
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.beginPath();
    this.ctx.arc(9, -6, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#0F172A';
    this.ctx.beginPath();
    this.ctx.arc(11, -6, 2.5, 0, Math.PI * 2);
    this.ctx.fill();

    // 5. Beak
    this.ctx.fillStyle = '#F59E0B';
    this.ctx.beginPath();
    this.ctx.moveTo(18, -4);
    this.ctx.lineTo(28, -1);
    this.ctx.lineTo(17, 3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Special Goggles for Kuntur
    if (flyer.id === 'kuntur') {
      this.ctx.fillStyle = '#78350F';
      this.ctx.fillRect(4, -9, 12, 3);
      this.ctx.strokeStyle = '#B45309';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(6, -10, 8, 8);
    }

    this.ctx.restore();
  }

  private drawParticles(): void {
    if (!this.ctx || this.prefersReducedMotion) return;
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  private getActiveFlyer(): PawanaFlyer {
    return this.flyers.find(f => f.id === this.activeFlyerId) || this.flyers[0];
  }

  /* --------------------------------------------------------------------------
     DOM Overlay & HUD Rendering (Accessible, Semantic, Zero Inline Styles)
     -------------------------------------------------------------------------- */
  private renderMenuOverlay(): void {
    if (!this.overlayContainer) return;

    this.overlayContainer.innerHTML = `
      <div class="pawana-modal-backdrop">
        <div class="pawana-card" role="dialog" aria-modal="true" aria-labelledby="pawana-modal-title">
          <h2 id="pawana-modal-title" class="pawana-title">Pawana</h2>
          <p class="pawana-subtitle">The Flight Path — Aerial Logic & Sequencing</p>
          ${this.highScore > 0 ? `<p class="pawana-subtitle">High Score: <strong>${this.highScore}</strong> gates</p>` : ''}

          <div class="pawana-tabs-group" role="tablist" aria-label="Curriculum Mode">
            <button class="pawana-tab-btn ${this.currentMode === 'numbers' ? 'active' : ''}" data-mode="numbers" role="tab" aria-selected="${this.currentMode === 'numbers'}">
              🔢 Numbers
            </button>
            <button class="pawana-tab-btn ${this.currentMode === 'spelling' ? 'active' : ''}" data-mode="spelling" role="tab" aria-selected="${this.currentMode === 'spelling'}">
              🔤 Spelling
            </button>
            <button class="pawana-tab-btn ${this.currentMode === 'shapes' ? 'active' : ''}" data-mode="shapes" role="tab" aria-selected="${this.currentMode === 'shapes'}">
              ⭐ Patterns
            </button>
          </div>

          <div class="pawana-diff-group" role="radiogroup" aria-label="Difficulty">
            <button class="pawana-diff-btn ${this.currentDifficulty === 'easy' ? 'active' : ''}" data-diff="easy" role="radio" aria-checked="${this.currentDifficulty === 'easy'}">
              Easy (5 ❤️)
            </button>
            <button class="pawana-diff-btn ${this.currentDifficulty === 'normal' ? 'active' : ''}" data-diff="normal" role="radio" aria-checked="${this.currentDifficulty === 'normal'}">
              Normal (3 ❤️)
            </button>
            <button class="pawana-diff-btn ${this.currentDifficulty === 'hard' ? 'active' : ''}" data-diff="hard" role="radio" aria-checked="${this.currentDifficulty === 'hard'}">
              Hard (2 ❤️)
            </button>
          </div>

          <div class="pawana-roster-grid" role="radiogroup" aria-label="Choose Flyer">
            ${this.flyers.map(f => `
              <button class="pawana-roster-item ${f.id === this.activeFlyerId ? 'active' : ''} ${f.unlocked ? '' : 'locked'}"
                      data-flyer="${f.id}"
                      role="radio"
                      aria-checked="${f.id === this.activeFlyerId}"
                      aria-disabled="${!f.unlocked}"
                      aria-label="${f.name} - ${f.badge}${f.unlocked ? '' : ' (Locked)'}">
                <span class="pawana-roster-name">${f.name}</span>
                <span class="pawana-roster-badge">${f.unlocked ? f.badge : '🔒 Locked'}</span>
              </button>
            `).join('')}
          </div>

          <button id="pawana-btn-start" class="pawana-btn pawana-btn-primary" aria-label="Take Flight">
            Take Flight 🚀
          </button>
        </div>
      </div>
    `;

    // Attach listeners
    this.overlayContainer.querySelectorAll('.pawana-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.currentMode = target.dataset.mode as PawanaMode;
        this.renderMenuOverlay();
      });
    });

    this.overlayContainer.querySelectorAll('.pawana-diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.currentDifficulty = target.dataset.diff as PawanaDifficulty;
        this.renderMenuOverlay();
      });
    });

    this.overlayContainer.querySelectorAll('.pawana-roster-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const flyerId = target.dataset.flyer;
        const flyer = this.flyers.find(f => f.id === flyerId);
        if (flyer && flyer.unlocked) {
          this.activeFlyerId = flyer.id;
          this.renderMenuOverlay();
        }
      });
    });

    this.overlayContainer.querySelector('#pawana-btn-start')?.addEventListener('click', () => {
      this.startFlight();
    });
  }

  private renderFlightHUD(): void {
    if (!this.overlayContainer) return;

    const heartsHtml = Array.from({ length: this.maxHearts }).map((_, i) => `
      <svg class="pawana-heart-icon ${i < this.hearts ? '' : 'pawana-heart-lost'}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    `).join('');

    const nextGate = this.gates.find(g => !g.passed);
    const mainPrompt = nextGate ? nextGate.question.prompt : 'Fly through gates!';
    const subPrompt = nextGate?.question.subPrompt ?? 'Tap anywhere or press Space';

    this.overlayContainer.innerHTML = `
      <div class="pawana-hud-bar">
        <div class="pawana-hud-left">
          <div class="pawana-hud-pill" role="status" aria-label="Hearts remaining: ${this.hearts}">
            ${heartsHtml}
          </div>
        </div>

        <div class="pawana-hud-prompt" role="status" aria-live="polite">
          <span class="pawana-hud-prompt-main">${mainPrompt}</span>
          <span class="pawana-hud-prompt-sub">${subPrompt}</span>
        </div>

        <div class="pawana-hud-right">
          <div id="pawana-wind-indicator" class="pawana-wind-banner" role="status" aria-live="polite" aria-label="Wind status">
            ${this.getWindBannerHtml()}
          </div>
          <div class="pawana-hud-pill" role="status" aria-label="Score: ${this.score}">
            ⭐ <span>${this.score}</span>
          </div>
        </div>
      </div>
    `;
    this.updateWindHUD();
  }

  private getWindBannerHtml(): string {
    if (this.windGust.state === 'warning') {
      const arrow = this.windGust.direction === 'up' ? '⬆️' : '⬇️';
      return `⚠️ Wind Gust Incoming ${arrow}`;
    } else if (this.windGust.state === 'active') {
      const arrow = this.windGust.direction === 'up' ? '⬆️ Updraft' : '⬇️ Downdraft';
      return `💨 Wayra Wind: ${arrow}`;
    }
    return '';
  }

  private updateWindHUD(): void {
    if (!this.overlayContainer) return;
    const banner = this.overlayContainer.querySelector('#pawana-wind-indicator') as HTMLElement | null;
    if (!banner) return;

    if (this.windGust.state === 'idle') {
      banner.classList.add('hidden');
      banner.classList.remove('active');
      banner.textContent = '';
    } else {
      banner.classList.remove('hidden');
      if (this.windGust.state === 'active') {
        banner.classList.add('active');
      } else {
        banner.classList.remove('active');
      }
      banner.textContent = this.getWindBannerHtml();
    }
  }

  private updateFlightHUDPrompt(): void {
    if (!this.overlayContainer) return;
    const nextGate = this.gates.find(g => !g.passed);
    const promptMain = this.overlayContainer.querySelector('.pawana-hud-prompt-main');
    const promptSub = this.overlayContainer.querySelector('.pawana-hud-prompt-sub');
    const scoreVal = this.overlayContainer.querySelector('.pawana-hud-right .pawana-hud-pill:last-child span');

    if (promptMain && nextGate) promptMain.textContent = nextGate.question.prompt;
    if (promptSub && nextGate?.question.subPrompt) promptSub.textContent = nextGate.question.subPrompt;
    if (scoreVal) scoreVal.textContent = String(this.score);
  }

  private renderGameOverModal(reason: string): void {
    if (!this.overlayContainer) return;

    this.overlayContainer.innerHTML = `
      <div class="pawana-modal-backdrop">
        <div class="pawana-card" role="dialog" aria-modal="true" aria-labelledby="pawana-gameover-title">
          <h2 id="pawana-gameover-title" class="pawana-title">Flight Rest 🪶</h2>
          <p class="pawana-subtitle">${reason}</p>
          <p>You navigated <strong>${this.score}</strong> gates smoothly!</p>
          ${this.highScore > 0 ? `<p>Best Flight: <strong>${this.highScore}</strong></p>` : ''}
          <div class="pawana-tabs-group">
            <button id="pawana-btn-retry" class="pawana-btn pawana-btn-primary" aria-label="Try Again">
              Try Again 🔄
            </button>
            <button id="pawana-btn-menu" class="pawana-btn pawana-btn-secondary" aria-label="Back to Menu">
              Menu 📋
            </button>
          </div>
        </div>
      </div>
    `;

    this.overlayContainer.querySelector('#pawana-btn-retry')?.addEventListener('click', () => {
      this.startFlight();
    });
    this.overlayContainer.querySelector('#pawana-btn-menu')?.addEventListener('click', () => {
      this.resetToMenu();
    });
    this.overlayContainer.querySelector<HTMLButtonElement>('#pawana-btn-retry')?.focus();
  }

  private renderVictoryModal(): void {
    if (!this.overlayContainer) return;

    this.overlayContainer.innerHTML = `
      <div class="pawana-modal-backdrop">
        <div class="pawana-card" role="dialog" aria-modal="true" aria-labelledby="pawana-victory-title">
          <h2 id="pawana-victory-title" class="pawana-title">Journey Mastered! 🌟</h2>
          <p class="pawana-subtitle">You completed the flight path sequence!</p>
          <p>Score: <strong>${this.score}</strong> (Best: ${this.highScore})</p>
          <div class="pawana-tabs-group">
            <button id="pawana-btn-continue" class="pawana-btn pawana-btn-primary" aria-label="Keep Flying">
              Keep Flying 🦅
            </button>
            <button id="pawana-btn-menu" class="pawana-btn pawana-btn-secondary" aria-label="Back to Menu">
              Menu 📋
            </button>
          </div>
        </div>
      </div>
    `;

    this.overlayContainer.querySelector('#pawana-btn-continue')?.addEventListener('click', () => {
      this.state = 'playing';
      this.renderFlightHUD();
    });
    this.overlayContainer.querySelector('#pawana-btn-menu')?.addEventListener('click', () => {
      this.resetToMenu();
    });
    this.overlayContainer.querySelector<HTMLButtonElement>('#pawana-btn-continue')?.focus();
  }

  public pause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      if (this.overlayContainer) {
        const pauseNotice = document.createElement('div');
        pauseNotice.className = 'pawana-modal-backdrop';
        pauseNotice.id = 'pawana-pause-overlay';
        pauseNotice.innerHTML = `
          <div class="pawana-card" role="dialog" aria-modal="true" aria-labelledby="pawana-pause-title">
            <h2 id="pawana-pause-title" class="pawana-title">Flight Paused ⏸️</h2>
            <button id="pawana-btn-resume" class="pawana-btn pawana-btn-primary" aria-label="Resume Flight">Resume</button>
          </div>
        `;
        this.overlayContainer.appendChild(pauseNotice);
        pauseNotice.querySelector('#pawana-btn-resume')?.addEventListener('click', () => this.resume());
        pauseNotice.querySelector<HTMLButtonElement>('#pawana-btn-resume')?.focus();
      }
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pawana-pause-overlay')?.remove();
      this.renderFlightHUD();
    }
  }

  public override destroy(): void {
    // Teardown keyboard & pointer listeners
    if (this.onKeyDownBound) {
      window.removeEventListener('keydown', this.onKeyDownBound);
      this.onKeyDownBound = null;
    }
    if (this.onPointerDownBound && this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
      this.onPointerDownBound = null;
    }

    // Teardown DOM overlays
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }

    this.gates = [];
    this.particles = [];
  }
}
