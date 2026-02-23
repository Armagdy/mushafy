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
        
        // Completely remove action bar and its space - CRITICAL: Must be done after super.onCreate
        removeActionBar();
        
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
        // Re-remove action bar and its space
        removeActionBar();
        // Re-apply edge-to-edge in case it was reset
        setupEdgeToEdge();
    }
    
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Re-remove action bar when configuration changes
        removeActionBar();
        // Re-apply edge-to-edge when theme changes (light/dark mode)
        // Use a slight delay to ensure the system has settled after theme change
        getWindow().getDecorView().post(new Runnable() {
            @Override
            public void run() {
                setupEdgeToEdge();
            }
        });
    }
    
    /**
     * Completely remove the action bar and the space it reserves
     * This ensures no title bar appears and no space is left behind
     */
    private void removeActionBar() {
        try {
            // Hide the action bar itself
            if (getSupportActionBar() != null) {
                getSupportActionBar().hide();
            }
            if (getActionBar() != null) {
                getActionBar().hide();
            }
            
            // Critical: Tell the window to not reserve space for action bar
            // This removes the empty gap that was left after hiding the action bar
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11+ (API 30+) - Use WindowInsetsController
                WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            }
            
            // Force the content view to extend behind system bars
            View contentView = findViewById(android.R.id.content);
            if (contentView != null) {
                contentView.setFitsSystemWindows(false);
            }
            
            // Ensure WebView bridge content also doesn't fit system windows
            View bridgeView = findViewById(com.getcapacitor.android.R.id.webview);
            if (bridgeView != null) {
                bridgeView.setFitsSystemWindows(false);
            }
        } catch (Exception e) {
            // Silently catch any exceptions
        }
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
        // Re-remove action bar when returning to app
        removeActionBar();
        // Resume normally when app comes back to foreground
        // Re-apply edge-to-edge in case theme changed while app was paused
        setupEdgeToEdge();
    }
}
