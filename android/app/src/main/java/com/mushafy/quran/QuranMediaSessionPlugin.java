package com.mushafy.quran;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.core.content.ContextCompat;

/**
 * Thin router between the WebView (JavaScript) and {@link QuranPlaybackService}.
 *
 * The service is a foreground service of type mediaPlayback. Keeping the media
 * session + notification inside that service (instead of inside this plugin, as
 * before) is what makes background playback survive: a running foreground service
 * raises the app process priority so Doze, the low-memory killer and OEM battery
 * savers no longer kill the app while Quran audio is playing.
 */
@CapacitorPlugin(name = "QuranMediaSession")
public class QuranMediaSessionPlugin extends Plugin {
    private static final String TAG = "QuranMediaSession";

    @Override
    public void load() {
        super.load();
        // The service routes native media-button events back to JS through this reference.
        QuranPlaybackService.setPlugin(this);
        Log.d(TAG, "QuranMediaSession plugin loaded (routed to QuranPlaybackService)");
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        // Intentionally do NOT stop the playback service here: it must survive
        // activity destruction (app in background / rotated / etc.).
        QuranPlaybackService.setPlugin(null);
        Log.d(TAG, "QuranMediaSession plugin destroyed (service left running)");
    }

    /**
     * Called by QuranPlaybackService when a media action originates on the native
     * side (notification buttons, lock screen, Bluetooth, headset keys).
     * Emits the same event shape the WebView already handles: { action, data? }.
     */
    void onServiceMediaEvent(String action, Double positionSeconds) {
        JSObject ret = new JSObject();
        ret.put("action", action);
        if (positionSeconds != null) {
            JSObject data = new JSObject();
            data.put("position", positionSeconds);
            ret.put("data", data);
        }
        notifyListeners("mediaSessionEvent", ret);
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        Intent intent = new Intent(getContext(), QuranPlaybackService.class);
        intent.setAction(QuranPlaybackService.ACTION_UPDATE);
        intent.putExtra(QuranPlaybackService.EXTRA_HAS_METADATA, true);
        intent.putExtra(QuranPlaybackService.EXTRA_TRACK, call.getString("track", ""));
        intent.putExtra(QuranPlaybackService.EXTRA_ARTIST, call.getString("artist", ""));
        intent.putExtra(QuranPlaybackService.EXTRA_ALBUM, call.getString("album", ""));
        sendToService(intent);
        call.resolve();
    }

    @PluginMethod
    public void updatePlaybackState(PluginCall call) {
        Intent intent = new Intent(getContext(), QuranPlaybackService.class);
        intent.setAction(QuranPlaybackService.ACTION_UPDATE);
        intent.putExtra(QuranPlaybackService.EXTRA_HAS_STATE, true);
        intent.putExtra(QuranPlaybackService.EXTRA_IS_PLAYING, call.getBoolean("isPlaying", false));
        // JS sends seconds - the service converts to ms internally.
        intent.putExtra(QuranPlaybackService.EXTRA_POSITION, call.getDouble("position", 0.0));
        intent.putExtra(QuranPlaybackService.EXTRA_DURATION, call.getDouble("duration", 0.0));
        sendToService(intent);
        call.resolve();
    }

    @PluginMethod
    public void destroy(PluginCall call) {
        if (QuranPlaybackService.isRunning()) {
            Intent intent = new Intent(getContext(), QuranPlaybackService.class);
            intent.setAction(QuranPlaybackService.ACTION_DESTROY);
            sendToService(intent);
        } else {
            // Nothing is running. Never use startForegroundService() on this path:
            // starting a service just to stop it immediately violates Android's
            // startForeground() contract and crashes the app.
            try {
                getContext().stopService(new Intent(getContext(), QuranPlaybackService.class));
            } catch (Exception ignored) {
            }
        }
        call.resolve();
    }

    /**
     * Whether the user has already exempted the app from battery optimization
     * ("Unrestricted" / "No battery optimization"). Aggressive OEM ROMs
     * (Xiaomi MIUI, OPPO ColorOS, Huawei EMUI, Samsung...) kill background apps
     * even with a foreground service unless this exemption is granted.
     */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        boolean ignoring = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ignoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    /**
     * Opens the system dialog asking the user to exempt the app from battery
     * optimization, so background Quran playback is never killed by OEM
     * battery managers. Requires the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
     * permission (declared in the manifest).
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + getContext().getPackageName())
                );
                getActivity().runOnUiThread(() -> {
                    try {
                        getActivity().startActivity(intent);
                    } catch (Exception e) {
                        Log.e(TAG, "Could not open battery optimization dialog", e);
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Failed to build battery optimization intent", e);
            }
        }
        call.resolve();
    }

    private void sendToService(Intent intent) {
        Context context = getContext();
        try {
            if (QuranPlaybackService.isRunning()) {
                // Service already alive: a plain startService is always allowed
                // because an app with a running foreground service is not
                // considered background.
                context.startService(intent);
            } else {
                // First start (user pressed play while app was in the foreground).
                // On Android 12+ startForegroundService is only legal from the
                // foreground, and playback is always user-initiated, so this is fine.
                ContextCompat.startForegroundService(context, intent);
            }
        } catch (Exception e) {
            // E.g. startForegroundService denied because the app was backgrounded
            // between the play tap and this call. Playback still works in-app;
            // the next update will run through the plain startService path once
            // the service is alive.
            Log.e(TAG, "Failed to send command to playback service", e);
        }
    }
}
