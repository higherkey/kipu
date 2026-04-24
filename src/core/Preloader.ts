export class Preloader {
  public static async loadAssets(assets: { url: string; type: 'image' | 'audio' }[]): Promise<void> {
    const promises = assets.map(asset => {
      if (asset.type === 'image') {
        return this.loadImage(asset.url);
      } else if (asset.type === 'audio') {
        // Audio preloading typically handled via Howler initialization
        return Promise.resolve();
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  private static loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
}
