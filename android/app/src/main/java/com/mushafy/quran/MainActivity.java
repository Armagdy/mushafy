package com.mushafy.quran;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1001;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(QuranMediaSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }


    /**
     * Create notification channel for media playback controls.
     * Required for Android 8.0 (API 26) and above.
     */
    private void createMediaNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String channelId = getString(R.string.media_notification_channel_id);
            CharSequence channelName = getString(R.string.media_notification_channel_name);
            String channelDescription = getString(R.string.media_notification_channel_description);
            int importance = NotificationManager.IMPORTANCE_DEFAULT; // Show on lock screen
            
            NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);
            channel.setDescription(channelDescription);
            channel.setShowBadge(false); // Don't show badge on app icon
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC); // Show on lock screen
            channel.setSound(null, null); // No sound for media controls
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
    
    @Override
    public void onPause() {
        super.onPause();
        // Don't pause the WebView or its audio when app goes to background
        // This is critical for background audio playback
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // Resume normally when app comes back to foreground
    }
}
