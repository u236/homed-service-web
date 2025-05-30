let modal, controller, dropdown, guest = true, theme = localStorage.getItem('theme') ?? 'dark', wide = localStorage.getItem('wide') ?? 'off', empty = '<span class="shade">&bull;</span>';

class Socket
{
    subscriptions = new Array();
    connected = false;

    constructor(onopen, onclose, onmessage)
    {
        this.onopen = onopen;
        this.onclose = onclose;
        this.onmessage = onmessage;
        this.connect();
    }

    connect()
    {
        this.ws = new WebSocket((location.protocol == 'https:' ? 'wss://' : 'ws://') + location.host + location.pathname);

        this.ws.onopen = function() { this.onopen(); this.connected = true; }.bind(this);
        this.ws.onmessage = function(event) { let data = JSON.parse(event.data); this.onmessage(data.topic, data.message); }.bind(this);
        this.ws.onerror = function() { this.ws.close(); }.bind(this);

        this.ws.onclose = function()
        {
            if (this.connected)
            {
                this.subscriptions = new Array();
                this.onclose();
            }

            setTimeout(function() { this.connect(); }.bind(this), 1000);
            this.connected = false;

        }.bind(this);
    }

    subscribe(topic)
    {
        if (!this.subscriptions.includes(topic))
            this.subscriptions.push(topic);

        this.ws.send(JSON.stringify({action: 'subscribe', topic: topic}));
    }

    publish(topic, message)
    {
        this.ws.send(JSON.stringify({action: 'publish', topic: topic, message: message}));
    }

    unsubscribe(topic)
    {
        this.subscriptions.splice(this.subscriptions.indexOf(topic), 1);
        this.ws.send(JSON.stringify({action: 'unsubscribe', topic: topic}));
    }
}

class Controller
{
    socket = new Socket(this.onopen.bind(this), this.onclose.bind(this), this.onmessage.bind(this));
    services = {dashboard: new Dashboard(this)};

    onopen()
    {
        console.log('socket successfully connected');
        this.socket.subscribe('service/#');
        this.socket.subscribe('status/web');
    }

    onclose()
    {
        document.querySelector('.services').innerHTML = '<span><i class="icon-false"></i> DISCONNECTED</span>';
        document.querySelector('.menu').innerHTML = null;
        this.clearPage('socket closed, reconnecting...');
        this.socket.subscriptions = new Array();
        Object.keys(this.services).forEach(service => { if (service != 'dashboard') this.removeService(service); });
    }

    onmessage(topic, message)
    {
        let list = topic.split('/');

        if (topic == "error")
        {
            this.clearPage(message);
            return;
        }

        if (topic == "setup")
        {
            guest = message.guest;

            if (guest)
            {
                document.querySelector('.header img').classList.remove('mobileHidden');
                document.querySelector('#footerData').style.display = 'none';
            }

            this.showPage(localStorage.getItem('page') ?? 'dashboard');
            return;
        }

        if (list[0] == 'service')
        {
            let service = list[2] ? list[1] + '/' + list[2] : list[1];

            if (message.status == 'online')
            {
                if (this.services[service])
                    return;

                switch (list[1])
                {
                    case 'automation': this.services[service] = new Automation(this, list[2]); break;
                    case 'recorder':   this.services[service] = new Recorder(this); break;
                    case 'custom':     this.services[service] = new Custom(this, list[2]); break;
                    case 'modbus':     this.services[service] = new Modbus(this, list[2]); break;
                    case 'zigbee':     this.services[service] = new ZigBee(this, list[2]); break;
                    default:           return;
                }

                if (service == 'recorder')
                    this.socket.subscribe('recorder');

                this.socket.subscribe('status/' + service);
                this.socket.subscribe('event/' + service);
            }
            else
            {
                if (this.service == service)
                    this.clearPage(service + ' service is unavailable');

                if (service == 'recorder')
                    this.socket.unsubscribe('recorder');

                this.socket.subscriptions.filter(topic => { return !topic.startsWith('service') && topic.includes(service); }).forEach(topic => { this.socket.unsubscribe(topic); });
                this.removeService(service);
            }

            this.updateMenu(true);
            return;
        }

        if (topic != 'recorder' || !this.services.recorder)
        {
            let service = list[1] != 'web' ? this.services[list[1] + '/' + list[2]] ?? this.services[list[1]] : this.services.dashboard;
            service?.parseMessage(list, message);
            return;
        }

        this.services.recorder.parseData(message);
    }

