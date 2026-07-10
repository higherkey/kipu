# 

Kipu: CLI Boilerplate & Architectural Blueprint

**Version:** 4.0  
**Target Use:** Automated ingestion via Gemini CLI, Antigravity IDE, or other agentic development environments.  
This document contains the structural blueprints, boilerplate code, and baseline configurations required to scaffold the Kipu project. It is formatted to be parsed directly by an AI software agent to generate the initial directory trees and primary system files.

## **1\. Target Repository Structure**

---

kipu-root/  
├── package.json  
├── tsconfig.json  
├── vite.config.ts  
├── index.html  
├── src/  
│   ├── main.ts  
│   ├── style.css  
│   ├── core/  
│   │   ├── BaseGame.ts  
│   │   ├── AudioController.ts  
│   │   ├── HapticController.ts  
│   │   └── StateManager.ts  
│   ├── ui/  
│   │   ├── Navigation.ts  
│   │   └── ParentalGate.ts  
│   └── games/  
│       ├── sandbox/  
│       │   ├── busyboard/  
│       │   └── bubblewrap/  
│       ├── workshop/  
│       │   └── litebrite/  
│       └── lab/  
│           └── eqtower/


## **2\. Foundation Configurations**

### ---

**2.1 package.json Boilerplate**

{  
  "name": "kipu-game-suite",  
  "private": true,  
  "version": "1.0.0",  
  "type": "module",  
  "scripts": {  
    "dev": "vite",  
    "build": "tsc && vite build",  
    "preview": "vite preview"  
  },  
  "dependencies": {  
    "howler": "^2.2.4",  
    "matter-js": "^0.19.0"  
  },  
  "devDependencies": {  
    "@types/howler": "^2.2.11",  
    "@types/matter-js": "^0.19.6",  
    "typescript": "^5.2.2",  
    "vite": "^5.0.0"  
  }  
}


### **2.2 vite.config.ts**

import { defineConfig } from 'vite';

export default defineConfig({  
  server: {  
    port: 3000,  
    host: true  
  },  
  build: {  
    outDir: 'dist',  
    assetsDir: 'assets',  
    sourcemap: false,  
    minify: 'terser'  
  }  
});


### **2.3 index.html (Mobile-Optimized Layout)**

\<\!DOCTYPE html\>  
\<html lang="en"\>  
\<head\>  
  \<meta charset="UTF-8"\>  
  \<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"\>  
  \<title\>Kipu Portals\</title\>  
  \<style\>  
    \* {  
      box-sizing: border-box;  
      margin: 0;  
      padding: 0;  
      user-select: none;  
      \-webkit-user-select: none;  
      touch-action: none;  
    }  
    html, body {  
      width: 100%;  
      height: 100%;  
      overflow: hidden;  
      background-color: \#f7f5f0;  
    }  
    \#app {  
      width: 100%;  
      height: 100%;  
      position: relative;  
    }  
  \</style\>  
\</head\>  
\<body\>  
  \<div id="app"\>\</div\>  
  \<script type="module" src="/src/main.ts"\>\</script\>  
\</body\>  
\</html\>


## **3\. Core Architecture Classes**

### ---

**3.1 BaseGame.ts**

Every mini-game or busy board configured inside Kipu must inherit from this parent interface to allow standard routing, layout scaling, and memory lifecycle tracking.

export abstract class BaseGame {  
  protected container: HTMLElement;  
  protected canvas: HTMLCanvasElement;  
  protected ctx: CanvasRenderingContext2D;  
  protected isRunning: boolean \= false;

  constructor(container: HTMLElement) {  
    this.container \= container;  
    this.canvas \= document.createElement('canvas');  
    this.ctx \= this.canvas.getContext('2d')\!;  
    this.container.appendChild(this.canvas);  
    this.resize();  
    window.addEventListener('resize', () \=\> this.resize());  
  }

  public abstract load(): Promise\<void\>;  
  public abstract start(): void;  
  public abstract stop(): void;

