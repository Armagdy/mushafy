package com.mushafy.quran;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Foreground service (type: mediaPlayback) that hosts the MediaSessionCompat and the
 * media-style notification while Quran audio is playing.
 *
 * Why this exists:
 *   The app plays audio inside the Capacitor WebView. Android keeps playing WebView audio
 *   in the background ONLY while the app process is alive. Without a foreground service the
 *   process is treated as a cached/background app and gets killed by Doze, low-memory
 *   killers and OEM battery savers (Xiaomi/OPPO/Samsung/...) - audio stops and the media
 *   notification disappears.
 *
 *   Running this service with startForeground() while playback is active elevates the
 *   process priority above anything those killers target, so background playback survives.
 *   A partial WakeLock is also held while playing so the CPU (and with it WebView timers
 *   + audio) keeps running with the screen off.
 */
public class QuranPlaybackService extends Service {
    private static final String TAG = "QuranPlaybackService";
    private static final String NOTIFICATION_CHANNEL_ID = "capacitor-music-channel-id";
    private static final int NOTIFICATION_ID = 7825;

    // Commands sent by the plugin (JS side)
    public static final String ACTION_UPDATE = "com.mushafy.quran.action.UPDATE";
    public static final String ACTION_DESTROY = "com.mushafy.quran.action.DESTROY";

    // Media button actions coming from the notification itself
    public static final String ACTION_NOTIFICATION_PLAY = "com.mushafy.quran.action.NOTIFICATION_PLAY";
    public static final String ACTION_NOTIFICATION_PAUSE = "com.mushafy.quran.action.NOTIFICATION_PAUSE";
    public static final String ACTION_NOTIFICATION_NEXT = "com.mushafy.quran.action.NOTIFICATION_NEXT";
    public static final String ACTION_NOTIFICATION_PREVIOUS = "com.mushafy.quran.action.NOTIFICATION_PREVIOUS";
    public static final String ACTION_NOTIFICATION_STOP = "com.mushafy.quran.action.NOTIFICATION_STOP";

    // Intent extras (position/duration in SECONDS, converted to ms internally)
    public static final String EXTRA_HAS_METADATA = "hasMetadata";
    public static final String EXTRA_HAS_STATE = "hasState";
    public static final String EXTRA_TRACK = "track";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_DURATION = "duration";

    private static volatile boolean sRunning = false;
    private static QuranMediaSessionPlugin jsPlugin;

    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private PlaybackStateCompat.Builder stateBuilder;
    private PowerManager.WakeLock wakeLock;

    private String currentTrack = "";
    private String currentArtist = "";
    private String currentAlbum = "";
    private boolean isPlaying = false;
    private long position = 0; // ms
    private long duration = 0; // ms

    private boolean isForeground = false;
    private Bitmap cachedAlbumArt = null;

    static void setPlugin(QuranMediaSessionPlugin plugin) {
        jsPlugin = plugin;
    }

    public static boolean isRunning() {
        return sRunning;
    }

