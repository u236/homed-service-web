class Custom extends DeviceService
{
    constructor(controller)
    {
        super(controller, 'custom');
    }

    parseMessage(list, message)
    {
        if (list[0] == 'status')
        {
            let check = false;

            this.names = message.names;
            this.version = message.version;

            message.devices.forEach(device =>
            {
                if (!device.name)
                    device.name = device.id;

                if (!this.devices[device.id])
                {
                    let item = this.names ? device.name : device.id;

                    this.devices[device.id] = new Device('custom', device.id);
                    this.controller.socket.subscribe('expose/custom/' + item);
                    this.controller.socket.subscribe('device/custom/' + item);

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

                document.querySelector('#serviceVersion').innerHTML = 'Custom ' + this.version;
            }

            return;
        }

        super.parseMessage(list, message);
    }

    showMenu()
    {
        let menu = document.querySelector('.menu');

        menu.innerHTML  = '<span id="list"><i class="icon-list"></i> Devices</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.showDeviceList(); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showDeviceEdit(); }.bind(this));

        document.querySelector('#serviceVersion').innerHTML = this.version ? 'Custom ' + this.version : '<i>unknown</i>';
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
            let table;

            this.content.innerHTML = html;
            table = this.content.querySelector('.deviceList table');

            Object.keys(this.devices).forEach(id =>
            {
                let device = this.devices[id];
                let row = table.querySelector('tbody').insertRow();

                row.addEventListener('click', function() { this.showDeviceInfo(device); }.bind(this));
                row.dataset.device = 'custom/' + device.id;

                for (let i = 0; i < 7; i++)
                {
                    let cell = row.insertCell();

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

                        case 1: cell.innerHTML = device.id; break;
                        case 2: cell.innerHTML = '<span class="value">' + device.info.exposes.length + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = this.parseValue('real', device.info.real); cell.classList.add('center'); break;
                        case 4: cell.innerHTML = this.parseValue('discovery', device.info.discovery); cell.classList.add('center'); break;
                        case 5: cell.innerHTML = this.parseValue('cloud', device.info.cloud); cell.classList.add('center'); break;
                        case 6: cell.innerHTML = empty; cell.classList.add('availability', 'center'); break;
                    }

                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index); localStorage.setItem('customSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('customSort') ?? 0);
        });
    }

    showDeviceEdit(device = undefined)
    {
        let add = false;

        if (!device)
        {
            let random = randomString(4);
            device = {info: {name: 'Device ' + random, id: 'device_' + random, exposes: ['switch'], active: true}};
            add = true;
        }

        fetch('html/custom/deviceEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('input[name="name"]').value = device.info.name;
            modal.querySelector('textarea[name="note"]').value = device.info.note ?? '';
            modal.querySelector('input[name="id"]').value = device.info.id;
            modal.querySelector('input[name="exposes"]').value = device.info.exposes.join(', ');
            modal.querySelector('textarea[name="options"]').value = device.info.options ? JSON.stringify(device.info.options) : '';
            modal.querySelector('input[name="real"]').checked = device.info.real;
            modal.querySelector('input[name="discovery"]').checked = device.info.discovery;
            modal.querySelector('input[name="cloud"]').checked = device.info.cloud;
            modal.querySelector('input[name="active"]').checked = device.info.active;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (form.exposes)
                    form.exposes = form.exposes.split(',').map(item =>item.trim());
                else
                    delete form.exposes;

                if (form.options)
                    form.options = JSON.parse(form.options);
                else
                    delete form.options;

                this.controller.socket.publish('command/custom', {action: 'updateDevice', device: add ? null : this.names ? device.info.name : device.id, data: form});

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }
}
