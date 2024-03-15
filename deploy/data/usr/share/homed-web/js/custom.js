class Custom
{
    content = document.querySelector('.content .container');
    devices = new Object();

    constructor(controller)
    {
        this.controller = controller;
    }

    findDevice(item)
    {
        return this.names ? Object.values(this.devices).find(device => device.info.name == item) : this.devices[item];
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':

                var check = false;

                this.names = message.names;
                this.version = message.version;

                message.devices.forEach(device =>
                {
                    if (!device.name)
                        device.name = device.id;

                    if (!this.devices[device.id])
                    {
                        this.devices[device.id] = new Device('custom', device.id);
                        this.controller.socket.subscribe('expose/custom/' + (this.names ? device.name : device.id));
                        check = true;
                    }

                    this.devices[device.id].info = device;
                });

                Object.keys(this.devices).forEach(id =>
                {
                    if (message.devices.filter(device => device.id == id).length)
                        return;

                    delete this.devices[id];
                    check = true;
                });

                if (this.controller.service == 'custom')
                {
                    if (check)
                        this.showDeviceList();

                    document.querySelector('#serviceVersion').innerHTML = this.version;
                }

                break;

            case 'event':

                var html = 'Device <b>' + message.device + '</b> ';

                if (message.event == 'added' || message.event == 'updated')
                    this.controller.clearPage('custom');

                switch (message.event)
                {
                    case 'idDuplicate':    this.controller.showToast(html + 'identifier is already in use', 'error'); return;
                    case 'nameDuplicate':  this.controller.showToast(html + 'name is already in use', 'error'); return;
                    case 'incompleteData': this.controller.showToast(html + 'data is incomplete', 'error'); return;
                    case 'added':          this.controller.showToast(html + 'successfully added'); return;
                    case 'updated':        this.controller.showToast(html + 'successfully updated'); return;
                    case 'removed':        this.controller.showToast(html + 'removed', 'warning'); return;
                }

                break;

            case 'device':

                var device = this.findDevice(list[2]);

                if (device && message)
                {
                    var row = document.querySelector('tr[data-device="' + device.info.id + '"]');

                    device.info.lastSeen = message.lastSeen;

                    if (this.controller.page == 'custom' && row)
                    {
                        row.classList.remove('online', 'offline', 'inactive');

                        if (device.info.active)
                        {
                            row.classList.add(message.status);
                            row.querySelector('.availability').innerHTML = '<i class="' + (message.status == "online" ? 'icon-true success' : 'icon-false error') + '"></i>';
                        }
                        else
                        {
                            row.classList.add('inactive');
                            row.querySelector('.availability').innerHTML = '<i class="icon-false shade"></i>';
                        }
                    }
                }

                break;

            case 'expose':

                var device = this.findDevice(list[2]);

                if (device && message)
                {
                    var item = this.names ? device.info.name : device.info.id;

                    Object.keys(message).forEach(endpoint =>
                    {
                        this.controller.socket.subscribe('fd/custom/' + (endpoint != 'common' ? item + '/' + endpoint : item));
                        device.setExposes(endpoint, message[endpoint]);
                    });

                    this.controller.socket.publish('command/custom', {action: 'getProperties', device: item});
                }

                break;

            case 'fd':

                var device = this.findDevice(list[2]);

                if (device)
                {
                    var endpoint = list[3] ?? 'common';
                    device.setProperties(endpoint, message);
                    Object.keys(message).forEach(name => { updateExpose(device, endpoint, name, message[name]); });
                }

                break;
        }
    }

    parseValue(key, value)
    {
        switch (key)
        {
            case 'active':
            case 'cloud':
            case 'discovery':
            case 'real':
                return value != undefined ? '<i class="icon-' + (value ? 'true' : 'false') + ' ' + (value ? 'success' : 'shade') + '"></i>' : empty;

            default: return value;
        }
    }

    showMenu()
    {
        var menu = document.querySelector('.menu');

        menu.innerHTML  = null;
        menu.innerHTML += '<span id="list"><i class="icon-list"></i> Devices</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.showDeviceList(); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showDeviceEdit(); }.bind(this));

        if (!this.status)
            return;

        document.querySelector('#serviceVersion').innerHTML = this.version ?? 'unknown';
    }

    showDeviceList()
    {
        this.controller.setService('custom');
        this.controller.setPage('custom');

        if (!Object.keys(this.devices).length)
        {
            this.content.innerHTML = '<div class="emptyList">custom devices list is empty</div>';
            return;
        }

        fetch('html/custom/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var table;

            this.content.innerHTML = html;
            table = this.content.querySelector('.deviceList table');

            Object.keys(this.devices).forEach(id =>
            {
                var device = this.devices[id];
                var row = table.querySelector('tbody').insertRow();

                row.addEventListener('click', function() { this.showDeviceInfo(device); }.bind(this));
                row.dataset.device = device.info.id;

                for (var i = 0; i < 7; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = device.info.name; break;
                        case 1: cell.innerHTML = device.info.id; break;
                        case 2: cell.innerHTML = '<span class="value">' + device.info.exposes.length + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = this.parseValue('real', device.info.real); cell.classList.add('center'); break;
                        case 4: cell.innerHTML = this.parseValue('discovery', device.info.discovery); cell.classList.add('center'); break;
                        case 5: cell.innerHTML = this.parseValue('cloud', device.info.cloud); cell.classList.add('center'); break;
                        case 6: cell.innerHTML = empty; cell.classList.add('availability', 'center'); break;
                    }

                }

                this.controller.socket.subscribe('device/custom/' + (this.names ? device.info.name : device.info.id));
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index, false); localStorage.setItem('customSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('customSort') ?? 0, false);
        });
    }

    showDeviceInfo(device)
    {
        this.controller.setService('custom');
        this.controller.setPage('customDevice');

        fetch('html/custom/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var table;

            this.content.innerHTML = html;
            table = this.content.querySelector('table.exposes');

            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(device); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(device); }.bind(this));
            this.content.querySelector('.topics').addEventListener('click', function() { this.showDeviceTopics(device); }.bind(this));

            Object.keys(device.info).forEach(key =>
            {
                var cell = document.querySelector('.' + key);
                var row = cell ? cell.closest('tr') : undefined;

                if (key == 'exposes')
                    return;

                if (cell)
                    cell.innerHTML = this.parseValue(key, device.info[key]);

                if (!row)
                    return;

                row.style.display = 'table-row';
            });

            if (!device.info.active)
            {
                this.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            Object.keys(device.endpoints).forEach(endpoint => { device.items(endpoint).forEach(expose => { addExpose(table, device, endpoint, expose); }); });
        });
    }

    showDeviceEdit(device = undefined)
    {
        var add = false;

        if (!device)
        {
            var random = Math.random().toString(36).substring(2, 7);
            device = {info: {name: 'Device ' + random, id: 'device_' + random, active: true, exposes: ['switch']}};
            add = true;
        }

        fetch('html/custom/deviceEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('input[name="name"]').value = device.info.name;
            modal.querySelector('input[name="id"]').value = device.info.id;
            modal.querySelector('input[name="real"]').checked = device.info.real;
            modal.querySelector('input[name="exposes"]').value = device.info.exposes.join(', ');
            modal.querySelector('textarea[name="options"]').value = device.info.options ? JSON.stringify(device.info.options) : '';
            modal.querySelector('input[name="discovery"]').checked = device.info.discovery;
            modal.querySelector('input[name="cloud"]').checked = device.info.cloud;
            modal.querySelector('input[name="active"]').checked = device.info.active;

            modal.querySelector('.save').addEventListener('click', function()
            {
                var form = formData(modal.querySelector('form'));

                if (form.exposes)
                    form.exposes = form.exposes.split(',').map(item =>item.trim());
                else
                    delete form.exposes;

                if (form.options)
                    form.options = JSON.parse(form.options);
                else
                    delete form.options;

                this.controller.socket.publish('command/custom', {action: 'updateDevice', device: add ? null : this.names ? device.info.name : device.info.id, data: form});

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }

    showDeviceRemove(device)
    {
        fetch('html/custom/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.controller.socket.publish('command/custom', {action: 'removeDevice', device: this.names ? device.info.name : device.info.id}); this.controller.clearPage('custom'); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }

    showDeviceTopics(device) // TODO: refactor and add prefix?
    {
        // fetch('html/custom/deviceTopics.html?' + Date.now()).then(response => response.text()).then(html =>
        // {
        //     var item = this.status.names ? this.device.name : this.device.id;
        //     var list;

        //     modal.querySelector('.data').innerHTML = html;

        //     list = modal.querySelector('.list');
        //     list.innerHTML += '<label>Availability:</label><pre>{prefix}/device/custom/' + item + '</pre>';
        //     list.innerHTML += '<label>Exposes:</label><pre>{prefix}/expose/custom/' + item + '</pre>';
        //     list.innerHTML += '<label>From device:</label><pre>{prefix}/fd/custom/' + item + '</pre>';
        //     list.innerHTML += '<label>To device:</label><pre>{prefix}/td/custom/' + item + '</pre>';

        //     modal.querySelector('.name').innerHTML = this.device.name;
        //     modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

        //     showModal(true);
        // });
    }
}
