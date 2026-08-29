class Camera
{
    content = document.querySelector('.content .container');
    status = new Object();
    connections = new Array();

    constructor(controller)
    {
        this.controller = controller;
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = 'Camera ' + this.status.version;
    }

    parseData(message)
    {
        let video = document.querySelector('video#' + message.id);

        if (!video)
            return;

        if (message.sdp)
        {
            video.connection.setRemoteDescription({type: 'answer', sdp: message.sdp});
            return;
        }

        console.log('stream request failed: ' + message.error);
        this.stop(video.connection);
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':
            {
                let check = false;

                this.status = message;

                if (this.device && this.status.devices)
                {
                    this.status.devices.forEach(device =>
                    {
                        if (device.id != this.device.id)
                            return;

                        this.controller.showPage('camera?device=' + device.id);
                        check = true;
                    });
                }

                if (check || this.controller.service == 'camera')
                {
                    if (!check)
                        this.controller.showPage('camera');

                    this.updatePage();
                }

                delete this.device;
                break;
            }

            case 'event':
            {
                let html = 'Device <b>' + message.device + '</b> ';

                if (this.controller.service != 'camera')
                    break;

                switch (message.event)
                {
                    case 'nameDuplicate':  this.controller.showToast(html + 'new name is already in use', 'error'); break;
                    case 'incompleteData': this.controller.showToast(html + 'data is incomplete', 'error'); break;
                    case 'missingStream':  this.controller.showToast(html + 'stream not found', 'error'); break;
                    case 'removed':        this.controller.showToast(html + 'removed', 'warning'); break;

                    case 'added':
                        this.controller.showToast(html + 'successfully added');
                        this.controller.clearPage();
                        break;

                    case 'updated':
                        this.controller.showToast(html + 'successfully updated');
                        showModal(false);
                        break;
                }

                break;
            }
        }
    }

    findDevice(id)
    {
        return this.status.devices?.find(device => device.id == id);
    }

    addVideo(element)
    {
        let video = document.createElement('video');

        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        element.append(video);
        return video;
    }

    play(video, id, subStream = false)
    {
        let device = this.findDevice(id);
        let deadline = Date.now() + 5000;
        let connection;

        if (!device)
            return;

        connection = new RTCPeerConnection({iceServers: new Array()});
        connection.addTransceiver('video', {direction: 'recvonly'});
        connection.ontrack = function(event) { video.srcObject = event.streams[0]; };
        connection.oniceconnectionstatechange = function() { if (['disconnected', 'failed'].includes(connection.iceConnectionState)) { this.stop(connection); this.play(video, id, subStream); } }.bind(this);

        connection.createOffer().then(offer => connection.setLocalDescription(offer)).then(function()
        {
            function wait(resolve)
            {
                if (deadline > Date.now() && connection.iceGatheringState != 'complete')
                {
                    setTimeout(wait.bind(this, resolve), 50);
                    return;
                }

                resolve();
            }

            new Promise(wait.bind(this)).then(function() { this.controller.socket.publish('command/camera', {action: 'getStream', id: video.id, device: id, subStream: subStream && device.subStream ? true : false, sdp: connection.localDescription.sdp}); }.bind(this));

        }.bind(this));

        video.connection = connection;
        video.id = 'stream-' + randomString(8);

        this.connections.push(connection);
    }

    stop(connection)
    {
        if (connection)
        {
            let index = this.connections.indexOf(connection);

            if (index >= 0)
                this.connections.splice(index, 1);

            connection.close();
            return;
        }

        this.connections.forEach(item => item.close());
        this.connections = new Array();
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split('=') : new Array();
        let device;

        menu.innerHTML  = '<span id="list"><i class="mdi-menu"></i> List</span>';
        menu.innerHTML += '<span id="add"><i class="mdi-plus"></i> Add</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage('camera'); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showDeviceEdit(); }.bind(this));

        if (!this.status.version)
            return;

        if (list[0] == 'device')
            device = this.findDevice(list[1]);

        if (device)
            this.showDeviceInfo(device);
        else
            this.showDeviceList();

        this.updatePage();
    }

    showDeviceList()
    {
        this.stop();

        if (!this.status.devices?.length)
        {
            this.content.innerHTML = '<div class="emptyList">camera devices list is empty</div>';
            return;
        }

        loadHTML('html/camera/deviceList.html', this, this.content, function()
        {
            let list = this.content.querySelector('.cameraList');

            this.status.devices.forEach(device =>
            {
                let title = document.createElement('span');
                let item = document.createElement('div');
                let video = this.addVideo(item);

                title.innerHTML = device.name;
                title.classList.add('title');

                item.classList.add('cameraItem');
                item.addEventListener('click', function() { this.controller.showPage('camera?device=' + device.id); }.bind(this));

                item.append(title);
                list.append(item);

                this.play(video, device.id, true);
            });

        }.bind(this));
    }

    showDeviceInfo(device)
    {
        this.stop();

        loadHTML('html/camera/deviceInfo.html', this, this.content, function()
        {
            let video = this.addVideo(this.content.querySelector('.cameraView'));

            this.content.querySelector('.name').innerHTML = device.name;
            this.content.querySelector('.id').innerHTML = device.id;
            this.content.querySelector('.mainStream').innerHTML = device.mainStream;
            this.content.querySelector('.subStream').innerHTML = device.subStream ?? empty;

            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(device); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(device); }.bind(this));

            handleArrowButtons(this.content, this.status.devices.map(item => item.id), this.status.devices.indexOf(device), function(id) { this.controller.showPage('camera?device=' + id); }.bind(this));

            video.addEventListener('click', function() { this.requestFullscreen ? this.requestFullscreen() : this.webkitEnterFullscreen(); });
            this.play(video, device.id);

        }.bind(this));
    }

    showDeviceEdit(device)
    {
        let add = false;

        if (!device)
        {
            device = {name: 'Camera ' + (this.status.devices ? this.status.devices.length + 1 : 1)};
            add = true;
        }

        loadHTML('html/camera/deviceEdit.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.name;
            modal.querySelector('input[name="name"]').value = device.name;
            modal.querySelector('input[name="mainStream"]').value = device.mainStream ?? '';
            modal.querySelector('input[name="subStream"]').value = device.subStream ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                this.device = device;
                this.controller.socket.publish('command/camera', {action: 'updateDevice', device: add ? null : device.id, data: formData(modal.querySelector('form'))});

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true, 'input[name="name"]');
        });
    }

    showDeviceRemove(device)
    {
        loadHTML('html/camera/deviceRemove.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.controller.socket.publish('command/camera', {action: 'removeDevice', device: device.id}); this.controller.clearPage(); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }
}
