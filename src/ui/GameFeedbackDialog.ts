import { saveGameFeedback } from '../core/GameFeedbackStore';
import './GameFeedbackDialog.css';

interface GameFeedbackDialogConfig {
  gameId: string;
  gameName: string;
  onClose: () => void;
}

type FeedbackState = 'ready' | 'requesting' | 'recording' | 'stopping' | 'saving' | 'saved';

const RECORDING_LIMIT_MS = 60_000;
const AUDIO_LIMIT_BYTES = 5 * 1024 * 1024;

export class GameFeedbackDialog {
  private readonly config: GameFeedbackDialogConfig;
  private readonly dialog = document.createElement('dialog');
  private readonly listeners = new AbortController();
  private readonly form: HTMLFormElement;
  private readonly text: HTMLTextAreaElement;
  private readonly recordButton: HTMLButtonElement;
  private readonly preview: HTMLDivElement;
  private readonly player: HTMLAudioElement;
  private readonly removeButton: HTMLButtonElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly doneButton: HTMLButtonElement;
  private readonly status: HTMLParagraphElement;
  private state: FeedbackState = 'ready';
  private generation = 0;
  private recorder?: MediaRecorder;
  private recordingTimeout?: number;
  private audio?: Blob;
  private playbackUrl?: string;

