import type { Game } from './Game';
import { NoButtonGame } from '../games/noButton/NoButtonGame';
import { BubbleWrapGame } from '../games/bubbleWrap/BubbleWrapGame';
import { BalloonPopGame } from '../games/balloonPop/BalloonPopGame';
import { ColorMixerGame } from '../games/colorMixer/ColorMixerGame';
import { ColorDropperGame } from '../games/colorDropper/ColorDropperGame';
import { BugCatcherGame } from '../games/bugCatcher/BugCatcherGame';
import { SoundMemoryGame } from '../games/soundMemory/SoundMemoryGame';
import { MarblePipeGame } from '../games/marblePipe/MarblePipeGame';
import { SoundBoardGame } from '../games/soundBoard/SoundBoardGame';
import { ParticlePhysicsGame } from '../games/particlePhysics/ParticlePhysicsGame';
import { SwitchboardGame } from '../games/busyBoard/SwitchboardGame';
import { LuminaryBoardGame } from '../games/busyBoard/LuminaryBoardGame';
import { ToneLuminaryBoardGame } from '../games/busyBoard/ToneLuminaryBoardGame';
import { MechanicalWorkshopGame } from '../games/busyBoard/MechanicalWorkshopGame';
import { CloudShapeGame } from '../games/cloudShape/CloudShapeGame';
import { LiteBriteGame } from '../games/liteBrite/LiteBriteGame';
import { AnimalChoirGame } from '../games/animalChoir/AnimalChoirGame';
import { EquationTowerGame } from '../games/equationTower/EquationTowerGame';
import { VibeCoderGame } from '../games/vibeCoder/VibeCoderGame';
import { TrashSorcererGame } from '../games/trashSorcerer/TrashSorcererGame';
import { KhipuSynthGame } from '../games/khipuSynth/KhipuSynthGame';
import { SoundWaveStudioGame } from '../games/busyBoard/SoundWaveStudioGame';
import { TypographyBoardGame } from '../games/busyBoard/TypographyBoardGame';
import { KineticSandboxGame } from '../games/busyBoard/KineticSandboxGame';
import { PawanaGame } from '../games/pawana/PawanaGame';
import { CameraGame } from '../games/camera/CameraGame';
import { FortressMathGame } from '../games/fortressMath/FortressMathGame';
import { CatQuartersGame } from '../games/catQuarters/CatQuartersGame';

import { ToneGardenGame, PatternLoomGame, TrackSketcherGame } from '../games/musicExperiments/MusicExperiments';

export interface GameRegistration {
  id: string;
  name: string;
  subtitle: string;
  /** Plain one-line "what it is", shown under the name in the game header. */
  tagline?: string;
  portal: 'sandbox' | 'workshop' | 'lab' | 'busyBoard';
  icon: string;
  category: 'sensory' | 'brain' | 'action'; // Legacy v3 categories
  desc: string;
  constructorRef: new () => Game;
}

export class GameRegistry {
  private static instance: GameRegistry;
  private readonly registry: Map<string, GameRegistration> = new Map();

  private constructor() {
    this.registerAll();
  }

  public static getInstance(): GameRegistry {
    if (!GameRegistry.instance) {
      GameRegistry.instance = new GameRegistry();
    }
    return GameRegistry.instance;
  }

