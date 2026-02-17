package com.mushafy.quran;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "QuranMediaSession")
public class QuranMediaSessionPlugin extends Plugin {
    private static final String TAG = "QuranMediaSession";
    private static final String NOTIFICATION_CHANNEL_ID = "capacitor-music-channel-id";
    private static final int NOTIFICATION_ID = 7825;
    
    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private PlaybackStateCompat.Builder stateBuilder;
    
    private String currentTrack = "";
    private String currentArtist = "";
    private String currentAlbum = "";
    private boolean isPlaying = false;
    private long duration = 0;
    private long position = 0;
    
    @Override
    public void load() {
        super.load();
        initializeMediaSession();
        Log.d(TAG, "QuranMediaSession plugin loaded");
    }
    
    private void initializeMediaSession() {
        Context context = getContext();
        notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        
        // Create MediaSession
        mediaSession = new MediaSessionCompat(context, TAG);
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        
        // Set up PlaybackState builder with SEEK_TO action
        stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO |  // ← Critical for seek support
                PlaybackStateCompat.ACTION_STOP
            );
        
        mediaSession.setPlaybackState(stateBuilder.build());
        
        // Set up callbacks for media button events
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                Log.d(TAG, "▶️ onPlay() called");
                notifyJavaScript("play", null);
                isPlaying = true;
                updatePlaybackState(PlaybackStateCompat.STATE_PLAYING, position);
                showNotification();
            }
            
            @Override
            public void onPause() {
                Log.d(TAG, "⏸️ onPause() called");
                notifyJavaScript("pause", null);
                isPlaying = false;
                updatePlaybackState(PlaybackStateCompat.STATE_PAUSED, position);
                showNotification();
            }
            
            @Override
            public void onSkipToNext() {
                Log.d(TAG, "⏭️ onSkipToNext() called");
                notifyJavaScript("next", null);
            }
            
            @Override
            public void onSkipToPrevious() {
                Log.d(TAG, "⏮️ onSkipToPrevious() called");
                notifyJavaScript("previous", null);
            }
            
            @Override
            public void onSeekTo(long pos) {
                Log.d(TAG, "⏩ onSeekTo() called with position: " + pos + "ms");
                position = pos;
                JSObject data = new JSObject();
                data.put("position", pos / 1000.0); // Convert ms to seconds
                notifyJavaScript("seek", data);
                updatePlaybackState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, pos);
            }
            
            @Override
            public void onStop() {
                Log.d(TAG, "⏹️ onStop() called");
                notifyJavaScript("stop", null);
                isPlaying = false;
                updatePlaybackState(PlaybackStateCompat.STATE_STOPPED, 0);
                hideNotification();
            }
        });
        
        mediaSession.setActive(true);
        Log.d(TAG, "MediaSession initialized with SEEK_TO support");
    }
    
    private void notifyJavaScript(String action, JSObject data) {
        JSObject ret = new JSObject();
        ret.put("action", action);
        if (data != null) {
            ret.put("data", data);
        }
        notifyListeners("mediaSessionEvent", ret);
    }
    
    /**
     * Load mushafy.png from assets as album art.
     * This creates a large bitmap for the notification background.
     */
    private Bitmap loadAlbumArtFromAssets() {
        try {
            android.content.res.AssetManager assetManager = getContext().getAssets();
            java.io.InputStream is = assetManager.open("public/mushafy.png");
            Bitmap bitmap = BitmapFactory.decodeStream(is);
            is.close();
            
            if (bitmap != null) {
                // Scale to reasonable size (512x512) for notification
                int size = 512;
                return Bitmap.createScaledBitmap(bitmap, size, size, true);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to load album art from assets", e);
        }
        return null;
    }
    
    @PluginMethod
    public void updateMetadata(PluginCall call) {
        currentTrack = call.getString("track", "");
        currentArtist = call.getString("artist", "");
        currentAlbum = call.getString("album", "");
        
        Log.d(TAG, "Updating metadata: " + currentTrack + " - " + currentArtist);
        
        MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTrack)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);
        
        // Add mushafy.png as album art (large background image)
        try {
            Bitmap albumArt = loadAlbumArtFromAssets();
            if (albumArt != null) {
                metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, albumArt);
                Log.d(TAG, "Album art loaded: " + albumArt.getWidth() + "x" + albumArt.getHeight());
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not load album art", e);
        }
        
        mediaSession.setMetadata(metadataBuilder.build());
        showNotification();
        
        call.resolve();
    }
    
    @PluginMethod
    public void updatePlaybackState(PluginCall call) {
        isPlaying = call.getBoolean("isPlaying", false);
        // Use getDouble since JavaScript sends float values, then convert to ms
        position = (long)(call.getDouble("position", 0.0) * 1000); // Convert seconds to ms
        duration = (long)(call.getDouble("duration", 0.0) * 1000); // Convert seconds to ms
        
        Log.d(TAG, "Updating playback state: isPlaying=" + isPlaying + ", position=" + (position/1000.0) + "s, duration=" + (duration/1000.0) + "s");
        
        // Update metadata duration (critical for seek bar to appear)
        if (mediaSession != null && duration > 0) {
            MediaMetadataCompat currentMetadata = mediaSession.getController().getMetadata();
            if (currentMetadata != null) {
                MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder(currentMetadata)
                    .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);
                mediaSession.setMetadata(metadataBuilder.build());
                Log.d(TAG, "Updated metadata duration to " + (duration/1000.0) + "s for seek bar");
            }
        }
        
        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        updatePlaybackState(state, position);
        showNotification();
        
        call.resolve();
    }
    
    private void updatePlaybackState(int state, long position) {
        PlaybackStateCompat playbackState = stateBuilder
            .setState(state, position, 1.0f)
            .build();
        mediaSession.setPlaybackState(playbackState);
    }
    
    @PluginMethod
    public void destroy(PluginCall call) {
        Log.d(TAG, "Destroying MediaSession");
        hideNotification();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        call.resolve();
    }
    
    private void showNotification() {
        Context context = getContext();
        
        // Create intent to open app when notification is tapped
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Load mushafy.png as large icon (full background image)
        Bitmap largeIcon = null;
        try {
            largeIcon = loadAlbumArtFromAssets();
            if (largeIcon != null) {
                Log.d(TAG, "Large icon loaded: " + largeIcon.getWidth() + "x" + largeIcon.getHeight());
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not load large icon", e);
        }
        
        // Build notification with MediaStyle
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setContentTitle(currentTrack)
            .setContentText(currentArtist)
            .setSubText(currentAlbum)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(largeIcon) // This shows as the background image
            .setContentIntent(contentIntent)
            .setDeleteIntent(MediaButtonReceiver.buildMediaButtonPendingIntent(context, PlaybackStateCompat.ACTION_STOP))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true) // Keep notification visible
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2) // Show 3 actions in compact view
            );
        
        // Add action buttons
        builder.addAction(createAction(android.R.drawable.ic_media_previous, "Previous", PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS));
        
        if (isPlaying) {
            builder.addAction(createAction(android.R.drawable.ic_media_pause, "Pause", PlaybackStateCompat.ACTION_PAUSE));
        } else {
            builder.addAction(createAction(android.R.drawable.ic_media_play, "Play", PlaybackStateCompat.ACTION_PLAY));
        }
        
        builder.addAction(createAction(android.R.drawable.ic_media_next, "Next", PlaybackStateCompat.ACTION_SKIP_TO_NEXT));
        
        Notification notification = builder.build();
        notificationManager.notify(NOTIFICATION_ID, notification);
        
        Log.d(TAG, "Notification shown with seek support");
    }
    
    private NotificationCompat.Action createAction(int icon, String title, long action) {
        Context context = getContext();
        PendingIntent pendingIntent = MediaButtonReceiver.buildMediaButtonPendingIntent(context, action);
        return new NotificationCompat.Action.Builder(icon, title, pendingIntent).build();
    }
    
    private void hideNotification() {
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
    }
}
