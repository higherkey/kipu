import { BaseGame } from '../../core/BaseGame';
import './CameraGame.css';

export type CameraFilter = 'normal' | 'sepia' | 'invert' | 'comic';
export type CreativeTool = 'crayons' | 'stickers';
export type StickerType = 'star' | 'heart' | 'glasses' | 'crown' | 'flower' | 'sparkles';

export interface PlacedSticker {
  id: string;
  type: StickerType;
  x: number;
  y: number;
  size: number;
  rotation: number;
}

export class CameraGame extends BaseGame {
  // Game state
  private state: 'viewfinder' | 'edit' = 'viewfinder';
  private currentFilter: CameraFilter = 'normal';
  private activeTool: CreativeTool = 'crayons';
  private selectedCrayonColor: string = '#FF3B30';
  private isEraserActive: boolean = false;
  private selectedStickerType: StickerType = 'star';

  // Hardware Media Stream & Video
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isUsingSimulatedStream: boolean = false;
  private isDestroyed: boolean = false;

  // Offscreen Buffers
  private photoCanvas: HTMLCanvasElement | null = null;
  private photoCtx: CanvasRenderingContext2D | null = null;
  private doodleCanvas: HTMLCanvasElement | null = null;
  private doodleCtx: CanvasRenderingContext2D | null = null;
  private simulatedCanvas: HTMLCanvasElement | null = null;
  private simulatedCtx: CanvasRenderingContext2D | null = null;

  // Visual Effects & Animation
  private flashAlpha: number = 0;
  private simulatedTime: number = 0;
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;

  // Doodling & Sticker State
  private isPointerDown: boolean = false;
  private lastPointerPos = { x: 0, y: 0 };
  private placedStickers: PlacedSticker[] = [];
  private draggedStickerIndex: number = -1;

  // DOM Overlay Controls
  private overlayContainer: HTMLDivElement | null = null;

  // Bound Event Listeners for clean teardown
  private onPointerDownBound: ((e: PointerEvent) => void) | null = null;
  private onPointerMoveBound: ((e: PointerEvent) => void) | null = null;
  private onPointerUpBound: (() => void) | null = null;

  constructor() {
    super();
  }

  protected onInit(): void {
    if (!this.canvas) return;
    this.isDestroyed = false;

    // 1. Initialize Offscreen Buffers
    this.initBuffers();

    // 2. Mount DOM Controls Overlay
    this.mountOverlay();

    // 3. Bind Input Event Listeners
    this.bindCanvasEvents();

    // 4. Request Camera MediaStream with graceful simulated fallback
    this.initCamera();
  }

  private initBuffers(): void {
    const width = this.canvas?.width || 800;
    const height = this.canvas?.height || 600;

    this.photoCanvas = document.createElement('canvas');
    this.photoCanvas.width = width;
    this.photoCanvas.height = height;
    this.photoCtx = this.photoCanvas.getContext('2d');

    this.doodleCanvas = document.createElement('canvas');
    this.doodleCanvas.width = width;
    this.doodleCanvas.height = height;
    this.doodleCtx = this.doodleCanvas.getContext('2d');

    this.simulatedCanvas = document.createElement('canvas');
    this.simulatedCanvas.width = 640;
    this.simulatedCanvas.height = 480;
    this.simulatedCtx = this.simulatedCanvas.getContext('2d');
  }

  private async initCamera(): Promise<void> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      this.initSimulatedStream();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (this.isDestroyed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.mediaStream = stream;
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.setAttribute('playsinline', '');
      this.videoElement.setAttribute('webkit-playsinline', '');
      this.videoElement.srcObject = stream;

      if (typeof this.videoElement.play === 'function') {
        try {
          const playPromise = this.videoElement.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            await playPromise.catch(() => {});
          }
        } catch {
          // Gracefully ignore not-implemented in headless / JSDOM
        }
      }

