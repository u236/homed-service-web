var controller, theme = localStorage.getItem('theme') ?? 'dark';

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
        var socket = this;

        socket.ws = new WebSocket('ws://' + location.host);

        socket.ws.onopen = function()
        {
            socket.onopen();
            socket.connected = true;
        };

        socket.ws.onclose = function()
        {
            if (socket.connected)
            {
                this.subscriptions = new Array();
                socket.onclose();
            }

            setTimeout(function() { socket.connect(); }, 1000);
            socket.connected = false;
        };

        socket.ws.onmessage = function(event)
        {
            var data = JSON.parse(event.data);
            socket.onmessage(data.topic, data.message);
        }

        socket.ws.onerror = function()
        {
            socket.ws.close();
        };
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
    services = ['automation', 'zigbee'];
    socket = new Socket(this.onopen.bind(this), this.onclose.bind(this), this.onmessage.bind(this));

    automation = new Automation(this);
    zigbee = new ZigBee(this);

    status = new Object();
    expose = new Object();

    onopen()
    {
        var controller = this;
        var services = document.querySelector('.header .services');

        console.log('socket successfully connected');
        services.innerHTML = '';

        controller.services.forEach(service =>
        {
            var item = document.createElement('span');

            item.innerHTML = service;
            item.addEventListener('click', function() { controller.showPage(service); localStorage.setItem('page', service); });

            controller.socket.subscribe('service/' + service);
            services.appendChild(item);
        });
    }

    onclose()
    {
        this.clearPage(this.page, 'socket closed, reconnecting');
    }

    onmessage(topic, message)
    {
        var list = topic.split('/');
        var service = list[1];

        switch(list[0])
        {
            case 'service':
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

                break;
            }

            case 'status':
            {
                switch (service)
                {
                    case 'automation':
                    {
                        var check = this.status.automation ? this.status.automation.automations.map(automation => automation.name) : null;

                        this.status.automation = message;

                        if (this.service == 'automation')
                        {
                            if (JSON.stringify(check) != JSON.stringify(this.status.automation.automations.map(automation => automation.name)))
                                this.automation.showAutomationList();

                            document.querySelector('#serviceVersion').innerHTML = this.status.automation.version;
                        }

                        break;
                    }

                    case 'zigbee':
                    {
                        var check = this.status.zigbee ? this.status.zigbee.devices.map(device => new Object({[device.ieeeAddress]: device.removed ?? false})) : null;

                        this.status.zigbee = message;

                        if (this.service == 'zigbee')
                        {
                            if (JSON.stringify(check) != JSON.stringify(this.status.zigbee.devices.map(device => new Object({[device.ieeeAddress]: device.removed ?? false}))))
                                this.zigbee.showDeviceList();

                            document.querySelector('#permitJoin i').className = 'icon-enable ' + (this.status.zigbee.permitJoin ? 'warning' : 'shade');
                            document.querySelector('#serviceVersion').innerHTML = this.status.zigbee.version;
                        }

                        this.status.zigbee.devices.forEach(device =>
                        {
                            var item = this.status.zigbee.names && device.name ? device.name : device.ieeeAddress;

                            this.socket.subscribe('expose/zigbee/' + item);
                            this.socket.subscribe('fd/zigbee/' + item);
                        });

                        break;
                    }
                }

                break;
            }

            case 'event':
            {
                switch (service)
                {
                    case 'automation':
                    {
                        var html = 'Automation <b>' + message.automation + '</b> ';

                        if (message.event == 'updated')
                            this.clearPage('automation');

                        switch (message.event)
                        {
                            case 'nameDuplicate':       this.showToast(html + 'name is already in use', 'error'); break;
                            case 'incompleteData':      this.showToast(html + 'data is incomplete', 'error'); break;
                            case 'added':               this.showToast(html + 'successfully added'); break;
                            case 'updated':             this.showToast(html + 'successfully updated'); break;
                            case 'removed':             this.showToast(html + 'removed', 'warning'); break;
                        }
                    }

                    case 'zigbee':
                    {
                        var html = 'Device <b>' + message.device + '</b> ';

                        if (message.event == 'deviceUpdated')
                            this.clearPage('zigbee');

                        switch (message.event)
                        {
                            case 'deviceJoined':        this.showToast(html + 'joined network'); break;
                            case 'deviceLeft':          this.showToast(html + 'left network', 'warning');  break;
                            case 'deviceNameDuplicate': this.showToast(html + 'name is already in use', 'error'); break;
                            case 'deviceUpdated':       this.showToast(html + 'successfully updated'); break;
                            case 'interviewError':      this.showToast(html + 'interview error', 'error'); break;
                            case 'interviewTimeout':    this.showToast(html + 'interview timed out', 'error'); break;
                            case 'interviewFinished':   this.showToast(html + 'interview finished'); break;
                        }
                    }
                }

                break;
            }

            case 'expose':
            {
                var device = list[2];

                if (!this.expose[service])
                    this.expose[service] = new Object;

                this.expose[service][device] = message;
                break;
            }

            case 'device':
            {
                var row = document.querySelector('tr[data-device="' + list[2] + '"]');

                if (row && this.page == 'zigbee')
                {
                    if (message.status == 'online')
                    {
                        row.classList.remove('unavailable');
                        row.querySelector('.availability').innerHTML = '<i class="icon-true success"></i>';
                    }
                    else
                    {
                        row.classList.add('unavailable');
                        row.querySelector('.availability').innerHTML = '<i class="icon-false error"></i>';
                    }
                }

                break;
            }

            case 'fd':
            {
                var device = list[2];
                var endpoint = list[3];

                switch(service)
                {
                    case 'zigbee':
                    {
                        var row = document.querySelector('tr[data-device="' + device + '"]');

                        if (row && this.page == 'zigbee')
                        {
                            row.querySelector('.linkQuality').innerHTML = message.linkQuality;
                            break;
                        }

                        // TODO: refactor this shit
                        if (this.zigbee.device && (this.zigbee.device.ieeeAddress == device || this.zigbee.device.name == device))
                            Object.keys(message).forEach(item => { updateExpose(endpoint, item, message[item]); });
                        //

                        break;
                    }
                }

                break;
            }

            // TODO: remocve it
            default:
                console.log(topic, message);
                break;
        }
    }

    setService(service)
    {
        var controller = this;
        var menu = document.querySelector('.menu');

        if (this.service == service)
            return;

        this.service = service;
        menu.innerHTML = '';

        switch(service)
        {
            case 'automation':

                menu.innerHTML += '<span id="list"><i class="icon-list"></i> List</span>';
                menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

                menu.querySelector('#list').addEventListener('click', function() { controller.automation.showAutomationList(); });
                menu.querySelector('#add').addEventListener('click', function() { controller.automation.showAutomationInfo(true); });

                if (this.status.automation)
                    document.querySelector('#serviceVersion').innerHTML = controller.status.automation.version;

                break;

            case 'zigbee':

                menu.innerHTML += '<span id="list"><i class="icon-list"></i> Devices</span>';
                menu.innerHTML += '<span id="map"><i class="icon-map"></i> Map</span>';
                menu.innerHTML += '<span id="permitJoin"><i class="icon-false"></i> Permit Join</span>';

                menu.querySelector('#list').addEventListener('click', function() { controller.zigbee.showDeviceList(); });
                menu.querySelector('#map').addEventListener('click', function() { controller.zigbee.showDeviceMap(); });
                menu.querySelector('#permitJoin').addEventListener('click', function() { controller.socket.publish('command/zigbee', {'action': 'setPermitJoin', 'enabled': controller.status.zigbee && controller.status.zigbee.permitJoin ? false : true}); });

                if (this.status.zigbee)
                {
                    document.querySelector('#permitJoin i').className = 'icon-enable ' + (controller.status.zigbee.permitJoin ? 'warning' : 'shade');
                    document.querySelector('#serviceVersion').innerHTML = controller.status.zigbee.version;
                }

                break;
        }
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
            case 'automation':
                this.automation.showAutomationList();
                break;

            case 'automationInfo':
                this.automation.showAutomationInfo();
                break;

            case 'zigbee':
                this.zigbee.showDeviceList();
                break;

            case 'zigbeeMap':
                this.zigbee.showDeviceMap();
                break;

            case 'zigbeeDevice':
                this.zigbee.showDeviceInfo();
                break;

            // TODO: remove it
            default:
                this.setService(page)
                this.setPage(page)
                this.clearPage(page, page + ' page not found');
                break;
        }
    }

    clearPage(name, warning = null)
    {
        var content = document.querySelector('.content .container');

        document.querySelector('#modal').style.display = 'none';
        content.innerHTML = '<div class="loader"></div><div class="center warning"></div>';

        if (warning)
        {
            content.querySelector('.warning').innerHTML = warning;
            console.log(warning);
        }

        this.status[name] = null;
        this.setPage(name);
    }

    showToast(message, style = 'success')
    {
        var controller = this;
        var item = document.createElement('div');

        item.addEventListener('click', function() { controller.clearToast(this); });
        item.innerHTML = '<div class="message">' + message + '</div>';
        item.classList.add('item', 'fade-in', style);

        setTimeout(function() { controller.clearToast(item); }, 5000);
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

window.onload = function()
{
    controller = new Controller();

    window.addEventListener('hashchange', function() { controller.showPage(location.hash.slice(1)); });
    window.addEventListener('mousedown', function(event) { if (event.target == document.querySelector('#modal')) document.querySelector('#modal').style.display = 'none'; });

    document.querySelector('body').setAttribute('theme', theme);
    document.querySelector('.homed').setAttribute('theme', theme);
    document.querySelector('#toggleTheme').innerHTML = (theme != 'light' ? '<i class="icon-on"></i>' : '<i class="icon-off"></i>') + ' DARK THEME';
    document.querySelector('#toggleTheme').addEventListener('click', function() { theme = theme != 'light' ? 'light' : 'dark'; localStorage.setItem('theme', theme); location.reload(); });

    controller.showPage(localStorage.getItem('page') ?? 'zigbee');
};

document.onkeydown = function(event)
{
    if (event.key == 'Esc' || event.key == 'Escape')
    {
        document.querySelector('#modal').style.display = 'none';
        document.querySelector('#modal').querySelector('.data').innerHTML = null;
    }
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

function addDropdown(dropdown, options, callback)
{
    var list = document.createElement('div');

    dropdown.addEventListener('pointerenter', function() { list.style.display = 'block'; });
    dropdown.addEventListener('mouseleave', function() { list.style.display = 'none'; });

    list.classList.add('list');
    dropdown.append(list);

    options.forEach(option =>
    {
        var item = document.createElement('div');
        item.addEventListener('click', function() { list.style.display = 'none'; callback(option); });
        item.classList.add('item');
        item.innerHTML = option;
        list.append(item);
    });
}

function handleSave(event)
{
    if (event.key == 'Enter')
    {
        event.preventDefault();
        document.querySelector('.save').click();
    }
}

function formData(form)
{
    var data = new Object;
    Array.from(form).forEach(input => { data[input.name] = input.type == 'checkbox' ? input.checked : input.value; });
    return data;
}

function timeInterval(interval)
{
    switch (true)
    {
        case interval >= 86400: return Math.round(interval / 86400) + ' day';
        case interval >= 3600:  return Math.round(interval / 3600)  + ' hrs';
        case interval >= 60:    return Math.round(interval / 60)    + ' min';
        case interval >= 1:     return Math.round(interval)         + ' sec';
        default:                return                                 'now';
    }
}

// TODO: refactor this shit
function sendData(endpoint, data)
{
    controller.socket.publish('td/zigbee/' + controller.zigbee.device.ieeeAddress + (isNaN(endpoint) ? '' : '/' + endpoint), data);
}
//
