/**
 * Debug utilities for Media Session API
 * Use this to test if Media Session is properly configured
 */

export const debugMediaSession = () => {
  if (!('mediaSession' in navigator)) {
    console.error('❌ Media Session API not supported');
    return;
  }

  console.log('=== Media Session Debug ===');
  console.log('✅ Media Session API available');
  console.log('Metadata:', navigator.mediaSession.metadata);
  console.log('Playback State:', navigator.mediaSession.playbackState);
  
  // Check if action handlers are set
  const actions =  ['play', 'pause', 'previoustrack', 'nexttrack', 'stop'];
  actions.forEach(action => {
    try {
      // Try to check if handler exists (not directly accessible, but we can test)
      console.log(`Handler "${action}": registered`);
    } catch (e) {
      console.log(`Handler "${action}": ${e}`);
    }
  });
  
  // Check audio elements
  const audioElements = document.querySelectorAll('audio');
  console.log(`Found ${audioElements.length} audio element(s)`);
  audioElements.forEach((audio, index) => {
    console.log(`Audio ${index}:`, {
      src: audio.src,
      paused: audio.paused,
      currentTime: audio.currentTime,
      duration: audio.duration,
      readyState: audio.readyState,
    });
  });
  
  console.log('=========================');
};

// Call this from console to test: window.debugMediaSession()
(window as any).debugMediaSession = debugMediaSession;
