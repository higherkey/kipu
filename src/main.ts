import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { Icons } from './ui/Icons';
import { IdleManager } from './core/IdleManager';
import { GameUI } from './ui/GameUI';
import type { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';
import { Router } from './core/Router';
import { LoadingOverlay } from './ui/LoadingOverlay';

// PWA Support
registerSW({
  onNeedRefresh() {
    console.log('New content available, click on reload button to update.');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

// Game State
let activeGame: Game | null = null;
let gameLoop: GameLoop | null = null;
let gameUI: GameUI | null = null;
let idleManager: IdleManager | null = null;
let router: Router | null = null;
let loadingOverlay: LoadingOverlay | null = null;

// Settings State (persisted in localStorage)
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
let vibrationEnabled = localStorage.getItem('vibrationEnabled') !== 'false';

// Game Name Mapping — Kipu spec names (Quechua short name + descriptive)
const gameNames: Record<string, string> = {
  noButton: 'Eeno',
  bubbleWrap: 'Poka',
  balloonPop: 'Tapa',
  colorMixer: 'Maka',
  bugCatcher: 'Nuko',
  soundMemory: 'Sound Memory',
  marblePipe: 'Marble Pipe',
  soundBoard: 'Sound Board',
  particlePhysics: 'Particle Play',
};

// Featured Games list for rotating banner
const featuredGames = [
  {
    id: 'noButton',
    title: 'Eeno',
    subtitle: 'The "No" Button',
    desc: 'Speak with funny voices and learn standard words in many languages!',
    icon: 'no'
  },
  {
    id: 'bubbleWrap',
    title: 'Poka',
    subtitle: 'Bubble Wrap',
    desc: 'Pop colorful bubbles, hear funny pops, and feel satisfying haptic feedback!',
    icon: 'bubble'
  },
  {
    id: 'marblePipe',
    title: 'Marble Pipe',
    subtitle: 'Marble Run Sandbox',
    desc: 'Build your own physics marble run with ramps, boosters, and bumpers!',
    icon: 'pipe'
  },
  {
    id: 'colorMixer',
    title: 'Maka',
    subtitle: 'Color Mixer',
    desc: 'Drop and merge paint drops to mix new colors with voice speech!',
    icon: 'palette'
  }
];

let currentHeroIndex = 0;
let heroInterval: any = null;

document.addEventListener('DOMContentLoaded', () => {
  const navShell = document.getElementById('navigation-shell');
  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const gameButtons = document.querySelectorAll('#game-list button, #game-list a');

  // Inject Icons into menu items
  gameButtons.forEach(button => {
    const gameId = (button as HTMLElement).dataset.game;
    const iconContainer = button.querySelector('.icon');
    if (iconContainer && gameId) {
      const iconMap: Record<string, string> = {
        noButton: 'no',
        bubbleWrap: 'bubble',
        balloonPop: 'balloon',
        colorMixer: 'palette',
        bugCatcher: 'bug',
        soundMemory: 'music',
        marblePipe: 'pipe',
        soundBoard: 'sound',
        particlePhysics: 'particle',
      };
      const iconKey = iconMap[gameId];
      if (iconKey && iconKey in Icons) {
        iconContainer.innerHTML = Icons[iconKey as keyof typeof Icons];
      }
    }
  });

  // Setup Category Filters
  const filterPills = document.querySelectorAll('#category-filters .filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');

      const cat = (pill as HTMLElement).getAttribute('data-category');
      const cards = document.querySelectorAll('#game-list a');
      cards.forEach(card => {
        const cardCat = (card as HTMLElement).getAttribute('data-category');
        if (cat === 'all' || cardCat === cat) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // Setup Hero Banner dots indicators
  const dotsContainer = document.getElementById('hero-dots');
  if (dotsContainer) {
    dotsContainer.innerHTML = featuredGames.map((_, i) => `<button class="dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Slide ${i+1}"></button>`).join('');
    
    dotsContainer.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '0');
        currentHeroIndex = idx;
        updateHeroBanner();
        startHeroRotation();
      });
    });
  }

  function updateHeroBanner() {
    const hero = featuredGames[currentHeroIndex];
    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    const heroDesc = document.getElementById('hero-desc');
    const heroPlayBtn = document.getElementById('hero-play-btn') as HTMLAnchorElement;
    const heroIconContainer = document.getElementById('hero-icon-container');

    const heroBannerEl = document.getElementById('hero-banner');
    if (heroBannerEl) {
      heroBannerEl.classList.add('fade-transition');
      setTimeout(() => {
        if (heroTitle) heroTitle.textContent = hero.title;
        if (heroSubtitle) heroSubtitle.textContent = hero.subtitle;
        if (heroDesc) heroDesc.textContent = hero.desc;
        if (heroPlayBtn) heroPlayBtn.href = `/game/${hero.id}`;
        if (heroIconContainer && hero.icon in Icons) {
          heroIconContainer.innerHTML = Icons[hero.icon as keyof typeof Icons];
        }

        if (dotsContainer) {
          dotsContainer.querySelectorAll('.dot').forEach((d, i) => {
            d.classList.toggle('active', i === currentHeroIndex);
          });
        }

        heroBannerEl.classList.remove('fade-transition');
      }, 150);
    }
  }

  function startHeroRotation() {
    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(() => {
      currentHeroIndex = (currentHeroIndex + 1) % featuredGames.length;
      updateHeroBanner();
    }, 5000);
  }

  // Setup global systems
  loadingOverlay = new LoadingOverlay();

  idleManager = new IdleManager(60000, () => {
    if (activeGame && gameUI) {
      gameUI.pause();
      gameUI.openMenu();
    }
  });

  // Global touch prevention on canvas
  if (gameCanvas) {
    gameCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
    }, { passive: false });

    gameCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
  }

  // Setup Router
  router = new Router();

  router.addRoute('/', () => {
    const notFound = document.getElementById('not-found-screen');
    notFound?.classList.add('hidden');

    cleanupActiveGame();
    navShell?.classList.remove('hidden');
    gameCanvas?.classList.add('hidden');
    gameCanvas?.classList.remove('with-hud');

    // Start hero rotation
    updateHeroBanner();
    startHeroRotation();
  });

  router.addRoute('/game/:id', (params) => {
    const gameId = params?.id;
    const validGames = ['noButton', 'bubbleWrap', 'balloonPop', 'colorMixer', 'bugCatcher', 'soundMemory', 'marblePipe', 'soundBoard', 'particlePhysics'];

    if (!gameId || !validGames.includes(gameId)) {
      router?.navigate('*', false);
      return;
    }

    // Stop hero rotation
    if (heroInterval) {
      clearInterval(heroInterval);
      heroInterval = null;
    }

    const notFound = document.getElementById('not-found-screen');
    notFound?.classList.add('hidden');

    // Show loading overlay with grace period
    loadingOverlay?.show(200);

    navShell?.classList.add('hidden');
    gameCanvas?.classList.remove('hidden');
    gameCanvas?.classList.add('with-hud');

    resizeCanvas(gameCanvas);
    window.addEventListener('resize', () => resizeCanvas(gameCanvas));

    startGame(gameId, gameCanvas);

    setTimeout(() => loadingOverlay?.hide(), 500);
  });

  router.addRoute('*', () => {
    cleanupActiveGame();

    navShell?.classList.add('hidden');
    gameCanvas?.classList.add('hidden');

    let notFound = document.getElementById('not-found-screen');
    if (!notFound) {
      notFound = document.createElement('div');
      notFound.id = 'not-found-screen';
      notFound.className = 'not-found-container';
      notFound.innerHTML = `
        <h2>404</h2>
        <p>This game could not be found.</p>
        <a href="/" class="back-home-btn">Go Back Home</a>
      `;
      document.getElementById('app')?.appendChild(notFound);
    } else {
      notFound.classList.remove('hidden');
    }
  });

  router.init();
});