    /**
     * Route a media action that originated on the native side (notification button,
     * lock screen / bluetooth / headset media key) back into the JavaScript side,
     * using the same event shape as before: { action, data? }.
     */
    static void notifyJs(String action, Double positionSeconds) {
        QuranMediaSessionPlugin plugin = jsPlugin;
        if (plugin != null) {
            plugin.onServiceMediaEvent(action, positionSeconds);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sRunning = true;
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        ensureMediaSession();
        Log.d(TAG, "Playback service created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null && intent.getAction() != null ? intent.getAction() : ACTION_UPDATE;

        // CRITICAL: if this service was started via startForegroundService(), Android
        // requires a startForeground() call even if the very next thing we do is
        // stop (e.g. an ACTION_DESTROY that arrives before playback ever started).
        // Skipping it crashes the whole app ~5 seconds later with
        // ForegroundServiceDidNotStartInTimeException.
        if (!isForeground) {
            try {
                ensureMediaSession();
                startForegroundCompat();
            } catch (Exception e) {
                Log.e(TAG, "Failed to enter foreground state", e);
            }
        }

        switch (action) {
            case ACTION_DESTROY:
                stopPlayback();
                return START_NOT_STICKY;

            case ACTION_NOTIFICATION_PLAY:
                handleMediaAction("play", null);
                return START_NOT_STICKY;

            case ACTION_NOTIFICATION_PAUSE:
                handleMediaAction("pause", null);
                return START_NOT_STICKY;

            case ACTION_NOTIFICATION_NEXT:
                handleMediaAction("next", null);
                return START_NOT_STICKY;

            case ACTION_NOTIFICATION_PREVIOUS:
                handleMediaAction("previous", null);
                return START_NOT_STICKY;

            case ACTION_NOTIFICATION_STOP:
                // Dismissed via swipe/X or stop pressed - reflect it immediately
                // even if the WebView is throttled in the background.
                notifyJs("stop", null);
                stopPlayback();
                return START_NOT_STICKY;

            case ACTION_UPDATE:
            default:
                handleUpdate(intent);
                return START_NOT_STICKY;
        }
    }

    private void handleUpdate(Intent intent) {
        if (intent == null) {
            return;
        }

        boolean hasMetadata = intent.getBooleanExtra(EXTRA_HAS_METADATA, false);
        boolean hasState = intent.getBooleanExtra(EXTRA_HAS_STATE, false);

        boolean playingChanged = false;

        if (hasMetadata) {
            String newTrack = intent.getStringExtra(EXTRA_TRACK);
            String newArtist = intent.getStringExtra(EXTRA_ARTIST);
            String newAlbum = intent.getStringExtra(EXTRA_ALBUM);
            if (newTrack != null) currentTrack = newTrack;
            if (newArtist != null) currentArtist = newArtist;
            if (newAlbum != null) currentAlbum = newAlbum;
            updateSessionMetadata();
            rebuildNotification();
        }

        if (hasState) {
            boolean newIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);
            position = (long) (intent.getDoubleExtra(EXTRA_POSITION, 0.0) * 1000.0);
            duration = (long) (intent.getDoubleExtra(EXTRA_DURATION, 0.0) * 1000.0);
            playingChanged = newIsPlaying != isPlaying;
            isPlaying = newIsPlaying;

            // Keep duration in metadata so the lock-screen seek bar renders
            if (duration > 0) {
                updateSessionMetadata();
            }
        }

        // PlaybackState drives the lock-screen/notification progress bar via the
        // media session, so it must be refreshed on every position update - but the
        // notification itself only needs re-posting when its visible content changed.
        updateSessionPlaybackState();
        updateWakeLock();
        if (hasState && playingChanged) {
            rebuildNotification();
        }
    }

    /**
     * Central handler for all native media actions (session callbacks and
     * notification buttons). Mirrors the behavior of the old plugin callbacks:
     * notify JS first (it owns the audio element), then refresh session state.
     */
    private void handleMediaAction(String action, Long seekPosMs) {
        switch (action) {
            case "play":
                isPlaying = true;
                notifyJs("play", null);
                break;
            case "pause":
                isPlaying = false;
                notifyJs("pause", null);
                break;
            case "next":
                notifyJs("next", null);
                return; // no local state change - JS decides what's next
            case "previous":
                notifyJs("previous", null);
                return;
            case "seek":
                if (seekPosMs != null) {
                    position = seekPosMs;
                    double seconds = seekPosMs / 1000.0;
                    notifyJs("seek", seconds);
                }
                break;
            case "stop":
                notifyJs("stop", null);
                stopPlayback();
                return;
            default:
                return;
        }

        updateSessionPlaybackState();
        updateWakeLock();
        rebuildNotification();
    }

    private void ensureMediaSession() {
        if (mediaSession != null) {
            return;
        }

        mediaSession = new MediaSessionCompat(this, TAG);
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO |
                PlaybackStateCompat.ACTION_STOP
            );

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                Log.d(TAG, "onPlay()");
                handleMediaAction("play", null);
            }

            @Override
            public void onPause() {
                Log.d(TAG, "onPause()");
                handleMediaAction("pause", null);
            }

            @Override
            public void onSkipToNext() {
                Log.d(TAG, "onSkipToNext()");
                handleMediaAction("next", null);
            }

            @Override
            public void onSkipToPrevious() {
                Log.d(TAG, "onSkipToPrevious()");
                handleMediaAction("previous", null);
            }

            @Override
            public void onSeekTo(long pos) {
                Log.d(TAG, "onSeekTo(): " + pos + "ms");
                handleMediaAction("seek", pos);
            }

