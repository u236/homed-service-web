var modal, controller, theme = localStorage.getItem('theme') ?? 'dark', wide = localStorage.getItem('wide') ?? 'off', empty = '<span class="shade">&bull;</span>';

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

        this.ws.send(JSON.stringify({'action': 'subscribe', 'topic': topic}));
    }

    publish(topic, message)
    {
        this.ws.send(JSON.stringify({'action': 'publish', 'topic': topic, 'message': message}));
    }

    unsubscribe(topic)
    {
        this.subscriptions.splice(this.subscriptions.indexOf(topic), 1);
        this.ws.send(JSON.stringify({'action': 'unsubscribe', 'topic': topic}));
    }
}

class Controller
{
    socket = new Socket(this.onopen.bind(this), this.onclose.bind(this), this.onmessage.bind(this));
    services = {dashboard: new Dashboard(this)};

    constructor()
    {
        this.showPage(localStorage.getItem('page') ?? 'dashboard');
    }

    onopen()
    {
        console.log('socket successfully connected');
        this.socket.subscribe('service/#');
        this.socket.subscribe('status/web');
    }

    onclose()
    {
        document.querySelector('.services').innerHTML = null;
        document.querySelector('.menu').innerHTML = '<i class="icon-false"></i> DISCONNECTED';
        this.clearPage('socket closed, reconnecting...');
        this.socket.subscriptions = new Array();
        Object.keys(this.services).forEach(service => { if (service != 'dashboard') this.removeService(service); });
    }

    onmessage(topic, message)
    {
        let list = topic.split('/');

        if (list[0] == 'service')
        {
            let service = list[2] ? list[1] + '/' + list[2] : list[1];

            if (message.status == 'online')
            {
                if (this.services[service])
                    return;

                switch (list[1])
                {
                    case 'automation': this.services[service] = new Automation(this); break;
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

            menu.innerHTML = '';
            services.sort();

            names.forEach(name =>
            {
                services.filter(service => { return service.startsWith(name); }).forEach(service =>
                {
                    let item = document.createElement('span');

                    if (menu.innerHTML)
                        menu.append('|');

                    item.innerHTML = service;
                    item.dataset.service = service;
                    item.addEventListener('click', function() { this.showPage(service); }.bind(this));

                    menu.appendChild(item);
                });
            });
        }

        menu.querySelectorAll('span').forEach(item =>
        {
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

        localStorage.setItem('page', page);
        location.hash = page;

        this.service = service;
        this.page = page;

        this.updateMenu(false);

        if (!this.services[service])
        {
            this.clearPage(service + ' service is unavailable');
            return;
        }

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

        setTimeout(function() { toast.removeChild(item); }, 200);
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

        return device ?? new Object();
    }

    propertiesList()
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

                Object.keys(device.endpoints).forEach(endpoint =>
                {
                    device.items(endpoint).forEach(expose =>
                    {
                        exposeList(expose, device.options(endpoint)).forEach(property =>
                        {
                            let value = {endpoint: item.split('/')[0] + '/' + id, property: property};

                            if (endpoint != 'common')
                                value.endpoint += '/' + endpoint;

                            list[device.info.name + ' &rarr; ' + exposeTitle(property, endpoint)] = value;
                        });
                    });
                });
            });
        });

        return list;
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

    endpoint(endpoint)
    {
        if (!this.endpoints[endpoint])
            this.endpoints[endpoint] = {properties: new Object()};

        return this.endpoints[endpoint];
    }

    exposes(endpoint)
    {
        return this.endpoint(endpoint).exposes ?? new Object();
    }

    items(endpoint)
    {
        return this.exposes(endpoint).items ?? new Array();
    }

    options(endpoint)
    {
        return this.exposes(endpoint).options ?? new Object();
    }

    properties(endpoint)
    {
        return this.endpoint(endpoint).properties;
    }

    setExposes(endpoint, exposes)
    {
        this.endpoint(endpoint).exposes = exposes;
    }

    setProperties(endpoint, data)
    {
        Object.keys(data).forEach(key => { this.endpoint(endpoint).properties[key] = data[key]; });
    }
}

