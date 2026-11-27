package org.fitlink.watch;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.telecom.TelecomManager;
import android.util.Log;

public class FitLinkNotificationService extends NotificationListenerService {
    private static final String TAG = "FitLinkNotifService";

    // Implemented in src/notifications/AndroidNotificationBridge.cpp via JNIEXPORT
    public static native void nativeOnNotificationPosted(
            String packageName,
            String appLabel,
            String title,
            String body
    );

    // Safe Java helper called from C++ JNI (uses official API 27+ NotificationManager check, never throws)
    public static boolean isNotificationAccessGranted(Context context) {
        if (context == null) {
            return false;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    ComponentName cn = new ComponentName(context, FitLinkNotificationService.class);
                    return nm.isNotificationListenerAccessGranted(cn);
                }
            }
            String enabled = Settings.Secure.getString(
                    context.getContentResolver(),
                    "enabled_notification_listeners"
            );
            return enabled != null && enabled.contains(context.getPackageName());
        } catch (Throwable t) {
            Log.w(TAG, "Unable to query notification listener permission", t);
            return false;
        }
    }

    // Safe Java helper to open Android Notification Listener settings without risking unhandled JNI exceptions
    public static void openNotificationAccessSettings(Context context) {
        if (context == null) {
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Throwable t) {
            Log.w(TAG, "Unable to open notification listener settings", t);
        }
    }

    // Safe Java helper invoked when watch sends FE EA 20 06 67 03 (Cut / Reject Call)
    @SuppressWarnings("deprecation")
    public static boolean endIncomingCall(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            return false;
        }
        try {
            if (context.checkSelfPermission(Manifest.permission.ANSWER_PHONE_CALLS)
                    != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
            TelecomManager telecom = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
            if (telecom != null) {
                return telecom.endCall();
            }
        } catch (Throwable t) {
            Log.w(TAG, "Unable to reject incoming call via TelecomManager", t);
        }
        return false;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) {
            return;
        }
        try {
            Notification notification = sbn.getNotification();
            if (notification == null) {
                return;
            }
            // Skip persistent ongoing services and empty group summary containers
            if ((notification.flags & Notification.FLAG_ONGOING_EVENT) != 0 ||
                (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) {
                return;
            }

            String packageName = sbn.getPackageName();
            if ("org.fitlink.watch".equals(packageName)) {
                return;
            }

            Bundle extras = notification.extras;
            if (extras == null) {
                return;
            }

            CharSequence titleSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence bigTextSeq = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);

            String title = titleSeq != null ? titleSeq.toString().trim() : "";
            String body = bigTextSeq != null
                    ? bigTextSeq.toString().trim()
                    : (textSeq != null ? textSeq.toString().trim() : "");

            if (title.isEmpty() && body.isEmpty()) {
                return;
            }

            String appLabel = resolveAppLabel(packageName);
            nativeOnNotificationPosted(packageName, appLabel, title, body);
        } catch (UnsatisfiedLinkError e) {
            // Native Qt library may not be loaded if user hasn't opened FitLink yet
            Log.w(TAG, "FitLink native library not loaded; skipping notification mirror");
        } catch (Throwable t) {
            Log.e(TAG, "Failed to mirror notification", t);
        }
    }

    private String resolveAppLabel(String packageName) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(packageName, 0);
            CharSequence label = pm.getApplicationLabel(info);
            return label != null ? label.toString() : packageName;
        } catch (Throwable ignored) {
            return packageName;
        }
    }
}
