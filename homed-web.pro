include(../homed-common/homed-common.pri)

HEADERS += \
    controller.h \
    database.h

SOURCES += \
    controller.cpp \
    database.cpp

DISTFILES += $$files(deploy/data/usr/share/homed-web/*, true)
QT += websockets

deploy.files = deploy/data/usr/share/homed-web/*
deploy.path = /usr/share/homed-web

INSTALLS += deploy
