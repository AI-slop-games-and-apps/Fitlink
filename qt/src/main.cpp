#include "core/AppController.h"

#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
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
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection
    );

    engine.loadFromModule(QStringLiteral("FitLink"), QStringLiteral("Main"));

    return app.exec();
}
