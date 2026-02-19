package com.mushafy.quran;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1001;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Setup edge-to-edge BEFORE super.onCreate
        setupEdgeToEdge();
        
        registerPlugin(QuranMediaSessionPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Explicitly hide action bar for older Android versions (Android 13 and below)
        // This fixes the issue where a native title bar appears between status bar and app header
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }
        
        // Remove window background to prevent any background showing through
        getWindow().setBackgroundDrawable(null);
        
        // Ensure the WebView takes full control of the layout
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
    }
    
    @Override
    public void onStart() {
        super.onStart();
        // Re-apply edge-to-edge in case it was reset
        setupEdgeToEdge();
    }
    
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Re-apply edge-to-edge when theme changes (light/dark mode)
        // Use a slight delay to ensure the system has settled after theme change
        getWindow().getDecorView().post(new Runnable() {
            @Override
            public void run() {
                setupEdgeToEdge();
            }
        });
    }
    
    private void setupEdgeToEdge() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ (API 30+)
            Window window = getWindow();
            WindowCompat.setDecorFitsSystemWindows(window, false);
            window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
            window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            // Android 5.0+ (API 21+)
            Window window = getWindow();
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | 
                             WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
            window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        }
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
        // Re-apply edge-to-edge in case theme changed while app was paused
        setupEdgeToEdge();
    }
}
