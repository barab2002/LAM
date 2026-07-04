/** Normalized capture result across platforms. */
export interface CapturedPhoto {
  /** File URI (native) */
  uri?: string;
  /** Raw blob (web) */
  blob?: Blob;
  mimeType: string;
}

export interface CaptureCameraHandle {
  /** Takes a photo immediately. */
  takePhoto: () => Promise<CapturedPhoto | null>;
}

export interface CaptureCameraProps {
  /**
   * Fired when the hands-free trigger (V gesture held ~500ms) is detected.
   * Only wired on platforms with a landmark pipeline (web); native falls
   * back to the self-timer button.
   */
  onGestureTrigger?: () => void;
  /** Reports whether gesture detection is actually running. */
  onGestureAvailability?: (available: boolean) => void;
  style?: object;
}
