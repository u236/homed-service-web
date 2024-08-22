class Dashboard
{
    content = document.querySelector('.content .container');
    index = localStorage.getItem('dashboard');
    status = new Object();

    constructor(controller)
    {
        this.controller = controller;
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = 'Web ' + this.status.version;
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':

                this.status = message;

                if (this.controller.service == 'dashboard')
                {
                    this.controller.showPage('dashboard');
                    this.updatePage();
                }

                break;
        }
    }

    itemString(item, edit = true)
    {
        let device = this.controller.findDevice(item);
        return (edit ? (item.hasOwnProperty('expose') ? 'Device' : 'Recorder') + ' &rarr; ' : '') + (device.info ? device.info.name : '<span class="error">' + item.endpoint + '</span>') + ' &rarr; ' + exposeTitle(item.expose ?? item.property, item.endpoint.split('/')[2] ?? 'common');
    }

    setIndex(index)
    {
        this.index = index;
        localStorage.setItem('dashboard', this.index);
    }

    storeData()
    {
        this.controller.socket.publish('command/web', {action: 'updateDashboards', data: this.status.dashboards});
        this.controller.clearPage();
    }

    addBlockExpose(table, item)
    {
        let row = table.insertRow();
        let titleCell = row.insertCell();
        let valueCell = row.insertCell();
        let part = item.expose.split('_');

        titleCell.innerHTML = item.name;
        titleCell.classList.add('name');

        valueCell.innerHTML = empty;
        valueCell.classList.add('value');

        switch (part[0])
        {
            case 'light':
            case 'switch':
                let name = part[1] ? 'status_' + part[1] : 'status';
                valueCell.dataset.property = name;
                valueCell.addEventListener('click', function() { let device = this.controller.findDevice(item); if (device) deviceCommand(device, item.endpoint.split('/')[2] ?? 'common', {[name]: 'toggle'}); }.bind(this));
                break;

            case 'cover':
                valueCell.dataset.property = 'position';
                valueCell.dataset.unit = '%';
                break;

            case 'thermostat':
                valueCell.dataset.property = 'temperature';
                valueCell.dataset.unit = '°C';
                break;

            default:
                valueCell.dataset.property = item.expose;
                break;
        }

        return row;
    }

    showPage()
    {
        let menu = document.querySelector('.menu');

        menu.innerHTML  = '<span id="sort" style="display: none;"><i class="icon-list"></i> Sort</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

        menu.querySelector('#sort').addEventListener('click', function() { this.showDashboardSort(); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showDashboardEdit(null); }.bind(this));

        if (!this.status.version)
            return;

        this.showDashboard();
        this.updatePage();
    }

    showDashboard()
    {
        if (!this.status.dashboards?.length)
        {
            this.content.innerHTML = '<div class="emptyList">dashboards list is empty</div>';
            return;
        }

        if (!this.status.dashboards[this.index])
            this.index = 0;

        document.querySelector('#sort').style.display = this.status.dashboards.length > 1 ? 'inline-block' : 'none';

        fetch('html/dashboard/dashboard.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let list;
            let dashboard;

            this.content.innerHTML = html;
            list = this.content.querySelector('.dashboardList');
            dashboard = this.status.dashboards[this.index];

            this.content.querySelector('.edit').addEventListener('click', function() { this.showDashboardEdit(dashboard); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDashboardRemove(dashboard); }.bind(this));

            this.status.dashboards.forEach((dashboard, index) =>
            {
                let element = document.createElement('span');

                if (list.innerHTML)
                    list.append('|');

                if (this.index == index)
                    element.classList.add('highlight');

                element.innerHTML = dashboard.name;
                element.addEventListener('click', function() { this.setIndex(index); this.showDashboard(); }.bind(this));

                list.appendChild(element);
            });

            if (!dashboard.blocks.length)
            {
                let element = this.content.querySelector('.dashboardData');
                element.innerHTML = '<div class="emptyList">dashboard "' + dashboard.name + '" data is empty</div>';
                element.style.display = 'block';
                return;
            }

            dashboard.blocks.forEach((block, index) =>
            {
                let element = document.createElement('div');
                let table = document.createElement('table');

                element.innerHTML = '<div class="title"><span class="name">' + block.name + '</span><span class="edit"><i class="icon-edit"></i></span></div>';
                element.append(table);
                element.classList.add('dashboardBlock');
                element.querySelector('.edit').addEventListener('click', function() { this.showBlockEdit(dashboard, block); }.bind(this));

                block.items.forEach(item =>
                {
                    if (item.hasOwnProperty('expose'))
                    {
                        let row = this.addBlockExpose(table, item);
                        let list = item.endpoint.split('/');
                        let endpoint = list[2] ?? 'common';
                        let device;

                        row.classList.add('inactive');

                        function wait(resolve)
                        {
                            device = this.controller.findDevice(item);

                            if (!device.endpoints?.[endpoint]?.exposes)
                            {
                                setTimeout(wait.bind(this, resolve), 10);
                                return;
                            }

                            resolve();
                        }

                        new Promise(wait.bind(this)).then(function()
                        {
                            let option = device.options(endpoint)[item.expose] ?? new Object();
                            let properties = device.properties(endpoint);

                            row.dataset.device = device.service + '/' + device.id;
                            row.dataset.endpoint = endpoint;

                            if (device.items(endpoint).includes(item.expose))
                                row.querySelector('td.name').addEventListener('click', function() { this.showExposeInfo(item, device, endpoint); }.bind(this));

                            if (option.unit)
                                row.querySelector("td.value").dataset.unit = option.unit;

                            Object.keys(properties).forEach(name => { updateExpose(device, endpoint, name, properties[name]); });

                        }.bind(this));
                    }
                    else
                    {
                        let row = table.insertRow();
                        let cell = row.insertCell();

                        cell.innerHTML = item.name + '<div class="placeholder"></div>';
                        cell.classList.add('chart');
                        cell.colSpan = 2;

                        function wait(resolve)
                        {
                            if (!this.controller.services.recorder)
                            {
                                setTimeout(wait.bind(this, resolve), 10);
                                return;
                            }

                            resolve();
                        }

                        new Promise(wait.bind(this)).then(function()
                        {
                            row.addEventListener('click', function() { this.showRecorderInfo(item); }.bind(this));
                            cell.querySelector('div').innerHTML = '<canvas id="chart-' + randomString(8) + '"></canvas>';
                            cell.querySelector('div').classList.remove('placeholder');
                            this.controller.services.recorder.chartQuery(item, cell);

                        }.bind(this));
                    }
                });

                this.content.querySelector('.column.' + (index < dashboard.blocks.length / 2 ? 'a' : 'b')).append(element);
            });
        });
    }

    showDashboardSort()
    {
        let showTable = function(table)
        {
            table.innerHTML = null;

            this.status.dashboards.forEach((dashboard, index) =>
            {
                let row = table.insertRow();

                for (let i = 0; i < 3; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = dashboard.name; break;

                        case 1:

                            if (index == this.status.dashboards.length - 1)
                                break;

                            cell.innerHTML = '&darr;';
                            cell.classList.add('move');
                            cell.addEventListener('click', function() { this.status.dashboards[index + 1] = this.status.dashboards.splice(index, 1, this.status.dashboards[index + 1])[0]; showTable(table); }.bind(this));
                            break;

                        case 2:

                            if (!index)
                                break;

                            cell.innerHTML = '&uarr;';
                            cell.classList.add('move');
                            cell.addEventListener('click', function() { this.status.dashboards[index - 1] = this.status.dashboards.splice(index, 1, this.status.dashboards[index - 1])[0]; showTable(table); }.bind(this));
                            break;
                    }
                }
            });

        }.bind(this);

        fetch('html/dashboard/dashboardSort.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.save').addEventListener('click', function() { this.storeData(); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showTable(modal.querySelector('table.dashboards'));

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);
        });
    }

    showDashboardEdit(dashboard)
    {
        let showTable = function(table, dashboard)
        {
            table.style.display = dashboard.blocks.length ? 'table' : 'none';
            table.innerHTML = null;

            dashboard.blocks.forEach((block, index) =>
            {
                let row = table.insertRow();

                for (let i = 0; i < 4; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:
                            cell.innerHTML = block.name;
                            cell.classList.add('edit');
                            cell.addEventListener('click', function() { this.showBlockEdit(dashboard, block, function() { this.showDashboardEdit(dashboard); }.bind(this)); }.bind(this));
                            break;

                        case 1:

                            if (dashboard.blocks.length < 2 || index == dashboard.blocks.length - 1)
                                break;

                            cell.innerHTML = '&darr;';
                            cell.classList.add('move');
                            cell.addEventListener('click', function() { dashboard.blocks[index + 1] = dashboard.blocks.splice(index, 1, dashboard.blocks[index + 1])[0]; showTable(table, dashboard); }.bind(this));
                            break;

                        case 2:

                            if (dashboard.blocks.length < 2 || !index)
                                break;

                            cell.innerHTML = '&uarr;';
                            cell.classList.add('move');
                            cell.addEventListener('click', function() { dashboard.blocks[index - 1] = dashboard.blocks.splice(index, 1, dashboard.blocks[index - 1])[0]; showTable(table, dashboard); }.bind(this));
                            break;

                        case 3:
                            cell.innerHTML = '<i class="icon-trash"></i>';
                            cell.classList.add('remove');
                            cell.addEventListener('click', function() { dashboard.blocks.splice(index, 1); showTable(table, dashboard); });
                            break;
                    }
                }
            });

        }.bind(this);

        if (!dashboard)
            dashboard = {name: 'New dashboard', blocks: new Array(), add: true};

        fetch('html/dashboard/dashboardEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = dashboard.name;
            modal.querySelector('input[name="name"]').value = dashboard.name;
            modal.querySelector('.add').addEventListener('click', function() { this.showBlockEdit(dashboard, null, function() { this.showDashboardEdit(dashboard); }.bind(this)); }.bind(this));

            modal.querySelector('.save').addEventListener('click', function()
            {
                dashboard.name = modal.querySelector('input[name="name"]').value;

                if (dashboard.add)
                {
                    this.setIndex(this.status.dashboards.length);
                    this.status.dashboards.push(dashboard);
                    delete dashboard.add;
                }

                this.storeData();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showTable(modal.querySelector('table.blocks'), dashboard);

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }

    showDashboardRemove(dashboard)
    {
        fetch('html/dashboard/dashboardRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = dashboard.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.status.dashboards.splice(this.index, 1); this.setIndex(0); this.storeData(); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }

    showBlockEdit(dashboard, block, callback)
    {
        let showTable = function(table, dashboard, block)
        {
            table.style.display = block.items.length ? 'table' : 'none';
            table.innerHTML = null;

            block.items.forEach((item, index) =>
            {
                let row = table.insertRow();

                for (let i = 0; i < 4; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:
                            cell.innerHTML = item.name + '<div class="note">' + this.itemString(item) + '</div>';
                            cell.classList.add('edit');
                            cell.addEventListener('click', function() { this.showItemEdit(dashboard, block, item, function() { this.showBlockEdit(dashboard, block, callback); }.bind(this)); }.bind(this));
                            break;

                        case 1:

                            if (block.items.length < 2 || index == block.items.length - 1)
                                break;

                            cell.innerHTML = '&darr;';
                            cell.classList.add('move');
                            cell.addEventListener('click', function() { block.items[index + 1] = block.items.splice(index, 1, block.items[index + 1])[0]; showTable(table, dashboard, block); }.bind(this));
                            break;

                        case 2:

                            if (block.items.length < 2 || !index)
                                break;

                            cell.innerHTML = '&uarr;';
                            cell.classList.add('move');
                            cell.addEventListener('click', function() { block.items[index - 1] = block.items.splice(index, 1, block.items[index - 1])[0]; showTable(table, dashboard, block); }.bind(this));
                            break;

                        case 3:
                            cell.innerHTML = '<i class="icon-trash"></i>';
                            cell.classList.add('remove');
                            cell.addEventListener('click', function() { block.items.splice(index, 1); showTable(table, dashboard, block); });
                            break;
                    }
                }
            });

        }.bind(this);

        if (!block)
            block = {name: 'New block', items: new Array(), add: true};

        fetch('html/dashboard/blockEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = dashboard.name + ' &rarr; ' + block.name;
            modal.querySelector('input[name="name"]').value = block.name;
            modal.querySelector('.add').addEventListener('click', function() { this.showItemEdit(dashboard, block, null, function() { this.showBlockEdit(dashboard, block, callback); }.bind(this)); }.bind(this));

            modal.querySelector('.save').addEventListener('click', function()
            {
                block.name = modal.querySelector('input[name="name"]').value;

                if (block.add)
                {
                    dashboard.blocks.push(block);
                    delete block.add;
                }

                if (callback)
                {
                    callback();
                    return;
                }

                this.storeData();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { callback ? callback() : showModal(false); });
            showTable(modal.querySelector('table.items'), dashboard, block);

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }

    showItemEdit(dashboard, block, item, callback)
    {
        let recorder = this.controller.services.recorder;
        let list = new Object();

        if (!item)
            item = {name: 'New item', add: true};

        Object.keys(this.controller.services).forEach(item =>
        {
            let service = this.controller.services[item];

            if (!service.devices || !Object.keys(service.devices).length)
                return;

            Object.keys(service.devices).forEach(id =>
            {
                let device = service.devices[id];

                Object.keys(device.endpoints).forEach(endpoint =>
                {
                    device.items(endpoint).forEach(expose =>
                    {
                        let value = {endpoint: item.split('/')[0] + '/' + id, expose: expose};

                        if (endpoint != 'common')
                            value.endpoint += '/' + endpoint;

                        list['Device &rarr; ' + device.info.name + ' &rarr; ' + exposeTitle(expose, endpoint)] = value;
                    });
                });
            });
        });

        if (recorder?.status?.items?.length)
        {
            recorder.status.items.forEach(item =>
            {
                let device = this.controller.findDevice(item);

                if (!device.info)
                    return;

                list['Recorder &rarr; ' + device.info.name + ' &rarr; ' + exposeTitle(item.property, item.endpoint.split('/')[2] ?? 'common')] = {endpoint: item.endpoint, property: item.property};
            });
        }

        fetch('html/dashboard/itemEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let data;

            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = dashboard.name + ' &rarr; ' + block.name + ' &rarr; ' + item.name;
            modal.querySelector('input[name="name"]').value = item.name;
            modal.querySelector('.item').innerHTML = item.add ? '<i>Select item there &rarr;</i>' : this.itemString(item);

            addDropdown(modal.querySelector('.dropdown'), Object.keys(list), function(key)
            {
                data = list[key];
                modal.querySelector('.item').innerHTML = this.itemString(data);
                modal.querySelector('.item').classList.remove('error');

            }.bind(this));

            modal.querySelector('.save').addEventListener('click', function()
            {
                item.name = modal.querySelector('input[name="name"]').value;

                if (data)
                {
                    item.endpoint = data.endpoint;

                    if (data.expose)
                    {
                        item.expose = data.expose;
                        delete item.property;
                    }
                    else
                    {
                        item.property = data.property;
                        delete item.expose;
                    }
                }

                if (!item.endpoint || (!item.expose && !item.property))
                {
                    modal.querySelector('.item').classList.add('error');
                    return;
                }

                if (item.add)
                {
                    block.items.push(item);
                    delete item.add;
                }

                if (callback)
                {
                    callback();
                    return;
                }

                this.storeData();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { callback ? callback() : showModal(false); });

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }

    showExposeInfo(item, device, endpoint)
    {
        fetch('html/dashboard/exposeInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let table;

            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = item.name;
            modal.querySelector('.note').innerHTML = this.itemString(item, false);

            table = modal.querySelector('table.exposes');
            addExpose(table, device, endpoint, item.expose);

            if (table.rows.length == 1 && !table.querySelector('td.control').innerHTML)
                table.querySelector('tr').deleteCell(2);

            modal.querySelector('.device').addEventListener('click', function() { this.controller.showPage(device.service + '?device=' + device.id); showModal(false); }.bind(this));
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }

    showRecorderInfo(item)
    {
        fetch('html/dashboard/recorderInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let id = 'chart-' + randomString(8);
            let chart;

            modal.querySelector('.data').innerHTML = html;
            chart = modal.querySelector('.chart');

            modal.querySelector('.name').innerHTML = item.name;
            modal.querySelector('.note').innerHTML = this.itemString(item, false);

            modal.querySelector('.interval').querySelectorAll('span').forEach(element => element.addEventListener('click', function()
            {
                modal.querySelector('.status').innerHTML = '<div class="dataLoader"></div>';

                if (!this.controller.services.recorder)
                    return;

                this.controller.services.recorder.chartQuery(item, chart, element.innerHTML);

            }.bind(this)));

            modal.querySelector('.item').addEventListener('click', function()
            {
                this.controller.services.recorder?.status.items?.forEach((data, index) =>
                {
                    if (data.endpoint != item.endpoint || data.property != item.property)
                        return;

                    this.controller.showPage('recorder?index=' + index);
                    showModal(false);
                });

            }.bind(this));

            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });
            modal.querySelectorAll('#data').forEach(item => { item.id = id; });

            if (this.controller.services.recorder)
                this.controller.services.recorder.chartQuery(item, chart);

            showModal(true);
        });
    }
}
