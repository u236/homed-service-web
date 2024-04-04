include(../homed-common/homed-common.pri)

HEADERS += \
    controller.h \
    database.h

SOURCES += \
    controller.cpp \
    database.cpp

QT += websockets
