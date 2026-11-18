import { registerPlugin } from '@capacitor/core';

export interface QuranMediaSessionPlugin {
  /**
   * Update media metadata (track, artist, album)
   */
  updateMetadata(options: {
    track: string;
    artist: string;
    album: string;
  }): Promise<void>;

  /**
   * Update playback state and position
   */
  updatePlaybackState(options: {
    isPlaying: boolean;
    position: number; // in seconds
    duration: number; // in seconds
  }): Promise<void>;

  /**
   * Destroy media session and hide notification
   */
  destroy(): Promise<void>;

  /**
   * Whether the app is exempt from battery optimization.
   * Aggressive OEM ROMs (Xiaomi/OPPO/Huawei/Samsung...) kill background
   * playback unless the user grants this exemption.
   */
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;

  /**
   * Opens the system dialog asking the user to exempt the app from
   * battery optimization (Android 6.0+).
   */
  requestIgnoreBatteryOptimizations(): Promise<void>;

  /**
   * Listen for media session events
   */
  addListener(
    eventName: 'mediaSessionEvent',
    listenerFunc: (event: MediaSessionEvent) => void
  ): Promise<any>;

  /**
   * Remove all listeners
   */
  removeAllListeners(): Promise<void>;
}

export interface MediaSessionEvent {
  action: 'play' | 'pause' | 'next' | 'previous' | 'seek' | 'stop';
  data?: {
    position?: number; // in seconds for seek action
  };
}

const QuranMediaSession = registerPlugin<QuranMediaSessionPlugin>('QuranMediaSession');

export default QuranMediaSession;
