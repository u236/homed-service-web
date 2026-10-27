let modal, controller, drag, dropdown, guest = true, icons = localStorage.getItem('homedIcons') ?? 'on', theme = localStorage.getItem('homedTheme') ?? 'dark', wide = localStorage.getItem('homedWide') ?? 'off', empty = '<span class="shade">&bull;</span>', cache = new Object(), plugins = new Array();

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
        this.ws.onerror = function(event) { event.target.close(); };

        this.ws.onclose = function(event)
        {
            if (event.target != this.ws)
                return;

            if (this.connected)
            {
                this.subscriptions = new Array();
                this.onclose();
            }

            setTimeout(function() { this.connect(); }.bind(this), 1000);
            this.connected = false;

        }.bind(this);

        fetch('manifest.json?' + Date.now()); // workaround for safari 26 bug: new WebSocket() to an IP host stalls until another HTTP request kicks the network thread
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

    constructor()
    {
        setInterval(function() { this.updateHealth(); }.bind(this), 1000);
    }

    onopen()
    {
        console.log('socket successfully connected');
        this.socket.subscribe('service/#');
        this.socket.subscribe('status/web');
    }

    onclose()
    {
        document.querySelector('.services').innerHTML = '<span><i class="mdi-close-circle"></i> DISCONNECTED</span>';
        document.querySelector('.menu').innerHTML = null;
        this.clearPage('socket closed, reconnecting...');
        this.socket.subscriptions = new Array();
        Object.keys(this.services).forEach(service => { if (service != 'dashboard') this.removeService(service); });
    }

    onmessage(topic, message)
    {
        let list = topic.split('/');

        if (topic == 'error')
        {
            this.clearPage(message);
            return;
        }

        if (topic == 'setup')
        {
            guest = message.guest;

            if (guest)
            {
                document.querySelector('.header img').classList.remove('mobileHidden');
                document.querySelector('#footerData').style.display = 'none';
            }

            this.showPage(location.hash ? decodeURI(location.hash).slice(1) : localStorage.getItem('homedPage') ?? 'dashboard');
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
                    case 'custom':     this.services[service] = new Custom(this, list[2]); break;
                    case 'matter':     this.services[service] = new Matter(this, list[2]); break;
                    case 'modbus':     this.services[service] = new Modbus(this, list[2]); break;
                    case 'zigbee':     this.services[service] = new ZigBee(this, list[2]); break;
                    case 'camera':     this.services[service] = new Camera(this); break;
                    case 'recorder':   this.services[service] = new Recorder(this); break;

                    default:
                    {
                        let plugin = plugins.find(item => item.serviceName == list[1]);

                        if (!plugin)
                            return;

                        this.services[service] = new plugin(this, list[2]);
                        this.services[service].service = service;
                        break;
                    }
                }

                if (service == 'camera' || service == 'recorder')
                    this.socket.subscribe(service);

                this.socket.subscribe('status/' + service);
                this.socket.subscribe('event/' + service);
            }
            else
            {
                if (this.service == service)
                    this.clearPage(service + ' service is unavailable');

                if (service == 'camera' || service == 'recorder')
                    this.socket.unsubscribe(service);

                this.removeService(service);
            }

            this.updateMenu(true);
            return;
        }

        switch (topic)
        {
            case 'camera':
            case 'recorder':
                this.services[topic]?.parseData(message);
                break;

            default:
            {
                let service = list[1] != 'web' ? this.services[list[1] + '/' + list[2]] ?? this.services[list[1]] : this.services.dashboard;
                service?.parseMessage(list, message);
                break;
            }
        }
    }

    removeService(item)
    {
        this.services[item]?.intervals?.forEach(interval => { clearInterval(interval); });
        delete this.services[item];
    }

    updateHealth()
    {
        let element = document.querySelector('.header .search');
        let count = Object.keys(this.healthList()).length;

        if (!element)
            return;

        element.innerHTML = '<i class="mdi-magnify"></i>' + (count ? ' <span class="value">' + count + '</span>' : '');
    }

    updateMenu(redraw)
    {
        let menu = document.querySelector('.header .services');

        if (redraw)
        {
            let names = ['dashboard', 'recorder', 'camera', 'automation', 'zigbee', 'matter', 'modbus', 'custom'];
            let short = ['dash', 'rec', 'cam', 'auto', 'zbee', 'mttr', 'mbus', 'cust'];
            let services = Object.keys(this.services).filter(service => !guest || ['dashboard', 'recorder'].includes(service));

            plugins.forEach(item => { if (names.includes(item.serviceName)) return; names.push(item.serviceName); short.push(item.shortName); });

            this.serviceList = new Array();
            menu.innerHTML = null;
            services.sort();

            names.forEach((name, index) =>
            {
                let list = services.filter(service => { return service.startsWith(name); });
                this.serviceList.push(...list);

                list.forEach(service =>
                {
                    let item = document.createElement('span');
                    let itemName = service;

                    if (menu.innerHTML)
                    {
                        let separator = document.createElement('i');
                        separator.classList.add('separator');
                        menu.append(separator);
                    }

                    if (services.length > 7)
                        itemName = itemName.replace(name, short[index]);

                    item.innerHTML = itemName;
                    item.dataset.service = service;
                    item.addEventListener('click', function() { this.showPage(service); }.bind(this));

                    menu.appendChild(item);
                });
            });

            if (!guest)
            {
                let search = document.createElement('span');
                let separator = document.createElement('i');

                search.innerHTML = '<i class="mdi-magnify"></i>';
                search.classList.add('search');
                search.addEventListener('click', function(event) { event.stopPropagation(); this.showSearch(); }.bind(this));

                separator.classList.add('separator');

                if (menu.offsetWidth > document.querySelector('.header .container').offsetWidth - 370)
                {
                    let item = document.createElement('span');
                    let element = document.createElement('div');

                    item.classList.add('trigger');
                    element.classList.add('dropdown');

                    addDropdown(element, this.serviceList, function(service) { this.showPage(service); }.bind(this), 0, item);

                    menu.innerHTML = null;
                    menu.append(item, element);
                }

                menu.append(separator, search);
                this.updateHealth();
            }
        }

        menu.querySelectorAll('span').forEach(item =>
        {
            if (item.classList.contains('trigger'))
            {
                item.innerHTML = '<i class="mdi-menu"></i> ' + this.service;
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

    switchService(forward)
    {
        let index = this.serviceList.indexOf(this.service) - 1;

        if (forward)
            index += 2;

        if (index < 0 || index >= this.serviceList.length)
            return;

        this.showPage(this.serviceList[index]);
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

    sceneList()
    {
        let scenes = new Object();
        let list = new Object();
        Object.keys(this.services).forEach(service => { if (service.startsWith('automation')) this.services[service].status.automations?.forEach(automation => { automation.triggers.filter(trigger => trigger.type == 'scene').forEach(trigger => { scenes[trigger.scene.toLowerCase()] = trigger.scene; }); }); });
        Object.keys(scenes).sort(compareStrings).forEach(item => list[item] = scenes[item]);
        return list;
    }

    deviceList()
    {
        let devices = new Object();
        let list = new Object();

        Object.keys(this.services).forEach(item =>
        {
            let service = this.services[item];

            if (!service.devices || !Object.keys(service.devices).length)
                return;

            Object.keys(service.devices).forEach(id =>
            {
                let device = service.devices[id];

                if (item.startsWith('zigbee') && !device.info.logicalType)
                    return;

                devices[device.info.name] = device;
            });
        });

        Object.keys(devices).sort(compareStrings).forEach(item => list[item] = devices[item]);
        return list;
    }

    propertyList(triggerProperty, pattern, any)
    {
        let devices = this.deviceList();
        let list = new Object();

        if (triggerProperty)
            list['<i>Trigger Property</i>'] = {endpoint: 'triggerEndpoint', property: 'triggerProperty'};

        Object.keys(devices).forEach(name =>
        {
            let device = devices[name];
            let endpoint = device.service.split('/')[0] + '/' + device.id;
            let groups = new Array();
            let items = new Array();

            Object.keys(device.endpoints).forEach(endpointId => { device.items(endpointId).forEach(expose => { exposeList(expose, device.options(endpointId)).forEach(property =>
            {
                let value = {endpoint: endpoint, property: property};
                let meta = exposeMeta(property);

                if (property.match('^[a-z]+P[0-9]+(Temperature|Time)$'))
                    return;

                if (endpointId != 'common')
                    value.endpoint += '/' + endpointId;

                if (!groups.includes(meta.name))
                    groups.push(meta.name);

                items.push([groups.indexOf(meta.name), 0, parseInt(meta.id ?? endpointId) || 0, exposeIcon(device, value.endpoint, property) + name + ' <i class="mdi-arrow-right"></i> ' + exposeTitle(device, value.endpoint, property), pattern ? '{{ property | ' + value.endpoint + ' | ' + property + ' }}' : value]);

            }); }); });

            if (any)
            {
                groups.forEach((group, index) =>
                {
                    let list = items.filter(item => item[0] == index);

                    if (list.length < 2)
                        return;

                    items.push([index, 1, 0, exposeIcon(device, list[0][4].endpoint, list[0][4].property) + name + ' <i class="mdi-arrow-right"></i> ' + exposeTitle(device, endpoint, group) + ' (any)', {endpoint: endpoint + '/any', property: group}]);
                });
            }

            items.sort(function(a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }).forEach(item => list[item[3]] = item[4]);
        });

        return list;
    }

    cameraList()
    {
        let list = new Object();
        this.services.camera?.status.devices?.forEach(device => { list['<span class="mdi-video exposeIcon"></span>Camera <i class="mdi-arrow-right"></i> ' + device.name] = '{{ camera | ' + device.id + ' }}'; });
        return list;
    }

    healthList()
    {
        let devices = this.deviceList();
        let list = new Object();

        Object.keys(devices).forEach(name =>
        {
            let device = devices[name];
            let status = batteryStatus(device.properties('common').battery ?? device.properties('common').batteryLow);

            if (!device.info.active || (device.availability != 'offline' && !status))
                return;

            list[this.searchTitle('Device', name, device.availability == 'offline' ? 'cube error' : 'battery-charging ' + status)] = device.service + '?device=' + device.id;
        });

        Object.keys(this.services).forEach(service => { if (service.startsWith('automation')) this.services[service].status.automations?.forEach(automation => { if (this.services[service].brokenItem(automation)) list[this.searchTitle('Automation', automation.name, 'script error')] = service + '?uuid=' + automation.uuid; }); });
        return list;
    }

    patternList(exclude = new Array())
    {
        let list = new Object();
        let groups =
        {
            name:     {'Trigger name': '{{ triggerName }}'},
            trigger:  {'Trigger endpoint': '{{ triggerEndpoint }}', 'Trigger property': '{{ triggerProperty }}', 'Trigger topic': '{{ triggerTopic }}', 'Trigger message': '{{ triggerMessage }}'},
            data:     {'MQTT data': '{{ mqtt | mqtt/topic/name | jsonField }}', 'State value': '{{ state | stateName }}', 'File contents': '{{ file | /path/to/file }}'},
            meta:     {'Shell output': '{{ shellOutput }}', 'Loop index': '{{ loopIndex }}'},
            time:     {'Timestamp': '{{ timestamp | dd.MM.yy hh:mm }}', 'Sunrise': '{{ sunrise | hh:mm }}', 'Sunset': '{{ sunset | hh:mm }}'},
            light:    {'Color temperature': '{{ colorTemperature | 153 | 500 }}', 'Level': '{{ level | 100 | 255 }}'},
            property: this.propertyList(false, true),
            camera:   this.cameraList()
        };

        Object.keys(groups).filter(group => !exclude.includes(group)).forEach(group => { list = {...list, ...groups[group]}; });
        return list;
    }

    callScene(scene)
    {
        let name = this.sceneList()[scene.toLowerCase()];

        if (!name)
        {
            this.showToast('Scene <b>' + scene + '</b> not found', 'warning', 1000);
            return;
        }

        Object.keys(this.services).forEach(service => { if (service.startsWith('automation')) this.socket.publish('command/' + service, {action: 'callScene', scene: name}); });
        this.showToast('Scene <b>' + name + '</b> called', 'success', 1000);
    }

    propertyIcon(item)
    {
        return this.services.dashboard.status.icons[item];
    }

    setPropertyIcon(item, icon)
    {
        let icons = this.services.dashboard.status.icons;

        if (icons[item] == icon)
            return;

        if (icon)
            icons[item] = icon;
        else
            delete icons[item];

        this.services.dashboard.storeIcons();
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

    setPage(page)
    {
        history.replaceState(null, null, '#' + encodeURI(page));
        this.page = page;
    }

    showPage(page)
    {
        let list = page.split(/\?(.*)/);
        let service = list[0];

        if (!service)
            service = 'dashboard';

        if (guest && !['dashboard', 'recorder'].includes(service))
        {
            this.setPage('dashboard');
            this.showPage('dashboard');
            return;
        }

        if (this.services[this.service]?.updated)
        {
            this.services[this.service].showAlert(page);
            return;
        }

        document.querySelector('.menu').innerHTML = null;
        document.querySelector('#serviceVersion').innerHTML = '<i>unknown</i>';

        localStorage.setItem('homedPage', service);

        if (location.hash.slice(1) != encodeURI(page))
            history.pushState(null, null, '#' + encodeURI(page));

        if (this.service != service)
            this.services.camera?.stop();

        this.service = service;
        this.page = page;

        this.updateMenu(false);
        this.clearPage(!this.services[service] ? service + ' service is unavailable' : null);

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
            let element = content.querySelector('.warning');
            console.log(warning);
            setTimeout(function() { element.innerHTML = warning; }, 1000);
        }

        showModal(false);
    }

    showToast(message, style = 'success', timeout = 3000)
    {
        let element = document.createElement('div');

        element.innerHTML = '<div class="message">' + message + '</div>';
        element.classList.add('item', 'fade-in', style);
        element.addEventListener('click', function() { this.clearToast(element); }.bind(this));

        setTimeout(function() { this.clearToast(element); }.bind(this), timeout);
        document.querySelector('#toast').appendChild(element);
    }

    clearToast(item)
    {
        let toast = document.querySelector('#toast');

        if (!toast.contains(item) || item.classList.contains('collapse'))
            return;

        item.addEventListener('animationend', function() { toast.removeChild(item); });
        item.style.height = item.offsetHeight + 'px';
        item.classList.remove('fade-in');
        item.classList.add('collapse');
    }

    searchNames(device)
    {
        let endpoint = device.service.split('/')[0] + '/' + device.id + '/';
        let names = this.services.dashboard.status.names ?? new Object();
        let list = new Array();
        Object.keys(names).forEach(item => { if (item.startsWith(endpoint) && !list.includes(names[item])) list.push(names[item]); });
        return list;
    }

    searchTitle(type, name, icon)
    {
        let icons =
        {
            automation: 'script',
            camera:     'video',
            dashboard:  'view-dashboard',
            device:     'cube',
            recorder:   'chart-line-variant',
            scene:      'play',
            service:    'server'
        }

        return '<i class="mdi-' + (icon ?? icons[type.toLowerCase()] ?? 'help') + '"></i> ' + type + ' <i class="mdi-arrow-right"></i> ' + name;
    }

    showSearch()
    {
        let list = this.healthList();
        let issues = Object.keys(list).length;
        let scenes = this.sceneList();
        let dashboard = this.services.dashboard;
        let devices = this.deviceList();
        let names = new Object();

        Object.keys(scenes).forEach(item => { let scene = scenes[item]; list[this.searchTitle('Scene', scene)] = {scene: scene}; });
        dashboard.status.dashboards?.forEach((item, index) => { list[this.searchTitle('Dashboard', dashboard.dashboardName(item, false))] = 'dashboard?index=' + index; });

        Object.keys(devices).forEach(name => { let device = devices[name]; let key = this.searchTitle('Device', name); names[key] = this.searchNames(device); list[key] = device.service + '?device=' + device.id; });
        this.services.recorder?.status.items?.forEach(item => { list[this.searchTitle('Recorder', dashboard.itemString(item, false))] = 'recorder?item=' + item.endpoint + '/' + item.property; });
        this.services.camera?.status.devices?.forEach(device => { list[this.searchTitle('Camera', device.name)] = 'camera?device=' + device.id; });

        Object.keys(this.services).forEach(service => { if (service.startsWith('automation')) this.services[service].status.automations?.forEach(automation => { list[this.searchTitle('Automation', automation.name)] = service + '?uuid=' + automation.uuid; }); });
        this.serviceList?.forEach(service => { let name = service.replace('zigbee', 'ZigBee'); list[this.searchTitle('Service', name.charAt(0).toUpperCase() + name.slice(1))] = service; });

        loadHTML('search.html', this, modal.querySelector('.data'), function()
        {
            let element = modal.querySelector('.search');
            let input = modal.querySelector('input');

            Object.keys(list).forEach((key, index) =>
            {
                let item = document.createElement('div');

                item.innerHTML = key;
                item.classList.add('item');
                item.addEventListener('click', function() { dropdown = undefined; showModal(false); list[key].scene ? this.callScene(list[key].scene) : this.showPage(list[key]); }.bind(this));

                if (index < issues)
                    item.classList.add('issue');

                if (names[key]?.length)
                {
                    item.key = key;
                    item.names = names[key];
                }

                if (issues && index == issues)
                    element.append(document.createElement('hr'));

                element.append(item);
            });

            input.addEventListener('input', function()
            {
                dropdown.setIndex(-1);

                element.querySelectorAll('.item, hr').forEach(item =>
                {
                    let names = new Array();

                    if (item.names)
                    {
                        names = input.value && item.names.filter(name => searchMatch(name, input.value));
                        item.innerHTML = item.key + (names.length ? ' <i class="mdi-arrow-right shade"></i> <span class="shade">' + names.join(', ') + '</span>' : '');
                    }

                    item.style.display = input.value && (item.classList.contains('issue') || (!names.length && !searchMatch(item.textContent, input.value))) ? 'none' : 'block';
                });
            });

            dropdown = new Dropdown(element, modal.querySelector('.data'));
            dropdown.close = function() { showModal(false); };

            modal.querySelector('.close').addEventListener('click', function() { dropdown = undefined; showModal(false); });
            showModal(true, 'input');
        });
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
        return this.exposes(endpointId).items?.filter(item => typeof item == 'string') ?? new Array();
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
        if (exposes.items?.includes('thermostat'))
            exposes.options = {...exposes.options, temperature: {...exposes.options?.temperature, type: 'sensor', unit: '°C'}};

        this.endpoint(endpointId).exposes = exposes;
    }

    setProperties(endpointId, data)
    {
        Object.keys(data).forEach(property => { this.endpoint(endpointId).properties[property] = data[property]; });
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
                    cell.dataset.value = device.otaProgress;
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

            cell.innerHTML = this.parseValue(device.info, key, true);
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

            devices.push([id, this.devices[id].info.name]);
        });

        devices.sort(function(a, b) { return compareStrings(a[1], b[1]); }).forEach(item => { list.push(item[0]); });
        handleArrowButtons(this.content, list, list.indexOf(device.id), function(id) { this.controller.showPage(this.service + '?device=' + id); }.bind(this));
    }

    updateAutomations(device)
    {
        let table = this.content.querySelector('table.automations');

        Object.keys(this.controller.services).filter(key => key.startsWith('automation')).forEach(key =>
        {
            let service = this.controller.services[key];

            service.status.automations?.filter(automation => service.deviceList(automation).includes(device)).forEach(automation =>
            {
                let row = table.insertRow();
                row.insertCell().innerHTML = '<span class="mdi-script exposeIcon"></span>' + automation.name;
                row.addEventListener('click', function() { this.controller.showPage(key + '?uuid=' + automation.uuid); }.bind(this));
            });
        });

        if (table.rows.length)
            return;

        this.content.querySelectorAll('.automations').forEach(item => item.remove());
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

                    Object.keys(message).filter(endpointId => message[endpointId]?.items?.length && (endpointId == 'common' || (endpointId % 1 == 0 && endpointId >= 1 && endpointId <= 255))).forEach(endpointId =>
                    {
                        this.controller.socket.subscribe('fd/' + this.service + '/' + (endpointId != 'common' ? item + '/' + endpointId : item));
                        device.setExposes(endpointId, message[endpointId]);
                    });

                    this.serviceCommand({action: 'getProperties', device: item, service: 'web'});

                    if (this.controller.service != this.service || device != this.device)
                        break;

                    this.showDeviceInfo(device);
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

    parseValue(data, key, summary)
    {
        let value = data[key];

        if (this.service.startsWith('zigbee') && key == 'cloud' && data.cloud && data.name == data.ieeeAddress)
        {
            let warning = '<i class="mdi-alert warning"></i>';

            if (summary)
                warning += ' device name not set';

            return warning;
        }

        switch (key)
        {
            case 'active':
            case 'cloud':
            case 'discovery':
            case 'interviewFinished':
            case 'real':
            case 'supported':
                return value != undefined ? '<i class="mdi-' + (value ? 'check-circle' : 'close-circle') + ' ' + (value ? 'success' : 'shade') + '"></i>' : empty;

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
        loadHTML('html/' + this.service.split('/')[0] + '/deviceInfo.html', this, this.content, function()
        {
            let table;

            this.content.querySelector('.name').innerHTML = device.info.name;
            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(device); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(device); }.bind(this));

            this.updateDeviceInfo(device);
            this.updateArrowButtons(device);
            this.updateAutomations(device);

            if (!device.info.active)
            {
                this.content.querySelector('.exposes').remove();
                return;
            }

            table = this.content.querySelector('table.exposes');
            Object.keys(device.endpoints).forEach(endpointId => { device.items(endpointId).forEach(expose => { addExpose(table, device, endpointId, expose); }); });

            if (!this.service.startsWith('custom'))
                return;

            this.content.querySelector('.export').addEventListener('click', function()
            {
                let data = {exposes: device.info.exposes, real: device.info.real};
                let item = document.createElement('a');

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
        loadHTML('html/' + this.service.split('/')[0] + '/deviceRemove.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.serviceCommand({action: 'removeDevice', device: device.id}, true); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }
}

class Drag
{
    events = ['pointermove', 'pointerup', 'pointercancel', 'touchmove'];
    targets = new Array();

    constructor(row, event, callback)
    {
        this.rows = this.subtree(row);
        this.row = row;

        this.origin = {x: event.clientX, y: event.clientY};
        this.callback = callback;

        this.listener = function(event)
        {
            switch (event.type)
            {
                case 'pointermove': this.move(event); break;
                case 'touchmove': if (this.preview) event.preventDefault(); break;
                default: this.finish(event.type == 'pointerup'); break;
            }

        }.bind(this);

        this.events.forEach(type => document.addEventListener(type, this.listener, {passive: false}));

        if (event.pointerType != 'touch')
            return;

        this.timeout = setTimeout(function() { this.timeout = null; this.move({clientX: this.x ?? this.origin.x, clientY: this.y ?? this.origin.y, pointerType: 'touch'}); }.bind(this), 500);
    }

    previous(row)
    {
        let item = row.previousElementSibling;

        while (this.targets.includes(item))
            item = item.previousElementSibling;

        return item;
    }

    parent(row)
    {
        let item = this.previous(row);

        while (item?.drag && (item.drag.header || item.drag.level >= row.drag.level))
            item = this.previous(item);

        return item;
    }

    subtree(row)
    {
        let item = row.nextElementSibling;
        let list = [row];

        while (item && (this.targets.includes(item) || item.drag?.level > row.drag.level))
        {
            if (!this.targets.includes(item))
                list.push(item);

            item = item.nextElementSibling;
        }

        return list;
    }

    levels(row)
    {
        let item = this.parent(row);
        let list = new Array();

        if (row.drag.type != this.row.drag.type)
            return list;

        list.push({row: row, index: row.drag.header || row.drag.empty ? 0 : row.drag.index + 1});

        while (item?.drag.type == this.row.drag.type)
        {
            let last = this.subtree(item).pop();

            if (last != row && (!last.drag.empty || last.drag.list != row.drag.list))
                break;

            list.push({row: item, index: item.drag.index + 1});
            item = this.parent(item);
        }

        return list;
    }

    move(event)
    {
        let scroll = event.clientY < 50 ? -10 : event.clientY > window.innerHeight - 50 ? 10 : 0;

        this.x = event.clientX;
        this.y = event.clientY;

        if (!this.preview)
        {
            if (this.timeout || (event.pointerType != 'touch' && Math.hypot(this.x - this.origin.x, this.y - this.origin.y) < 5))
                return;

            this.start();
        }

        this.preview.style.top = this.y - this.offset + 'px';
        this.update();

        clearInterval(this.interval);

        if (!scroll)
            return;

        this.interval = setInterval(function() { this.scroll.scrollTop += scroll; this.update(); }.bind(this), 20);
    }

    start()
    {
        let table = document.createElement('table');
        let frame = this.row.getBoundingClientRect();
        let previous = this.row.previousElementSibling;

        table.append(this.row.cloneNode(true));
        table.rows[0].style.removeProperty('background-color');

        Array.from(table.rows[0].cells).forEach((item, index) => { item.style.width = this.row.cells[index].getBoundingClientRect().width + 'px'; });

        this.offset = this.origin.y - frame.top;
        this.size = frame.height;
        this.colspan = Array.from(this.row.cells).reduce((result, value) => result + value.colSpan, 0);
        this.scroll = this.row.closest('#modal') ?? document.scrollingElement;
        this.next = this.rows[this.rows.length - 1].nextElementSibling;

        this.preview = document.createElement('div');
        this.preview.className = this.row.closest('table').parentNode.className + ' dragPreview';
        this.preview.style.left = frame.left + 'px';
        this.preview.style.width = frame.width + 'px';
        this.preview.style.height = frame.height - 1 + 'px';
        this.preview.append(table);

        this.table = this.row.parentNode;
        this.hidden = document.createElement('tbody');

        this.table.after(this.hidden);
        this.hidden.classList.add('dragHidden');
        this.hidden.append(...this.rows);

        this.insert(this.table, this.row, previous);
        this.hover = document.elementFromPoint(this.x, this.y)?.closest('tr');

        document.body.append(this.preview);
        document.body.classList.add('drag');
    }

    update()
    {
        let element = document.elementFromPoint(this.x, this.y);
        let frame;

        while (element && !element.drag)
            element = element.parentElement;

        this.preview.classList.toggle('deny', element?.drag.type != this.row.drag.type);

        if (!element || element.drag.type != this.row.drag.type || (this.targets.includes(element) && element == this.hover))
            return;

        this.hover = element;

        if (this.targets.includes(element))
        {
            this.select(element);
            return;
        }

        if (element.drag.table)
        {
            this.insert(element.drag.table.rows[0]?.parentNode ?? element.drag.table, element);
            return;
        }

        frame = element.getBoundingClientRect();
        this.insert(element.parentNode, element, element.drag.header && element.nextElementSibling?.drag.empty ? element.nextElementSibling : element.drag.header || element.drag.empty || (this.y > frame.top + frame.height / 2 && this.subtree(element).length == 1) ? element : this.previous(element));
    }

    insert(table, element, previous)
    {
        if (table != this.targets[0]?.parentNode || previous != this.targets[0]?.previousElementSibling)
        {
            let levels = previous && previous.drag.level >= element.drag.level ? this.levels(previous) : [{row: element, index: element.drag.index}];
            let above = this.targets[0]?.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING;
            let position = element.getBoundingClientRect().top;
            let scroll;

            if (!levels.length)
                return;

            this.targets.forEach(row => row.remove());
            this.placeholder?.style.removeProperty('display');

            this.placeholder = previous?.drag.empty ? previous : null;
            this.placeholder?.style.setProperty('display', 'none');

            this.targets = levels.map(level =>
            {
                let row = document.createElement('tr');
                row.drag = {...level.row.drag, index: level.index};
                row.innerHTML = '<td colspan="' + this.colspan + '"><div></div></td>';
                row.classList.add('dragTarget');
                row.style.backgroundColor = level.row.style.backgroundColor;
                row.querySelector('div').style.height = this.size - 1 + 'px';
                return row;
            });

            if (previous)
                previous.after(...this.targets);
            else
                table.prepend(...this.targets);

            scroll = above ? position - element.getBoundingClientRect().top - this.size : 0;
            this.scroll.scrollTop -= scroll > 0 ? scroll : 0;
        }

        this.select(this.targets.find(row => row.drag.list == element.drag.list) ?? this.targets[0]);
    }

    select(row)
    {
        this.marked?.forEach(item => item?.classList.remove('current', 'dragAbove', 'dragBelow'));

        this.marked = [row, row.previousElementSibling, row.nextElementSibling];
        this.marked[0].classList.add('current');
        this.marked[1]?.classList.add('dragAbove');
        this.marked[2]?.classList.add('dragBelow');

        this.target = {list: row.drag.list, index: row.drag.index};
    }

    finish(apply)
    {
        let source = this.row.drag;

        this.events.forEach(type => document.removeEventListener(type, this.listener));
        drag = undefined;

        clearTimeout(this.timeout);
        clearInterval(this.interval);

        if (!this.preview)
            return;

        this.preview.remove();
        document.body.classList.remove('drag');

        if (apply && (this.target.list != source.list || ![source.index, source.index + 1].includes(this.target.index)))
        {
            this.target.list.splice(this.target.list == source.list && this.target.index > source.index ? this.target.index - 1 : this.target.index, 0, source.list.splice(source.index, 1)[0]);
            this.callback();
            return;
        }

        if (this.next)
            this.next.before(...this.rows);
        else
            this.table.append(...this.rows);

        this.hidden.remove();
        this.marked.forEach(item => item?.classList.remove('current', 'dragAbove', 'dragBelow'));
        this.targets.forEach(row => row.remove());
        this.placeholder?.style.removeProperty('display');
    }
}

class Dropdown
{
    mouse = true;
    index = -1;

    constructor(list, trigger)
    {
        this.items = list.querySelectorAll('.item');
        this.items.forEach((item, index) => item.addEventListener('mouseover', function() { if (this.mouse) this.setIndex(index); }.bind(this)));

        this.list = list;
        this.list.addEventListener('mousemove', function() { this.mouse = true; }.bind(this));
        this.list.addEventListener('mouseout', function() { if (this.mouse) this.setIndex(-1); }.bind(this));

        this.trigger = trigger;
    }

    setIndex(index, scroll)
    {
        this.index = index;
        this.items.forEach((item, index) => item.classList.toggle('current', index == this.index));

        if (index >= 0 && scroll)
        {
            let list = this.list.getBoundingClientRect();
            let item = this.items[this.index].getBoundingClientRect();

            if (list.top <= item.top && list.bottom >= item.bottom)
                return;

            this.items[this.index].scrollIntoView(list.top > item.top);
        }
    }

    handleKey(event)
    {
        let key = event.key.toLowerCase();

        if (['arrowdown', 'arrowup', 'enter'].includes(key))
            event.preventDefault();

        this.mouse = false;

        switch (key)
        {
            case 'arrowdown': for (let i = this.index + 1; i < this.items.length; i++) { if (this.items[i].style.display != 'none') { this.setIndex(i, true); break; } } break;
            case 'arrowup':   for (let i = this.index - 1; i >= 0; i--) { if (this.items[i].style.display != 'none') { this.setIndex(i, true); break; } } break;
            case 'enter':     if (this.index >= 0 && this.index < this.items.length) this.items[this.index].click(); break;

            case 'esc':
            case 'escape':
                this.close();
                return false;
        }

        return true;
    }

    open()
    {
        this.setIndex(-1);
        this.list.style.display = 'block';
    }

    close()
    {
        this.list.style.display = 'none';
    }
}

class Mark
{
    constructor(textarea, callback)
    {
        let element = document.createElement('div');

        this.textarea = textarea;
        this.callback = callback;

        this.layer = document.createElement('div');
        this.layer.classList.add('layer');

        textarea.before(element);
        textarea.addEventListener('scroll', function() { this.layer.scrollTop = textarea.scrollTop; }.bind(this));
        textarea.addEventListener('input', function() { this.update(); }.bind(this));

        element.classList.add('mark');
        element.append(this.layer, textarea);

        this.update();
    }

    update()
    {
        let text = this.textarea.value;
        let list = this.callback(text);
        let data = text.split('').map(char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[char] ?? char);

        list.sort((a, b) => (a.end - a.start) - (b.end - b.start)).forEach(item =>
        {
            data[item.start] = '<mark' + (item.class ? ' class="' + item.class + '"' : '') + '>' + data[item.start];
            data[item.end - 1] += '</mark>';
        });

        this.layer.innerHTML = data.join('') + ' ';
        this.layer.scrollTop = this.textarea.scrollTop;
    }
}

window.onload = function()
{
    let date = new Date();
    let logout = document.querySelector('#logout');

    modal = document.querySelector('#modal');
    controller = new Controller();

    window.addEventListener('hashchange', function() { let page = decodeURI(location.hash).slice(1); if (controller.page != page) controller.showPage(page); });

    document.addEventListener('mousedown', function(event) { if (event.target == modal) { modal.querySelector('button.cancel')?.click(); modal.querySelector('button.close')?.click(); } });
    document.addEventListener('click', function(event) { if (dropdown && !dropdown.trigger.contains(event.target)) { dropdown.close(); dropdown = undefined; } });

    document.querySelector('#hotkeys').addEventListener('click', function()
    {
        loadHTML('hotkeys.html', this, modal.querySelector('.data'), function()
        {
            let meta = navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl';
            modal.querySelectorAll('.meta').forEach(item => { item.innerHTML = meta; });
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    });

    document.querySelector('#toggleIcons').addEventListener('click', function() { icons = icons != 'off' ? 'off' : 'on'; setIcons(); localStorage.setItem('homedIcons', icons); });
    document.querySelector('#toggleTheme').addEventListener('click', function() { theme = theme != 'light' ? 'light' : 'dark'; setTheme(); localStorage.setItem('homedTheme', theme); });
    document.querySelector('#toggleWide').addEventListener('click', function() { wide = wide != 'off' ? 'off' : 'on'; setWide(); localStorage.setItem('homedWide', wide); });

    setIcons();
    setTheme();
    setWide();

    if (date > new Date(date.getFullYear() + '-12-23') || date < new Date(date.getFullYear() + '-01-15'))
        document.querySelector('.header img').src = 'img/xmas.svg';

    if (!logout)
        return;

    logout.addEventListener('click', function()
    {
        loadHTML('logout.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.current').addEventListener('click', function() { window.location.href = 'logout?session=current'; }.bind(this));

            if (!guest)
                modal.querySelector('.all').addEventListener('click', function() { window.location.href = 'logout?session=all'; }.bind(this));
            else
                modal.querySelector('.all').remove();

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

    if (document.fullscreenElement ?? document.webkitFullscreenElement)
        return;

    if (dropdown)
    {
        if (!dropdown.handleKey(event))
            dropdown = undefined;

        return;
    }

    if (drag)
    {
        if (['esc', 'escape'].includes(key))
            drag.finish(false);

        return;
    }

    if (!['input', 'textarea'].includes(event.target.tagName.toLowerCase()))
    {
        if (!guest && (event.ctrlKey || event.metaKey) && ['k', 'arrowleft', 'arrowright'].includes(key))
        {
            event.preventDefault();

            if (modal.style.display != 'block')
                key == 'k' ? controller.showSearch() : controller.switchService(key == 'arrowright');

            return;
        }

        if (event.altKey || event.ctrlKey || event.metaKey)
            return;

        switch (key)
        {
            case 'h': document.querySelector('#hotkeys').click(); return;
            case 'i': document.querySelector('#toggleIcons').click(); return;
            case 't': document.querySelector('#toggleTheme').click(); return;
            case 'w': document.querySelector('#toggleWide').click(); return;
        }
    }

    if (modal.style.display != 'block')
    {
        let search = document.querySelector('#search');

        if (event.altKey || event.ctrlKey || event.metaKey)
            return;

        switch (key)
        {
            case 'enter':
            {
                let element = event.target.nextSibling;

                if (element?.type == 'submit')
                    element.click();

                break;
            }

            case '/':
            case 'esc':
            case 'escape':

                if (search && ((key == '/' && search.style.display == 'none') || (key != '/' && search.style.display != 'none')))
                {
                    event.preventDefault();
                    document.querySelector('th.search').click();
                    break;
                }

                if (!search && key != '/')
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
            modal.querySelector('button.connect')?.click();
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

function registerPlugin(plugin)
{
    if (!plugin.serviceName)
    {
        console.log('plugin registration failed: serviceName is not defined');
        return;
    }

    plugin.html = 'plugin/html/' + plugin.serviceName + '/';
    plugins.push(plugin);
}

function loadHTML(file, context, element, callback)
{
    if (context?.constructor?.html)
        file = file.startsWith('html/') ? 'plugin/' + file : context.constructor.html + file;

    if (!cache[file])
        cache[file] = fetch(file + '?' + Date.now()).then(response => response.ok ? response.text() : Promise.reject(file));

    cache[file].then(html =>
    {
        element.innerHTML = html;
        callback.bind(context)();

    }).catch(function() { delete cache[file]; console.log('failed to load file ' + file); });
}

function setIcons()
{
    document.querySelector('html').setAttribute('icons', icons);
    document.querySelector('#toggleIcons').innerHTML = '<i class="' + (icons != 'off' ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off') + ' toggleIcon"></i> SHOW ICONS';
}

function setTheme()
{
    document.querySelector('html').setAttribute('theme', theme);
    document.querySelector('#toggleTheme').innerHTML = '<i class="' + (theme != 'light' ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off') + ' toggleIcon"></i> DARK THEME';
    controller.services.recorder?.updateCharts();
}

function setWide()
{
    document.querySelector('html').setAttribute('wide', wide);
    document.querySelector('#toggleWide').innerHTML = '<i class="' + (wide != 'off' ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off') + ' toggleIcon"></i> WIDE MODE';
    controller.updateMenu(true);
}

function compareStrings(a, b)
{
    return a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
}

function patternIndex(text)
{
    let data = new Array();
    let list = new Array();

    for (let i = 0; i < text.length - 1; i++)
    {
        if (text.startsWith('{{', i))
        {
            data.push(i++);
            continue;
        }

        if (text.startsWith('}}', i) && data.length)
        {
            list.push({start: data.pop(), end: i + 2});
            i++;
        }
    }

    return list;
}

function searchMatch(value, search)
{
    let en = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.';
    let ru = 'йцукенгшщзхъфывапролджэячсмитьбю';

    value = value.toLowerCase();
    search = search.toLowerCase();

    return value.includes(search) || value.includes(Array.from(search).map(item => en.includes(item) ? ru[en.indexOf(item)] : ru.includes(item) ? en[ru.indexOf(item)] : item).join(''));
}

function sortTable(table, index, first = true, once = false)
{
    let invert = once && index == table.dataset.index;
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
                    sort = invert ? parseInt(current.dataset.value) < parseInt(next?.dataset.value) : parseInt(current.dataset.value) > parseInt(next?.dataset.value);
                    break;

                case current.classList.contains('linkQuality'):
                    sort = invert ? parseInt(current.textContent) < parseInt(next?.textContent) : parseInt(current.textContent) > parseInt(next?.textContent);
                    break;

                case current.classList.contains('powerSource'):
                    sort = invert ? parseInt(current.dataset.value ?? 1000) < parseInt(next?.dataset.value ?? 1000) : parseInt(current.dataset.value ?? 1000) > parseInt(next?.dataset.value ?? 1000);
                    break;

                default:
                    sort = isNaN(current.textContent) || isNaN(next?.textContent) ? current.textContent.toLowerCase() > next?.textContent.toLowerCase() : parseFloat(current.textContent) > parseFloat(next.textContent);
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
    delete table.dataset.index;

    if (!once)
    {
        table.querySelector('th[data-index="' + index + '"]')?.classList.add('warning');
        return;
    }

    if (invert)
        return;

    table.dataset.index = index;
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
        input.value = null;

        showTableTotal(table, single, plural, colspan, total);
    });

    input.addEventListener('input', function()
    {
        let count = 0;

        table.querySelectorAll('tbody tr').forEach(row =>
        {
            let check = false;
            row.querySelectorAll('td').forEach((cell, index) => { if (!check && cells.includes(index) && searchMatch(cell.innerHTML, input.value)) { count++; check = true; } });
            row.style.display = check ? 'table-row' : 'none';
        });

        showTableTotal(table, single, plural, colspan, count, input.value ? false : true);
    });
}

function addDrag(cell, callback)
{
    cell.innerHTML = '<i class="mdi-reorder-horizontal"></i>';
    cell.classList.add('move');
    cell.addEventListener('pointerdown', function(event) { if (event.button) return; event.preventDefault(); drag = new Drag(cell.parentNode, event, callback); });
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

        search.addEventListener('input', function()
        {
            let items = Array.from(list.querySelectorAll('.item'));
            dropdown.setIndex(-1);
            items.forEach(item => { item.style.display = search.value && !searchMatch(item.textContent, search.value) ? 'none' : 'block'; });
            list.querySelectorAll('hr').forEach(item => { item.style.display = items.slice(0, separator).some(item => item.style.display != 'none') && items.slice(separator).some(item => item.style.display != 'none') ? 'block' : 'none'; });
        });

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

        if (dropdown?.trigger == trigger)
        {
            dropdown.close();
            dropdown = undefined;
            return;
        }

        dropdown?.close();
        dropdown = list.dropdown;
        dropdown.open();
        search?.focus();
    });

    list.dropdown = new Dropdown(list, trigger);
}

function closeModal()
{
    modal.removeEventListener('animationend', closeModal);
    modal.querySelector('.data').innerHTML = null;
    modal.style.display = 'none';
}

function showModal(show, focus, type)
{
    if (show)
    {
        let list, separator;

        switch (type)
        {
            case 'trigger':
                list = controller.patternList(['name', 'meta', 'light', 'camera']);
                separator = 10;
                break;

            case 'condition':
                list = controller.patternList(['light', 'camera']);
                separator = 13;
                break;

            case 'action':
                list = controller.patternList();
                separator = 15;
                break;
        }

        modal.style.display = 'block';
        modal.classList.remove('fade-out');
        modal.classList.add('fade-in');

        modal.querySelectorAll('label .extend').forEach(item => item.addEventListener('click', function() { modal.querySelector('textarea[name="' + item.id + '"]').style.height = '300px'; item.style.display = 'none'; }));

        if (list)
        {
            modal.querySelectorAll('label .dropdown').forEach(item =>
            {
                let input = modal.querySelector('textarea[name="' + item.id + '"]');
                let mark = new Mark(input, patternIndex);
                addDropdown(item, Object.keys(list), function(key) { input.value += list[key]; input.classList.remove('error'); input.focus(); input.setSelectionRange(input.value.length - list[key].length, input.value.length); mark.update(); }, separator);
            });
        }

        modal.querySelectorAll('input, textarea').forEach(item => item.addEventListener('input', function() { item.classList.remove('error'); }));
        modal.querySelector(focus)?.focus();

        document.querySelector('body').classList.add('lockScroll');
        return;
    }

    if (modal.style.display != 'block')
        return;

    Object.keys(modal.dataset).forEach(key => { delete modal.dataset[key]; });

    modal.addEventListener('animationend', closeModal);
    modal.classList.remove('fade-in');
    modal.classList.add('fade-out');

    document.querySelector('body').classList.remove('lockScroll');
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
    return Math.random().toString(16).substring(2, length + 2);
}

function paletteColor(index, alpha)
{
    let list = ['54, 162, 235', '255, 99, 132', '75, 192, 192', '255, 159, 64', '153, 102, 255', '255, 205, 86', '201, 203, 207'];
    let color = list[index % list.length];
    return alpha ? 'rgba(' + color + ', ' + alpha + ')' : 'rgb(' + color + ')';
}

function formData(form)
{
    let data = new Object();
    let check = true;

    Array.from(form).forEach(input =>
    {
        switch (input.type)
        {
            case 'checkbox': data[input.name] = input.checked; break;
            case 'number':   data[input.name] = parseFloat(input.value); break;
            default:         data[input.name] = input.value.trim(); break;
        }

        if (input.required && input.offsetParent && (input.type == 'number' ? isNaN(data[input.name]) : !data[input.name]))
        {
            input.classList.add('error');
            check = false;
        }
    });

    return check ? data : null;
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

function batteryStatus(value)
{
    let check = typeof(value) == 'boolean';
    return value == undefined || parseInt(value) > 20 || (check && !value) ? false : parseInt(value) > 10 || check ? 'warning' : 'error';
}

function checkBattery(element, value)
{
    let status = batteryStatus(value);

    element.classList.remove('error', 'warning');

    if (!status)
        return;

    element.classList.add(status);
}
