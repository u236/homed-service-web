class Modbus extends DeviceService
{
    deviceType =
    {
        homedRelayController:  'HOMEd Relay Controller',
        homedSwitchController: 'HOMEd Switch Controller',
        wbMap3e:               'Wiren Board WB-MAP3E',
        wbMap12h:              'Wiren Board WB-MAP12H'
    };

    constructor(controller)
    {
        super(controller, 'modbus');
    }

    parseMessage(list, message)
    {
        if (list[0] == 'status')
        {
            var check = false;

            this.names = message.names;
            this.version = message.version;

            message.devices.forEach(device =>
            {
                device.id = device.portId + '.' + device.slaveId;

                if (!device.name)
                    device.name = device.id;

                if (!this.devices[device.id])
                {
                    this.devices[device.id] = new Device('modbus', device.id);
                    this.controller.socket.subscribe('expose/modbus/' + (this.names ? device.name : device.id));
                    check = true;
                }

                // TODO: remove it
                device.active = true;
                device.discovery = true;
                device.cloud = true;
                //

                this.devices[device.id].info = device;
            });

            Object.keys(this.devices).forEach(id =>
            {
                if (message.devices.filter(device => (device.portId + '.' + device.slaveId) == id).length)
                    return;

                delete this.devices[id];
                check = true;
            });

            if (this.controller.service == 'modbus')
            {
                if (check)
                    this.showDeviceList();

                document.querySelector('#serviceVersion').innerHTML = 'Modbus ' + this.version;
            }

            return;
        }

        super.parseMessage(list, message);
    }

    parseValue(key, value)
    {
        return key != 'type' ? super.parseValue(key, value) : this.deviceType[value] ?? '<span class="shade">' + value + '</span>';
    }

    showMenu()
    {
        var menu = document.querySelector('.menu');

        menu.innerHTML  = '<span id="list"><i class="icon-list"></i> Devices</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.showDeviceList(); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showDeviceEdit(); }.bind(this));

        document.querySelector('#serviceVersion').innerHTML = this.version ? 'Modbus ' + this.version : 'unknown';
    }

    showDeviceList()
    {
        this.controller.setService('modbus');
        this.controller.setPage('modbus');

        if (!Object.keys(this.devices).length)
        {
            this.content.innerHTML = '<div class="emptyList">modbus devices list is empty</div>';
            return;
        }

        fetch('html/modbus/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
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
                        case 0:

                            cell.innerHTML = device.info.name;

                            if (device.info.note)
                            {
                                cell.innerHTML += '<span class="note">' + device.info.note + '</span>';
                                row.classList.add('tooltip');
                            }

                            break;

                        case 1: cell.innerHTML = this.deviceType[device.info.type] ?? '<span class="shade">' + device.info.type + '</span>'; break;
                        case 2: cell.innerHTML = '<span class="value">' + device.info.portId + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = '<span class="value">' + device.info.slaveId + '</span>'; cell.classList.add('center'); break;
                        case 4: cell.innerHTML = this.parseValue('discovery', device.info.discovery); cell.classList.add('center'); break;
                        case 5: cell.innerHTML = this.parseValue('cloud', device.info.cloud); cell.classList.add('center'); break;
                        case 6: cell.innerHTML = empty; cell.classList.add('availability', 'center'); break;
                    }

                }

                this.controller.socket.subscribe('device/modbus/' + (this.names ? device.info.name : device.info.id));
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index, false); localStorage.setItem('customSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('customSort') ?? 0, false);
        });
    }

    showDeviceEdit(device = undefined)
    {
        // var add = false;

        // if (!device)
        // {
        //     var random = Math.random().toString(36).substring(2, 7);
        //     device = {info: {name: 'Device ' + random, id: 'device_' + random, active: true, exposes: ['switch']}};
        //     add = true;
        // }

        // fetch('html/custom/deviceEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        // {
        //     modal.querySelector('.data').innerHTML = html;
        //     modal.querySelector('.name').innerHTML = device.info.name;
        //     modal.querySelector('input[name="name"]').value = device.info.name;
        //     modal.querySelector('textarea[name="note"]').value = device.info.note ?? '';
        //     modal.querySelector('input[name="id"]').value = device.info.id;
        //     modal.querySelector('input[name="real"]').checked = device.info.real;
        //     modal.querySelector('input[name="exposes"]').value = device.info.exposes.join(', ');
        //     modal.querySelector('textarea[name="options"]').value = device.info.options ? JSON.stringify(device.info.options) : '';
        //     modal.querySelector('input[name="discovery"]').checked = device.info.discovery;
        //     modal.querySelector('input[name="cloud"]').checked = device.info.cloud;
        //     modal.querySelector('input[name="active"]').checked = device.info.active;

        //     modal.querySelector('.save').addEventListener('click', function()
        //     {
        //         var form = formData(modal.querySelector('form'));

        //         if (form.exposes)
        //             form.exposes = form.exposes.split(',').map(item =>item.trim());
        //         else
        //             delete form.exposes;

        //         if (form.options)
        //             form.options = JSON.parse(form.options);
        //         else
        //             delete form.options;

        //         this.controller.socket.publish('command/custom', {action: 'updateDevice', device: add ? null : this.names ? device.info.name : device.info.id, data: form});

        //     }.bind(this));

        //     modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

        //     modal.removeEventListener('keypress', handleSave);
        //     modal.addEventListener('keypress', handleSave);
        //     showModal(true);

        //     modal.querySelector('input[name="name"]').focus();
        // });
    }

    showDeviceRemove(device)
    {
        // fetch('html/custom/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        // {
        //     modal.querySelector('.data').innerHTML = html;
        //     modal.querySelector('.name').innerHTML = device.info.name;
        //     modal.querySelector('.remove').addEventListener('click', function() { this.controller.socket.publish('command/custom', {action: 'removeDevice', device: this.names ? device.info.name : device.info.id}); this.controller.clearPage('custom'); }.bind(this));
        //     modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

        //     showModal(true);
        // });
    }
}
