class Display extends DeviceService
{
    exposes =
    {
        co2:         'leaf',
        contact:     'door-closed',
        humidity:    'water-percent',
        light:       'lightbulb',
        occupancy:   'account',
        power:       'lightning-bolt',
        switch:      'power',
        temperature: 'thermometer',
        thermostat:  'fire',
        waterLeak:   'water'
    };

    constructor(controller)
    {
        super(controller, 'display');
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = this.version ? 'Display ' + this.version : '<i>unknown</i>';
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':
            {
                let check = Object.keys(this.devices).length ? false : true;

                this.icons = message.icons ?? new Array();
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
                    else if (this.names && this.devices[device.id].info.name != device.name)
                    {
                        this.controller.socket.unsubscribe('expose/' + this.service + '/' + this.devices[device.id].info.name);
                        this.controller.socket.unsubscribe('device/' + this.service + '/' + this.devices[device.id].info.name);
                        this.controller.socket.subscribe('expose/' + this.service + '/' + device.name);
                        this.controller.socket.subscribe('device/' + this.service + '/' + device.name);
                    }

                    this.devices[device.id].info = device;

                    if (this.controller.service != this.service || this.devices[device.id] != this.device)
                        return;

                    this.showDeviceInfo(this.device);
                });

                Object.keys(this.devices).filter(id => !message.devices.filter(device => device.id == id).length).forEach(id =>
                {
                    delete this.devices[id];
                    check = true;
                });

                if (this.controller.service == this.service)
                {
                    if (check)
                        this.controller.showPage(this.controller.page);

                    this.updatePage();
                }

