package org.fitlink.watch;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
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
        } catch (Exception e) {
            Log.e(TAG, "Failed to mirror notification", e);
        }
    }

    private String resolveAppLabel(String packageName) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(packageName, 0);
            CharSequence label = pm.getApplicationLabel(info);
            return label != null ? label.toString() : packageName;
        } catch (Exception ignored) {
            return packageName;
        }
    }
}
