var modal, controller, theme = localStorage.getItem('theme') ?? 'dark', empty = '<span class="shade">&bull;</span>';

class Socket
{
    subscriptions = new Array();
    connected = false;

    constructor(onopen, onclose, onmessage)
    {
        this.onopen = onopen ?? function() {};
        this.onclose = onclose ?? function() {};
        this.onmessage = onmessage ?? function() {};
        this.connect();
    }

    connect()
    {
        this.ws = new WebSocket((location.protocol == 'https:' ? 'wss://' : 'ws://') + location.host + location.pathname);

        this.ws.onopen = function() { this.onopen(); this.connected = true; }.bind(this);
        this.ws.onmessage = function(event) { var data = JSON.parse(event.data); this.onmessage(data.topic, data.message); }.bind(this);
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
    services = {'dashboard': 'offline', 'recorder': 'offline', 'automation': 'offline', 'zigbee': 'offline', 'modbus': 'offline', 'custom': 'offline'};
    socket = new Socket(this.onopen.bind(this), this.onclose.bind(this), this.onmessage.bind(this));

    dashboard = new Dashboard(this);
    recorder = new Recorder(this);
    automation = new Automation(this);

    zigbee = new ZigBee(this);
    modbus = new Modbus(this);
    custom = new Custom(this);

    onopen()
    {
        console.log('socket successfully connected');
        Object.keys(this.services).forEach(service => { this.socket.subscribe('service/' + (service != 'dashboard' ? service : 'web')); });

        this.zigbee.devices = new Object();
        this.modbus.devices = new Object();
        this.custom.devices = new Object();
    }

    onclose()
    {
        this.clearPage(this.service, 'socket closed, reconnecting');
    }

    onmessage(topic, message)
    {
        var list = topic.split('/');
        var service = list[1] != 'web' ? list[1] : 'dashboard';

        if (list[0] == 'service')
        {
            if (message.status != 'online')
            {
                var item = list[1];

                if (this.service == service)
                    this.clearPage(this.page, service + ' service is offline');

                if (service == 'recorder')
                    this.socket.unsubscribe('recorder');

                this.socket.subscriptions.filter(topic => { var list = topic.split('/'); return list[0] != 'service' && list[1] == item; }).forEach(topic => { this.socket.unsubscribe(topic); });
            }
            else
            {
                if (service == 'recorder')
                    this.socket.subscribe('recorder');

                this.socket.subscribe('status/' + list[1]);
                this.socket.subscribe('event/' + list[1]);
            }

            this.services[service] = message.status;
            this.updateMenu();
            return;
        }

        if (list[0] == 'recorder')
        {
            this.recorder.parseData(message);
            return;
        }

        switch (service)
        {
            case 'dashboard': this.dashboard.parseMessage(list, message); break;
            case 'recorder': this.recorder.parseMessage(list, message); break;
            case 'automation': this.automation.parseMessage(list, message); break;
            case 'zigbee': this.zigbee.parseMessage(list, message); break;
            case 'modbus': this.modbus.parseMessage(list, message); break;
            case 'custom': this.custom.parseMessage(list, message); break;
        }
    }

    updateMenu()
    {
        var services = document.querySelector('.header .services');

        services.innerHTML = '';

        Object.keys(this.services).forEach(service =>
        {
            var element = document.createElement('span');

            if (this.services[service] != 'online')
                return;

            if (services.innerHTML)
                services.append('|');

            if (this.service == service)
                element.classList.add('highlight');

            element.addEventListener('click', function() { this.showPage(service); localStorage.setItem('page', service); }.bind(this));
            element.innerHTML = service;

            services.appendChild(element);
        });
    }

    setService(service)
    {
        if (this.service == service)
            return;

        document.querySelectorAll('.header .services span').forEach(item => { item.classList.toggle('highlight', item.innerHTML == service); });

        switch (service)
        {
            case 'dashboard': this.dashboard.showMenu(); break;
            case 'recorder': this.recorder.showMenu(); break;
            case 'automation': this.automation.showMenu(); break;
            case 'zigbee': this.zigbee.showMenu(); break;
            case 'modbus': this.modbus.showMenu(); break;
            case 'custom': this.custom.showMenu(); break;
        }

        this.service = service;
    }

    setPage(page)
    {
        location.hash = page;
        this.page = page;
    }

    showPage(page, force = false)
    {
        if (this.page == page && !force)
            return;

        switch (page)
        {
            case 'recorder':       this.recorder.showItemList(); break;
            case 'automation':     this.automation.showAutomationList(); break;
            case 'zigbee':         this.zigbee.showDeviceList(); break;
            case 'modbus':         this.modbus.showDeviceList(); break;
            case 'custom':         this.custom.showDeviceList(); break;
            default:               this.dashboard.showDashboard(); break;
        }
    }

    clearPage(name, warning = null)
    {
        var content = document.querySelector('.content .container');

        content.innerHTML = '<div class="pageLoader"></div><div class="center warning"></div>';

        if (warning)
        {
            content.querySelector('.warning').innerHTML = warning;
            console.log(warning);
        }

        switch (this.service)
        {
            case 'dashboard': this.dashboard.status = new Object(); break;
            case 'recorder': this.recorder.status = new Object(); break;
            case 'automation': this.automation.status = new Object(); break;
            case 'zigbee': this.zigbee.devices = new Object(); break;
            case 'modbus': this.modbus.devices = new Object(); break;
            case 'custom': this.custom.devices = new Object(); break;
        }

        this.setPage(name);
        showModal(false);
    }

    showToast(message, style = 'success')
    {
        var element = document.createElement('div');

        element.addEventListener('click', function() { this.clearToast(element); }.bind(this));
        element.innerHTML = '<div class="message">' + message + '</div>';
        element.classList.add('item', 'fade-in', style);

        setTimeout(function() { this.clearToast(element); }.bind(this), 5000);
        document.querySelector('#toast').appendChild(element);
    }

    clearToast(item)
    {
        var toast = document.querySelector('#toast');

        if (!toast.contains(item))
            return;

        setTimeout(function() { toast.removeChild(item); }, 200);
        item.classList.add('fade-out');
    }

    propertiesList()
    {
        var services = ['zigbee', 'modbus', 'custom'];
        var list = new Object();

        services.forEach(service =>
        {
            var devices = this[service].devices ?? new Object();

            if (!Object.keys(devices))
                return;

            Object.keys(devices).forEach(id =>
            {
                var device = devices[id];

                Object.keys(device.endpoints).forEach(endpoint =>
                {
                    device.items(endpoint).forEach( expose =>
                    {
                        exposeList(expose, device.options(endpoint)).forEach(property =>
                        {
                            var value = {endpoint: service + '/' + id, property: property}

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
            this.endpoints[endpoint] = new Object;

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
        return this.endpoint(endpoint).properties ?? new Object();
    }

    setExposes(endpoint, expose)
    {
        this.endpoint(endpoint).exposes = expose;
    }

    setProperties(endpoint, properties)
    {
        this.endpoint(endpoint).properties = properties;
    }
}

class DeviceService
{
    content = document.querySelector('.content .container');
    devices = new Object();

    constructor(controller, service)
    {
        this.controller = controller;
        this.service = service;
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
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
                var row = document.querySelector('tr[data-device="' + device.id + '"]');

                if (message.lastSeen)
                    device.info.lastSeen = message.lastSeen;

                if (this.controller.page == this.service && row)
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
                var item = this.names ? device.info.name : device.id;

                Object.keys(message).forEach(endpoint =>
                {
                    this.controller.socket.subscribe('fd/' + this.service + '/' + (endpoint != 'common' ? item + '/' + endpoint : item));
                    device.setExposes(endpoint, message[endpoint]);
                });

                this.controller.socket.publish('command/' + this.service, {action: 'getProperties', device: item, service: 'web'});
            }

            break;

        case 'fd':

            var device = this.findDevice(list[2]);

            if (device && message)
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

    showDeviceInfo(device)
    {
        this.controller.setService(this.service);
        this.controller.setPage(this.service + 'Device');

        fetch('html/' + this.service + '/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var table;

            this.content.innerHTML = html;
            table = this.content.querySelector('table.exposes');

            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(device); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(device); }.bind(this));

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

    showDeviceRemove(device)
    {
        fetch('html/' + this.service + '/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.controller.socket.publish('command/' + this.service, {action: 'removeDevice', device: this.names ? device.info.name : device.info.id}); this.controller.clearPage(this.service); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }
}

window.onload = function()
{
    var logout = document.querySelector('#logout');

    modal = document.querySelector('#modal');
    controller = new Controller();

    window.addEventListener('hashchange', function() { controller.showPage(location.hash.slice(1)); });
    window.addEventListener('mousedown', function(event) { if (event.target == modal) showModal(false); });

    document.querySelector('body').setAttribute('theme', theme);
    document.querySelector('.homed').setAttribute('theme', theme);
    document.querySelector('#toggleTheme').innerHTML = (theme != 'light' ? '<i class="icon-on"></i>' : '<i class="icon-off"></i>') + ' DARK THEME';
    document.querySelector('#toggleTheme').addEventListener('click', function() { theme = theme != 'light' ? 'light' : 'dark'; localStorage.setItem('theme', theme); location.reload(); });

    controller.showPage(localStorage.getItem('page') ?? 'dashboard');

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

function sortTable(table, index, first = true)
{
    var check = true;

    while (check)
    {
        var rows = table.rows;

        check = false;

        for (var i = first ? 1 : 2; i < rows.length - 1; i++)
        {
            if (rows[i].querySelectorAll('td')[index].innerHTML.toLowerCase() <= rows[i + 1].querySelectorAll('td')[index].innerHTML.toLowerCase())
                continue;

            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            check = true;
            break;
        }
    }

    table.querySelectorAll('th.sort').forEach(cell => cell.classList.remove('warning') );
    table.querySelector('th[data-index="' + index + '"]').classList.add('warning');
}

function addDropdown(dropdown, options, callback, separator = 0)
{
    var list = document.createElement('div');
    var search = undefined;

    list.classList.add('list');
    dropdown.append(list);

    if (options.length > 10)
    {
        search = document.createElement('input');
        search.type = 'text';
        search.placeholder = 'Type to search'
        list.append(search);
        search.addEventListener('input', function() { list.querySelectorAll('.item').forEach(item => { item.style.display = search.value && !item.innerHTML.toLowerCase().includes(search.value.toLowerCase()) ? 'none' : 'block'; }); });
    }

    options.forEach((option, index) =>
    {
        var element = document.createElement('div');
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

function formData(form)
{
    var data = new Object();

    Array.from(form).forEach(input =>
    {
        switch (input.type)
        {
            case 'checkbox': data[input.name] = input.checked; break;
            case 'number':   data[input.name] = parseFloat(input.value); break;
            default:         data[input.name] = input.value;
        }
    });

    return data;
}

function timeInterval(interval)
{
    switch (true)
    {
        case interval >= 86400: return parseInt(interval / 86400) + ' day';
        case interval >= 3600:  return parseInt(interval / 3600)  + ' hrs';
        case interval >= 60:    return parseInt(interval / 60)    + ' min';
        case interval >= 5:     return parseInt(interval / 5) * 5 + ' sec';
        default:                return                               'now';
    }
}

function deviceCommand(device, endpoint, data)
{
    var item = controller[device.service].names ? device.info.name : device.id;
    controller.socket.publish('td/' + device.service + '/' + (endpoint != 'common' ? item + '/' + endpoint : item), data);
}