            @Override
            public void onStop() {
                Log.d(TAG, "onStop()");
                handleMediaAction("stop", null);
            }
        });

        mediaSession.setActive(true);
        updateSessionMetadata();
        updateSessionPlaybackState();
    }

    private void updateSessionMetadata() {
        if (mediaSession == null) {
            return;
        }

        MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTrack)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);

        Bitmap art = getAlbumArt();
        if (art != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art);
        }

        mediaSession.setMetadata(builder.build());
    }

    private void updateSessionPlaybackState() {
        if (mediaSession == null || stateBuilder == null) {
            return;
        }

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        // Playback speed 0 while paused so the progress bar freezes instead of advancing.
        PlaybackStateCompat playbackState = stateBuilder
            .setState(state, position, isPlaying ? 1.0f : 0.0f)
            .build();
        mediaSession.setPlaybackState(playbackState);
    }

    /**
     * Keep a partial CPU wake lock while audio is playing so WebView timers and
     * media events keep firing with the screen off (critical for ayah chaining
     * and position updates in background).
     */
    private void updateWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm == null) {
                    return;
                }
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "mushafy:playback");
                wakeLock.setReferenceCounted(false);
            }

            if (isPlaying && !wakeLock.isHeld()) {
                wakeLock.acquire();
                Log.d(TAG, "Wake lock acquired");
            } else if (!isPlaying && wakeLock.isHeld()) {
                wakeLock.release();
                Log.d(TAG, "Wake lock released");
            }
        } catch (Exception e) {
            Log.e(TAG, "Wake lock error", e);
        }
    }

    private void startForegroundCompat() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        isForeground = true;
        Log.d(TAG, "Service promoted to foreground (mediaPlayback)");
    }

    /**
     * Rebuild and re-post the media notification. Only called when the visible
     * content actually changed (metadata / play-pause state), not on every
     * position tick - the progress bar follows the media session PlaybackState.
     */
    private void rebuildNotification() {
        if (!isForeground) {
            return;
        }
        notificationManager.notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        // Intent to re-open the app when the notification is tapped
        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPi = PendingIntent.getActivity(
            this, 0, contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle(currentTrack)
            .setContentText(currentArtist)
            .setSubText(currentAlbum)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(contentPi)
            .setDeleteIntent(servicePendingIntent(ACTION_NOTIFICATION_STOP))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(isPlaying) // dismissible while paused, pinned while playing
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession != null ? mediaSession.getSessionToken() : null)
                .setShowActionsInCompactView(0, 1, 2)
            );

        Bitmap art = getAlbumArt();
        if (art != null) {
            builder.setLargeIcon(art);
        }

        builder.addAction(new NotificationCompat.Action.Builder(
            android.R.drawable.ic_media_previous, "Previous",
            servicePendingIntent(ACTION_NOTIFICATION_PREVIOUS)).build());

        builder.addAction(isPlaying
            ? new NotificationCompat.Action.Builder(
                android.R.drawable.ic_media_pause, "Pause",
                servicePendingIntent(ACTION_NOTIFICATION_PAUSE)).build()
            : new NotificationCompat.Action.Builder(
                android.R.drawable.ic_media_play, "Play",
                servicePendingIntent(ACTION_NOTIFICATION_PLAY)).build());

        builder.addAction(new NotificationCompat.Action.Builder(
            android.R.drawable.ic_media_next, "Next",
            servicePendingIntent(ACTION_NOTIFICATION_NEXT)).build());

        return builder.build();
    }

    private PendingIntent servicePendingIntent(String action) {
        Intent intent = new Intent(this, QuranPlaybackService.class);
        intent.setAction(action);
        int requestCode = action.hashCode() & 0xFFFF;
        return PendingIntent.getService(
            this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private Bitmap getAlbumArt() {
        if (cachedAlbumArt != null) {
            return cachedAlbumArt;
        }
        try {
            java.io.InputStream is = getAssets().open("public/mushafy.png");
            Bitmap bitmap = BitmapFactory.decodeStream(is);
            is.close();
            if (bitmap != null) {
                cachedAlbumArt = Bitmap.createScaledBitmap(bitmap, 512, 512, true);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not load album art", e);
        }
        return cachedAlbumArt;
    }

    /**
     * Fully stop: drop foreground status (removes the notification),
     * release the wake lock and destroy the service + media session.
     */
    private void stopPlayback() {
        isPlaying = false;
        updateWakeLock();

        if (mediaSession != null) {
            try {
                mediaSession.setActive(false);
                mediaSession.release();
            } catch (Exception e) {
                Log.w(TAG, "Error releasing media session", e);
            }
            mediaSession = null;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        isForeground = false;

        stopSelf();
        Log.d(TAG, "Playback service stopped");
    }

    /**
     * If the user swipes the app away while paused (nothing playing) the service
     * has no reason to live - stop it to avoid the system restarting a zombie.
     * While PLAYING we deliberately keep running: that is the whole point of a
     * media playback foreground service.
     */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (!isPlaying) {
            stopPlayback();
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        sRunning = false;
        updateWakeLock();
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {
            }
        }
        if (mediaSession != null) {
            try {
                mediaSession.setActive(false);
                mediaSession.release();
            } catch (Exception ignored) {
            }
            mediaSession = null;
        }
        super.onDestroy();
        Log.d(TAG, "Playback service destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Quran Audio Player",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Controls for Quran audio playback");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
