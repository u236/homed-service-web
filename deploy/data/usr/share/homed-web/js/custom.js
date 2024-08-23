class Custom extends DeviceService
{
    constructor(controller, instance)
    {
        super(controller, 'custom', instance);
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = this.version ? 'Custom ' + this.version : '<i>unknown</i>';
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

                this.updateSummary(this.device)
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

            return;
        }

        super.parseMessage(list, message);
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split('=') : new Array();
        let device;

        menu.innerHTML  = '<span id="list"><i class="icon-list"></i> List</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage(this.service); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.controller.showPage(this.service + '?add'); }.bind(this));

        switch (list[0])
        {
            case 'device':

                device = this.devices[list[1]];

                if (device)
                    this.showDeviceInfo(device);
                else
                    this.showDeviceList();

                break;

            case 'add': this.showDeviceEdit(); break;
            default: this.showDeviceList(); break;
        }

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

        fetch('html/custom/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
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
                            {
                                cell.innerHTML += '<span class="note">' + device.info.note + '</span>';
                                row.classList.add('tooltip');
                            }

                            break;

                        case 1: cell.innerHTML = device.id; cell.classList.add('mobileHidden'); break;
                        case 2: cell.innerHTML = '<span class="value">' + device.info.exposes.length + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = this.parseValue('real', device.info.real); cell.classList.add('center'); break;
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

                this.serviceCommand({action: 'updateDevice', device: add ? null : this.names ? device.info.name : device.id, data: form});

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }
}