    removeService(item)
    {
        this.services[item]?.intervals?.forEach(interval => { clearInterval(interval); });
        delete this.services[item];
    }

    updateMenu(redraw)
    {
        let menu = document.querySelector('.header .services');

        if (redraw)
        {
            let names = ['dashboard', 'recorder', 'automation', 'zigbee', 'modbus', 'custom'];
            let services = Object.keys(this.services);
            let list = new Array();

            menu.innerHTML = null;
            services.sort();

            names.forEach(name =>
            {
                if (guest && !['dashboard', 'recorder'].includes(name))
                    return;

                services.filter(service => { return service.startsWith(name); }).forEach(service =>
                {
                    let item = document.createElement('span');

                    if (menu.innerHTML)
                        menu.append('|');

                    item.innerHTML = service.replace('automation/', 'auto/');
                    item.dataset.service = service;
                    item.addEventListener('click', function() { this.showPage(service); }.bind(this));

                    menu.appendChild(item);
                    list.push(service);
                });
            });

            if (!guest && menu.offsetWidth > document.querySelector('.header .container').offsetWidth - 275)
            {
                let item = document.createElement('span');
                let element = document.createElement('div');

                item.classList.add('trigger');
                element.classList.add('dropdown');

                addDropdown(element, list, function(service) { this.showPage(service); }.bind(this), 0, item);

                menu.innerHTML = null;
                menu.append(item, element);
            }
        }

        menu.querySelectorAll('span').forEach(item =>
        {
            if (item.classList.contains('trigger'))
            {
                item.innerHTML = '<i class="icon-list"></i> ' + this.service;
                return;
            }

            if (item.dataset.service != this.service)
            {
                item.classList.remove('highlight');
                return;
            }

            item.classList.add('highlight');
        });
    }

    showPage(page)
    {
        let list = page.split('?');
        let service = list[0];

        if (guest && !['dashboard', 'recorder'].includes(service))
            return;

        if (this.services[this.service]?.updated)
        {
            this.services[this.service].showAlert(page);
            return;
        }

        localStorage.setItem('page', page);
        location.hash = page;

        this.service = service;
        this.page = page;

        this.updateMenu(false);
        this.clearPage();

        if (!this.services[service])
            return;

        this.services[service].showPage(list[1]);
    }

    clearPage(warning)
    {
        let content = document.querySelector('.content .container');

        content.innerHTML = '<div class="pageLoader"></div><div class="center warning"></div>';

        if (warning)
        {
            content.querySelector('.warning').innerHTML = warning;
            console.log(warning);
        }

        showModal(false);
    }

    showToast(message, style = 'success')
    {
        let element = document.createElement('div');

        element.innerHTML = '<div class="message">' + message + '</div>';
        element.classList.add('item', 'fade-in', style);
        element.addEventListener('click', function() { this.clearToast(element); }.bind(this));

        setTimeout(function() { this.clearToast(element); }.bind(this), 5000);
        document.querySelector('#toast').appendChild(element);
    }

    clearToast(item)
    {
        let toast = document.querySelector('#toast');

        if (!toast.contains(item))
            return;

        setTimeout(function() { toast?.removeChild(item); }, 200);
        item.classList.add('fade-out');
    }

    findDevice(item)
    {
        let list = item.endpoint.split('/');
        let device;

        Object.keys(this.services).forEach(item =>
        {
            if (device)
                return;

            if (item.startsWith(list[0]))
            {
                let devices = this.services[item].devices ?? new Object();
                device = devices.hasOwnProperty(list[1]) ? devices[list[1]] : Object.values(devices).find(device => device.info.name == list[1]);
            }
        });

        return device ?? new Device();
    }

    propertiesList(pattern)
    {
        let list = new Object();

        Object.keys(this.services).forEach(item =>
        {
            let service = this.services[item];

            if (!service.devices || !Object.keys(service.devices).length)
                return;

            Object.keys(service.devices).forEach(id =>
            {
                let device = service.devices[id];

                Object.keys(device.endpoints).forEach(endpointId => { device.items(endpointId).forEach(expose => { exposeList(expose, device.options(endpointId)).forEach(property =>
                {
                    let value = {endpoint: item.split('/')[0] + '/' + id, property: property};

                    if (property.match('^[a-z]+P[0-9]+(Temperature|Time)$'))
                        return;

                    if (endpointId != 'common')
                        value.endpoint += '/' + endpointId;

                    list[device.info.name + ' <i class="icon-right"></i> ' + exposeTitle(device, value.endpoint, property)] = pattern ? '{{ property | ' + value.endpoint + ' | ' + property + ' }}' : value;

                }); }); });
            });
        });

        return list;
    }

