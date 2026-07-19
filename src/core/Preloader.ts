export class Preloader {
  public static async loadAssets(assets: { url: string; type: 'image' | 'audio' }[]): Promise<void> {
    const promises = assets.map(asset => {
      if (asset.type === 'image') {
        return this.loadImage(asset.url);
      } else if (asset.type === 'audio') {
        return this.loadAudio(asset.url);
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  private static loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img); // Resolve on error to not block game initialization
      img.src = url;
    });
  }


  private static async loadAudio(url: string): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await res.blob();
    } catch (err) {
      console.warn(`Preloader failed to cache audio: ${url}`, err);
    }
  }
}

