class Modbus extends DeviceService
{
    deviceType =
    {
        customController:      'Custom Modbus Device',
        homedRelayController:  'HOMEd Relay Controller',
        homedSwitchController: 'HOMEd Switch Controller',
        wbMap3e:               'Wiren Board WB-MAP3E',
        wbMap12h:              'Wiren Board WB-MAP12H'
    };

    constructor(controller, instance)
    {
        super(controller, 'modbus', instance);
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = this.version ? 'Modbus ' + this.version : '<i>unknown</i>';
    }

    parseMessage(list, message)
    {
        if (list[0] == 'status')
        {
            let check = Object.keys(this.devices).length ? false : true;

            this.names = message.names;
            this.version = message.version;

            message.devices.forEach(device =>
            {
                device.id = device.portId + '.' + device.slaveId;

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
                if (message.devices.filter(device => (device.portId + '.' + device.slaveId) == id).length)
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

            return;
        }

        super.parseMessage(list, message);
    }

    parseValue(key, value)
    {
        return key != 'type' ? super.parseValue(key, value) : this.deviceType[value] ?? '<span class="shade">' + value + '</span>';
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split('=') : new Array();
        let device;

        menu.innerHTML  = '<span id="list"><i class="icon-list"></i> List</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage(this.service); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showDeviceEdit(); }.bind(this));

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

        fetch('html/modbus/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let table;
            let count = 0;

            this.content.innerHTML = html;
            table = this.content.querySelector('.deviceList table');

            Object.keys(this.devices).forEach(id =>
            {
                let device = this.devices[id];
                let row = table.querySelector('tbody').insertRow();

                row.dataset.device = this.service + '/' + device.id;
                row.addEventListener('click', function() { this.controller.showPage(this.service + '?device=' + device.id); }.bind(this));

                for (let i = 0; i < 6; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:

                            cell.innerHTML = device.info.name;

                            if (device.info.note)
                                row.title = device.info.note;

                            break;

                        case 1: cell.innerHTML = this.deviceType[device.info.type] ?? '<span class="shade">' + device.info.type + '</span>'; cell.classList.add('mobileHidden'); break;
                        case 2: cell.innerHTML = '<span class="value">' + device.info.portId + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = '<span class="value">' + device.info.slaveId + '</span>'; cell.classList.add('center'); break;
                        case 4: cell.innerHTML = this.parseValue('discovery', device.info.discovery); cell.classList.add('center', 'mobileHidden'); break;
                        case 5: cell.innerHTML = this.parseValue('cloud', device.info.cloud); cell.classList.add('center', 'mobileHidden'); break;
                    }
                }

                count++;
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index); localStorage.setItem('customSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('customSort') ?? 0);

            table.querySelector('tfoot').innerHTML='<tr><th colspan="7">' + count + (count > 1 ? ' devices ' : ' device ') + 'total</th></tr>';
        });
    }

    showDeviceEdit(device)
    {
        let add = false;

        if (!device)
        {
            let random = randomString(4);
            device = {info: {name: 'Device ' + random, id: 'device_' + random, active: true}};
            add = true;
        }

        fetch('html/modbus/deviceEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('input[name="name"]').value = device.info.name;
            modal.querySelector('textarea[name="note"]').value = device.info.note ?? '';

            Object.keys(this.deviceType).forEach(key =>
            {
                let option = document.createElement('option');

                option.innerHTML = this.deviceType[key];
                option.value = key;

                modal.querySelector('select[name="type"]').append(option);

                if (device.info.type != key)
                    return;

                if (key != 'customController')
                    modal.querySelector('.custom').style.display = 'none';
    
                modal.querySelector('select[name="type"]').value = key;
            });

            modal.querySelector('input[name="portId"]').value = device.info.portId ?? 1;
            modal.querySelector('input[name="slaveId"]').value = device.info.slaveId ?? 1;
            modal.querySelector('input[name="baudRate"]').value = device.info.baudRate ?? 9600;
            modal.querySelector('input[name="pollInterval"]').value = device.info.pollInterval ?? 1000;
            modal.querySelector('input[name="requestTimeout"]').value = device.info.requestTimeout ?? 1000;
            modal.querySelector('input[name="replyTimeout"]').value = device.info.replyTimeout ?? 20;
            modal.querySelector('textarea[name="items"]').value = device.info.items ? JSON.stringify(device.info.items, null, 2) : '';
            modal.querySelector('textarea[name="options"]').value = device.info.options ? JSON.stringify(device.info.options, null, 2) : '';
            modal.querySelector('input[name="discovery"]').checked = device.info.discovery;
            modal.querySelector('input[name="cloud"]').checked = device.info.cloud;
            modal.querySelector('input[name="active"]').checked = device.info.active;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (form.type == 'customController' && form.items)
                    try { form.items = JSON.parse(form.items); } catch { modal.querySelector('textarea[name="items"]').classList.add('error'); return; }
                else
                    delete form.items;

                if (form.type == 'customController' && form.options)
                    try { form.options = JSON.parse(form.options); } catch { modal.querySelector('textarea[name="options"]').classList.add('error'); return; }
                else
                    delete form.options;

                this.serviceCommand({action: 'updateDevice', device: add ? null : this.names ? device.info.name : device.id, data: form});

            }.bind(this));
            
            modal.querySelector('select[name="type"]').addEventListener('change', function(event) { modal.querySelector('.custom').style.display = event.target.value == 'customController' ? 'block' : 'none'; });
            modal.querySelector('textarea[name="items"]').addEventListener('input', function() { this.classList.remove('error'); });
            modal.querySelector('textarea[name="options"]').addEventListener('input', function() { this.classList.remove('error'); });
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true, 'input[name="name"]');
        });
    }
}