    propertyName(item)
    {
        return this.services.dashboard.status.names[item];
    }

    setPropertyName(item, name)
    {
        let names = this.services.dashboard.status.names;

        if (names[item] == name)
            return;

        if (name)
            names[item] = name;
        else
            delete names[item];

        this.services.dashboard.storeNames();
    }
}

class Device
{
    endpoints = new Object();

    constructor(service, id)
    {
        this.service = service;
        this.id = id;
    }

    endpoint(endpointId)
    {
        if (!this.endpoints[endpointId])
            this.endpoints[endpointId] = {properties: new Object()};

        return this.endpoints[endpointId];
    }

    exposes(endpointId)
    {
        return this.endpoint(endpointId).exposes ?? new Object();
    }

    items(endpointId)
    {
        return this.exposes(endpointId).items ?? new Array();
    }

    options(endpointId)
    {
        return this.exposes(endpointId).options ?? new Object();
    }

    properties(endpointId)
    {
        return this.endpoint(endpointId).properties;
    }

    setExposes(endpointId, exposes)
    {
        this.endpoint(endpointId).exposes = exposes;
    }

    setProperties(endpointId, data)
    {
        Object.keys(data).forEach(key => { this.endpoint(endpointId).properties[key] = data[key]; });
    }
}

class DeviceService
{
    intervals = [setInterval(function() { this.updateDeviceData(); }.bind(this), 100)];
    content = document.querySelector('.content .container');
    devices = new Object();

    constructor(controller, service, instance)
    {
        this.controller = controller;
        this.service = service;

        if (!instance)
            return;

        this.service += '/' + instance;
        this.instance = true;
    }

    updateDeviceData()
    {
        Object.keys(this.devices).forEach(id =>
        {
            let device = this.devices[id];

            if (this.service.startsWith('zigbee') && !device.info.logicalType)
                return;

            document.querySelectorAll('table:not(.summary) tr[data-device="' + this.service + '/' + id + '"]').forEach(row =>
            {
                let className = device.info.active ? device.availability : 'inactive';

                if (!row.classList.contains(className))
                {
                    row.classList.remove('online', 'offline', 'inactive');
                    row.classList.add(className);
                }
            });

            if (this.controller.service == this.service && device == this.device && device.info.ota?.running && device.otaProgress != undefined)
            {
                let button = document.querySelector('.title button.upgrade span');
                let cell = modal.querySelector('.progress');

                if (button && button.dataset.value != device.otaProgress)
                {
                    button.dataset.value = device.otaProgress;
                    button.innerHTML = ' OTA: ' + device.otaProgress + ' %';
                }

                if (cell && cell.dataset.value != device.otaProgress)
                {
                    cell.dataset.value = device.otaProgres;
                    cell.innerHTML = device.otaProgress + ' %';
                }
            }
        });
    }

    updateDeviceInfo(device)
    {
        Object.keys(device.info).forEach(key =>
        {
            let cell = this.content.querySelector('.' + key + ':not(.exposes)');
            let row = cell?.closest('tr');

            if (!cell)
                return;

            if (row)
            {
                row.style.display = 'table-row';

                if (key == 'lastSeen')
                {
                    row.dataset.device = this.service + '/' + device.id;
                    return;
                }
            }

            cell.innerHTML = this.parseValue(key, device.info[key]);
        });
    }

