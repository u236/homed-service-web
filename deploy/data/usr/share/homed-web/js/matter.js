class Matter extends DeviceService
{
    constructor(controller, instance)
    {
        super(controller, 'matter', instance);
        // this.shareTimer = null;
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = this.version ? 'Matter ' + this.version : '<i>unknown</i>';
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':
            {
                let check = Object.keys(this.devices).length ? false : true;

                this.names = message.names;
                this.version = message.version;

                message.devices.forEach(device =>
                {
                    device.id = device.nodeId;

                    if (!device.name)
                        device.name = device.id;

                    if (!this.devices[device.id])
                    {
                        let item = this.names ? device.name : device.id;

                        this.devices[device.id] = new Device(this.service, device.id);
                        this.controller.socket.subscribe('expose/' + this.service + '/' + item);
                        this.controller.socket.subscribe('device/' + this.service + '/' + item);

                        check = true;
                    }

                    this.devices[device.id].info = device;

                    if (this.controller.service != this.service || this.devices[device.id] != this.device)
                        return;

                    this.showDeviceInfo(this.device);
                });

                Object.keys(this.devices).forEach(id =>
                {
                    if (message.devices.filter(device => device.id == id).length)
                        return;

                    delete this.devices[id];
                    check = true;
                });

                if (this.controller.service == this.service)
                {
                    if (check)
                        this.controller.showPage(this.service);

                    this.updatePage();
                }

                break;
            }

            case 'event':
            {
                let html = 'Device <b>' + (message.device ?? message.nodeId) + '</b> ';

                if (this.controller.service != this.service)
                    break;

                switch (message.event)
                {
                    case 'deviceFound':      this.controller.showToast(html + 'found'); break;
                    case 'deviceConnecting': this.controller.showToast(html + 'connecting'); break;
                    case 'networkSetup':     this.controller.showToast(html + 'setting up network'); break;
                    case 'deviceNotFound':   this.controller.showToast(html + 'not found', 'warning'); break;
                    case 'connectFailed':    this.controller.showToast(html + 'connection failed', 'error'); break;
                    case 'nameDuplicate':    this.controller.showToast(html + 'new name is already in use', 'error'); break;
                    case 'incompleteData':   this.controller.showToast(html + 'data is incomplete', 'error'); break;
                    case 'removed':          this.controller.showToast(html + 'removed', 'warning'); break;

                    case 'added':
                        this.controller.showToast(html + 'successfully added');
                        this.controller.clearPage();
                        this.devices = new Object();
                        break;

                    case 'updated':
                        this.controller.showToast(html + 'successfully updated');
                        showModal(false);
                        break;
                }

                break;
            }

            default:
                super.parseMessage(list, message);
                break;
        }

        // if (list[0] == 'device')
        // {
        //     let device = this.findDevice(list[2]);

        //     if (device && message.sharing)
        //     {
        //         device.sharing = message.sharing;

        //         if (this.controller.service == this.service && device == this.device)
        //             this.updateShareButton(device);

        //         this.updateShareModal(device);
        //     }
        //     else if (device && device.sharing)
        //     {
        //         delete device.sharing;

        //         if (this.controller.service == this.service && device == this.device)
        //             this.updateShareButton(device);

        //         this.updateShareModal(device);
        //     }
        // }
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split('=') : new Array();
        let device;

        menu.innerHTML  = '<span id="list"><i class="icon-list"></i> List</span>';
        menu.innerHTML += '<span id="connect"><i class="icon-plus"></i> Connect</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage(this.service); }.bind(this));
        menu.querySelector('#connect').addEventListener('click', function() { this.showDeviceConnect(); }.bind(this));

        if (list[0] == 'device')
            device = this.devices[list[1]];

        if (device)
            this.showDeviceInfo(device);
        else
            this.showDeviceList();

        this.device = device;
        this.updatePage();
    }

    showDeviceList()
    {
        if (!Object.keys(this.devices).length)
        {
            this.content.innerHTML = '<div class="emptyList">' + this.service + ' devices list is empty</div>';
            return;
        }

        loadHTML('html/matter/deviceList.html', this, this.content, function()
        {
            let table = this.content.querySelector('.deviceList table');

            Object.keys(this.devices).forEach(id =>
            {
                let device = this.devices[id];
                let row = table.querySelector('tbody').insertRow();

                row.dataset.device = this.service + '/' + device.id;
                row.addEventListener('click', function() { this.controller.showPage(this.service + '?device=' + device.id); }.bind(this));

                for (let i = 0; i < 4; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:

                            cell.innerHTML = device.info.name;
                            cell.colSpan = 2;

                            if (device.info.note)
                                row.title = device.info.note;

                            break;

                        case 1: cell.innerHTML = device.info.modelName ?? ''; cell.classList.add('mobileHidden'); break;
                        case 2: cell.innerHTML = this.parseValue(device.info, 'discovery'); cell.classList.add('center', 'mobileHidden'); break;
                        case 3: cell.innerHTML = this.parseValue(device.info, 'cloud'); cell.classList.add('center', 'mobileHidden'); break;
                    }
                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index); localStorage.setItem('homedMatterSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('homedMatterSort') ?? 0);
            addTableSearch(table, 'devices', 'device', 5, [0, 1]);
        });
    }

    showDeviceConnect()
    {
        loadHTML('html/matter/deviceConnect.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.connect').addEventListener('click', function()
            {
                let code = modal.querySelector('input[name="code"]').value.trim();

                if (!code)
                    return;

                this.serviceCommand({action: 'connectDevice', code: code});
                showModal(false);

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true, 'input[name="code"]');
        });
    }

    showDeviceEdit(device)
    {
        loadHTML('html/matter/deviceEdit.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('input[name="name"]').placeholder = device.id;
            modal.querySelector('input[name="name"]').value = device.info.name != device.id ? device.info.name : '';
            modal.querySelector('textarea[name="note"]').value = device.info.note ?? '';
            modal.querySelector('input[name="discovery"]').checked = device.info.discovery;
            modal.querySelector('input[name="cloud"]').checked = device.info.cloud;
            modal.querySelector('input[name="active"]').checked = device.info.active;
            modal.querySelector('.save').addEventListener('click', function() { this.serviceCommand({...{action: 'updateDevice', device: device.id}, ...formData(modal.querySelector('form'))}); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true, 'input[name="name"]');
        });
    }

    // showDeviceShare(device)
    // {
    //     loadHTML('html/matter/deviceShare.html', this, modal.querySelector('.data'), function()
    //     {
    //         modal.querySelector('.name').innerHTML = device.info.name;

    //         modal.querySelector('.start').addEventListener('click', function()
    //         {
    //             this.serviceCommand({action: 'shareDevice', device: this.names ? device.info.name : device.id});
    //         }.bind(this));

    //         modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

    //         if (device.sharing)
    //         {
    //             modal.querySelector('.start').disabled = true;
    //             modal.querySelector('.start').classList.add('shade');
    //             modal.querySelector('.active').style.display = 'block';
    //             this.startShareCountdown(device);
    //         }

    //         showModal(true);
    //     });
    // }

    // updateShareButton()
    // {
    // }

    // updateShareModal(device)
    // {
    //     let section = modal.querySelector('.deviceShare');

    //     if (!section)
    //         return;

    //     if (device.sharing)
    //     {
    //         section.querySelector('.start').disabled = true;
    //         section.querySelector('.start').classList.add('shade');
    //         section.querySelector('.active').style.display = 'block';
    //         this.startShareCountdown(device);
    //     }
    //     else
    //     {
    //         if (this.shareTimer)
    //         {
    //             clearInterval(this.shareTimer);
    //             this.shareTimer = null;
    //         }

    //         showModal(false);
    //     }
    // }

    // startShareCountdown(device)
    // {
    //     let section = modal.querySelector('.deviceShare .active');

    //     if (!section || !device.sharing)
    //         return;

    //     let code = device.sharing.manualCode;
    //     let formatted = code.slice(0, 4) + '-' + code.slice(4, 7) + '-' + code.slice(7);
    //     section.querySelector('.manualCode').innerHTML = '<span class="value">' + formatted + '</span>';
    //     section.querySelector('.qrCode').innerHTML = '<span class="value">' + device.sharing.qrCode + '</span>';

    //     if (this.shareTimer)
    //         clearInterval(this.shareTimer);

    //     let update = function()
    //     {
    //         let remaining = device.sharing.endTime - Math.floor(Date.now() / 1000);

    //         if (remaining > 0)
    //         {
    //             let min = Math.floor(remaining / 60);
    //             let sec = remaining % 60;
    //             section.querySelector('.countdown').innerHTML = min + ':' + String(sec).padStart(2, '0');
    //         }
    //         else
    //         {
    //             section.querySelector('.countdown').innerHTML = 'expired';
    //             clearInterval(this.shareTimer);
    //             this.shareTimer = null;
    //         }
    //     }.bind(this);

    //     update();
    //     this.shareTimer = setInterval(update, 1000);
    // }
}
