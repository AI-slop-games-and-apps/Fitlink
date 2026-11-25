#include "core/AppController.h"

#include <QDebug>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQmlError>
#include <QQuickStyle>

int main(int argc, char *argv[]) {
    qputenv("QT_QUICK_CONTROLS_STYLE", "Material");
    QQuickStyle::setStyle(QStringLiteral("Material"));

    QGuiApplication app(argc, argv);
    app.setOrganizationName(QStringLiteral("FitLink"));
    app.setOrganizationDomain(QStringLiteral("fitlink.org"));
    app.setApplicationName(QStringLiteral("FitLink"));
    app.setApplicationVersion(QStringLiteral("1.0.0"));

    fitlink::AppController controller;

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("appController"), &controller);

    QObject::connect(
        &engine,
        &QQmlApplicationEngine::warnings,
        &app,
        [](const QList<QQmlError> &warnings) {
            for (const auto &w : warnings) {
                qWarning() << "[FitLink QML]" << w.toString();
            }
        }
    );

    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() {
            qCritical() << "[FitLink] Failed to load root QML module FitLink/Main";
            QCoreApplication::exit(-1);
        },
        Qt::QueuedConnection
    );

    engine.loadFromModule(QStringLiteral("FitLink"), QStringLiteral("Main"));

    return app.exec();
}
