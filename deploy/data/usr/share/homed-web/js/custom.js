class Custom
{
    content = document.querySelector('.content .container');

    status = new Object();
    expose = new Object();

    constructor(controller)
    {
        this.controller = controller;
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':

                this.status = message;

                if (this.controller.service == 'custom')
                {
                    document.querySelector('#serviceVersion').innerHTML = this.status.version;
                    this.showDeviceList();
                }

                this.status.devices.forEach(device =>
                {
                    var item = this.status.names && device.name ? device.name : device.id;
                    this.controller.socket.subscribe('expose/custom/' + item);
                    this.controller.socket.subscribe('fd/custom/' + item);
                });

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

                var device = this.status.devices ? this.status.devices.find(item => this.status.names ? item.name == list[2] : item.id == list[2]) : undefined;
                var row = document.querySelector('tr[data-device="' + list[2] + '"]');

                if (this.controller.page == 'custom' && device && row)
                {
                    row.classList.remove('online', 'offline', 'inactive');

                    if (device.active)
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

                break;

            case 'expose':
                this.expose[list[2]] = message;
                break;

            case 'fd':

                if (this.device && (this.status.names ? this.device.name == list[2] : this.device.id == list[2]))
                    Object.keys(message).forEach(item => { updateExpose('common', item, message[item]); });

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

        menu.innerHTML = null;

        menu.innerHTML += '<span id="list"><i class="icon-list"></i> Devices</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.showDeviceList(); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showDeviceEdit(true); }.bind(this));

        if (!this.status)
            return;

        document.querySelector('#serviceVersion').innerHTML = this.status.version;
    }

    showDeviceList()
    {
        this.controller.setService('custom');
        this.controller.setPage('custom');

        if (!this.status.devices || !this.status.devices.length)
        {
            this.content.innerHTML = '<div class="emptyList">custom devices list is empty</div>';
            return;
        }

        fetch('html/custom/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var table;

            this.content.innerHTML = html;
            table = this.content.querySelector('.deviceList table');

            this.status.devices.forEach(device =>
            {
                var row = table.querySelector('tbody').insertRow();

                if (!device.name)
                    device.name = device.id;

                row.addEventListener('click', function() { this.device = device; this.showDeviceInfo(); }.bind(this));
                row.dataset.device = this.status.names ? device.name : device.id;

                for (var i = 0; i < 7; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = device.name; break;
                        case 1: cell.innerHTML = device.id; break;
                        case 2: cell.innerHTML = '<span class="value">' + device.exposes.length + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = this.parseValue('real', device.real); cell.classList.add('center'); break;
                        case 4: cell.innerHTML = empty; cell.classList.add('availability', 'center'); break;
                        case 5: cell.innerHTML = this.parseValue('discovery', device.discovery); cell.classList.add('center'); break;
                        case 6: cell.innerHTML = this.parseValue('cloud', device.cloud); cell.classList.add('center'); break;
                    }
                }

                this.controller.socket.subscribe('device/custom/' + (this.status.names ? device.name : device.id));
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index, false); localStorage.setItem('customSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('customSort') ?? 0, false);
        });
    }

    showDeviceInfo()
    {
        var expose = this.device.active ? this.expose[this.status.names ? this.device.name : this.device.id] : new Object();

        this.controller.setService('custom');
        this.controller.setPage('customDevice');

        if (!this.device)
        {
            this.controller.clearPage('custom', 'custom device data is empty');
            return;
        }

        fetch('html/custom/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            this.content.innerHTML = html;
            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(); }.bind(this));
            this.content.querySelector('.topics').addEventListener('click', function() { this.showDeviceTopics(); }.bind(this));

            for (var key in this.device)
            {
                var cell = document.querySelector('.' + key);
                var row = cell ? cell.closest('tr') : undefined;

                if (key == 'exposes')
                    continue;

                if (cell)
                    cell.innerHTML = this.parseValue(key, this.device[key]);

                if (row)
                    row.style.display = 'table-row';
            }

            if (!expose.common)
            {
                this.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            expose.common.items.forEach(item => { addExpose('common', item, expose.options); });
            this.controller.socket.publish('command/custom', {action: 'getProperties', device: this.device.id});
        });
    }

    showDeviceEdit(add = false)
    {
        if (add)
        {
            var random = Math.random().toString(36).substring(2, 7);
            this.device = {name: 'Device ' + random, id: 'device_' + random, active: true, exposes: ['switch']};
        }

        fetch('html/custom/deviceEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = this.device.name;
            modal.querySelector('input[name="name"]').value = this.device.name;
            modal.querySelector('input[name="id"]').value = this.device.id;
            modal.querySelector('input[name="real"]').checked = this.device.real;
            modal.querySelector('input[name="exposes"]').value = this.device.exposes.join(', ');
            modal.querySelector('textarea[name="options"]').value = this.device.options ? JSON.stringify(this.device.options) : '';
            modal.querySelector('input[name="active"]').checked = this.device.active;
            modal.querySelector('input[name="discovery"]').checked = this.device.discovery;
            modal.querySelector('input[name="cloud"]').checked = this.device.cloud;

            modal.querySelector('.save').addEventListener('click', function()
            {
                var data = formData(modal.querySelector('form'));

                if (data.exposes)
                    data.exposes = data.exposes.split(',').map(item =>item.trim());
                else
                    delete data.exposes;

                if (data.options)
                    data.options = JSON.parse(data.options);
                else
                    delete data.options;

                this.controller.socket.publish('command/custom', {action: 'updateDevice', device: add ? null : this.device.name, data: data});

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }

    showDeviceRemove()
    {
        fetch('html/custom/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = this.device.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.controller.socket.publish('command/custom', {action: 'removeDevice', device: this.device.name}); this.controller.clearPage('custom'); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }

    showDeviceTopics() // TODO: refactor and add prefix?
    {
        fetch('html/custom/deviceTopics.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var item = this.status.names ? this.device.name : this.device.id;
            var list;

            modal.querySelector('.data').innerHTML = html;

            list = modal.querySelector('.list');
            list.innerHTML += '<label>Availability:</label><pre>{prefix}/device/custom/' + item + '</pre>';
            list.innerHTML += '<label>Exposes:</label><pre>{prefix}/expose/custom/' + item + '</pre>';
            list.innerHTML += '<label>From device:</label><pre>{prefix}/fd/custom/' + item + '</pre>';
            list.innerHTML += '<label>To device:</label><pre>{prefix}/td/custom/' + item + '</pre>';

            modal.querySelector('.name').innerHTML = this.device.name;
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }
}
