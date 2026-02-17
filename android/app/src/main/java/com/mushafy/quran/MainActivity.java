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
        super.onCreate(savedInstanceState);
        
        // Create notification channel for media playback (Android 8.0+)
        createMediaNotificationChannel();
        
        // Enable transparent navigation bar and draw behind it
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        );
        
        // Keep audio playing in background
        // This ensures the WebView doesn't pause audio when the app goes to background
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setDomStorageEnabled(true);
            // CRITICAL: Allow media to play in background
            webView.getSettings().setAllowFileAccess(true);
            webView.getSettings().setAllowContentAccess(true);
            
            // Prevent WebView from pausing on background
            webView.setKeepScreenOn(false); // Don't keep screen on, but keep audio playing
        }
        
        // Request notification permission for Android 13+ (API 33+)
        // This is required to show media controls in notifications
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST_CODE);
            }
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
            int importance = NotificationManager.IMPORTANCE_LOW; // Don't make sound, just show controls
            
            NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);
            channel.setDescription(channelDescription);
            channel.setShowBadge(false); // Don't show badge on app icon
            
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