  constructor(config: GameFeedbackDialogConfig) {
    this.config = config;
    this.dialog.className = 'game-feedback-dialog';
    this.dialog.setAttribute('aria-labelledby', 'game-feedback-title');
    this.dialog.innerHTML = `
      <h2 id="game-feedback-title" tabindex="-1" autofocus>Tell us about this game</h2>
      <form>
        <p>What did you like? What would you change? Your note stays on this device for your grown-up.</p>
        <label for="game-feedback-text">Write a note</label>
        <textarea id="game-feedback-text" maxlength="500" rows="3"></textarea>
        <button class="game-feedback-record" type="button">Record my voice</button>
        <div class="game-feedback-preview" hidden>
          <audio controls aria-label="Listen to your recording"></audio>
          <button class="game-feedback-remove" type="button">Erase recording</button>
        </div>
        <div class="game-feedback-actions">
          <button class="game-feedback-cancel" type="button">Cancel</button>
          <button class="game-feedback-primary" type="submit">Save</button>
        </div>
      </form>
      <p class="game-feedback-status" role="status"></p>
      <button class="game-feedback-primary game-feedback-done" type="button" hidden>Done</button>
    `;

    this.form = this.dialog.querySelector('form')!;
    this.text = this.dialog.querySelector('textarea')!;
    this.recordButton = this.dialog.querySelector('.game-feedback-record')!;
    this.preview = this.dialog.querySelector('.game-feedback-preview')!;
    this.player = this.dialog.querySelector('audio')!;
    this.removeButton = this.dialog.querySelector('.game-feedback-remove')!;
    this.saveButton = this.dialog.querySelector('button[type="submit"]')!;
    this.cancelButton = this.dialog.querySelector('.game-feedback-cancel')!;
    this.doneButton = this.dialog.querySelector('.game-feedback-done')!;
    this.status = this.dialog.querySelector('.game-feedback-status')!;

    const options = { signal: this.listeners.signal };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopRecording();
    }, options);
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close();
    }, options);
    this.dialog.addEventListener('close', () => {
      this.reset();
      this.dialog.remove();
      this.config.onClose();
    }, options);
    this.cancelButton.addEventListener('click', () => this.close(), options);
    this.doneButton.addEventListener('click', () => this.close(), options);
    this.text.addEventListener('input', () => this.updateControls(), options);
    this.recordButton.addEventListener('click', () => {
      if (this.state === 'recording') this.stopRecording();
      else if (this.state === 'ready') void this.startRecording();
    }, options);
    this.removeButton.addEventListener('click', () => {
      if (this.state !== 'ready') return;
      this.clearAudio();
      this.updateControls();
      this.recordButton.focus();
      this.status.textContent = 'Recording erased.';
    }, options);
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.save();
    }, options);
  }

  open(): void {
    if (this.listeners.signal.aborted || this.dialog.isConnected) return;
    this.updateControls();
    document.body.append(this.dialog);
    this.dialog.showModal();
  }

  destroy(): void {
    this.listeners.abort();
    if (this.dialog.open) this.dialog.close();
    this.reset();
    this.dialog.remove();
  }

  private close(): void {
    if (this.state === 'saving') return;
    this.releaseRecorder();
    this.dialog.close();
  }

  private reset(): void {
    this.generation += 1;
    this.releaseRecorder();
    this.clearAudio();
    this.form.reset();
    this.status.textContent = '';
    this.state = 'ready';
  }

  private updateControls(): void {
    const ready = this.state === 'ready';
    const saving = this.state === 'saving';
    const saved = this.state === 'saved';
    const hasAudio = Boolean(this.audio);
    this.form.hidden = saved;
    this.doneButton.hidden = !saved;
    this.text.readOnly = saving;
    this.cancelButton.disabled = saving;
    this.recordButton.hidden = hasAudio;
    this.recordButton.setAttribute('aria-disabled', String(!ready && this.state !== 'recording'));
    this.recordButton.textContent = this.state === 'recording' ? 'Stop recording' : 'Record my voice';
    this.preview.hidden = !hasAudio;
    this.removeButton.disabled = saving;
    this.saveButton.setAttribute('aria-disabled', String(!ready || (!this.text.value.trim() && !hasAudio)));
  }

  private async startRecording(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.status.textContent = 'Voice recording is unavailable here. You can still write a note.';
      return;
    }

    const generation = this.generation;
    this.state = 'requesting';
    this.status.textContent = 'Allow the microphone to record your voice.';
    this.updateControls();

    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!this.dialog.open || this.generation !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (document.hidden) {
        stream.getTracks().forEach((track) => track.stop());
        this.recordingFailed('Return to Kipu to record your voice.');
        return;
      }

      const recorder = new MediaRecorder(stream);
      this.recorder = recorder;
      const chunks: Blob[] = [];
      let size = 0;
      recorder.ondataavailable = ({ data }) => {
        if (!data.size) return;
        size += data.size;
        if (size > AUDIO_LIMIT_BYTES) {
          this.recordingFailed('That recording was too big. Try a shorter one or write a note.');
        } else {
          chunks.push(data);
        }
      };
      recorder.onerror = () => this.recordingFailed('The microphone stopped. Try again or write a note.');
      recorder.onstop = () => {
        const audio = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type });
        if (!audio.size) {
          this.recordingFailed('No sound was recorded. Try again or write a note.');
          return;
        }
        this.releaseRecorder();
        this.audio = audio;
        this.playbackUrl = URL.createObjectURL(audio);
        this.player.src = this.playbackUrl;
        this.state = 'ready';
        this.status.textContent = 'Recording ready. You can listen or save it.';
        const moveFocus = document.activeElement === this.recordButton;
        this.updateControls();
        if (moveFocus) this.removeButton.focus();
      };
      recorder.start(1000);
      this.recordingTimeout = window.setTimeout(() => this.stopRecording(), RECORDING_LIMIT_MS);
      this.state = 'recording';
      this.status.textContent = 'Recording now. You can talk for up to one minute.';
      this.updateControls();
    } catch {
      if (this.recorder?.stream !== stream) stream?.getTracks().forEach((track) => track.stop());
      if (this.dialog.open && this.generation === generation) {
        this.recordingFailed('The microphone was unavailable. Try again or write a note.');
      }
    }
  }

  private stopRecording(): void {
    if (!this.recorder || this.state !== 'recording') return;
    this.state = 'stopping';
    this.status.textContent = 'Getting your recording ready…';
    this.updateControls();
    if (this.recorder.state !== 'inactive') this.recorder.stop();
  }

  private recordingFailed(message: string): void {
    this.releaseRecorder();
    this.state = 'ready';
    this.status.textContent = message;
    this.updateControls();
  }

  private releaseRecorder(): void {
    window.clearTimeout(this.recordingTimeout);
    this.recordingTimeout = undefined;
    const recorder = this.recorder;
    this.recorder = undefined;
    if (!recorder) return;
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
    if (recorder.state !== 'inactive') recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
  }

  private clearAudio(): void {
    if (this.playbackUrl) {
      this.player.pause();
      this.player.removeAttribute('src');
      this.player.load();
      URL.revokeObjectURL(this.playbackUrl);
    }
    this.audio = undefined;
    this.playbackUrl = undefined;
  }

  private async save(): Promise<void> {
    const text = this.text.value.trim();
    const audio = this.audio;
    if (this.state !== 'ready' || (!text && !audio)) return;
    const generation = this.generation;
    this.state = 'saving';
    this.status.textContent = 'Saving your feedback…';
    this.updateControls();

    try {
      const { gameId, gameName } = this.config;
      await saveGameFeedback({ gameId, gameName, text, audio });
    } catch {
      if (!this.dialog.open || this.generation !== generation) return;
      this.state = 'ready';
      this.status.textContent = 'Your feedback could not be saved. Try pressing Save again.';
      this.updateControls();
      return;
    }

    if (!this.dialog.open || this.generation !== generation) return;
    this.clearAudio();
    this.form.reset();
    this.state = 'saved';
    this.status.textContent = 'Thanks! Your feedback is saved for your grown-up.';
    this.updateControls();
    this.doneButton.focus();
  }
}
