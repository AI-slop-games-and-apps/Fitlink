#include "AndroidNotificationBridge.h"

#include <QMetaObject>
#include <QMutex>
#include <QMutexLocker>
#include <QTimer>

#if defined(Q_OS_ANDROID)
#include <QCoreApplication>
#include <QJniEnvironment>
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
    // Defer initial Android JNI check until QtActivity and the event loop are initialized
    QTimer::singleShot(0, this, &AndroidNotificationBridge::refreshPermissionState);
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
    QJniEnvironment env;
    QJniObject context = QNativeInterface::QAndroidApplication::context();
    if (!context.isValid()) {
        env.checkAndClearExceptions();
        return;
    }

    const jboolean granted = QJniObject::callStaticMethod<jboolean>(
        "org/fitlink/watch/FitLinkNotificationService",
        "isNotificationAccessGranted",
        "(Landroid/content/Context;)Z",
        context.object<jobject>()
    );
    if (env.checkAndClearExceptions()) {
        return;
    }

    const bool hasPerm = (granted == JNI_TRUE);
    if (m_hasPermission != hasPerm) {
        m_hasPermission = hasPerm;
        emit stateChanged();
    }
#endif
}

void AndroidNotificationBridge::openPermissionSettings() {
#if defined(Q_OS_ANDROID)
    QJniEnvironment env;
    QJniObject context = QNativeInterface::QAndroidApplication::context();
    if (!context.isValid()) {
        env.checkAndClearExceptions();
        return;
    }
    QJniObject::callStaticMethod<void>(
        "org/fitlink/watch/FitLinkNotificationService",
        "openNotificationAccessSettings",
        "(Landroid/content/Context;)V",
        context.object<jobject>()
    );
    env.checkAndClearExceptions();
#endif
}

bool AndroidNotificationBridge::endIncomingCall() {
#if defined(Q_OS_ANDROID)
    QJniEnvironment env;
    QJniObject context = QNativeInterface::QAndroidApplication::context();
    if (!context.isValid()) {
        env.checkAndClearExceptions();
        return false;
    }
    const jboolean ended = QJniObject::callStaticMethod<jboolean>(
        "org/fitlink/watch/FitLinkNotificationService",
        "endIncomingCall",
        "(Landroid/content/Context;)Z",
        context.object<jobject>()
    );
    if (env.checkAndClearExceptions()) {
        return false;
    }
    return ended == JNI_TRUE;
#else
    return false;
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
        if (!utf) return QString();
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
