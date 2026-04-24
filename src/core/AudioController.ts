import { Howl } from 'howler';

export class AudioController {
  private static instance: AudioController;
  private sounds: Map<string, Howl> = new Map();

  private constructor() {}

  public static getInstance(): AudioController {
    if (!AudioController.instance) {
      AudioController.instance = new AudioController();
    }
    return AudioController.instance;
  }

  public registerSound(id: string, src: string | string[], options?: any) {
    if (!this.sounds.has(id)) {
      this.sounds.set(id, new Howl({ src, ...options }));
    }
  }

  public play(id: string, spriteId?: string) {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.play(spriteId);
    } else {
      console.warn(`Sound '${id}' not found.`);
    }
  }
}
