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
    services = {'automation': 'offline', 'custom': 'offline', 'zigbee': 'offline'};
    socket = new Socket(this.onopen.bind(this), this.onclose.bind(this), this.onmessage.bind(this));

    automation = new Automation(this);
    custom = new Custom(this);
    zigbee = new ZigBee(this);

    onopen()
    {
        console.log('socket successfully connected');
        Object.keys(this.services).forEach(service => { this.socket.subscribe('service/' + service); });
    }

    onclose()
    {
        this.clearPage(this.service, 'socket closed, reconnecting');
    }

    onmessage(topic, message)
    {
        var list = topic.split('/');
        var service = list[1];

        if (list[0] == 'service')
        {
            if (message.status != 'online')
            {
                if (this.service == service)
                    this.clearPage(this.page, service + ' service is offline');

                this.socket.subscriptions.filter(topic => { var list = topic.split('/'); return list[0] != 'service' && list[1] == service; }).forEach(topic => { this.socket.unsubscribe(topic); });
            }
            else
            {
                this.socket.subscribe('status/' + service);
                this.socket.subscribe('event/' + service);
            }

            this.services[service] = message.status;
            this.updateMenu();
            return;
        }

        switch (service)
        {
            case 'automation': this.automation.parseMessage(list, message); break;
            case 'custom': this.custom.parseMessage(list, message); break;
            case 'zigbee': this.zigbee.parseMessage(list, message); break;
        }
    }

    updateMenu()
    {
        var services = document.querySelector('.header .services');

        services.innerHTML = '';

        Object.keys(this.services).forEach(service =>
        {
            var item = document.createElement('span');

            if (this.services[service] != 'online')
                return;

            if (services.innerHTML)
                services.append('|');

            if (this.service == service)
                item.classList.add('highlight');

            item.addEventListener('click', function() { this.showPage(service); localStorage.setItem('page', service); }.bind(this));
            item.innerHTML = service;

            services.appendChild(item);
        });
    }

    setService(service)
    {
        if (this.service == service)
            return;

        document.querySelectorAll('.header .services span').forEach(item => { item.classList.toggle('highlight', item.innerHTML == service); });

        switch (service)
        {
            case 'automation': this.automation.showMenu(); break;
            case 'custom': this.custom.showMenu(); break;
            case 'zigbee': this.zigbee.showMenu(); break;
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
            case 'automation':     this.automation.showAutomationList(); break;
            case 'automationInfo': this.automation.showAutomationInfo(); break;
            case 'custom':         this.custom.showDeviceList(); break;
            case 'customDevice':   this.custom.showDeviceInfo(); break;
            case 'zigbeeMap':      this.zigbee.showDeviceMap(); break;
            case 'zigbeeDevice':   this.zigbee.showDeviceInfo(); break;
            default:               this.zigbee.showDeviceList(); break;
        }
    }

    clearPage(name, warning = null)
    {
        var content = document.querySelector('.content .container');

        content.innerHTML = '<div class="loader"></div><div class="center warning"></div>';

        if (warning)
        {
            content.querySelector('.warning').innerHTML = warning;
            console.log(warning);
        }

        switch (this.service)
        {
            case 'automation': this.automation.status = new Object(); break;
            case 'custom': this.custom.devices = new Object(); break;
            case 'zigbee': this.zigbee.devices = new Object(); break;
        }

        this.setPage(name);
        showModal(false);
    }

    showToast(message, style = 'success')
    {
        var item = document.createElement('div');

        item.addEventListener('click', function() { this.clearToast(item); }.bind(this));
        item.innerHTML = '<div class="message">' + message + '</div>';
        item.classList.add('item', 'fade-in', style);

        setTimeout(function() { this.clearToast(item); }.bind(this), 5000);
        document.querySelector('#toast').appendChild(item);
    }

    clearToast(item)
    {
        var toast = document.querySelector('#toast');

        if (!toast.contains(item))
            return;

        setTimeout(function() { toast.removeChild(item); }, 200);
        item.classList.add('fade-out');
    }
}

class Device // TODO: info setter/getter?
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

window.onload = function()
{
    modal = document.querySelector('#modal');
    controller = new Controller();

    window.addEventListener('hashchange', function() { controller.showPage(location.hash.slice(1)); });
    window.addEventListener('mousedown', function(event) { if (event.target == modal) showModal(false); });

    document.querySelector('body').setAttribute('theme', theme);
    document.querySelector('.homed').setAttribute('theme', theme);
    document.querySelector('#toggleTheme').innerHTML = (theme != 'light' ? '<i class="icon-on"></i>' : '<i class="icon-off"></i>') + ' DARK THEME';
    document.querySelector('#toggleTheme').addEventListener('click', function() { theme = theme != 'light' ? 'light' : 'dark'; localStorage.setItem('theme', theme); location.reload(); });

    controller.showPage(localStorage.getItem('page') ?? 'zigbee');
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
        search =  document.createElement('input');
        search.type = 'text';
        search.placeholder = 'Type to search'
        list.append(search);
        search.addEventListener('input', function() { list.querySelectorAll('.item').forEach(item => { item.style.display = search.value && !item.innerHTML.toLowerCase().includes(search.value.toLowerCase()) ? 'none' : 'block'; }); });
    }

    options.forEach((option, index) =>
    {
        var item = document.createElement('div');
        item.addEventListener('click', function() { callback(option); });
        item.classList.add('item');
        item.innerHTML = option;

        if (separator && index == separator)
            list.append(document.createElement('hr'));

        list.append(item);
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
    Array.from(form).forEach(input => { data[input.name] = input.type == 'checkbox' ? input.checked : input.value; });
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

function sendData(device, endpoint, data) // TODO: rename
{
    switch (device.service)
    {
        case 'custom':
            var item = controller.custom.names ? device.info.name : device.info.id;
            controller.socket.publish('td/custom/' + (endpoint != 'common' ? item + '/' + endpoint : item), data);
            break;

        case 'zigbee':
            var item = controller.zigbee.names ? device.info.name : device.info.ieeeAddress;
            controller.socket.publish('td/zigbee/' + (endpoint != 'common' ? item + '/' + endpoint : item), data);
            break;
    }
}
