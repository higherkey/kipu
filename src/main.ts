import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { Icons } from './ui/Icons';
import { IdleManager } from './core/IdleManager';
import { PauseMenu } from './ui/PauseMenu';
import type { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';
import { Router } from './core/Router';
import { LoadingOverlay } from './ui/LoadingOverlay';
import { Navigation } from './ui/Navigation';

// PWA Support
registerSW({
  onNeedRefresh() {
    console.log('New content available, click on reload button to update.');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

let activeGame: Game | null = null;
let gameLoop: GameLoop | null = null;
let pauseMenu: PauseMenu | null = null;
let idleManager: IdleManager | null = null;
let router: Router | null = null;
let loadingOverlay: LoadingOverlay | null = null;
let navigation: Navigation | null = null;

document.addEventListener('DOMContentLoaded', () => {
  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const gameButtons = document.querySelectorAll('#game-list button, #game-list a');

  // Inject Icons
  gameButtons.forEach(button => {
    const gameId = (button as HTMLElement).dataset.game;
    const iconContainer = button.querySelector('.icon');
    if (iconContainer && gameId) {
      const iconMap: Record<string, string> = {
        noButton: 'no',
        bubbleWrap: 'bubble',
        balloonPop: 'balloon',
        soundBoard: 'sound',
        particlePhysics: 'particle',
      };
      const iconKey = iconMap[gameId];
      if (iconKey && iconKey in Icons) {
        iconContainer.innerHTML = Icons[iconKey as keyof typeof Icons];
      }
    }
  });

  // Setup Global Systems
  navigation = new Navigation();
  loadingOverlay = new LoadingOverlay();

  pauseMenu = new PauseMenu(
    () => resumeGame(),
    () => exitToHome()
  );

  idleManager = new IdleManager(60000, () => {
    if (activeGame) pauseGame();
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
    // Hide 404 if visible
    const notFound = document.getElementById('not-found-screen');
    notFound?.classList.add('hidden');

    navigation?.showMenu();
    cleanupActiveGame();
  });

  router.addRoute('/game/:id', (params) => {
    const gameId = params?.id;
    if (!gameId) {
      router?.navigate('/404');
      return;
    }

    const validGames = ['noButton', 'bubbleWrap', 'balloonPop', 'soundBoard', 'particlePhysics'];
    if (!validGames.includes(gameId)) {
      router?.navigate('/404');
      return;
    }

    // Hide 404 if visible
    const notFound = document.getElementById('not-found-screen');
    notFound?.classList.add('hidden');

    // Show loading overlay (grace period)
    loadingOverlay?.show(200);

    navigation?.hideMenu();
    
    resizeCanvas(gameCanvas);
    
    // Track resize handler to clean up later if needed
    const onResize = () => resizeCanvas(gameCanvas);
    window.addEventListener('resize', onResize);

    startGame(gameId, gameCanvas);

    // Hide overlay after a brief delay for a smooth experience
    setTimeout(() => {
      loadingOverlay?.hide();
    }, 500);
  });

  router.addRoute('*', () => {
    cleanupActiveGame();
    navigation?.showMenu(); // Ensure layout resets
    
    // Hide menu list and canvas
    document.getElementById('navigation-shell')?.classList.add('hidden');
    gameCanvas?.classList.add('hidden');

    // Show or create 404 Container
    let notFound = document.getElementById('not-found-screen');
    if (!notFound) {
      notFound = document.createElement('div');
      notFound.id = 'not-found-screen';
      notFound.className = 'not-found-container';
      notFound.innerHTML = `
        <h2>404</h2>
        <p>Oops! We got lost in the toy box!</p>
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
import { SoundBoardGame } from './games/soundBoard/SoundBoardGame';
import { ParticlePhysicsGame } from './games/particlePhysics/ParticlePhysicsGame';

function startGame(gameId: string, canvas: HTMLCanvasElement) {
  // Clear previous game if any
  cleanupActiveGame();

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
  pauseMenu?.show();
}

function resumeGame() {
  if (activeGame) activeGame.resume();
  gameLoop?.start();
  pauseMenu?.hide();
  idleManager?.start();
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
  pauseMenu?.hide();
  idleManager?.stop();
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