    updateArrowButtons(device)
    {
        let devices = new Array();
        let list = new Array();

        Object.keys(this.devices).forEach(id =>
        {
            if (this.service.startsWith('zigbee') && !this.devices[id].info.logicalType)
                return;

            devices.push([id, this.devices[id].info.name.toLowerCase()]);
        });

        devices.sort(function(a, b) { return a[1] < b[1] ? -1 : 1; }).forEach(item => { list.push(item[0]); });
        handleArrowButtons(this.content, list, list.indexOf(device.id), function(id) { this.controller.showPage(this.service + '?device=' + id); }.bind(this));
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'event':
            {
                let html = 'Device <b>' + message.device + '</b> ';

                if (this.controller.service != this.service)
                    break;

                switch (message.event)
                {
                    case 'idDuplicate':    this.controller.showToast(html + 'identifier is already in use', 'error'); break;
                    case 'nameDuplicate':  this.controller.showToast(html + 'new name is already in use', 'error'); break;
                    case 'incompleteData': this.controller.showToast(html + 'data is incomplete', 'error'); break;
                    case 'removed':        this.controller.showToast(html + 'removed', 'warning'); break;

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

            case 'device':
            {
                let device = this.findDevice(this.instance ? list[3] : list[2]);

                if (device && message)
                {
                    if (message.lastSeen)
                        device.lastSeen = message.lastSeen;

                    if (message.otaProgress)
                        device.otaProgress = message.otaProgress;

                    device.availability = message.status;
                }

                break;
            }

            case 'expose':
            {
                let device = this.findDevice(this.instance ? list[3] : list[2]);

                if (device && message)
                {
                    let item = this.names ? device.info.name : device.id;

                    Object.keys(message).forEach(endpointId =>
                    {
                        this.controller.socket.subscribe('fd/' + this.service + '/' + (endpointId != 'common' ? item + '/' + endpointId : item));
                        device.setExposes(endpointId, message[endpointId]);
                    });

                    this.serviceCommand({action: 'getProperties', device: item, service: 'web'});
                }

                break;
            }

            case 'fd':
            {
                let device = this.findDevice(this.instance ? list[3] : list[2]);

                if (device && message)
                {
                    let endpointId = (this.instance ? list[4] : list[3]) ?? 'common';
                    device.setProperties(endpointId, message);
                    Object.keys(message).forEach(property => { updateExpose(device, endpointId, property, message[property]); });
                }

                break;
            }
        }
    }

    parseValue(key, value)
    {
        switch (key)
        {
            case 'active':
            case 'cloud':
            case 'discovery':
            case 'interviewFinished':
            case 'real':
            case 'supported':
                return value != undefined ? '<i class="icon-' + (value ? 'true' : 'false') + ' ' + (value ? 'success' : 'shade') + '"></i>' : empty;

            case 'baudRate':
            case 'portId':
            case 'slaveId':
                return '<span class="value">' + value + '</span>';

            case 'pollInterval':
            case 'replyTimeout':
            case 'requestTimeout':
                return '<span class="value">' + value + '</span> ms';

            default: return value;
        }
    }

    findDevice(item)
    {
        return Object.values(this.devices).find(device => device.info.name == item) ?? this.devices[item];
    }

    serviceCommand(data, clear = false)
    {
        if (clear)
            this.controller.clearPage();

        this.controller.socket.publish('command/' + this.service, data);
    }

    showDeviceInfo(device)
    {
        fetch('html/' + this.service.split('/')[0] + '/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let table;

            this.content.innerHTML = html;
            this.content.querySelector('.name').innerHTML = device.info.name;
            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(device); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(device); }.bind(this));

            this.updateDeviceInfo(device);
            this.updateArrowButtons(device);

            if (!device.info.active)
            {
                this.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            table = this.content.querySelector('table.exposes');
            Object.keys(device.endpoints).forEach(endpointId => { device.items(endpointId).forEach(expose => { addExpose(table, device, endpointId, expose); }); });

            if (!this.service.startsWith('custom'))
                return;

            this.content.querySelector('.export').addEventListener('click', function()
            {
                let data = {exposes: device.info.exposes, real: device.info.real};
                let item = document.createElement("a");

                if (device.info.options)
                    data.options = device.info.options;

                if (device.info.bindings)
                    data.bindings = device.info.bindings;

                if (device.info.availabilityTopic)
                    data.availabilityTopic = device.info.availabilityTopic;

                if (device.info.availabilityPattern)
                    data.availabilityPattern = device.info.availabilityPattern;

                item.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
                item.download = device.info.name + '.json';
                item.click();

            }.bind(this));
        });
    }

    showDeviceRemove(device)
    {
        fetch('html/' + this.service.split('/')[0] + '/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.serviceCommand({action: 'removeDevice', device: this.names ? device.info.name : device.id}, true); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }
}

class Dropdown
{
    mouse = true;
    index = -1;

    constructor(list, trigger)
    {
        this.items = list.querySelectorAll('.item');
        this.items.forEach((item, index) =>item.addEventListener('mouseover', function() { if (this.mouse) this.setIndex(index); }.bind(this)));

        this.list = list;
        this.list.addEventListener('mousemove', function() { this.mouse = true; }.bind(this));
        this.list.addEventListener('mouseout', function() { if (this.mouse) this.setIndex(-1); }.bind(this));
        this.list.style.display = 'block';

        this.trigger = trigger;
    }

    setIndex(index, scroll)
    {
        this.index = index;
        this.items.forEach((item, index) => { if (index != this.index) item.classList.remove('current'); else item.classList.add('current'); });

        if (index >= 0 && scroll)
        {
            var list = this.list.getBoundingClientRect();
            var item = this.items[this.index].getBoundingClientRect();

            if (list.top <= item.top && list.bottom >= item.bottom)
                return;

            this.items[this.index].scrollIntoView(list.top > item.top);
        }
    }

    handleKey(event)
    {
        let key = event.key.toLocaleLowerCase();

        if (['arrowdown', 'arrowup', 'enter'].includes(key))
            event.preventDefault();

        this.mouse = false;

        switch (key)
        {
            case 'arrowdown': for (let i = this.index + 1; i < this.items.length; i++) { if (this.items[i].style.display != 'none') { this.setIndex(i, true); break; } } break;
            case 'arrowup': for (let i = this.index - 1; i >= 0; i--) { if (this.items[i].style.display != 'none') { this.setIndex(i, true); break; } } break;
            case 'enter': if (this.index >= 0 && this.index < this.items.length) this.items[this.index].click(); break;

            case 'esc':
            case 'escape':
                this.close();
                return false;
        }

        return true;
    }

    close()
    {
        this.list.style.display = 'none';
    }
}

window.onload = function()
{
    let date = new Date();
    let logout = document.querySelector('#logout');

    modal = document.querySelector('#modal');
    controller = new Controller();

    window.addEventListener('hashchange', function() { let page = decodeURI(location.hash).slice(1); if (controller.page != page) controller.showPage(page); });

    document.addEventListener('mousedown', function(event) { if (event.target == modal) showModal(false); });
    document.addEventListener('click', function(event) { if (dropdown && !dropdown.trigger.contains(event.target)) { dropdown.close(); dropdown = undefined; } });

    document.querySelector('#hotkeys').addEventListener('click', function()
    {
        fetch('hotkeys.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    });

    document.querySelector('#toggleTheme').addEventListener('click', function() { theme = theme != 'light' ? 'light' : 'dark'; setTheme(); localStorage.setItem('theme', theme); });
    document.querySelector('#toggleWide').addEventListener('click', function() { wide = wide != 'off' ? 'off' : 'on'; setWide(); localStorage.setItem('wide', wide); });

    setTheme();
    setWide();

    if (date > new Date(date.getFullYear() + '-12-23') || date < new Date(date.getFullYear() + '-01-15'))
        document.querySelector('.header img').src = 'img/xmas.svg';

    if (!logout)
        return;

    logout.addEventListener('click', function()
    {
        fetch('logout.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.current').addEventListener('click', function() { window.location.href = 'logout?session=current'; }.bind(this));

            if (!guest)
                modal.querySelector('.all').addEventListener('click', function() { window.location.href = 'logout?session=all'; }.bind(this));
            else
                modal.querySelector('.all').style.display = 'none';

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    });
};

window.onresize = function()
{
    controller.updateMenu(true);
};

document.onkeydown = function(event)
{
    let key = event.key.toLowerCase();

    if (dropdown)
    {
        if (!dropdown.handleKey(event))
            dropdown = undefined;

        return;
    }

    if (!['input', 'textarea'].includes(event.target.tagName.toLowerCase()))
    {
        switch (key)
        {
            case 'h': document.querySelector('#hotkeys').click(); return;
            case 't': document.querySelector('#toggleTheme').click(); return;
            case 'w': document.querySelector('#toggleWide').click(); return;
        }
    }

    if (modal.style.display != 'block')
    {
        let search = document.querySelector("#search");

        switch (key)
        {
            case '/':
            case 'esc':
            case 'escape':

                if (search && ((key == '/' && search.style.display == 'none') || (key != '/' && search.style.display != 'none')))
                {
                    event.preventDefault();
                    document.querySelector('th.search').click();
                }

                break;

            case 'l':

                if (!search)
                    document.querySelector('#list')?.click();

                break;

            case 'arrowleft':  document.querySelector(event.shiftKey ? '#left' : 'button.previous')?.click(); break;
            case 'arrowright': document.querySelector(event.shiftKey ? '#right' : 'button.next')?.click(); break;
            case 'e':          document.querySelector('button.edit')?.click(); break;
            case 'r':          document.querySelector('button.remove')?.click(); break;
            case 's':          document.querySelector('button.save')?.click(); break;
        }

        return;
    }

    switch (key)
    {
        case 'enter':

            if (event.shiftKey)
                break;

            event.preventDefault();
            modal.querySelector('button.remove')?.click();
            modal.querySelector('button.save')?.click();
            break;

        case 'esc':
        case 'escape':
            modal.querySelector('button.cancel')?.click();
            modal.querySelector('button.close')?.click();
            break;
    }
};

function setTheme()
{
    document.querySelector('html').setAttribute('theme', theme);
    document.querySelector('#toggleTheme').innerHTML = (theme != 'light' ? '<i class="icon-on"></i>' : '<i class="icon-off"></i>') + ' DARK THEME';
    controller.services.recorder?.updateCharts();
}

function setWide()
{
    document.querySelectorAll('.container').forEach(item => item.style.maxWidth = wide != 'off' ? 'none' : '1000px');
    document.querySelector('#toggleWide').innerHTML = (wide != 'off' ? '<i class="icon-on"></i>' : '<i class="icon-off"></i>') + ' WIDE MODE';
    controller.updateMenu(true);
}

function sortTable(table, index, first = true, once = false)
{
    let check = true;

    while (check)
    {
        let rows = table.querySelectorAll('tbody tr');

        check = false;

        for (let i = first ? 0 : 1; i < rows.length - 1; i++)
        {
            let current = rows[i].querySelectorAll('td')[index];
            let next = rows[i + 1].querySelectorAll('td')[index];
            let sort;

            switch (true)
            {
                case current.classList.contains('lastSeen') || current.classList.contains('lastTriggered'):
                    sort = parseInt(current.dataset.value) > parseInt(next?.dataset.value);
                    break;

                case current.classList.contains('linkQuality'):
                    sort = parseInt(current.innerHTML) > parseInt(next?.innerHTML);
                    break;

                default:
                    sort = current.innerHTML.toLowerCase() > next?.innerHTML.toLowerCase();
                    break;
            }

            if (sort)
            {
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                check = true;
                break;
            }
        }
    }

    table.querySelectorAll('th.sort').forEach(cell => cell.classList.remove('warning') );

    if (once)
        return;

    table.querySelector('th[data-index="' + index + '"]')?.classList.add('warning');
}

function showTableTotal(table, single, plural, colspan, count, total = true)
{
    table.querySelector('tfoot').innerHTML='<tr><th colspan="' + colspan + '">' + count + ' ' + (count == 1 ? single : plural) + ' ' + (total ? 'total' : 'found') + '</th></tr>';
}

function addTableSearch(table, plural, single, colspan, cells = [0])
{
    let total = table.querySelectorAll('tbody tr').length;
    let search = table.querySelector('#search');
    let input = search.querySelector('input');

    showTableTotal(table, single, plural, colspan, total);

    table.querySelector('th.search').addEventListener('click', function()
    {
        if (search.style.display == 'none')
        {
            search.style.display = 'table-row';
            input.focus();
            return;
        }

        table.querySelectorAll('tbody tr').forEach(row => { row.style.display = 'table-row'; });
        search.style.display = 'none';
        input.value = '';

        showTableTotal(table, single, plural, colspan, total);
    });

    input.addEventListener('input', function()
    {
        let count = 0;

        table.querySelectorAll('tbody tr').forEach(row =>
        {
            let check = false;
            row.querySelectorAll('td').forEach((cell, index) => { if (!check && cells.includes(index) && cell.innerHTML.toLowerCase().includes(input.value.toLowerCase())) { count++; check = true; } });
            row.style.display = check ? 'table-row' : 'none';
        });

        showTableTotal(table, single, plural, colspan, count, input.value ? false : true);
    });
}

function addDropdown(element, options, callback, separator, trigger)
{
    let list = document.createElement('div');
    let search;

    list.classList.add('list');
    element.append(list);

    if (!options.length)
    {
        let item = document.createElement('div');
        item.innerHTML = '<i>list is empty</i>';
        item.classList.add('center', 'shade');
        list.append(item);
    }

    if (!trigger && options.length > 10)
    {
        search = document.createElement('input');
        search.type = 'text';
        search.placeholder = 'Type to search';
        search.addEventListener('input', function() { dropdown.setIndex(-1); list.querySelectorAll('.item').forEach(item => { item.style.display = search.value && !item.innerHTML.toLowerCase().includes(search.value.toLowerCase()) ? 'none' : 'block'; }); });
        list.append(search);
    }

    options.forEach((option, index) =>
    {
        let item = document.createElement('div');

        item.innerHTML = option;
        item.classList.add('item');
        item.addEventListener('click', function() { callback(option); });

        if (separator && index == separator)
            list.append(document.createElement('hr'));

        list.append(item);
    });

    if (!trigger)
        trigger = element;

    trigger.addEventListener('click', function(event)
    {
        if (event.target.nodeName == 'INPUT')
            return;

        if (dropdown && event.target != search)
        {
            dropdown.close();
            dropdown = undefined;
            return;
        }

        dropdown = new Dropdown(list, trigger);

        if (!search)
            return;

        search.focus();
    });
}

function showModal(show, focus)
{
    if (show)
    {
        let list =
        {
            'Trigger name': '{{ triggerName }}',
            'Shell output': '{{ shellOutput }}',
            'File contents': '{{ file | /path/to/file }}',
            'MQTT data': '{{ mqtt | mqtt/topic/name | jsonField }}',
            'State value': '{{ state | stateName }}',
            'Color temperature': '{{ colorTemperature | 153 | 500 }}',
            'Timestamp': '{{ timestamp | dd.MM.yy hh:mm }}',
            ...controller.propertiesList(true)
        };

        modal.style.display = 'block';
        modal.querySelectorAll('label .extend').forEach(item => item.addEventListener('click', function() { modal.querySelector('textarea[name="' + item.id + '"]').style.height = '300px'; item.style.display = 'none'; }));
        modal.querySelectorAll('label .dropdown').forEach(item => { addDropdown(item, Object.keys(list), function(key) {let input = modal.querySelector('textarea[name="' + item.id + '"]'); input.value += list[key]; input.focus(); input.setSelectionRange(input.value.length - list[key].length, input.value.length); }, 7); });
        modal.querySelector(focus)?.focus();
        return;
    }

    Object.keys(modal.dataset).forEach(item => { delete modal.dataset[item]; });
    modal.querySelector('.data').innerHTML = null;
    modal.style.display = 'none';
}

function handleArrowButtons(element, list, index, callback)
{
    if (list.length < 2 || !index)
        element.querySelector('.previous').disabled = true;
    else
        element.querySelector('.previous').addEventListener('click', function() { callback(list[index - 1]); });

    if (list.length < 2 || index == list.length - 1)
        element.querySelector('.next').disabled = true;
    else
        element.querySelector('.next').addEventListener('click', function() { callback(list[index + 1]); });
}

function randomString(length)
{
    return Math.random().toString(36).substring(2, length + 2);
}

function formData(form)
{
    let data = new Object();

    Array.from(form).forEach(input =>
    {
        switch (input.type)
        {
            case 'checkbox': data[input.name] = input.checked; break;
            case 'number':   data[input.name] = parseFloat(input.value); break;
            default:         data[input.name] = input.value; break;
        }
    });

    return data;
}

function timeInterval(interval, round = true)
{
    switch (true)
    {
        case interval >= 86400: return parseInt(Math.round(interval / 86400)) + ' day';
        case interval >= 3600:  return parseInt(Math.round(interval / 3600))  + ' hrs';
        case interval >= 60:    return parseInt(Math.round(interval / 60))    + ' min';
    }

    if (!round)
        return Math.ceil(interval) + ' sec';

    return interval >= 5 ? parseInt(interval / 5) * 5 + ' sec' : 'now';
}

function deviceCommand(device, endpointId, data)
{
    let service = controller.services[device.service];
    let item;

    if (!service)
        return;

    item = service.names ? device.info.name : device.id;
    controller.socket.publish('td/' + device.service + '/' + (endpointId != 'common' ? item + '/' + endpointId : item), data);
}

function loadFile(callback)
{
    let input = document.createElement('input');

    input.addEventListener('change', function()
    {
        let reader = new FileReader();

        reader.onload = function()
        {
            let data;
            try { data = JSON.parse(reader.result); } catch { controller.showToast('File <b>' + input.files[0].name + '</b> is not valid json file', 'error'); return; }
            callback(data);
        };

        reader.readAsText(input.files[0]);
    });

    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'application/json');
    input.click();
}