  protected resize(): void {  
    const dpr \= window.devicePixelRatio || 1;  
    this.canvas.width \= this.container.clientWidth \* dpr;  
    this.canvas.height \= this.container.clientHeight \* dpr;  
    this.canvas.style.width \= \`${this.container.clientWidth}px\`;  
    this.canvas.style.height \= \`${this.container.clientHeight}px\`;  
    this.ctx.scale(dpr, dpr);  
  }

  public destroy(): void {  
    this.stop();  
    window.removeEventListener('resize', () \=\> this.resize());  
    this.canvas.remove();  
  }  
}


### **3.2 HapticController.ts**

A unified interface wrapper designed to manage device-specific touch responses with immediate feedback loops.

export class HapticController {  
  private static instance: HapticController;

  private constructor() {}

  public static getInstance(): HapticController {  
    if (\!HapticController.instance) {  
      HapticController.instance \= new HapticController();  
    }  
    return HapticController.instance;  
  }

  public trigger(pattern: number | number\[\]): void {  
    if ('vibrate' in navigator) {  
      try {  
        navigator.vibrate(pattern);  
      } catch (e) {  
        console.warn('Haptic execution prevented by browser.', e);  
      }  
    }  
  }

  public lightClick(): void {  
    this.trigger(15);  
  }

  public mechanicalSnap(): void {  
    this.trigger(45);  
  }

  public warningRipple(): void {  
    this.trigger(\[30, 50, 30\]);  
  }  
}


### **3.3 AudioController.ts**

Utilizes Howler.js to handle audio-sprite allocations to bypass mobile web-view execution barriers.

import { Howl } from 'howler';

export class AudioController {  
  private static instance: AudioController;  
  private spriteMap: Record\<string, Howl\> \= {};

  private constructor() {}

  public static getInstance(): AudioController {  
    if (\!AudioController.instance) {  
      AudioController.instance \= new AudioController();  
    }  
    return AudioController.instance;  
  }

  public registerPool(key: string, srcPath: string, sprites: Record\<string, \[number, number\]\>): void {  
    this.spriteMap\[key\] \= new Howl({  
      src: \[srcPath\],  
      sprite: sprites,  
      html5: false, // Force Web Audio API for minimal click-to-sound latency  
      preload: true  
    });  
  }

  public play(poolKey: string, spriteName: string): void {  
    const pool \= this.spriteMap\[poolKey\];  
    if (pool) {  
      pool.play(spriteName);  
    } else {  
      console.error(\`Audio pool: ${poolKey} not registered.\`);  
    }  
  }  
}


## **4\. Main Portal Navigation Engine**

---

import { BaseGame } from '../core/BaseGame';

export interface Route {  
  id: string;  
  portal: 'sandbox' | 'workshop' | 'lab';  
  title: string;  
  constructorRef: new (container: HTMLElement) \=\> BaseGame;  
}

export class NavigationController {  
  private container: HTMLElement;  
  private currentActiveGame: BaseGame | null \= null;  
  private routes: Route\[\] \= \[\];

  constructor(appContainer: HTMLElement) {  
    this.container \= appContainer;  
  }

  public register(route: Route): void {  
    this.routes.push(route);  
  }

  public navigateTo(gameId: string): void {  
    const route \= this.routes.find(r \=\> r.id \=== gameId);  
    if (\!route) {  
      console.error(\`Route target: ${gameId} not registered.\`);  
      return;  
    }

    if (this.currentActiveGame) {  
      this.currentActiveGame.destroy();  
      this.currentActiveGame \= null;  
    }

    this.container.innerHTML \= '';  
      
    const gameInstance \= new route.constructorRef(this.container);  
    this.currentActiveGame \= gameInstance;  
      
    gameInstance.load().then(() \=\> {  
      gameInstance.start();  
    }).catch(err \=\> {  
      console.error(\`Error initialization pipeline for: ${gameId}\`, err);  
    });  
  }  
}  
  