  private registerAll() {
    const list: GameRegistration[] = [
      {
        id: 'noButton',
        name: 'Eeno',
        subtitle: 'The "No" Button',
        tagline: 'Say no in many languages',
        portal: 'sandbox',
        icon: 'no',
        category: 'sensory',
        desc: 'Play with funny voices and learn standard words in many languages!',
        constructorRef: NoButtonGame
      },
      {
        id: 'bubbleWrap',
        name: 'Poka',
        subtitle: 'Bubble Wrap',
        tagline: 'Pop the bubbles',
        portal: 'sandbox',
        icon: 'bubble',
        category: 'sensory',
        desc: 'Pop colorful bubbles, hear funny pops, and feel satisfying haptic feedback!',
        constructorRef: BubbleWrapGame
      },
      {
        id: 'balloonPop',
        name: 'Tapa',
        subtitle: 'Balloon Pop',
        tagline: 'Pop the floating balloons',
        portal: 'workshop',
        icon: 'balloon',
        category: 'sensory',
        desc: 'Pop floating balloons of different colors and sizes!',
        constructorRef: BalloonPopGame
      },
      {
        id: 'colorDropper',
        name: 'Sutuy',
        subtitle: 'Color Dropper',
        tagline: 'Drop and merge paint',
        portal: 'workshop',
        icon: 'droplet',
        category: 'brain',
        desc: 'Drop and merge paint drops to mix new colors programmatically!',
        constructorRef: ColorDropperGame
      },
      {
        id: 'colorMixer',
        name: 'Maka',
        subtitle: 'Color Mixer',
        tagline: 'Mix paint with your finger',
        portal: 'workshop', // Maka is Workshop
        icon: 'palette',
        category: 'brain',
        desc: 'Drop paint and mix colors by hand in a satisfying open space!',
        constructorRef: ColorMixerGame
      },
      {
        id: 'bugCatcher',
        name: 'Nuko',
        subtitle: 'Bug Catcher',
        tagline: 'Find the hidden bugs',
        portal: 'workshop',
        icon: 'bug',
        category: 'action',
        desc: 'Find all the hidden bugs in the garden!',
        constructorRef: BugCatcherGame
      },
      {
        id: 'soundMemory',
        name: 'Yuyay',
        subtitle: 'Sound Memory',
        tagline: 'Listen, then repeat the tune',
        portal: 'workshop',
        icon: 'music',
        category: 'brain',
        desc: 'Listen to the musical tones and repeat the sequence from memory!',
        constructorRef: SoundMemoryGame
      },
      {
        id: 'marblePipe',
        name: 'Marble Pipe',
        subtitle: 'Logic Puzzle',
        tagline: 'Build a marble run',
        portal: 'lab',
        icon: 'pipe',
        category: 'brain',
        desc: 'Build your own physics marble run with ramps, boosters, and bumpers!',
        constructorRef: MarblePipeGame
      },
      {
        id: 'soundBoard',
        name: 'Sound Board',
        subtitle: 'Audio Patterns',
        tagline: 'Tap pads to make sounds',
        portal: 'sandbox',
        icon: 'sound',
        category: 'sensory',
        desc: 'Tap color pads to trigger different instruments and tones!',
        constructorRef: SoundBoardGame
      },
      {
        id: 'particlePhysics',
        name: 'Particle Play',
        subtitle: 'Physics Sandbox',
        tagline: 'Draw sparks that fall',
        portal: 'sandbox',
        icon: 'particle',
        category: 'action',
        desc: 'Draw particle fields and watch gravity and physics react to your touch!',
        constructorRef: ParticlePhysicsGame
      },
      {
        id: 'switchboard',
        name: 'The Switchboard',
        subtitle: 'Toggles & Swaps',
        tagline: 'Flip switches and dials',
        portal: 'busyBoard',
        icon: 'settings',
        category: 'sensory',
        desc: 'Explore toggles, dials, breakers, and switches with rich sounds and haptic responses!',
        constructorRef: SwitchboardGame
      },
      {
        id: 'luminaryBoard',
        name: 'The Luminary Board',
        subtitle: 'Dimmers & Color Matrices (Web Audio)',
        tagline: 'Dim and color the lights',
        portal: 'busyBoard',
        icon: 'bulb',
        category: 'sensory',
        desc: 'Interact with dimmers, strobe patterns, halos, and multi-finger color gradients with Web Audio glissando!',
        constructorRef: LuminaryBoardGame
      },
      {
        id: 'luminaryBoardTone',
        name: 'The Luminary Board (Tone.js)',
        subtitle: 'Tone.js Synthesizer Studio',
        tagline: 'Light board with synth sounds',
        portal: 'busyBoard',
        icon: 'bulb',
        category: 'sensory',
        desc: 'Compare Tone.js FM synthesis, AM modulation, and continuous pitch-glide voice engine side-by-side!',
        constructorRef: ToneLuminaryBoardGame
      },
      {
        id: 'mechanicalWorkshop',
        name: 'The Mechanical Workshop',
        subtitle: 'Latches, Links, & Gears',
        tagline: 'Gears, latches and locks',
        portal: 'busyBoard',
        icon: 'settings', // Reusing settings icon
        category: 'sensory',
        desc: 'Spin interlocking gears, plug stereo cords, drag latches, and twist combination tumblers!',
        constructorRef: MechanicalWorkshopGame
      },
      {
        id: 'cloudShape',
        name: 'Cloud Shape Finder',
        subtitle: 'Procedural Sky & Animals',
        tagline: 'Turn clouds into animals',
        portal: 'sandbox',
        icon: 'cloud',
        category: 'sensory',
        desc: 'Tap and trace soft puffy clouds to morph them into cute animal outlines!',
        constructorRef: CloudShapeGame
      },
      {
        id: 'liteBrite',
        name: 'Digital Lite Brite',
        subtitle: 'Glowing Peg Matrix',
        tagline: 'Make art with glowing pegs',
        portal: 'workshop',
        icon: 'sparkles',
        category: 'sensory',
        desc: 'Trace templates and design glowing neon art with colorful acrylic pegs!',
        constructorRef: LiteBriteGame
      },
      {
        id: 'animalChoir',
        name: 'Animal Choir',
        subtitle: 'Rhythm Grid Sequencer',
        tagline: 'Make songs with animals',
        portal: 'workshop',
        icon: 'music',
        category: 'brain',
        desc: 'Create rhythmic songs with a grid of singing animal cards!',
        constructorRef: AnimalChoirGame
      },
      {
        id: 'equationTower',
        name: 'Equation Tower',
        subtitle: 'Physics Math Balance',
        tagline: 'Stack blocks to reach the line',
        portal: 'lab',
        icon: 'layers',
        category: 'brain',
        desc: 'Each block is as tall as its number. Stack them to reach the line!',
        constructorRef: EquationTowerGame
      },
      {
        id: 'vibeCoder',
        name: 'Vibe Coder',
        subtitle: 'Visual Logic Pathfinding',
        tagline: 'Guide your friend with arrows',
        portal: 'lab',
        icon: 'code',
        category: 'brain',
        desc: 'Queue step arrows to guide your character through mazes to collect treats!',
        constructorRef: VibeCoderGame
      },
      {
        id: 'trashSorcerer',
        name: 'Trash Sorcerer',
        subtitle: 'Physics Flick Sorting',
        tagline: 'Sort the trash into portals',
        portal: 'lab',
        icon: 'trash',
        category: 'action',
        desc: 'Flick items into magic recycling, compost, and trash portals!',
        constructorRef: TrashSorcererGame
      },
      {
        id: 'khipuSynth',
        name: 'Khipu Synth',
        subtitle: '8-Track Loop & Music Studio',
        tagline: 'Make looping music',
        portal: 'lab',
        icon: 'sliders',
        category: 'brain',
        desc: 'Build 8-track loop sequences, customize instruments and BPM, and record audio!',
        constructorRef: KhipuSynthGame
      },
      {
        id: 'toneGarden',
        name: 'Tone Garden',
        subtitle: 'Tap-to-Play Sound Grid',
        tagline: 'Tap blooms to hear sounds',
        portal: 'workshop',
        icon: 'music',
        category: 'sensory',
        desc: 'Tap colorful blooms to explore four different sound shapes.',
        constructorRef: ToneGardenGame
      },
      {
        id: 'patternLoom',
        name: 'Pattern Loom',
        subtitle: 'Looping Step Experiment',
        tagline: 'Build a looping beat',
        portal: 'lab',
        icon: 'music',
        category: 'brain',
        desc: 'Switch steps on and listen as a two-lane loop takes shape.',
        constructorRef: PatternLoomGame
      },
      {
        id: 'trackSketcher',
        name: 'Track Sketcher',
        subtitle: 'Local Timeline Experiment',
        tagline: 'Sketch a tune on a timeline',
        portal: 'lab',
        icon: 'sliders',
        category: 'brain',
        desc: 'Tap notes onto a timeline and return to your locally saved sketch.',
        constructorRef: TrackSketcherGame
      },
      {
        id: 'soundWaveStudio',
        name: 'Sound & Wave Studio',
        subtitle: 'Acoustic Mechanics',
        tagline: 'Bend pitch and sound',
        portal: 'busyBoard',
        icon: 'activity',
        category: 'sensory',
        desc: 'Explore pitch ribbons, siren handles, formant shifters, morse keys, and plungers!',
        constructorRef: SoundWaveStudioGame
      },
      {
        id: 'typographyBoard',
        name: 'Typography & Interface',
        subtitle: 'Tactile Text Controls',
        tagline: 'Play with letters and words',
        portal: 'busyBoard',
        icon: 'type',
        category: 'sensory',
        desc: 'Interact with odometer tumblers, font weight sliders, word gravity, and case toggles!',
        constructorRef: TypographyBoardGame
      },
      {
        id: 'kineticSandbox',
        name: 'Kinetic Sandbox',
        subtitle: 'Physics-Lite Vectors',
        tagline: 'Pendulums, sand and pegs',
        portal: 'busyBoard',
        icon: 'particle',
        category: 'sensory',
        desc: 'Explore pendulums, pinwheels, hourglass sand, plinko pegs, Newton\'s cradle, and pneumatic bellows!',
        constructorRef: KineticSandboxGame
      },
      {
        id: 'pawana',
        name: 'Pawana',
        subtitle: 'Logic Flight Path',
        tagline: 'Fly through logic gates',
        portal: 'lab',
        icon: 'feather',
        category: 'brain',
        desc: 'Navigate aerial logic gates and sequence pathways in this educational flight challenge!',
        constructorRef: PawanaGame
      },
      {
        id: 'fortressMath',
        name: 'Fortress Math',
        subtitle: 'Count, Plan & Capture',
        tagline: 'Count and grow your kingdom',
        portal: 'lab',
        icon: 'layers',
        category: 'brain',
        desc: 'Add up defenses, send explorers, and grow your kingdom against two friendly bots.',
        constructorRef: FortressMathGame
      },
      {
        id: 'catQuarters',
        name: 'Cat Quarters',
        subtitle: 'Cat Placement Puzzle',
        tagline: 'Place cats so none touch',
        portal: 'lab',
        icon: 'cat',
        category: 'brain',
        desc: 'Find a spot for each cat without letting any two cats touch.',
        constructorRef: CatQuartersGame
      },
      {
        id: 'camera',
        name: 'Cam',
        subtitle: 'Fun Photo Studio',
        tagline: 'Silly photos and stickers',
        portal: 'workshop',
        icon: 'camera',
        category: 'sensory',
        desc: 'Take silly photos with fun filters, add cute stickers, and doodle with colorful crayons!',
        constructorRef: CameraGame
      }
    ];

    list.forEach(game => this.registry.set(game.id, game));
  }

  public get(id: string): GameRegistration | undefined {
    return this.registry.get(id);
  }

  public getAll(): GameRegistration[] {
    return Array.from(this.registry.values());
  }

  public getIds(): string[] {
    return Array.from(this.registry.keys());
  }

  public getByPortal(portal: 'sandbox' | 'workshop' | 'lab' | 'busyBoard'): GameRegistration[] {
    return this.getAll().filter(game => game.portal === portal);
  }

  public getByCategory(category: 'sensory' | 'brain' | 'action'): GameRegistration[] {
    return this.getAll().filter(game => game.category === category);
  }
}
