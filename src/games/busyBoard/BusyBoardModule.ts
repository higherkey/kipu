export interface BusyBoardModule {
  id: string;
  x: number;      // Grid column coordinate (0-indexed)
  y: number;      // Grid row coordinate (0-indexed)
  w: number;      // Width in grid cells
  h: number;      // Height in grid cells

  init(): void;
  render(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number): void;
  handlePointerDown(x: number, y: number, px: number, py: number, pw: number, ph: number): boolean; // Returns true if hit and handled
  handlePointerMove(x: number, y: number, px: number, py: number, pw: number, ph: number): void;
  handlePointerUp(x: number, y: number, px: number, py: number, pw: number, ph: number): void;
  setPowerState?(hasPower: boolean): void; // Optional callback for power states
  destroy(): void;
}