      this.isUsingSimulatedStream = false;
      this.updateStatusBadge('Camera Active', false);
    } catch {
      this.initSimulatedStream();
    }
  }

  private initSimulatedStream(): void {
    this.isUsingSimulatedStream = true;
    this.mediaStream = null;
    this.simulatedTime = 0;
    this.updateStatusBadge('Simulated Camera', true);
  }

  private updateStatusBadge(text: string, isSimulated: boolean): void {
    const badgeText = this.overlayContainer?.querySelector('#camera-status-text');
    const badgeDot = this.overlayContainer?.querySelector('.badge-dot');
    if (badgeText) badgeText.textContent = text;
    if (badgeDot) {
      badgeDot.classList.toggle('simulated', isSimulated);
    }
  }

  private mountOverlay(): void {
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.className = 'camera-game-overlay';
    this.overlayContainer.id = 'camera-overlay';

    this.overlayContainer.innerHTML = `
      <header class="camera-top-bar" id="camera-top-bar">
        <div class="camera-filters-group" id="camera-filters-group">
          <button class="camera-filter-btn active" data-filter="normal" aria-label="Normal Filter">Normal</button>
          <button class="camera-filter-btn" data-filter="sepia" aria-label="Sepia Filter">Sepia</button>
          <button class="camera-filter-btn" data-filter="invert" aria-label="Invert Filter">Invert</button>
          <button class="camera-filter-btn" data-filter="comic" aria-label="Comic Filter">Comic</button>
        </div>
        <div class="camera-actions-group hidden" id="camera-actions-group">
          <button class="camera-action-btn camera-retake-btn" id="camera-retake-btn" aria-label="Retake Photo">
            <span class="btn-icon">↺</span> Retake
          </button>
          <button class="camera-action-btn camera-clear-btn" id="camera-clear-btn" aria-label="Clear Doodles">
            <span class="btn-icon">🗑️</span> Clear
          </button>
          <button class="camera-action-btn camera-save-btn" id="camera-save-btn" aria-label="Save Photo">
            <span class="btn-icon">💾</span> Save
          </button>
        </div>
      </header>

      <div class="camera-status-badge" id="camera-status-badge" aria-live="polite">
        <span class="badge-dot"></span>
        <span class="badge-text" id="camera-status-text">Loading...</span>
      </div>

      <footer class="camera-bottom-bar" id="camera-bottom-bar">
        <div class="camera-shutter-group" id="camera-shutter-group">
          <button class="camera-shutter-btn" id="camera-shutter-btn" aria-label="Take Photo">
            <span class="shutter-inner"></span>
          </button>
        </div>

        <div class="camera-tools-group hidden" id="camera-tools-group">
          <div class="camera-tool-tabs">
            <button class="camera-tab-btn active" id="tab-crayons" data-tool="crayons" aria-label="Crayons">🎨 Crayons</button>
            <button class="camera-tab-btn" id="tab-stickers" data-tool="stickers" aria-label="Stickers">⭐ Stickers</button>
          </div>

          <div class="camera-palette-row" id="camera-crayons-palette">
            <button class="crayon-swatch-btn swatch-red active" data-color="#FF3B30" aria-label="Red Crayon"></button>
            <button class="crayon-swatch-btn swatch-yellow" data-color="#FFCC00" aria-label="Yellow Crayon"></button>
            <button class="crayon-swatch-btn swatch-green" data-color="#34C759" aria-label="Green Crayon"></button>
            <button class="crayon-swatch-btn swatch-blue" data-color="#007AFF" aria-label="Blue Crayon"></button>
            <button class="crayon-swatch-btn swatch-purple" data-color="#AF52DE" aria-label="Purple Crayon"></button>
            <button class="crayon-swatch-btn eraser-btn" data-color="eraser" aria-label="Eraser">🧼</button>
          </div>

          <div class="camera-palette-row hidden" id="camera-stickers-palette">
            <button class="sticker-select-btn active" data-sticker="star" aria-label="Star Sticker">⭐</button>
            <button class="sticker-select-btn" data-sticker="heart" aria-label="Heart Sticker">❤️</button>
            <button class="sticker-select-btn" data-sticker="glasses" aria-label="Glasses Sticker">🕶️</button>
            <button class="sticker-select-btn" data-sticker="crown" aria-label="Crown Sticker">👑</button>
            <button class="sticker-select-btn" data-sticker="flower" aria-label="Flower Sticker">🌸</button>
            <button class="sticker-select-btn" data-sticker="sparkles" aria-label="Sparkles Sticker">✨</button>
          </div>
        </div>
      </footer>
    `;

    const parent = this.canvas?.parentElement || document.body;
    parent.appendChild(this.overlayContainer);

    this.bindOverlayEvents();
  }

  private bindOverlayEvents(): void {
    if (!this.overlayContainer) return;

    // Filter Buttons
    this.overlayContainer.querySelectorAll('.camera-filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const filter = (e.currentTarget as HTMLElement).dataset.filter as CameraFilter;
        if (filter) this.setFilter(filter);
      });
    });

    // Shutter Button
    const shutterBtn = this.overlayContainer.querySelector('#camera-shutter-btn');
    shutterBtn?.addEventListener('click', () => this.takePhoto());

    // Retake Button
    const retakeBtn = this.overlayContainer.querySelector('#camera-retake-btn');
    retakeBtn?.addEventListener('click', () => this.retakePhoto());

    // Clear Button
    const clearBtn = this.overlayContainer.querySelector('#camera-clear-btn');
    clearBtn?.addEventListener('click', () => this.clearDoodles());

    // Save Button
    const saveBtn = this.overlayContainer.querySelector('#camera-save-btn');
    saveBtn?.addEventListener('click', () => this.savePhoto());

    // Tool Tabs
    const tabCrayons = this.overlayContainer.querySelector('#tab-crayons');
    const tabStickers = this.overlayContainer.querySelector('#tab-stickers');
    tabCrayons?.addEventListener('click', () => this.setActiveTool('crayons'));
    tabStickers?.addEventListener('click', () => this.setActiveTool('stickers'));

    // Crayon Swatches
    this.overlayContainer.querySelectorAll('.crayon-swatch-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const color = target.dataset.color;
        if (color === 'eraser') {
          this.isEraserActive = true;
        } else if (color) {
          this.isEraserActive = false;
          this.selectedCrayonColor = color;
        }
        this.overlayContainer?.querySelectorAll('.crayon-swatch-btn').forEach((b) => b.classList.remove('active'));
        target.classList.add('active');
        this.haptics.lightTap();
      });
    });

    // Sticker Selection
    this.overlayContainer.querySelectorAll('.sticker-select-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const sticker = target.dataset.sticker as StickerType;
        if (sticker) {
          this.selectedStickerType = sticker;
          this.overlayContainer?.querySelectorAll('.sticker-select-btn').forEach((b) => b.classList.remove('active'));
          target.classList.add('active');
          this.haptics.lightTap();
        }
      });
    });
  }

  private bindCanvasEvents(): void {
    if (!this.canvas) return;

    this.onPointerDownBound = (e: PointerEvent) => this.handlePointerDown(e);
    this.onPointerMoveBound = (e: PointerEvent) => this.handlePointerMove(e);
    this.onPointerUpBound = () => this.handlePointerUp();

    this.canvas.addEventListener('pointerdown', this.onPointerDownBound);
    this.canvas.addEventListener('pointermove', this.onPointerMoveBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('pointercancel', this.onPointerUpBound);
  }

  // --- Filter Logic ---

  public setFilter(filter: CameraFilter): void {
    this.currentFilter = filter;
    this.haptics.lightTap();

    if (this.overlayContainer) {
      this.overlayContainer.querySelectorAll('.camera-filter-btn').forEach((btn) => {
        const isActive = (btn as HTMLElement).dataset.filter === filter;
        btn.classList.toggle('active', isActive);
      });
    }
  }

  public getFilter(): CameraFilter {
    return this.currentFilter;
  }

  private getFilterCss(filter: CameraFilter): string {
    switch (filter) {
      case 'sepia':
        return 'sepia(0.85) contrast(1.1) brightness(0.95)';
      case 'invert':
        return 'invert(1)';
      case 'comic':
        return 'contrast(1.6) saturate(1.8) hue-rotate(15deg)';
      case 'normal':
      default:
        return 'none';
    }
  }

  public applySoftwareFilter(ctx: CanvasRenderingContext2D, width: number, height: number, filter: CameraFilter): void {
    if (filter === 'normal') return;
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const len = d.length;

      if (filter === 'sepia') {
        for (let i = 0; i < len; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          d[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
          d[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
          d[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
        }
      } else if (filter === 'invert') {
        for (let i = 0; i < len; i += 4) {
          d[i] = 255 - d[i];
          d[i + 1] = 255 - d[i + 1];
          d[i + 2] = 255 - d[i + 2];
        }
      } else if (filter === 'comic') {
        for (let i = 0; i < len; i += 4) {
          d[i] = Math.min(255, Math.floor(d[i] / 64) * 85);
          d[i + 1] = Math.min(255, Math.floor(d[i + 1] / 64) * 85);
          d[i + 2] = Math.min(255, Math.floor(d[i + 2] / 64) * 85);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Gracefully ignore in restricted / mock contexts
    }
  }

  // --- Shutter & Photo Capture ---

  public takePhoto(): void {
    if (this.state !== 'viewfinder' || !this.photoCanvas || !this.photoCtx || !this.canvas) return;

    // 1. Audio & Haptics Feedback
    this.playShutterAudio();
    this.haptics.heavyImpact();

    // 2. Trigger Flash Overlay
    this.flashAlpha = 1.0;

    // 3. Freeze Current Video Frame onto photoCanvas
    const w = this.photoCanvas.width;
    const h = this.photoCanvas.height;

    this.photoCtx.save();
    this.photoCtx.clearRect(0, 0, w, h);

    if (this.currentFilter !== 'normal') {
      this.photoCtx.filter = this.getFilterCss(this.currentFilter);
    }

    // Mirror horizontally to match live selfie view
    this.photoCtx.translate(w, 0);
    this.photoCtx.scale(-1, 1);

    if (!this.isUsingSimulatedStream && this.videoElement && this.videoElement.videoWidth > 0) {
      this.photoCtx.drawImage(this.videoElement, 0, 0, w, h);
    } else if (this.simulatedCanvas) {
      this.photoCtx.drawImage(this.simulatedCanvas, 0, 0, w, h);
    }

    this.photoCtx.restore();

    // Apply software pixel fallback for test environments where ctx.filter is ignored
    this.applySoftwareFilter(this.photoCtx, w, h, this.currentFilter);

    // 4. Transition State to 'edit'
    this.state = 'edit';
    this.updateUIMode();
  }

  private playShutterAudio(): void {
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    if (!soundEnabled) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Click 1 (shutter open)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1400, now);
      osc1.frequency.exponentialRampToValueAtTime(350, now + 0.035);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.04);

      // Click 2 (shutter close, 65ms later)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(950, now + 0.065);
      osc2.frequency.exponentialRampToValueAtTime(180, now + 0.11);
      gain2.gain.setValueAtTime(0.28, now + 0.065);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.065);
      osc2.stop(now + 0.12);
    } catch {
      this.audio.play('synth:click', 1000);
    }
  }

  public retakePhoto(): void {
    this.state = 'viewfinder';
    this.clearDoodles();
    this.updateUIMode();
    this.haptics.lightTap();
  }

  public clearDoodles(): void {
    if (this.doodleCanvas && this.doodleCtx) {
      this.doodleCtx.clearRect(0, 0, this.doodleCanvas.width, this.doodleCanvas.height);
    }
    this.placedStickers = [];
    this.haptics.lightTap();
  }

  public savePhoto(): void {
    if (!this.photoCanvas || !this.canvas) return;

    // Composite export canvas: Photo + Doodles + Vector Stickers
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.photoCanvas.width;
    exportCanvas.height = this.photoCanvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    // 1. Draw photo
    exportCtx.drawImage(this.photoCanvas, 0, 0);

    // 2. Draw doodles
    if (this.doodleCanvas) {
      exportCtx.drawImage(this.doodleCanvas, 0, 0);
    }

    // 3. Draw placed stickers
    this.placedStickers.forEach((st) => {
      this.renderVectorSticker(exportCtx, st.type, st.x, st.y, st.size);
    });

    // 4. Trigger 100% Local Download (Zero network upload)
    try {
      const dataUrl = exportCanvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `kipu-photo-${Date.now()}.png`;
      downloadLink.href = dataUrl;
      downloadLink.click();

      this.audio.play('synth:bell', 880);
      this.haptics.heavyImpact();
    } catch (err) {
      console.warn('Local photo download failed:', err);
    }
  }

  private updateUIMode(): void {
    if (!this.overlayContainer) return;

    const isEdit = this.state === 'edit';
    this.overlayContainer.querySelector('#camera-filters-group')?.classList.toggle('hidden', isEdit);
    this.overlayContainer.querySelector('#camera-actions-group')?.classList.toggle('hidden', !isEdit);
    this.overlayContainer.querySelector('#camera-shutter-group')?.classList.toggle('hidden', isEdit);
    this.overlayContainer.querySelector('#camera-tools-group')?.classList.toggle('hidden', !isEdit);
  }

  public setActiveTool(tool: CreativeTool): void {
    this.activeTool = tool;
    this.haptics.lightTap();

    if (!this.overlayContainer) return;
    this.overlayContainer.querySelector('#tab-crayons')?.classList.toggle('active', tool === 'crayons');
    this.overlayContainer.querySelector('#tab-stickers')?.classList.toggle('active', tool === 'stickers');

    this.overlayContainer.querySelector('#camera-crayons-palette')?.classList.toggle('hidden', tool !== 'crayons');
    this.overlayContainer.querySelector('#camera-stickers-palette')?.classList.toggle('hidden', tool !== 'stickers');
  }

  // --- Pointer & Touch Drawing Handlers ---

  private getCanvasCoords(e: PointerEvent): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / (rect.width || 1);
    const scaleY = this.canvas.height / (rect.height || 1);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  private handlePointerDown(e: PointerEvent): void {
    if (this.state !== 'edit') return;
    const pos = this.getCanvasCoords(e);
    this.isPointerDown = true;
    this.lastPointerPos = pos;

    if (this.activeTool === 'stickers') {
      // Hit test existing stickers for dragging
      const hitIdx = this.placedStickers.findIndex((st) => {
        const dx = st.x - pos.x;
        const dy = st.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= st.size * 0.75;
      });

      if (hitIdx !== -1) {
        this.draggedStickerIndex = hitIdx;
      } else {
        // Stamp new sticker
        this.addSticker(this.selectedStickerType, pos.x, pos.y);
      }
    } else {
      // Start crayon stroke
      this.drawCrayonPoint(pos.x, pos.y);
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isPointerDown || this.state !== 'edit') return;
    const pos = this.getCanvasCoords(e);

    if (this.activeTool === 'stickers') {
      if (this.draggedStickerIndex !== -1 && this.placedStickers[this.draggedStickerIndex]) {
        this.placedStickers[this.draggedStickerIndex].x = pos.x;
        this.placedStickers[this.draggedStickerIndex].y = pos.y;
      }
    } else {
      // Draw crayon segment
      this.drawCrayonLine(this.lastPointerPos.x, this.lastPointerPos.y, pos.x, pos.y);
    }

    this.lastPointerPos = pos;
  }

  private handlePointerUp(): void {
    this.isPointerDown = false;
    this.draggedStickerIndex = -1;
  }

  private drawCrayonPoint(x: number, y: number): void {
    if (!this.doodleCtx) return;
    this.doodleCtx.save();
    if (this.isEraserActive) {
      this.doodleCtx.globalCompositeOperation = 'destination-out';
      this.doodleCtx.beginPath();
      this.doodleCtx.arc(x, y, 20, 0, Math.PI * 2);
      this.doodleCtx.fill();
    } else {
      this.doodleCtx.globalCompositeOperation = 'source-over';
      this.doodleCtx.fillStyle = this.selectedCrayonColor;
      this.doodleCtx.beginPath();
      this.doodleCtx.arc(x, y, 5, 0, Math.PI * 2);
      this.doodleCtx.fill();
    }
    this.doodleCtx.restore();
  }

  private drawCrayonLine(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.doodleCtx) return;
    this.doodleCtx.save();
    if (this.isEraserActive) {
      this.doodleCtx.globalCompositeOperation = 'destination-out';
      this.doodleCtx.lineWidth = 36;
    } else {
      this.doodleCtx.globalCompositeOperation = 'source-over';
      this.doodleCtx.strokeStyle = this.selectedCrayonColor;
      this.doodleCtx.lineWidth = 10;
    }
    this.doodleCtx.lineCap = 'round';
    this.doodleCtx.lineJoin = 'round';
    this.doodleCtx.beginPath();
    this.doodleCtx.moveTo(x1, y1);
    this.doodleCtx.lineTo(x2, y2);
    this.doodleCtx.stroke();
    this.doodleCtx.restore();
  }

  public addSticker(type: StickerType, x: number, y: number): void {
    this.placedStickers.push({
      id: `sticker-${Date.now()}-${Math.random()}`,
      type,
      x,
      y,
      size: 48,
      rotation: 0,
    });
    this.audio.play('synth:click', 900);
    this.haptics.lightTap();
  }

  public getPlacedStickers(): PlacedSticker[] {
    return this.placedStickers;
  }

  public getState(): 'viewfinder' | 'edit' {
    return this.state;
  }

  public isUsingMockStream(): boolean {
    return this.isUsingSimulatedStream;
  }

  public getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  // --- Procedural Simulated Canvas Stream ---

  private renderSimulatedFrame(dt: number): void {
    if (!this.simulatedCanvas || !this.simulatedCtx) return;
    const ctx = this.simulatedCtx;
    const w = this.simulatedCanvas.width;
    const h = this.simulatedCanvas.height;

    this.simulatedTime += dt;
    this.blinkTimer += dt;
    if (this.blinkTimer > 3500) {
      this.isBlinking = true;
      if (this.blinkTimer > 3700) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
    }

    // 1. Animated Gradient Background
    const grad = ctx.createLinearGradient(0, 0, w, h);
    const hueOffset = (this.simulatedTime * 0.02) % 360;
    grad.addColorStop(0, `hsl(${hueOffset}, 70%, 85%)`);
    grad.addColorStop(1, `hsl(${(hueOffset + 60) % 360}, 75%, 80%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Friendly Animated Mascot Companion (Eeno mascot)
    const floatY = h / 2 + Math.sin(this.simulatedTime * 0.003) * 16;
    const centerX = w / 2;

    // Mascot Body
    ctx.fillStyle = '#FFD166';
    ctx.beginPath();
    ctx.arc(centerX, floatY, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#F4A261';
    ctx.stroke();

    // Rosy Cheeks
    ctx.fillStyle = '#FFAAA6';
    ctx.beginPath();
    ctx.arc(centerX - 48, floatY + 18, 16, 0, Math.PI * 2);
    ctx.arc(centerX + 48, floatY + 18, 16, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#264653';
    if (this.isBlinking) {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 42, floatY - 10);
      ctx.lineTo(centerX - 18, floatY - 10);
      ctx.moveTo(centerX + 18, floatY - 10);
      ctx.lineTo(centerX + 42, floatY - 10);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(centerX - 30, floatY - 10, 10, 0, Math.PI * 2);
      ctx.arc(centerX + 30, floatY - 10, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cheerful Smile
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#264653';
    ctx.beginPath();
    ctx.arc(centerX, floatY + 10, 24, 0.2, Math.PI - 0.2, false);
    ctx.stroke();
  }

  // --- Vector Sticker Rendering ---

  private renderVectorSticker(ctx: CanvasRenderingContext2D, type: StickerType, x: number, y: number, size: number): void {
    ctx.save();
    ctx.translate(x, y);

    switch (type) {
      case 'star': {
        const spikes = 5;
        const outer = size * 0.6;
        const inner = size * 0.28;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outer : inner;
          const a = (i * Math.PI) / spikes - Math.PI / 2;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#FFD166';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#E76F51';
        ctx.stroke();
        break;
      }
      case 'heart': {
        const s = size * 0.035;
        ctx.beginPath();
        ctx.moveTo(0, 5 * s);
        ctx.bezierCurveTo(-15 * s, -15 * s, -30 * s, 10 * s, 0, 30 * s);
        ctx.bezierCurveTo(30 * s, 10 * s, 15 * s, -15 * s, 0, 5 * s);
        ctx.fillStyle = '#EF476F';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#B5179E';
        ctx.stroke();
        break;
      }
      case 'glasses': {
        ctx.fillStyle = '#118AB2';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#073B4C';
        // Left & right frame
        ctx.strokeRect(-size * 0.6, -size * 0.25, size * 0.5, size * 0.4);
        ctx.fillRect(-size * 0.6, -size * 0.25, size * 0.5, size * 0.4);
        ctx.strokeRect(size * 0.1, -size * 0.25, size * 0.5, size * 0.4);
        ctx.fillRect(size * 0.1, -size * 0.25, size * 0.5, size * 0.4);
        // Bridge
        ctx.beginPath();
        ctx.moveTo(-size * 0.1, -size * 0.05);
        ctx.lineTo(size * 0.1, -size * 0.05);
        ctx.stroke();
        break;
      }
      case 'crown': {
        const w = size * 0.6;
        const h = size * 0.45;
        ctx.beginPath();
        ctx.moveTo(-w, h);
        ctx.lineTo(-w, -h * 0.4);
        ctx.lineTo(-w * 0.5, 0);
        ctx.lineTo(0, -h);
        ctx.lineTo(w * 0.5, 0);
        ctx.lineTo(w, -h * 0.4);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = '#FFB703';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FB8500';
        ctx.stroke();
        break;
      }
      case 'flower': {
        const petals = 6;
        for (let i = 0; i < petals; i++) {
          const a = (i * Math.PI * 2) / petals;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * (size * 0.25), Math.sin(a) * (size * 0.25), size * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#FF9BB2';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD166';
        ctx.fill();
        break;
      }
      case 'sparkles': {
        for (let j = 0; j < 3; j++) {
          const ox = (j - 1) * (size * 0.35);
          const oy = (j % 2 === 0 ? -1 : 1) * (size * 0.2);
          const r = size * 0.2;
          ctx.beginPath();
          ctx.moveTo(ox, oy - r);
          ctx.quadraticCurveTo(ox, oy, ox + r, oy);
          ctx.quadraticCurveTo(ox, oy, ox, oy + r);
          ctx.quadraticCurveTo(ox, oy, ox - r, oy);
          ctx.quadraticCurveTo(ox, oy, ox, oy - r);
          ctx.fillStyle = '#06D6A0';
          ctx.fill();
        }
        break;
      }
    }

    ctx.restore();
  }

  // --- Main Game Loop ---

  public update(dt: number): void {
    if (!this.canvas || !this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Clear Canvas
    this.ctx.clearRect(0, 0, w, h);

    if (this.state === 'viewfinder') {
      // Update simulated frame if running in mock/fallback mode
      if (this.isUsingSimulatedStream) {
        this.renderSimulatedFrame(dt);
      }

      this.ctx.save();
      // Apply active visual filter
      if (this.currentFilter !== 'normal') {
        this.ctx.filter = this.getFilterCss(this.currentFilter);
      }

      // Horizontal flip for front-facing mirror effect
      this.ctx.translate(w, 0);
      this.ctx.scale(-1, 1);

      if (!this.isUsingSimulatedStream && this.videoElement && this.videoElement.videoWidth > 0) {
        this.ctx.drawImage(this.videoElement, 0, 0, w, h);
      } else if (this.simulatedCanvas) {
        this.ctx.drawImage(this.simulatedCanvas, 0, 0, w, h);
      }
      this.ctx.restore();
    } else {
      // Photo Edit Mode: Render frozen photo
      if (this.photoCanvas) {
        this.ctx.drawImage(this.photoCanvas, 0, 0, w, h);
      }

      // Render Crayon Doodles
      if (this.doodleCanvas) {
        this.ctx.drawImage(this.doodleCanvas, 0, 0, w, h);
      }

      // Render Placed Vector Stickers
      this.placedStickers.forEach((st) => {
        this.renderVectorSticker(this.ctx!, st.type, st.x, st.y, st.size);
      });
    }

    // 2. Decaying Shutter Flash Effect
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt / 150);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  public resize(width: number, height: number): void {
    if (this.photoCanvas && this.doodleCanvas) {
      // Preserve existing captured photo & doodles across resize
      const tempPhoto = document.createElement('canvas');
      tempPhoto.width = this.photoCanvas.width;
      tempPhoto.height = this.photoCanvas.height;
      tempPhoto.getContext('2d')?.drawImage(this.photoCanvas, 0, 0);

      const tempDoodle = document.createElement('canvas');
      tempDoodle.width = this.doodleCanvas.width;
      tempDoodle.height = this.doodleCanvas.height;
      tempDoodle.getContext('2d')?.drawImage(this.doodleCanvas, 0, 0);

      this.photoCanvas.width = width;
      this.photoCanvas.height = height;
      this.photoCtx?.drawImage(tempPhoto, 0, 0, width, height);

      this.doodleCanvas.width = width;
      this.doodleCanvas.height = height;
      this.doodleCtx?.drawImage(tempDoodle, 0, 0, width, height);
    }
  }

  public pause(): void {
    if (this.videoElement && !this.videoElement.paused) {
      this.videoElement.pause();
    }
  }

  public resume(): void {
    if (this.videoElement && this.videoElement.paused && this.mediaStream) {
      this.videoElement.play().catch(() => {});
    }
  }

  // --- Teardown & Lifecycle ---

  public destroy(): void {
    this.isDestroyed = true;

    // 1. Release MediaStream Tracks (Crucial: turns off camera hardware LED!)
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }

    // 2. Detach and remove HTMLVideoElement
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.remove();
      this.videoElement = null;
    }

    // 3. Remove DOM Overlay
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }

    // 4. Remove Canvas Listeners
    if (this.canvas) {
      if (this.onPointerDownBound) this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
      if (this.onPointerMoveBound) this.canvas.removeEventListener('pointermove', this.onPointerMoveBound);
    }
    if (this.onPointerUpBound) {
      window.removeEventListener('pointerup', this.onPointerUpBound);
      window.removeEventListener('pointercancel', this.onPointerUpBound);
    }

    // 5. Clean up offscreen canvases
    this.photoCanvas = null;
    this.photoCtx = null;
    this.doodleCanvas = null;
    this.doodleCtx = null;
    this.simulatedCanvas = null;
    this.simulatedCtx = null;
    this.placedStickers = [];
  }
}
