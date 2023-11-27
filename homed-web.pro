include(../homed-common/homed-common.pri)

HEADERS += \
    controller.h

SOURCES += \
    controller.cpp

DISTFILES += \
    deploy/data/usr/share/homed-web/css/app.css \
    deploy/data/usr/share/homed-web/css/font.css \
    deploy/data/usr/share/homed-web/font/fontello.woff2 \
    deploy/data/usr/share/homed-web/font/open-sans-cyrillic.woff2 \
    deploy/data/usr/share/homed-web/font/open-sans-latin.woff2 \
    deploy/data/usr/share/homed-web/font/roboto-mono-cyrillic.woff2 \
    deploy/data/usr/share/homed-web/font/roboto-mono-latin.woff2 \
    deploy/data/usr/share/homed-web/html/automation/automationEdit.html \
    deploy/data/usr/share/homed-web/html/automation/automationInfo.html \
    deploy/data/usr/share/homed-web/html/automation/automationList.html \
    deploy/data/usr/share/homed-web/html/automation/automationRemove.html \
    deploy/data/usr/share/homed-web/html/automation/dateCondition.html \
    deploy/data/usr/share/homed-web/html/automation/delayAction.html \
    deploy/data/usr/share/homed-web/html/automation/mqttAction.html \
    deploy/data/usr/share/homed-web/html/automation/propertyItem.html \
    deploy/data/usr/share/homed-web/html/automation/shellAction.html \
    deploy/data/usr/share/homed-web/html/automation/stateAction.html \
    deploy/data/usr/share/homed-web/html/automation/stateCondition.html \
    deploy/data/usr/share/homed-web/html/automation/telegramAction.html \
    deploy/data/usr/share/homed-web/html/automation/telegramTrigger.html \
    deploy/data/usr/share/homed-web/html/automation/timeCondition.html \
    deploy/data/usr/share/homed-web/html/automation/timeTrigger.html \
    deploy/data/usr/share/homed-web/html/automation/weekCondition.html \
    deploy/data/usr/share/homed-web/html/zigbee/deviceData.html \
    deploy/data/usr/share/homed-web/html/zigbee/deviceDebug.html \
    deploy/data/usr/share/homed-web/html/zigbee/deviceEdit.html \
    deploy/data/usr/share/homed-web/html/zigbee/deviceInfo.html \
    deploy/data/usr/share/homed-web/html/zigbee/deviceList.html \
    deploy/data/usr/share/homed-web/html/zigbee/deviceMap.html \
    deploy/data/usr/share/homed-web/html/zigbee/deviceRemove.html \
    deploy/data/usr/share/homed-web/html/zigbee/deviceTopics.html \
    deploy/data/usr/share/homed-web/img/homed.svg \
    deploy/data/usr/share/homed-web/index.html \
    deploy/data/usr/share/homed-web/js/app.js \
    deploy/data/usr/share/homed-web/js/automation.js \
    deploy/data/usr/share/homed-web/js/d3.min.js \
    deploy/data/usr/share/homed-web/js/expose.js \
    deploy/data/usr/share/homed-web/js/iro.min.js \
    deploy/data/usr/share/homed-web/js/zigbee.js

QT += websockets

for(file, DISTFILES) {
    path = $$dirname(file)
    path = $$replace(path,deploy/data,)
    eval(deploy_$${path}.files += $$file)
    eval(deploy_$${path}.path = $$path)
    eval(INSTALLS *= deploy_$${path})
}
