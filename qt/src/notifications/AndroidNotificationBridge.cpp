#include "AndroidNotificationBridge.h"

#include <QMetaObject>
#include <QMutex>
#include <QMutexLocker>

#if defined(Q_OS_ANDROID)
#include <QCoreApplication>
#include <QJniObject>
#include <jni.h>
#endif

namespace fitlink {

namespace {
QMutex g_bridgeMutex;
AndroidNotificationBridge *g_activeBridge = nullptr;
} // namespace

AndroidNotificationBridge::AndroidNotificationBridge(QObject *parent)
    : PlatformNotificationBridge(parent) {
    {
        QMutexLocker locker(&g_bridgeMutex);
        g_activeBridge = this;
    }
    refreshPermissionState();
}

AndroidNotificationBridge::~AndroidNotificationBridge() {
    QMutexLocker locker(&g_bridgeMutex);
    if (g_activeBridge == this) {
        g_activeBridge = nullptr;
    }
}

QString AndroidNotificationBridge::platformLabel() const {
    return QStringLiteral("Android NotificationListenerService");
}

void AndroidNotificationBridge::setEnabled(bool enabled) {
    if (m_enabled != enabled) {
        m_enabled = enabled;
        emit stateChanged();
    }
}

void AndroidNotificationBridge::refreshPermissionState() {
#if defined(Q_OS_ANDROID)
    QJniObject context = QNativeInterface::QAndroidApplication::context();
    if (!context.isValid()) {
        return;
    }
    QJniObject resolver = context.callObjectMethod(
        "getContentResolver",
        "()Landroid/content/ContentResolver;"
    );
    QJniObject listeners = QJniObject::callStaticObjectMethod(
        "android/provider/Settings$Secure",
        "getString",
        "(Landroid/content/ContentResolver;Ljava/lang/String;)Ljava/lang/String;",
        resolver.object<jobject>(),
        QJniObject::fromString(QStringLiteral("enabled_notification_listeners")).object<jstring>()
    );
    const QString enabledList = listeners.isValid() ? listeners.toString() : QString();
    const bool granted = enabledList.contains(QStringLiteral("org.fitlink.watch"));
    if (m_hasPermission != granted) {
        m_hasPermission = granted;
        emit stateChanged();
    }
#endif
}

void AndroidNotificationBridge::openPermissionSettings() {
#if defined(Q_OS_ANDROID)
    QJniObject context = QNativeInterface::QAndroidApplication::context();
    if (!context.isValid()) {
        return;
    }
    QJniObject intent(
        "android/content/Intent",
        "(Ljava/lang/String;)V",
        QJniObject::fromString(QStringLiteral("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")).object<jstring>()
    );
    // FLAG_ACTIVITY_NEW_TASK = 0x10000000
    intent.callObjectMethod("addFlags", "(I)Landroid/content/Intent;", 0x10000000);
    context.callMethod<void>("startActivity", "(Landroid/content/Intent;)V", intent.object<jobject>());
#endif
}

void AndroidNotificationBridge::dispatchFromJni(const QString &packageName,
                                                const QString &appLabel,
                                                const QString &title,
                                                const QString &body) {
    QMutexLocker locker(&g_bridgeMutex);
    if (!g_activeBridge || !g_activeBridge->isEnabled()) {
        return;
    }
    AndroidNotificationBridge *target = g_activeBridge;
    QMetaObject::invokeMethod(
        target,
        [target, packageName, appLabel, title, body]() {
            emit target->notificationReceived(packageName, appLabel, title, body);
        },
        Qt::QueuedConnection
    );
}

} // namespace fitlink

#if defined(Q_OS_ANDROID)
extern "C" {
JNIEXPORT void JNICALL
Java_org_fitlink_watch_FitLinkNotificationService_nativeOnNotificationPosted(
    JNIEnv *env,
    jclass /*clazz*/,
    jstring jPackageName,
    jstring jAppLabel,
    jstring jTitle,
    jstring jBody) {
    auto toQString = [env](jstring str) -> QString {
        if (!str) return QString();
        const char *utf = env->GetStringUTFChars(str, nullptr);
        QString out = QString::fromUtf8(utf);
        env->ReleaseStringUTFChars(str, utf);
        return out;
    };

    fitlink::AndroidNotificationBridge::dispatchFromJni(
        toQString(jPackageName),
        toQString(jAppLabel),
        toQString(jTitle),
        toQString(jBody)
    );
}
}
#endif
