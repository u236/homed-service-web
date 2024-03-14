include(../homed-common/homed-common.pri)

HEADERS += \
    controller.h \
    dashboard.h

SOURCES += \
    controller.cpp \
    dashboard.cpp

QT += websockets