class DeviceService
{
    content = document.querySelector('.content .container');
    intervals = new Array();
    devices = new Object();

    constructor(controller, service, instance)
    {
        this.controller = controller;
        this.service = service;

        if (instance)
        {
            this.service += '/' + instance;
            this.instance = true;
        }

        this.intervals.push(setInterval(function() { this.updateAvailability(); }.bind(this), 100));
    }

    updateAvailability()
    {
        Object.keys(this.devices).forEach(id =>
        {
            let device = this.devices[id];

            if (this.service.startsWith('zigbee') && !device.info.logicalType)
                return;

            document.querySelectorAll('tr[data-device="' + this.service + '/' + id + '"]').forEach(row =>
            {
                let cell = row.querySelector('.availability');
                let className = device.info.active ? device.availability : 'shade';
                let value = device.info.active ? '<i class="' + (device.availability == "online" ? 'icon-true success' : 'icon-false error') + '"></i>' : '<i class="icon-false shade"></i>';

                if (!row.classList.contains(className))
                {
                    row.classList.remove('online', 'offline', 'shade');
                    row.classList.add(className);
                }

                if (!cell || cell.innerHTML == value)
                    return;

                cell.innerHTML = value;
            });
        });
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'event':
            {
                let html = 'Device <b>' + message.device + '</b> ';

                if (this.controller.service == this.service && (message.event == 'added' || message.event == 'updated'))
                {
                    this.controller.clearPage();
                    this.devices = new Object();
                }

                switch (message.event)
                {
                    case 'idDuplicate':    this.controller.showToast(html + 'identifier is already in use', 'error'); return;
                    case 'nameDuplicate':  this.controller.showToast(html + 'new name is already in use', 'error'); return;
                    case 'incompleteData': this.controller.showToast(html + 'data is incomplete', 'error'); return;
                    case 'added':          this.controller.showToast(html + 'successfully added'); return;
                    case 'updated':        this.controller.showToast(html + 'successfully updated'); return;
                    case 'removed':        this.controller.showToast(html + 'removed', 'warning'); return;
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

                    Object.keys(message).forEach(endpoint =>
                    {
                        this.controller.socket.subscribe('fd/' + this.service + '/' + (endpoint != 'common' ? item + '/' + endpoint : item));
                        device.setExposes(endpoint, message[endpoint]);
                    });

                    if (device.service.startsWith('zigbee') && !device.endpoints.common)
                        this.controller.socket.subscribe('fd/' + this.service + '/' + item);

                    this.serviceCommand({action: 'getProperties', device: item, service: 'web'});
                }

                break;
            }

            case 'fd':
            {
                let device = this.findDevice(this.instance ? list[3] : list[2]);

                if (device && message)
                {
                    let endpoint = list[3] ?? 'common';
                    device.setProperties(endpoint, message);
                    Object.keys(message).forEach(name => { updateExpose(device, endpoint, name, message[name]); });
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

            default: return value;
        }
    }

    findDevice(item)
    {
        return this.names ? Object.values(this.devices).find(device => device.info.name == item) : this.devices[item];
    }

    serviceCommand(data, clear = false)
    {
        if (clear)
            this.controller.clearPage();

        this.controller.socket.publish('command/' + this.service, data);
    }

    showDeviceInfo(device)
    {
        fetch('html/' + this.service + '/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let table;

            this.content.innerHTML = html;
            table = this.content.querySelector('table.exposes');

            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(device); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(device); }.bind(this));

            Object.keys(device.info).forEach(key =>
            {
                let cell = document.querySelector('.' + key);
                let row = cell ? cell.closest('tr') : undefined;

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

    showDeviceRemove(device)
    {
        fetch('html/' + this.service + '/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.serviceCommand({action: 'removeDevice', device: this.names ? device.info.name : device.id}, true); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }
}

window.onload = function()
{
    let logout = document.querySelector('#logout');

    modal = document.querySelector('#modal');
    controller = new Controller();

    window.addEventListener('mousedown', function(event) { if (event.target == modal) showModal(false); });

    window.addEventListener('hashchange', function()
    {
        let page = decodeURI(location.hash).slice(1);

        if (controller.page == page)
            return;

        controller.showPage(page);
    });

    document.querySelector('#toggleTheme').addEventListener('click', function() { theme = theme != 'light' ? 'light' : 'dark'; setTheme(); localStorage.setItem('theme', theme); });
    document.querySelector('#toggleWide').addEventListener('click', function() { wide = wide != 'off' ? 'off' : 'on'; setWide(); localStorage.setItem('wide', wide); });

    setTheme();
    setWide();

    if (!logout)
        return;

    logout.addEventListener('click', function()
    {
        fetch('logout.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.current').addEventListener('click', function() { window.location.href = 'logout?session=current'; }.bind(this));
            modal.querySelector('.all').addEventListener('click', function() { window.location.href = 'logout?session=all'; }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    });
};

document.onkeydown = function(event)
{
    if (event.key == 'Esc' || event.key == 'Escape')
        showModal(false);
};

function setTheme()
{
    document.querySelectorAll('body, .homed').forEach(item => item.setAttribute('theme', theme));
    document.querySelector('#toggleTheme').innerHTML = (theme != 'light' ? '<i class="icon-on"></i>' : '<i class="icon-off"></i>') + ' DARK THEME';

    if (!controller.services.recorder)
        return;

    controller.services.recorder.updateCharts();
}

function setWide()
{
    document.querySelectorAll('.container').forEach(item => item.style.maxWidth = wide != 'off' ? 'none' : '1000px');
    document.querySelector('#toggleWide').innerHTML = (wide != 'off' ? '<i class="icon-on"></i>' : '<i class="icon-off"></i>') + ' WIDE MODE';
}

function sortTable(table, index, first = true, once = false)
{
    let check = true;

    while (check)
    {
        let rows = table.rows;

        check = false;

        for (let i = first ? 1 : 2; i < rows.length - 1; i++)
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

    table.querySelector('th[data-index="' + index + '"]').classList.add('warning');
}

function addDropdown(dropdown, options, callback, separator = 0)
{
    let list = document.createElement('div');
    let search;

    list.classList.add('list');
    dropdown.append(list);

    if (options.length > 10)
    {
        search = document.createElement('input');
        search.type = 'text';
        search.placeholder = 'Type to search';
        list.append(search);
        search.addEventListener('input', function() { list.querySelectorAll('.item').forEach(item => { item.style.display = search.value && !item.innerHTML.toLowerCase().includes(search.value.toLowerCase()) ? 'none' : 'block'; }); });
    }

    options.forEach((option, index) =>
    {
        let element = document.createElement('div');

        element.addEventListener('click', function() { callback(option); });
        element.innerHTML = option;
        element.classList.add('item');

        if (separator && index == separator)
            list.append(document.createElement('hr'));

        list.append(element);
    });

    dropdown.addEventListener('click', function(event)
    {
        if (list.style.display == 'block' && event.target != search)
        {
            list.style.display = 'none';
            return;
        }

        list.style.display = 'block';

        if (!search)
            return;

        search.focus();
    });

    document.addEventListener('click', function(event) { if (!dropdown.contains(event.target)) list.style.display = 'none'; });
}

function showModal(show)
{
    if (show)
    {
        modal.style.display = 'block';
        return;
    }

    modal.querySelector('.data').innerHTML = null;
    modal.style.display = 'none';
}

function handleSave(event)
{
    if (event.key == 'Enter' && !event.shiftKey)
    {
        event.preventDefault();
        document.querySelector('.save').click();
    }
}

function handleSend(event, item)
{
    if (event.key == 'Enter' && !event.shiftKey)
    {
        event.preventDefault();
        document.querySelector('.send').click();
    }
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

function deviceCommand(device, endpoint, data)
{
    let service = controller.services[device.service];
    let item;

    if (!service)
        return;

    item = service.names ? device.info.name : device.id;
    controller.socket.publish('td/' + device.service + '/' + (endpoint != 'common' ? item + '/' + endpoint : item), data);
}