                this.ready = true;
                break;
            }

            default:
                super.parseMessage(list, message);
                break;
        }
    }

    brokenLayout(device)
    {
        return !device.info.active || !this.controller.devicesReady() || !device.info.pages?.some(page => page.items?.some(item => item.endpoint && !this.controller.findDevice(item).info)) ? false : true;
    }

    pageName(device, page)
    {
        let index = device.info.pages.indexOf(page);
        return page.name?.trim() || 'Page ' + ((index < 0 ? device.info.pages.length : index) + 1);
    }

    itemName(page, item)
    {
        let index = page.items.indexOf(item);
        return item.name || 'Item ' + ((index < 0 ? page.items.length : index) + 1);
    }

    defaultIcon(item)
    {
        return item.scene ? 'play' : this.exposes[item.expose?.split('_')[0]];
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split(/=(.*)/) : new Array();
        let device;

        menu.innerHTML  = '<span id="list"><i class="mdi-menu"></i> List</span>';
        menu.innerHTML += '<span id="add"><i class="mdi-plus"></i> Add</span>';
        menu.innerHTML += '<span id="import" class="mobileHidden"><i class="mdi-upload"></i> Import</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage(this.service); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showDeviceEdit(); }.bind(this));

        menu.querySelector('#import').addEventListener('click', function()
        {
            loadFile(function(data)
            {
                let random = randomString(4);
                let device = {cloud: false, discovery: false, name: 'Device ' + random, id: 'plate-' + random, ...data};
                this.controller.setPage(this.service + '?device=' + device.id);
                this.serviceCommand({action: 'updateDevice', data: device});

            }.bind(this));

        }.bind(this));

        this.layout = list[0] == 'layout';

        if (this.layout || list[0] == 'device')
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
        this.controller.setPage(this.service);

        if (!Object.keys(this.devices).length)
        {
            this.content.innerHTML = '<div class="emptyList">' + this.service + ' devices list is empty</div>';
            return;
        }

        loadHTML('html/display/deviceList.html', this, this.content, function()
        {
            let table = this.content.querySelector('.deviceList table');

            Object.keys(this.devices).forEach(id =>
            {
                let device = this.devices[id];
                let row = table.querySelector('tbody').insertRow();

                row.dataset.device = this.service + '/' + device.id;
                row.addEventListener('click', function() { this.controller.showPage(this.service + '?device=' + device.id); }.bind(this));

                for (let i = 0; i < 5; i++)
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

                        case 1: cell.innerHTML = device.id; cell.classList.add('mobileHidden'); break;
                        case 2: cell.innerHTML = '<span class="value">' + (device.info.pages?.length ?? 0) + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = this.parseValue(device.info, 'discovery'); cell.classList.add('center', 'mobileHidden'); break;
                        case 4: cell.innerHTML = this.parseValue(device.info, 'cloud'); cell.classList.add('center', 'mobileHidden'); break;
                    }
                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index); localStorage.setItem('homedDisplaySort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('homedDisplaySort') ?? 0);
            addTableSearch(table, 'devices', 'device', 6, [0, 1]);
        });
    }

    showDeviceInfo(device)
    {
        if (this.layout)
        {
            this.showDeviceLayout(device);
            return;
        }

        super.showDeviceInfo(device);
    }

    showDeviceEdit(device)
    {
        let add = false;

        if (!device)
        {
            let random = randomString(4);
            device = {info: {name: 'Device ' + random, id: 'plate-' + random, width: 480, height: 480, active: true}};
            add = true;
        }

        loadHTML('html/display/deviceEdit.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('input[name="name"]').value = device.info.name;
            modal.querySelector('textarea[name="note"]').value = device.info.note ?? '';
            modal.querySelector('input[name="id"]').value = device.info.id;
            modal.querySelector('input[name="width"]').value = device.info.width;
            modal.querySelector('input[name="height"]').value = device.info.height;
            modal.querySelector('input[name="home"]').value = device.info.home ?? 0;
            modal.querySelector('input[name="discovery"]').checked = device.info.discovery;
            modal.querySelector('input[name="cloud"]').checked = device.info.cloud;
            modal.querySelector('input[name="active"]').checked = device.info.active;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (add)
                    this.controller.setPage(this.service + '?device=' + form.id);

                this.serviceCommand({action: 'updateDevice', device: add ? null : device.id, data: {...form, pages: device.info.pages}});

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true, 'input[name="name"]');
        });
    }

    showDeviceLayout(device)
    {
        loadHTML('html/display/deviceLayout.html', this, this.content, function()
        {
            let pages = device.info.pages ?? new Array();

            this.content.querySelector('.name').innerHTML = '<span class="info">' + device.info.name + '</span> <i class="mdi-arrow-right"></i> Layout';
            this.content.querySelector('.info').addEventListener('click', function() { this.controller.showPage(this.service + '?device=' + device.id); }.bind(this));
            this.content.querySelector('.edit').addEventListener('click', function() { this.backup = structuredClone(device.info.pages); this.showLayoutEdit(device); }.bind(this));

            if (!pages.length)
            {
                let element = this.content.querySelector('.layoutData');
                element.innerHTML = '<div class="emptyList">pages list is empty</div>';
                element.style.display = 'block';
                return;
            }

            pages.forEach((page, index) =>
            {
                let element = document.createElement('div');
                let table = document.createElement('table');
                let list = page.layout.split('x');
                let count = (list[0] != 3 || !page.clock ? list[0] : 2) * list[1]; // TODO: check for album/portrait

                element.innerHTML = '<div class="title"><span class="name">' + this.pageName(device, page) + ' <span class="flag">' + page.layout + '</span></span><span class="edit"><i class="mdi-pencil"></i></span></div>';
                element.classList.add('layoutPage');

                if (index >= 4)
                    element.classList.add('inactive');

                element.querySelector('.edit').addEventListener('click', function() { this.showPageEdit(device, index); }.bind(this));

                if (page.note)
                {
                    let note = document.createElement('div');
                    note.innerHTML += page.note;
                    note.classList.add('note');
                    element.append(note);
                }

                element.append(table);

                page.items?.forEach((item, index) =>
                {
                    let row = table.insertRow();
                    let cell = row.insertCell();

                    if (index >= count)
                        row.classList.add('inactive');

                    this.controller.services.dashboard.devicePromise({...item, name: this.itemName(page, item)}, cell);
                    cell.classList.add('label');
                });

                if (!table.rows.length)
                {
                    let cell = table.insertRow().insertCell();
                    cell.innerHTML = '<i>page is empty</i>';
                    cell.classList.add('center', 'shade');
                }

                this.content.querySelector('.column.' + (index < pages.length / 2 ? 'a' : 'b')).append(element);
            });
        });
    }

    showLayoutEdit(device)
    {
        let showTable = function(table, pages)
        {
            table.parentNode.style.display = pages.length ? 'block' : 'none';
            table.innerHTML = null;

            pages.forEach((page, index) =>
            {
                let row = table.insertRow();

                row.drag = {type: 'page', list: pages, index: index, level: 0};

                for (let i = 0; i < 3; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:
                            cell.innerHTML = this.pageName(device, page);
                            cell.classList.add('edit');
                            cell.addEventListener('click', function() { this.showPageEdit(device, index, function() { this.showLayoutEdit(device); }.bind(this)); }.bind(this));
                            break;

                        case 1:

                            if (pages.length < 2)
                            {
                                cell.innerHTML = empty;
                                cell.classList.add('empty');
                                break;
                            }

                            addDrag(cell, function() { showTable(table, pages); });
                            break;

                        case 2:
                            cell.innerHTML = '<i class="mdi-trash-can-outline"></i>';
                            cell.classList.add('remove');
                            cell.addEventListener('click', function() { pages.splice(index, 1); showTable(table, pages); });
                            break;
                    }
                }
            });

        }.bind(this);

        if (!device.info.pages)
            device.info.pages = new Array();

        loadHTML('html/display/layoutEdit.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.add').addEventListener('click', function() { this.showPageEdit(device, null, function() { this.showLayoutEdit(device); }.bind(this)); }.bind(this));
            modal.querySelector('.save').addEventListener('click', function() { this.serviceCommand({action: 'updateDevice', device: device.id, data: device.info}); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { device.info.pages = this.backup; showModal(false); }.bind(this));

            showTable(modal.querySelector('table.pages'), device.info.pages);
            showModal(true);
        });
    }

    showPageEdit(device, pageIndex, callback, page)
    {
        let showTable = function(table, page)
        {
            table.parentNode.style.display = page.items.length ? 'block' : 'none';
            table.innerHTML = null;

            page.items.forEach((item, index) =>
            {
                let row = table.insertRow();

                row.drag = {type: 'item', list: page.items, index: index, level: 0};

                for (let i = 0; i < 3; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:
                            cell.innerHTML = '<span class="name"></span><div class="note">' + this.controller.services.dashboard.itemString(item) + '</div>';
                            cell.classList.add('edit');
                            cell.addEventListener('click', function() { this.showItemEdit(device, page, item, function() { this.showPageEdit(device, pageIndex, callback, page); }.bind(this)); }.bind(this));
                            this.controller.services.dashboard.devicePromise({...item, name: this.itemName(page, item)}, cell.querySelector('span'), false);
                            break;

                        case 1:

                            if (page.items.length < 2)
                            {
                                cell.innerHTML = empty;
                                cell.classList.add('empty');
                                break;
                            }

                            addDrag(cell, function() { showTable(table, page); });
                            break;

                        case 2:
                            cell.innerHTML = '<i class="mdi-trash-can-outline"></i>';
                            cell.classList.add('remove');
                            cell.addEventListener('click', function() { page.items.splice(index, 1); showTable(table, page); });
                            break;
                    }
                }
            });

        }.bind(this);

        if (!page)
            page = structuredClone(device.info.pages[pageIndex]) ?? {name: 'New page', layout: '2x2', items: new Array(), add: true};

        loadHTML('html/display/pageEdit.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.info.name + ' <i class="mdi-arrow-right"></i> ' + this.pageName(device, page);
            modal.querySelector('input[name="name"]').value = page.name ?? '';
            modal.querySelector('textarea[name="note"]').value = page.note ?? '';
            modal.querySelector('select[name="layout"]').value = page.layout;
            modal.querySelector('input[name="clock"]').checked = page.clock ?? false;
            modal.querySelector('.add').addEventListener('click', function() { this.showItemEdit(device, page, null, function() { this.showPageEdit(device, pageIndex, callback, page); }.bind(this)); }.bind(this));

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                page.layout = form.layout;

                if (form.name)
                    page.name = form.name;
                else
                    delete page.name;

                if (form.note)
                    page.note = form.note;
                else
                    delete page.note;

                if (form.clock)
                    page.clock = true;
                else
                    delete page.clock;

                if (page.add)
                {
                    device.info.pages.push(page);
                    delete page.add;
                }
                else
                    device.info.pages[pageIndex] = page;

                if (callback)
                {
                    callback();
                    return;
                }

                this.serviceCommand({action: 'updateDevice', device: device.id, data: device.info});

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { callback ? callback() : showModal(false); });

            showTable(modal.querySelector('table.items'), page);
            showModal(true, 'input[name="name"]');
        });
    }

    showItemEdit(display, page, item, callback)
    {
        let items = new Object();
        let icons = new Object();

        if (!item)
            item = {add: true};

        Object.values(this.controller.sceneList()).forEach(scene => { items['<i class="mdi-play exposeIcon"></i>Scene <i class="mdi-arrow-right"></i> ' + scene] = {scene: scene}; });
        Object.assign(items, this.controller.exposeList((expose, device) => this.exposes[expose.split('_')[0]] && device.service != 'display'));

        this.icons.forEach(icon => { icons['<i class="mdi-' + icon.replace(/^mdi:/, '') + '"></i>' + icon] = icon; });

        loadHTML('html/display/itemEdit.html', this, modal.querySelector('.data'), function()
        {
            let device = item.endpoint ? this.controller.findDevice(item) : new Device();
            let icon = item.icon;
            let data;

            let showIcon = function()
            {
                let value = this.defaultIcon(data ?? item);

                modal.querySelector('.iconData').style.display = value ? 'block' : 'none';

                if (!value)
                    return;

                modal.querySelector('.icon').innerHTML = icon ? '<i class="mdi-' + icon.replace(/^mdi:/, '') + '"></i>' + icon : '<i class="mdi-' + value + '"></i><span class="shade">mdi:' + value + ' [default]</span>';
                modal.querySelector('.restore').style.display = icon ? 'table-cell' : 'none';

            }.bind(this);

            modal.querySelector('.name').innerHTML = display.info.name + ' <i class="mdi-arrow-right"></i> ' + this.pageName(display, page) + ' <i class="mdi-arrow-right"></i> ' + this.itemName(page, item);
            modal.querySelector('.item').innerHTML = item.add ? 'Select item there <i class="mdi-arrow-right"></i>' : this.controller.services.dashboard.itemString(item);

            if (device.info)
            {
                modal.querySelector('.item span').classList.add('info');
                modal.querySelector('.item span').addEventListener('click', function() { this.controller.showPage(device.service + '?device=' + device.id); showModal(false); }.bind(this));
            }

            addDropdown(modal.querySelector('.itemData .dropdown'), Object.keys(items), function(key)
            {
                data = items[key];
                modal.querySelector('.item').innerHTML = this.controller.services.dashboard.itemString(data);
                modal.querySelector('.item').classList.remove('error');
                showIcon();

            }.bind(this));

            addDropdown(modal.querySelector('.iconData .dropdown'), Object.keys(icons), function(key)
            {
                icon = icons[key];
                showIcon();
            });

            modal.querySelector('input[name="name"]').value = item.name ?? '';
            modal.querySelector('.restore').addEventListener('click', function() { icon = null; showIcon(); });

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (data)
                {
                    delete item.scene;
                    delete item.endpoint;
                    delete item.expose;

                    Object.assign(item, data);
                }

                if (icon)
                    item.icon = icon;
                else
                    delete item.icon;

                if (form.name)
                    item.name = form.name;
                else
                    delete item.name;

                if (!item.scene && (!item.endpoint || !item.expose))
                {
                    modal.querySelector('.item').classList.add('error');
                    return;
                }

                if (item.add)
                {
                    page.items.push(item);
                    delete item.add;
                }

                callback();
            });

            modal.querySelector('.cancel').addEventListener('click', function() { callback(); });

            showIcon();
            showModal(true, 'input[name="name"]');
        });
    }
}
