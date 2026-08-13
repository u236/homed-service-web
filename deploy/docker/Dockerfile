FROM    127.0.0.1:5000/homed-service:latest
ARG     TARGETARCH
ADD     share /usr/share/homed-web
RUN     mkdir /etc/homed
RUN     ln -s /data/homed-web.conf /etc/homed/homed-web.conf
RUN     ln -s /data/homed.log /var/log/homed.log
RUN     ln -s /data/plugin /usr/share/homed-web/plugin
COPY    homed-web-$TARGETARCH /usr/bin/homed-web
CMD     ["/usr/bin/homed-web"]