import { NoButtonGame } from './games/noButton/NoButtonGame';
import { BubbleWrapGame } from './games/bubbleWrap/BubbleWrapGame';
import { BalloonPopGame } from './games/balloonPop/BalloonPopGame';
import { ColorMixerGame } from './games/colorMixer/ColorMixerGame';
import { BugCatcherGame } from './games/bugCatcher/BugCatcherGame';
import { SoundMemoryGame } from './games/soundMemory/SoundMemoryGame';
import { MarblePipeGame } from './games/marblePipe/MarblePipeGame';
import { SoundBoardGame } from './games/soundBoard/SoundBoardGame';
import { ParticlePhysicsGame } from './games/particlePhysics/ParticlePhysicsGame';

function startGame(gameId: string, canvas: HTMLCanvasElement) {
  // Clear previous game if any
  if (activeGame) activeGame.destroy();
  if (gameUI) gameUI.unmount();

  const gameName = gameNames[gameId] || 'Game';

  // Create the unified Game UI
  gameUI = new GameUI({
    gameName,
    onHome: () => exitToHome(),
    onPause: () => pauseGame(),
    onResume: () => resumeGame(),
    onRestart: () => restartGame(gameId, canvas),
    soundEnabled,
    vibrationEnabled,
    onSoundToggle: (enabled) => {
      soundEnabled = enabled;
      localStorage.setItem('soundEnabled', String(enabled));
      // Notify active game of sound setting change
      if (activeGame && 'setSoundEnabled' in activeGame) {
        (activeGame as any).setSoundEnabled(enabled);
      }
    },
    onVibrationToggle: (enabled) => {
      vibrationEnabled = enabled;
      localStorage.setItem('vibrationEnabled', String(enabled));
      // Notify active game of vibration setting change
      if (activeGame && 'setVibrationEnabled' in activeGame) {
        (activeGame as any).setVibrationEnabled(enabled);
      }
    },
  });
  gameUI.mount();

  // Instantiate selected game
  switch (gameId) {
    case 'noButton':
      activeGame = new NoButtonGame();
      break;
    case 'bubbleWrap':
      activeGame = new BubbleWrapGame();
      break;
    case 'balloonPop':
      activeGame = new BalloonPopGame();
      break;
    case 'colorMixer':
      activeGame = new ColorMixerGame();
      break;
    case 'bugCatcher':
      activeGame = new BugCatcherGame();
      break;
    case 'soundMemory':
      activeGame = new SoundMemoryGame();
      break;
    case 'marblePipe':
      activeGame = new MarblePipeGame();
      break;
    case 'soundBoard':
      activeGame = new SoundBoardGame();
      break;
    case 'particlePhysics':
      activeGame = new ParticlePhysicsGame();
      break;
    default:
      console.warn(`Unknown game: ${gameId}`);
      return;
  }

  activeGame.init(canvas);
  
  gameLoop = new GameLoop((dt) => {
    if (activeGame) activeGame.update(dt);
  });
  gameLoop.start();
  idleManager?.start();
}

function pauseGame() {
  if (activeGame) activeGame.pause();
  gameLoop?.stop();
}

function resumeGame() {
  if (activeGame) activeGame.resume();
  gameLoop?.start();
  idleManager?.start();
}

function restartGame(gameId: string, canvas: HTMLCanvasElement) {
  if (activeGame) activeGame.destroy();
  activeGame = null;
  gameLoop?.stop();
  
  // Start the same game again
  startGame(gameId, canvas);
}

function exitToHome() {
  router?.navigate('/');
}

function cleanupActiveGame() {
  if (activeGame) {
    activeGame.destroy();
    activeGame = null;
  }
  gameLoop?.stop();
  gameLoop = null;
  gameUI?.unmount();
  gameUI = null;
  idleManager?.stop();
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = window.innerWidth;
  // Account for HUD height
  canvas.height = window.innerHeight - 60;
}
