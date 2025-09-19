class Modbus extends DeviceService
{
    deviceType =
    {
        customController:      'Custom Modbus Controller',
        homedRelayController:  'HOMEd Relay Controller',
        homedSwitchController: 'HOMEd Switch Controller',
        r4pin08m0:             'Eletechsup R4PIN08-8DI Controller',
        r4pin08m1:             'Eletechsup R4PIN08-8DO Controller',
        r4pin08m2:             'Eletechsup R4PIN08-4DI-4DO Controller',
        r4pin08m3:             'Eletechsup R4PIN08-2DI-6DO Controller',
        r4pin08m4:             'Eletechsup R4PIN08-6DI-2DO Controller',
        wbM1w2:                'Wiren Board WB-M1W2 Temperature Sensor',
        wbMs:                  'Wiren Board WB-MS Modbus Sensor',
        wbMsw:                 'Wiren Board WB-MSW Wall-mounted Sensor',
        wbMai6:                'Wiren Board WB-MAI6 Analog Input Controller',
        wbMap3ev:              'Wiren Board WB-MAP3EV Voltage Meter',
        wbMap3e:               'Wiren Board WB-MAP3E Energy Meter',
        wbMap6s:               'Wiren Board WB-MAP6S Energy Meter',
        wbMap12e:              'Wiren Board WB-MAP12E Energy Meter',
        wbMap12h:              'Wiren Board WB-MAP12H Energy Meter',
        wbMrwm2:               'Wiren Board WB-MRWM2 Relay Controller',
        wbMrm2:                'Wiren Board WB-MRM2-mini Relay Controller',
        wbMr3:                 'Wiren Board WB-MR3LV/MRWL3 Relay Controller',
        wbMr6:                 'Wiren Board WB-MR6C/MR6-LV Relay Controller',
        wbMr6p:                'Wiren Board WB-MR6CU/MRPS6 Relay Controller',
        wbLed0:                'Wiren Board WB-LED Dimmer (W1, W2, W3, W4)',
        wbLed1:                'Wiren Board WB-LED Dimmer (W1+W2, W3, W4)',
        wbLed2:                'Wiren Board WB-LED Dimmer (CCT1, W3, W4)',
        wbLed16:               'Wiren Board WB-LED Dimmer (W1, W2, W3+W4)',
        wbLed17:               'Wiren Board WB-LED Dimmer (W1+W2, W3+W4)',
        wbLed18:               'Wiren Board WB-LED Dimmer (CCT1, W3+W4)',
        wbLed32:               'Wiren Board WB-LED Dimmer (W1, W2, CCT2)',
        wbLed33:               'Wiren Board WB-LED Dimmer (W1+W2, CCT2)',
        wbLed34:               'Wiren Board WB-LED Dimmer (CCT1, CCT2)',
        wbLed256:              'Wiren Board WB-LED Dimmer (RGB, W4)',
        wbLed512:              'Wiren Board WB-LED Dimmer (W1+W2+W3+W4)',
        wbMdm:                 'Wiren Board WB-MDM3 Mosfet Dimmer',
        wbUps:                 'Wiren Board WB-UPS v3 Backup Power Supply',
        neptunSmartPlus:       'Neptun Smart+ Controller',
        jth2d1:                'JTH-2D1 Temperature and Humidity Sensor',
        t13:                   'T13-750W-12-H Frequency Converter',
        m0701s:                'VFC-M0701S Frequency Converter'
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

                if (!this.devices[device.id] || this.devices[device.id].info.type != device.type)
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

    parseValue(data, key, summary)
    {
        let value = data[key];
        return key != 'type' ? super.parseValue(data, key, summary) : this.deviceType[value] ?? '<span class="shade">' + value + '</span>';
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

        loadHTML('html/modbus/deviceList.html', this, this.content, function()
        {
            let table = this.content.querySelector('.deviceList table');

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
                            cell.colSpan = 2;

                            if (device.info.note)
                                row.title = device.info.note;

                            break;

                        case 1: cell.innerHTML = this.deviceType[device.info.type] ?? '<span class="shade">' + device.info.type + '</span>'; cell.classList.add('mobileHidden'); break;
                        case 2: cell.innerHTML = '<span class="value">' + device.info.portId + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = '<span class="value">' + device.info.slaveId + '</span>'; cell.classList.add('center'); break;
                        case 4: cell.innerHTML = this.parseValue(device.info, 'discovery'); cell.classList.add('center', 'mobileHidden'); break;
                        case 5: cell.innerHTML = this.parseValue(device.info, 'cloud'); cell.classList.add('center', 'mobileHidden'); break;
                    }
                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index); localStorage.setItem('customSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('customSort') ?? 0);
            addTableSearch(table, 'devices', 'device', 7, [0, 1]);
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

        loadHTML('html/modbus/deviceEdit.html', this, modal.querySelector('.data'), function()
        {
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
