class Automation
{
    intervals = [setInterval(function() { this.checkDevices(); this.updateLastTriggered(); }.bind(this), 100)];
    content = document.querySelector('.content .container');
    service = 'automation';

    triggerType = ['property', 'mqtt', 'state', 'scene', 'telegram', 'time', 'interval', 'startup'];
    triggerStatement = ['equals', 'differs', 'above', 'below', 'between', 'outside', 'changes', 'updates'];
    triggerPattern = ['name'];

    conditionType = ['property', 'mqtt', 'state', 'date', 'time', 'week', 'pattern', 'AND', 'OR', 'NOT'];
    conditionStatement = ['equals', 'differs', 'above', 'below', 'between', 'outside'];
    conditionPattern = ['equals', 'differs', 'above', 'below', 'pattern'];

    actionType = ['property', 'mqtt', 'state', 'scene', 'telegram', 'shell', 'condition', 'loop', 'delay', 'exit'];
    actionStatement = ['value', 'increase', 'decrease'];
    actionPattern = ['value', 'increase', 'decrease', 'message', 'file', 'keyboard', 'scene', 'command', 'count', 'delay'];
    actionNested = ['condition', 'loop'];

    status = new Object();
    data = new Object();

    constructor(controller, instance)
    {
        this.controller = controller;

        if (!instance)
            return;

        this.service += '/' + instance;
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = 'Automation ' + this.status.version;
    }

    updateLastTriggered()
    {
        if (this.controller.page != this.service || !this.status.automations)
            return;

        this.status.automations.forEach((item, index) =>
        {
            let cell = document.querySelector('tr[data-index="' + index + '"] .lastTriggered');
            let value = timeInterval((Date.now() - item.lastTriggered) / 1000);

            if (!item.lastTriggered || !cell || cell.innerHTML == value)
                return;

            cell.dataset.value = item.lastTriggered;
            cell.innerHTML = value;
        });
    }

    updateStates()
    {
        let table = modal.querySelector('table.states');
        let list = Object.keys(this.status.states ?? new Object());

        if (!table)
            return;

        list.forEach(state =>
        {
            let row = table.querySelector('tr[data-state="' + state + '"]');

            if (row)
            {
                row.querySelector('.value').innerHTML = this.status.states[state];
                return;
            }

            row = table.insertRow();
            row.dataset.state = state;

            for (let i = 0; i < 3; i++)
            {
                let cell = row.insertCell();

                switch (i)
                {
                    case 0: cell.innerHTML = state; break;
                    case 1: cell.innerHTML = '<span class="value">' + this.status.states[state] + '</span>'; break;

                    case 2:
                        cell.innerHTML = '<i class="mdi-trash-can-outline"></i>';
                        cell.classList.add('remove');
                        cell.addEventListener('click', function() { cell.innerHTML = '<div class="dataLoader"></div>'; this.controller.socket.publish('command/' + this.service, {action: 'removeState', state: state}); this.removeState = true; }.bind(this));
                        break;
                }
            }
        });

        table.querySelectorAll('tr').forEach(row => { if (!list.includes(row.dataset.state)) row.remove(); });

        modal.querySelector('.empty').style.display = list.length ? 'none' : 'block';
        table.parentNode.style.display = list.length ? 'block' : 'none';

        sortTable(table, 0);
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':
            {
                let check = this.status.automations?.map(automation => automation.uuid);

                this.status = message;

                this.status.automations?.forEach(item =>
                {
                    if (!item.conditions)
                        item.conditions = new Array();

                    if (item.uuid != this.data.uuid)
                        return;

                    item.actions.forEach((action, index) => this.data.actions[index].uuid = action.uuid);
                });

                if (this.controller.service == this.service)
                {
                    if (JSON.stringify(check) != JSON.stringify(this.status.automations?.map(automation => automation.uuid)))
                        this.controller.showPage(this.controller.page);

                    this.updateStates();
                    this.updatePage();
                }

                break;
            }

            case 'event':
            {
                let html = 'Automation <b>' + message.automation + '</b> ';

                if (this.controller.service != this.service)
                    break;

                switch (message.event)
                {
                    case 'nameDuplicate':  this.controller.showToast(html + 'name is already in use', 'error'); break;
                    case 'incompleteData': this.controller.showToast(html + 'data is incomplete', 'error'); break;

                    case 'added':
                        this.controller.showToast(html + 'successfully added');
                        this.controller.clearPage();
                        this.updated = false;
                        this.status = new Object();
                        break;

                    case 'updated':
                        this.controller.showToast(html + 'successfully updated');
                        this.updated = false;
                        this.showAutomationInfo(false);
                        break;

                    case 'removed':
                        this.controller.showToast(html + 'removed', 'warning');
                        this.updated = false;
                        break;
                }

                break;
            }
        }
    }

    parseValue(value)
    {
        return value ? value == 'true' || value == 'false' ? value == 'true' : parseFloat(value) == value ? parseFloat(value) : value : null;
    }

    levelIndent(cell, level, current = true)
    {
        if (!level)
            return;

        cell.style.paddingLeft = 18 * (level - 1) + 5 + 'px';
        cell.innerHTML += '<span class="small ' + (current ? 'warning' : 'shade') + '"><i class="mdi-subdirectory-arrow-right"></i></span> ';
    }

    arrayStatement(statement)
    {
        return statement == 'between' || statement == 'outside';
    }

    statementString(statement)
    {
        switch (statement)
        {
            case 'outside': return 'is outside';
            case 'changes': return 'changes for';
            default: return statement;
        }
    }

    deviceList(item)
    {
        let list = new Array();

        Object.entries(item).filter(([key, value]) => Array.isArray(value)).forEach(([key, value]) =>
        {
            let items = key == 'triggers' ? this.triggerPattern : key == 'conditions' ? this.conditionPattern : this.actionPattern;

            value.filter(element => typeof(element) == 'object').forEach(element =>
            {
                if (element.type == 'property' && element.endpoint != 'triggerEndpoint' && element.property != 'triggerProperty')
                {
                    let device = this.controller.findDevice(element);
                    list.push({device: device, valid: device.info ? true : false});
                }

                items.filter(name => typeof(element[name]) == 'string').forEach(name => { patternIndex(element[name]).forEach(pattern => { list.push({...this.controller.patternData(element[name].slice(pattern.start, pattern.end)), pattern: true}); }); });
                list.push(...this.deviceList(element));
            });
        });

        return list;
    }

    brokenItem(item)
    {
        return !this.controller.devicesReady() || !this.deviceList(item).some(data => !data.valid) ? false : true;
    }

    checkDevices()
    {
        if (this.controller.page != this.service || !this.status.automations)
            return;

        this.status.automations.forEach((item, index) => { document.querySelector('tr[data-index="' + index + '"]')?.classList.toggle('broken', this.brokenItem(item)); });
    }

    valueString(value, check = false)
    {
        let string = typeof(value) == 'string';
        let error = check && string && this.controller.devicesReady() && patternIndex(value).some(pattern => !this.controller.patternData(value.slice(pattern.start, pattern.end)).valid);

        if (string)
            value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return '<span class="value' + (error ? ' error' : '') + '">' + value + '</span>';
    }

    itemProperty(item, form = false)
    {
        if (item.endpoint != 'triggerEndpoint' || item.property != 'triggerProperty')
        {
            let device = this.controller.findDevice(item);
            let check = item.endpoint.split('/')[2] == 'any';
            let title = exposeTitle(device, check ? item.endpoint.slice(0, -4) : item.endpoint, item.property) + (check ? ' (any)' : '');

            if (form)
                return (device.info ? device.info.name : '<span class="error">' + item.endpoint + '</span>') + ' <i class="mdi-arrow-right"></i> ' + title;

            return '<span class="value">' + (device.info ? device.info.name : '<span class="error">' + item.endpoint + '</span>') + '</span> <i class="mdi-arrow-right"></i> <span class="value">' + title + '</span>';
        }

        return form ? '<i>Trigger Property</i>' : '<span class="value"><i>Trigger Property</i></span>';
    }

    handleCopy(item, list, append)
    {
        let element = modal.querySelector('.copy');
        let data = structuredClone(item);

        if (append)
        {
            element.remove();
            return;
        }

        delete data.uuid;
        data.active = false;
        element.addEventListener('click', function() { list.push(data); this.showAutomationInfo(); }.bind(this));
    }

    valueForm(form, statement)
    {
        switch (statement)
        {
            case 'between':
            case 'outside':
                form.querySelector('.array').style.display = 'block';
                form.querySelector('.other').style.display = 'none';
                break;

            case 'updates':
                form.querySelector('.array').style.display = 'none';
                form.querySelector('.other').style.display = 'none';
                break;

            default:
                form.querySelector('.array').style.display = 'none';
                form.querySelector('.other').style.display = 'block';
                break;
        }
    }

    triggerInfo(trigger)
    {
        let data;

        switch (trigger.type)
        {
            case 'property':
            case 'mqtt':
            case 'state':

                for (let i = 0; i < this.triggerStatement.length; i++)
                {
                    let statement = this.triggerStatement[i];

                    if (!trigger.hasOwnProperty(statement))
                        continue;

                    data = (trigger.type == 'property' ? this.itemProperty(trigger) + ' ' : trigger.type == 'state' ? this.valueString(trigger.state) + ' ' : this.valueString(trigger.topic) + ' ' + (trigger.property ? '<i class="mdi-arrow-right"></i> ' + this.valueString(trigger.property) + ' ' : '')) + this.statementString(statement);

                    if (statement == 'updates')
                        break;

                    data += ' ' + (this.arrayStatement(statement) && Array.isArray(trigger[statement]) ? trigger[statement] : [trigger[statement]]).map(item => this.valueString(item)).join(' and ');
                }

                break;

            case 'scene':
                data = this.valueString(trigger.scene);
                break;

            case 'telegram':
                data = this.valueString(trigger.message) + (trigger.chats ? ' from ' + this.valueString(trigger.chats.join(', ')) : '');
                break;

            case 'time':
                data = this.valueString(trigger.time);
                break;

            case 'interval':
                data = 'every ' + this.valueString(trigger.interval) + ' ' + (trigger.interval != 1 ? 'minutes' : 'minute');
                break;

            case 'startup':
                data = trigger.name ? '' : '<span class="shade"><i>without name</i></span>';
                break;
        }

        if (trigger.offset)
            data += ' with ' + this.valueString(trigger.offset) + ' ' + (trigger.offset != 1 ? 'minutes' : 'minute') + ' offset';

        if (trigger.name)
            data += (trigger.offset ? ' and ' : ' with ') + 'name ' + this.valueString(trigger.name, true);

        if (trigger.startup == false)
            data += ' <span class="flag">skip startup</span>';

        if (trigger.hold)
            data += ' <span class="flag">' + trigger.hold + ' ' + (trigger.hold != 1 ? 'seconds' : 'second') + '</span>';
        else if (trigger.force)
            data += ' <span class="flag">force</span>';

        return data.trim();
    }

    conditionInfo(condition)
    {
        if (condition.type == 'week')
            return this.valueString(condition.days.join(', '));

        for (let i = 0; i < this.conditionStatement.length; i++)
        {
            let statement = this.conditionStatement[i];
            let value;

            if (!condition.hasOwnProperty(statement))
                continue;

            value = (this.arrayStatement(statement) && Array.isArray(condition[statement]) ? condition[statement] : [condition[statement]]).map(item => this.valueString(item, !Array.isArray(condition[statement]))).join(' and ');

            switch (condition.type)
            {
                case 'property':
                case 'mqtt':
                    return (condition.type == 'property' ? this.itemProperty(condition) + ' ' : this.valueString(condition.topic) + ' ' + (condition.property ? '<i class="mdi-arrow-right"></i> ' + this.valueString(condition.property) + ' ' : '')) + this.statementString(statement) + ' ' + value;

                case 'state':
                case 'pattern':
                    return this.valueString(condition[condition.type == 'state' ? 'name' : 'pattern'], condition.type == 'pattern') + ' ' + this.statementString(statement) + ' ' + value;

                case 'date':
                    return this.statementString(statement) + ' ' + value;

                case 'time':
                    return this.statementString(statement) + ' ' + value;
            }
        }
    }

    actionInfo(action)
    {
        let data;

        switch (action.type)
        {
            case 'property':

                for (let i = 0; i < this.actionStatement.length; i++)
                {
                    let statement = this.actionStatement[i];

                    if (!action.hasOwnProperty(statement))
                        continue;

                    data = this.itemProperty(action) + ' <i class="mdi-arrow-right"></i> ' + (statement == 'increase' ? this.valueString('+') + ' ' : statement == 'decrease' ? this.valueString('-') + ' ' : '') + this.valueString(action[statement], true);
                }

                break;

            case 'mqtt':
                data = this.valueString(action.message, true) + ' to ' + this.valueString(action.topic) + ' topic';
                break;

            case 'state':
                data = (action.value || action.value == false ? 'set' : 'remove') + ' ' + this.valueString(action.name) + (action.value || action.value == false ? ' to ' + this.valueString(action.value, true) : '');
                break;

            case 'scene':
                data = this.valueString(action.scene, true);
                break;

            case 'telegram':
                data = (action.message ? this.valueString(action.message, true) : 'empty message') + (action.chats ? ' to ' + this.valueString(action.chats.join(', ')) : '');
                break;

            case 'shell':
                data = this.valueString(action.command, true);
                break;

            case 'condition':
            case 'exit':
                data = action.triggerName ? '' : '<span class="shade"><i>any trigger</i></span>';
                break;

            case 'loop':
                data = this.valueString(action.count, true) + ' times';
                break;

            case 'delay':
                data = this.valueString(action.delay, true) + ' seconds';
                break;
        }

        if (action.triggerName)
            data += ' when trigger is ' + this.valueString(action.triggerName);

        if (action.retain)
            data += ' <span class="flag">retain</span>';

        if (action.rich)
            data += ' <span class="flag">rich</span>';

        if (action.file)
            data += ' <span class="flag">file</span>'; // TODO: show broken patterns

        if (action.keyboard)
            data += ' <span class="flag">keyboard</span>'; // TODO: show broken patterns

        if (action.silent)
            data += ' <span class="flag">silent</span>';

        if (action.atLeastOnce)
            data += ' <span class="flag">at least once</span>';

        return data.trim();
    }

    conditionDropdown(automation, list, type)
    {
        if (['AND', 'OR', 'NOT'].includes(type))
        {
            list.push({type: type, conditions: new Array()});
            automation.showAutomationInfo();
            return;
        }

        automation.showCondition({type: type}, list, true);
    }

    conditionList(automation, list, table, level = 0, inactive = false)
    {
        let items = !list?.length && level ? new Array(new Object()) : list;

        items?.forEach((condition, index) =>
        {
            let row = table.insertRow();

            if (level)
                row.style.backgroundColor = paletteColor(level - 1, 'var(--depth-alpha)');

            if (inactive || (condition.active != undefined && !condition.active))
                row.classList.add('inactive');

            row.drag = {type: 'condition', list: list, index: index, level: level, empty: condition.type ? false : true};

            for (let i = 0; i < 4; i++)
            {
                let cell = row.insertCell();

                switch (i)
                {
                    case 0:
                        automation.levelIndent(cell, level);
                        cell.innerHTML += ['AND', 'OR', 'NOT'].includes(condition.type) ? '<span class="value">' + condition.type + '</span>' : condition.type ?? '<span class="shade"><i>no conditions</i></span>';
                        break;

                    case 1:

                        if (!condition.type)
                            break;

                        if (['AND', 'OR', 'NOT'].includes(condition.type))
                        {
                            cell.innerHTML = '<div class="dropdown right"><i class="mdi-plus"></i></div>';
                            cell.classList.add('right');
                            addDropdown(cell.querySelector('.dropdown'), automation.conditionType, function(type) { automation.conditionDropdown(automation, condition.conditions, type); }, 7);
                            automation.conditionList(automation, condition.conditions, table, level + 1, inactive);
                            break;
                        }

                        cell.innerHTML = automation.conditionInfo(condition) ?? '<i>undefined</i>';
                        cell.classList.add('edit');
                        cell.addEventListener('click', function() { automation.showCondition(condition, list); });
                        break;

                    case 2:

                        if (!condition.type || (list.length < 2 && !level && !automation.data.actions.find(item => automation.actionNested.includes(item.type))))
                        {
                            cell.innerHTML = empty;
                            cell.classList.add('empty');
                            break;
                        }

                        addDrag(cell, function() { automation.showAutomationInfo(); });
                        break;

                    case 3:

                        if (!condition.type)
                            break;

                        cell.innerHTML = '<i class="mdi-trash-can-outline"></i>';
                        cell.classList.add('remove', 'right');
                        cell.addEventListener('click', function() { list.splice(index, 1); automation.showAutomationInfo(); });
                        break;
                }
            }
        });
    }

    actionList(automation, list, table, level = 0, inactive = false)
    {
        let items = !list?.length && level ? new Array(new Object()) : list;

        items?.forEach((action, index) =>
        {
            let row = table.insertRow();
            let nested = automation.actionNested.includes(action.type);
            let disabled = inactive || (action.active != undefined && !action.active);

            if (level)
                row.style.backgroundColor = paletteColor(level - 1, 'var(--depth-alpha)');

            if (disabled)
                row.classList.add('inactive');

            row.drag = {type: 'action', list: list, index: index, level: level, empty: action.type ? false : true};

            for (let i = 0; i < 4; i++)
            {
                let cell = row.insertCell();

                switch (i)
                {
                    case 0:
                        automation.levelIndent(cell, level);
                        cell.innerHTML += nested ? '<span class="value">' + action.type.toUpperCase() + '</span>' : action.type ?? '<span class="shade"><i>do nothing</i></span>';
                        break;

                    case 1:

                        if (!action.type)
                            break;

                        cell.innerHTML = automation.actionInfo(action) ?? '<i>undefined</i>';
                        cell.classList.add('edit');
                        cell.addEventListener('click', function() { automation.showAction(action, list); });

                        if (!nested)
                            break;

                        for (let j = (action.type == 'loop' && action.hideWhile && !action.conditions.length ? 1 : 0); j < (action.type == 'loop' || (action.hideElse && !action.else.length) ? 2 : 3); j++)
                        {
                            let actionRow = table.insertRow();
                            let nameCell = actionRow.insertCell();
                            let actionCell = actionRow.insertCell();

                            actionRow.style.backgroundColor = paletteColor(level, 'var(--depth-alpha)');

                            if (disabled)
                                actionRow.classList.add('inactive');

                            automation.levelIndent(nameCell, level, false);

                            nameCell.colSpan = 3;
                            actionCell.innerHTML = '<div class="dropdown right"><i class="mdi-plus"></i></div>';

                            switch (j)
                            {
                                case 0:
                                    actionRow.drag = {type: 'condition', list: action.conditions, index: 0, level: level + 1, header: true};
                                    nameCell.innerHTML += '<span class="value">' + (action.type == 'loop' ? 'WHILE' : 'IF') + '</span> <span class="value">' + action.conditionType + '</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.conditionType, function(type) { automation.conditionDropdown(automation, action.conditions, type); }, 7);
                                    automation.conditionList(automation, action.conditions, table, level + 1, disabled);
                                    break;

                                case 1:
                                    actionRow.drag = {type: 'action', list: action.type == 'loop' ? action.actions : action.then, index: 0, level: level + 1, header: true};
                                    nameCell.innerHTML += '<span class="value">' + (action.type == 'loop' ? 'DO' : 'THEN') + '</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.actionType, function(type) { automation.showAction({type: type}, action.type == 'loop' ? action.actions : action.then, true); }, 6);
                                    automation.actionList(automation, action.type == 'loop' ? action.actions : action.then, table, level + 1, disabled);
                                    break;

                                case 2:
                                    actionRow.drag = {type: 'action', list: action.else, index: 0, level: level + 1, header: true};
                                    nameCell.innerHTML += '<span class="value">ELSE</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.actionType, function(type) { automation.showAction({type: type}, action.else, true); }, 6);
                                    automation.actionList(automation, action.else, table, level + 1, disabled);
                                    break;
                            }
                        }

                        break;

                    case 2:

                        if (!action.type || (list.length < 2 && !level))
                        {
                            cell.innerHTML = empty;
                            cell.classList.add('empty');
                            break;
                        }

                        addDrag(cell, function() { automation.showAutomationInfo(); });
                        break;

                    case 3:

                        if (!action.type)
                            break;

                        cell.innerHTML = '<i class="mdi-trash-can-outline"></i>';
                        cell.classList.add('remove');
                        cell.addEventListener('click', function() { list.splice(index, 1); automation.showAutomationInfo(); });
                        break;
                }
            }
        });
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split(/=(.*)/) : new Array();
        let automation;

        menu.innerHTML  = '<span id="states"><i class="mdi-variable"></i> States</span>';
        menu.innerHTML += '<span id="list"><i class="mdi-menu"></i> List</span>';
        menu.innerHTML += '<span id="add"><i class="mdi-plus"></i> Add</span>';
        menu.innerHTML += '<span id="import" class="mobileHidden"><i class="mdi-upload"></i> Import</span>';

        menu.querySelector('#states').addEventListener('click', function() { this.showStates(); }.bind(this));
        menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage(this.service); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showAutomationInfo(false, true); }.bind(this));

        menu.querySelector('#import').addEventListener('click', function()
        {
            loadFile(function(data)
            {
                this.data = data;
                delete this.uuid;
                this.showAutomationInfo();

            }.bind(this));

        }.bind(this));

        if (!this.status.version)
            return;

        if (list[0] == 'uuid')
            automation = this.status.automations?.find(item => item.uuid == list[1]);

        if (automation)
        {
            let deadline = Date.now() + 5000;

            function wait(resolve)
            {
                if (deadline > Date.now() && !this.controller.devicesReady())
                {
                    setTimeout(wait.bind(this, resolve), 10);
                    return;
                }

                resolve();
            }

            new Promise(wait.bind(this)).then(function()
            {
                this.data = structuredClone(automation);
                this.uuid = automation.uuid;
                this.showAutomationInfo(false);

            }.bind(this));
        }
        else
            this.showAutomationList();

        this.updatePage();
    }

    showStates()
    {
        loadHTML('html/automation/states.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });
            this.updateStates();
            showModal(true);
        });
    }

    showAutomationList()
    {
        this.controller.setPage(this.service);

        if (!this.status.automations?.length)
        {
            this.content.innerHTML = '<div class="emptyList">automations list is empty</div>';
            return;
        }

        loadHTML('html/automation/automationList.html', this, this.content, function()
        {
            let table = this.content.querySelector('.itemList table');

            this.status.automations.forEach((item, index) =>
            {
                let row = table.querySelector('tbody').insertRow();

                row.addEventListener('click', function() { this.controller.showPage(this.service + '?uuid=' + item.uuid); }.bind(this));
                row.dataset.index = index;

                if (!item.active)
                    row.classList.add('inactive');

                for (let i = 0; i < 6; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:

                            cell.innerHTML = item.name;
                            cell.colSpan = 2;

                            if (item.note)
                                row.title = item.note;

                            break;

                        case 1: cell.innerHTML = '<span class="value">' + item.mode.slice(0, 1).toUpperCase() + '</span>'; cell.classList.add('center'); break;
                        case 2: cell.innerHTML = '<span class="value">' + item.triggers.length + '</span>'; cell.classList.add('center', 'mobileHidden'); break;
                        case 3: cell.innerHTML = '<span class="value">' + item.conditions.length + '</span>'; cell.classList.add('center', 'mobileHidden'); break;
                        case 4: cell.innerHTML = '<span class="value">' + item.actions.length + '</span>'; cell.classList.add('center', 'mobileHidden'); break;
                        case 5: cell.innerHTML = empty; cell.classList.add('lastTriggered', 'right'); break;
                    }
                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { let once = cell.classList.contains('once'); sortTable(table, this.dataset.index, true, once); if (!once) localStorage.setItem('homedAutomationSort', this.dataset.index); }));
            sortTable(table, localStorage.getItem('homedAutomationSort') ?? 0);
            addTableSearch(table, 'automations', 'automation', 7);
        });
    }

    showAutomationInfo(updated = true, add = false)
    {
        loadHTML('html/automation/automationInfo.html', this, this.content, function()
        {
            let triggers, conditions, actions;

            if (updated)
            {
                this.content.querySelector('.save').classList.add('warning');
                this.updated = true;
            }

            if (add)
            {
                this.data = {mode: 'single', active: true, triggers: new Array(), conditions: new Array(), actions: new Array()};
                delete this.uuid;
            }

            if (this.uuid)
            {
                let automations = new Array();
                let list = new Array();
                let current;

                this.status.automations.forEach(automation => { automations.push([automation.uuid, automation.name]); });

                automations.sort(function(a, b) { return compareStrings(a[1], b[1]); }).forEach((item, index) =>
                {
                    if (item[0] == this.uuid)
                        current = index;

                    list.push(item[0]);
                });

                handleArrowButtons(this.content, list, current, function(uuid) { this.controller.showPage(this.service + '?uuid=' + uuid); }.bind(this));
            }
            else
                this.content.querySelectorAll('.remove, .copy, .export, .previous, .next').forEach(item => item.style.display = 'none');

            if (!this.data.name)
                this.data.name = 'Automation ' + randomString(4);

            this.content.querySelector('.edit').addEventListener('click', function() { this.showAutomationEdit(); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showAutomationRemove(); }.bind(this));
            this.content.querySelector('.save').addEventListener('click', function() { this.controller.socket.publish('command/' + this.service, {action: 'updateAutomation', automation: this.uuid, data: this.data}); }.bind(this));

            this.content.querySelector('.copy').addEventListener('click', function()
            {
                delete this.uuid;

                delete this.data.active;
                delete this.data.lastTriggered;
                delete this.data.uuid;

                this.data.actions.forEach(action => delete action.uuid);
                this.data.name += ' (copy)';
                this.showAutomationInfo();

            }.bind(this));

            this.content.querySelector('.export').addEventListener('click', function()
            {
                let data = structuredClone(this.data);
                let item = document.createElement('a');

                delete data.active;
                delete data.lastTriggered;
                delete data.name;
                delete data.uuid;

                data.actions.forEach(action => delete action.uuid);

                item.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
                item.download = this.data.name + '.json';
                item.click();

            }.bind(this));

            this.content.querySelector('.name').innerHTML = this.data.name + (this.uuid ? '' : ' <span class="value warning">NEW</span>');
            this.content.querySelector('.note').innerHTML = this.data.note ?? '';
            this.content.querySelector('.mode').innerHTML = '<span class="value">' + this.data.mode + '</span>';
            this.content.querySelector('.debounce').innerHTML = '<span class="value">' + (this.data.debounce ?? 0) + '</span> seconds';
            this.content.querySelector('.active').innerHTML = this.data.active ? '<i class="mdi-check-circle success"></i>' : '<i class="mdi-close-circle shade"></i>';
            this.content.querySelector('.log').innerHTML = this.data.log ? '<i class="mdi-check-circle success"></i>' : '<i class="mdi-close-circle shade"></i>';

            triggers = this.content.querySelector('.triggers');
            conditions = this.content.querySelector('.conditions');
            actions = this.content.querySelector('.actions');

            addDropdown(this.content.querySelector('.addTrigger'), this.triggerType, function(type) { this.showTrigger({type: type}, true); }.bind(this));
            addDropdown(this.content.querySelector('.addCondition'), this.conditionType, function(type) { this.conditionDropdown(this, this.data.conditions, type); }.bind(this), 7);
            addDropdown(this.content.querySelector('.addAction'), this.actionType, function(type) { this.showAction({type: type}, this.data.actions, true); }.bind(this), 6);

            this.data.triggers.forEach((trigger, index) =>
            {
                let row = triggers.insertRow();

                if (trigger.active != undefined && !trigger.active)
                    row.classList.add('inactive');

                row.drag = {type: 'trigger', list: this.data.triggers, index: index, level: 0};

                for (let i = 0; i < 4; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = trigger.type; break;

                        case 1:
                            cell.innerHTML = this.triggerInfo(trigger) ?? '<i>undefined</i>';
                            cell.classList.add('edit');
                            cell.addEventListener('click', function() { this.showTrigger(trigger); }.bind(this));
                            break;

                        case 2:

                            if (this.data.triggers.length < 2)
                            {
                                cell.innerHTML = empty;
                                cell.classList.add('empty');
                                break;
                            }

                            addDrag(cell, function() { this.showAutomationInfo(); }.bind(this));
                            break;

                        case 3:
                            cell.innerHTML = '<i class="mdi-trash-can-outline"></i>';
                            cell.classList.add('remove');
                            cell.addEventListener('click', function() { this.data.triggers.splice(index, 1); this.showAutomationInfo(); }.bind(this));
                            break;
                    }
                }
            });

            this.content.querySelector('.addCondition').parentNode.drag = {type: 'condition', list: this.data.conditions, index: 0, level: 0, header: true, table: conditions};

            this.conditionList(this, this.data.conditions, conditions);
            this.actionList(this, this.data.actions, actions);

            showModal(false);
        });
    }

    showAutomationEdit()
    {
        loadHTML('html/automation/automationEdit.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = this.data.name;
            modal.querySelector('input[name="name"]').value = this.data.name;
            modal.querySelector('textarea[name="note"]').value = this.data.note ?? '';
            modal.querySelector('select[name="mode"]').value = this.data.mode ?? 'parallel';
            modal.querySelector('input[name="debounce"]').value = this.data.debounce ?? 0;
            modal.querySelector('input[name="log"]').checked = this.data.log;
            modal.querySelector('input[name="active"]').checked = this.data.active;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                this.data.name = form.name;
                this.data.note = form.note;
                this.data.mode = form.mode;
                this.data.debounce = form.debounce;
                this.data.log = form.log;
                this.data.active = form.active;

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true, 'input[name="name"]');
        });
    }

    showAutomationRemove()
    {
        loadHTML('html/automation/automationRemove.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = this.data.name;
            modal.querySelector('.remove').addEventListener('click', function() { this.controller.socket.publish('command/' + this.service, {action: 'removeAutomation', automation: this.uuid}); this.controller.clearPage(); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }

    showTrigger(trigger, append = false)
    {
        switch (trigger.type)
        {
            case 'property':  this.showPropertyItem(trigger, this.data.triggers, this.triggerStatement, append, 'trigger'); break;
            case 'mqtt':      this.showMqttItem(trigger, this.data.triggers, this.triggerStatement, append, 'trigger'); break;
            case 'state':     this.showStateTrigger(trigger, append); break;
            case 'scene':     this.showSceneTrigger(trigger, append); break;
            case 'telegram':  this.showTelegramTrigger(trigger, append); break;
            case 'time':      this.showTimeTrigger(trigger, append); break;
            case 'interval':  this.showIntervalTrigger(trigger, append); break;
            case 'startup':   this.showStartupTrigger(trigger, append); break;
        }
    }

    showCondition(condition, list, append = false)
    {
        switch (condition.type)
        {
            case 'property':  this.showPropertyItem(condition, list, this.conditionStatement, append, 'condition'); break;
            case 'mqtt':      this.showMqttItem(condition, list, this.conditionStatement, append, 'condition'); break;
            case 'state':     this.showStatePatternCondition(condition, list, append, condition.type); break;
            case 'date':      this.showDateTimeCondition(condition, list, append, condition.type); break;
            case 'time':      this.showDateTimeCondition(condition, list, append, condition.type); break;
            case 'week':      this.showWeekCondition(condition, list, append); break;
            case 'pattern':   this.showStatePatternCondition(condition, list, append, condition.type); break;
        }
    }

    showAction(action, list, append = false)
    {
        switch (action.type)
        {
            case 'property':  this.showPropertyItem(action, list, this.actionStatement, append, 'action'); break;
            case 'mqtt':      this.showMqttAction(action, list, append); break;
            case 'state':     this.showStateAction(action, list, append); break;
            case 'scene':     this.showSceneAction(action, list, append); break;
            case 'telegram':  this.showTelegramAction(action, list, append); break;
            case 'shell':     this.showShellAction(action, list, append); break;
            case 'condition': this.showConditionAction(action, list, append); break;
            case 'loop':      this.showLoopAction(action, list, append); break;
            case 'delay':     this.showDelayAction(action, list, append); break;
            case 'exit':      this.showExitAction(action, list, append); break;
        }
    }

    showPropertyItem(item, list, statements, append, type)
    {
        loadHTML('html/automation/propertyItem.html', this, modal.querySelector('.data'), function()
        {
            let properties = this.controller.propertyList(type != 'trigger', false, type == 'trigger');
            let data;

            modal.querySelector('.name').innerHTML = 'Property ' + type;
            modal.querySelector('.property').innerHTML = append ? 'Select property there <i class="mdi-arrow-right"></i>' : this.itemProperty(item, true);

            addDropdown(modal.querySelector('.dropdown'), Object.keys(properties), function(key)
            {
                data = properties[key];
                modal.querySelector('.property').innerHTML = this.itemProperty(data, true);
                modal.querySelector('.property').classList.remove('error');

            }.bind(this), type != 'trigger' ? 1 : 0);

            statements.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = this.statementString(statement);
                option.value = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!item.hasOwnProperty(statement))
                    return;

                modal.querySelector('select[name="statement"]').value = statement;

                if (this.arrayStatement(statement))
                {
                    modal.querySelector('input[name="min"]').value = item[statement][0];
                    modal.querySelector('input[name="max"]').value = item[statement][1];
                }
                else
                    modal.querySelector('textarea[name="value"]').value = statement != 'updates' ? item[statement] : '';

                this.valueForm(modal, statement);
            });

            modal.querySelector('#value.dropdown').style.display = type != 'trigger' ? 'inline' : 'none';

            modal.querySelector('.hold').style.display = type == 'trigger' ? 'block' : 'none';
            modal.querySelector('input[name="hold"]').value = item.hold ?? '';

            modal.querySelector('.triggerName').style.display = type != 'condition' ? 'block' : 'none';
            modal.querySelector('#triggerName.dropdown').style.display = type == 'trigger' ? 'inline' : 'none';
            modal.querySelector('textarea[name="triggerName"]').value = (type == 'trigger' ? item.name : item.triggerName) ?? '';

            modal.querySelector('input[name="startup"]').closest('label').style.display = type == 'trigger' ? 'block' : 'none';
            modal.querySelector('input[name="startup"]').checked = item.startup ?? true;

            modal.querySelector('input[name="force"]').closest('label').style.display = type == 'trigger' ? 'block' : 'none';
            modal.querySelector('input[name="force"]').checked = item.force ?? false;

            modal.querySelector('input[name="active"]').checked = item.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!data && (!item.endpoint || !item.property))
                {
                    modal.querySelector('.property').classList.add('error');
                    return;
                }

                if (!form)
                    return;

                if (data)
                {
                    item.endpoint = data.endpoint;
                    item.property = data.property;
                }

                statements.forEach(statement => delete item[statement]);

                item[form.statement] = this.arrayStatement(form.statement) ? [this.parseValue(form.min), this.parseValue(form.max)] : form.statement != 'updates' ? this.parseValue(form.value) : true;
                item.active = form.active;

                if (form.hold && type == 'trigger' && item.endpoint.split('/')[2] != 'any')
                    item.hold = form.hold;
                else
                    delete item.hold;

                if (form.triggerName)
                    item[type == 'trigger' ? 'name' : 'triggerName'] = form.triggerName;
                else
                    delete item[type == 'trigger' ? 'name' : 'triggerName'];

                if (!form.startup && type == 'trigger')
                    item.startup = false;
                else
                    delete item.startup;

                if (form.force && type == 'trigger' && !['changes', 'updates'].includes(form.statement))
                    item.force = true;
                else
                    delete item.force;

                if (append)
                    list.push(item);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(item, list, append);
            showModal(true, null, type);
        });
    }

    showMqttItem(item, list, statements, append, type)
    {
        loadHTML('html/automation/mqttItem.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = 'MQTT ' + type;
            modal.querySelector('input[name="topic"]').value = item.topic ?? '';
            modal.querySelector('input[name="property"]').value = item.property ?? '';

            statements.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = this.statementString(statement);
                option.value = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!item.hasOwnProperty(statement))
                    return;

                modal.querySelector('select[name="statement"]').value = statement;

                if (this.arrayStatement(statement))
                {
                    modal.querySelector('input[name="min"]').value = item[statement][0];
                    modal.querySelector('input[name="max"]').value = item[statement][1];
                }
                else
                    modal.querySelector('textarea[name="value"]').value = statement != 'updates' ? item[statement] : '';

                this.valueForm(modal, statement);
            });

            modal.querySelector('#value.dropdown').style.display = type != 'trigger' ? 'inline' : 'none';

            modal.querySelector('.hold').style.display = type == 'trigger' ? 'block' : 'none';
            modal.querySelector('input[name="hold"]').value = item.hold ?? '';

            modal.querySelector('.triggerName').style.display = type != 'condition' ? 'block' : 'none';
            modal.querySelector('#triggerName.dropdown').style.display = type == 'trigger' ? 'inline' : 'none';
            modal.querySelector('textarea[name="triggerName"]').value = (type == 'trigger' ? item.name : item.triggerName) ?? '';

            modal.querySelector('input[name="startup"]').closest('label').style.display = type == 'trigger' ? 'block' : 'none';
            modal.querySelector('input[name="startup"]').checked = item.startup ?? true;

            modal.querySelector('input[name="force"]').closest('label').style.display = type == 'trigger' ? 'block' : 'none';
            modal.querySelector('input[name="force"]').checked = item.force ?? false;

            modal.querySelector('input[name="active"]').checked = item.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                statements.forEach(statement => delete item[statement]);

                item.topic = form.topic;
                item.property = form.property;
                item[form.statement] = this.arrayStatement(form.statement) ? [this.parseValue(form.min), this.parseValue(form.max)] : form.statement != 'updates' ? this.parseValue(form.value) : true;
                item.active = form.active;

                if (form.hold && type == 'trigger')
                    item.hold = form.hold;
                else
                    delete item.hold;

                if (form.triggerName)
                    item[type == 'trigger' ? 'name' : 'triggerName'] = form.triggerName;
                else
                    delete item[type == 'trigger' ? 'name' : 'triggerName'];

                if (!form.startup && type == 'trigger')
                    item.startup = false;
                else
                    delete item.startup;

                if (form.force && type == 'trigger' && !['changes', 'updates'].includes(form.statement))
                    item.force = true;
                else
                    delete item.force;

                if (append)
                    list.push(item);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(item, list, append);
            showModal(true, 'input[name="topic"]', type);
        });
    }

    showStateTrigger(trigger, append)
    {
        loadHTML('html/automation/stateTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="state"]').value = trigger.state ?? '';

            this.triggerStatement.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = this.statementString(statement);
                option.value = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!trigger.hasOwnProperty(statement))
                    return;

                modal.querySelector('select[name="statement"]').value = statement;

                if (this.arrayStatement(statement))
                {
                    modal.querySelector('input[name="min"]').value = trigger[statement][0];
                    modal.querySelector('input[name="max"]').value = trigger[statement][1];
                }
                else
                    modal.querySelector('textarea[name="value"]').value = statement != 'updates' ? trigger[statement] : '';

                this.valueForm(modal, statement);
            });

            modal.querySelector('input[name="hold"]').value = trigger.hold ?? '';
            modal.querySelector('textarea[name="name"]').value = trigger.name ?? '';
            modal.querySelector('input[name="force"]').checked = trigger.force ?? false;
            modal.querySelector('input[name="active"]').checked = trigger.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                this.triggerStatement.forEach(statement => delete trigger[statement]);

                trigger.state = form.state;
                trigger[form.statement] = this.arrayStatement(form.statement) ? [this.parseValue(form.min), this.parseValue(form.max)] : form.statement != 'updates' ? this.parseValue(form.value) : true;
                trigger.active = form.active;

                if (form.hold)
                    trigger.hold = form.hold;
                else
                    delete trigger.hold;

                if (form.name)
                    trigger.name = form.name;
                else
                    delete trigger.name;

                if (form.force && !['changes', 'updates'].includes(form.statement))
                    trigger.force = true;
                else
                    delete trigger.force;

                if (append)
                    this.data.triggers.push(trigger);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(trigger, this.data.triggers, append);
            showModal(true, 'input[name="state"]', 'trigger');
        });
    }

    showSceneTrigger(trigger, append)
    {
        loadHTML('html/automation/sceneTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="scene"]').value = trigger.scene ?? '';
            modal.querySelector('textarea[name="name"]').value = trigger.name ?? '';
            modal.querySelector('input[name="active"]').checked = trigger.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                trigger.scene = form.scene;
                trigger.active = form.active;

                if (form.name)
                    trigger.name = form.name;
                else
                    delete trigger.name;

                if (append)
                    this.data.triggers.push(trigger);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(trigger, this.data.triggers, append);
            showModal(true, 'input[name="scene"]', 'trigger');
        });
    }

    showTelegramTrigger(trigger, append)
    {
        loadHTML('html/automation/telegramTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="message"]').value = trigger.message ?? '';
            modal.querySelector('input[name="chats"]').value = trigger.chats ? trigger.chats.join(', ') : '';
            modal.querySelector('textarea[name="name"]').value = trigger.name ?? '';
            modal.querySelector('input[name="active"]').checked = trigger.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let chats = form?.chats ? form.chats.split(',').map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                if (!form)
                    return;

                trigger.message = form.message;
                trigger.chats = chats.length ? chats : null;
                trigger.active = form.active;

                if (form.name)
                    trigger.name = form.name;
                else
                    delete trigger.name;

                if (append)
                    this.data.triggers.push(trigger);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(trigger, this.data.triggers, append);
            showModal(true, 'textarea[name="message"]', 'trigger');
        });
    }

    showTimeTrigger(trigger, append)
    {
        loadHTML('html/automation/timeTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="time"]').value = trigger.time ?? '12:00';
            modal.querySelector('textarea[name="name"]').value = trigger.name ?? '';
            modal.querySelector('input[name="active"]').checked = trigger.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                trigger.time = form.time;
                trigger.active = form.active;

                if (form.name)
                    trigger.name = form.name;
                else
                    delete trigger.name;

                if (append)
                    this.data.triggers.push(trigger);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(trigger, this.data.triggers, append);
            showModal(true, 'input[name="time"]', 'trigger');
        });
    }

    showIntervalTrigger(trigger, append)
    {
        loadHTML('html/automation/intervalTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="interval"]').value = trigger.interval ?? 10;
            modal.querySelector('input[name="offset"]').value = trigger.offset ?? 0;
            modal.querySelector('textarea[name="name"]').value = trigger.name ?? '';
            modal.querySelector('input[name="active"]').checked = trigger.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                trigger.interval = form.interval;
                trigger.offset = form.offset;
                trigger.active = form.active;

                if (form.name)
                    trigger.name = form.name;
                else
                    delete trigger.name;

                if (append)
                    this.data.triggers.push(trigger);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(trigger, this.data.triggers, append);
            showModal(true, 'input[name="interval"]', 'trigger');
        });
    }

    showStartupTrigger(trigger, append)
    {
        loadHTML('html/automation/startupTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="name"]').value = trigger.name ?? '';
            modal.querySelector('input[name="active"]').checked = trigger.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                trigger.active = form.active;

                if (form.name)
                    trigger.name = form.name;
                else
                    delete trigger.name;

                if (append)
                    this.data.triggers.push(trigger);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(trigger, this.data.triggers, append);
            showModal(true, 'textarea[name="name"]', 'trigger');
        });
    }

    showStatePatternCondition(condition, list, append, type)
    {
        loadHTML('html/automation/' + type + 'Condition.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector(type == 'state' ? 'input[name="name"]' : 'textarea[name="pattern"]').value = condition[type == 'state' ? 'name' : 'pattern'] ?? '';
            modal.querySelector('input[name="active"]').checked = condition.active ?? true;

            this.conditionStatement.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = this.statementString(statement);
                option.value = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!condition.hasOwnProperty(statement))
                    return;

                    modal.querySelector('select[name="statement"]').value = statement;

                if (this.arrayStatement(statement))
                {
                    modal.querySelector('input[name="min"]').value = condition[statement][0];
                    modal.querySelector('input[name="max"]').value = condition[statement][1];
                }
                else
                    modal.querySelector('textarea[name="value"]').value = condition[statement];

                this.valueForm(modal, statement);
            });

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let item = type == 'state' ? 'name' : 'pattern';

                if (!form)
                    return;

                this.conditionStatement.forEach(statement => delete condition[statement]);

                condition[item] = form[item];
                condition[form.statement] = this.arrayStatement(form.statement) ? [this.parseValue(form.min), this.parseValue(form.max)] : this.parseValue(form.value);
                condition.active = form.active;

                if (append)
                    list.push(condition);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(condition, list, append);
            showModal(true, type == 'state' ? 'input[name="name"]' : 'textarea[name="pattern"]', 'condition');
        });
    }

    showDateTimeCondition(condition, list, append, type)
    {
        loadHTML('html/automation/' + type + 'Condition.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="active"]').checked = condition.active ?? true;

            this.conditionStatement.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = this.statementString(statement);
                option.value = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!condition.hasOwnProperty(statement))
                    return;

                modal.querySelector('select[name="statement"]').value = statement;

                if (this.arrayStatement(statement))
                {
                    modal.querySelector('input[name="start"]').value = condition[statement][0];
                    modal.querySelector('input[name="end"]').value = condition[statement][1];
                }
                else
                    modal.querySelector('input[name="value"]').value = condition[statement];

                this.valueForm(modal, statement);
            });

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                this.conditionStatement.forEach(statement => delete condition[statement]);

                condition[form.statement] = this.arrayStatement(form.statement) ? [form.start, form.end] : form.value;
                condition.active = form.active;

                if (append)
                    list.push(condition);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(condition, list, append);
            showModal(true, 'input[name="value"]');
        });
    }

    showWeekCondition(condition, list, append)
    {
        loadHTML('html/automation/weekCondition.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="days"]').value = condition.days ? condition.days.join(', ') : '';
            modal.querySelector('input[name="active"]').checked = condition.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let days = form?.days ? form.days.split(',').map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                if (!form)
                    return;

                condition.days = days.length ? days : null;
                condition.active = form.active;

                if (append)
                    list.push(condition);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(condition, list, append);
            showModal(true, 'input[name="days"]');
        });
    }

    showMqttAction(action, list, append)
    {
        loadHTML('html/automation/mqttAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="topic"]').value = action.topic ?? '';
            modal.querySelector('textarea[name="message"]').value = action.message ?? '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="retain"]').checked = action.retain ?? false;
            modal.querySelector('input[name="active"]').checked = action.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                action.topic = form.topic;
                action.message = form.message;
                action.retain = form.retain;
                action.active = form.active;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, list, append);
            showModal(true, 'input[name="topic"]', 'action');
        });
    }

    showStateAction(action, list, append)
    {
        loadHTML('html/automation/stateAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="name"]').value = action.name ?? '';
            modal.querySelector('textarea[name="value"]').value = action.value ?? '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="active"]').checked = action.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                action.name = form.name;
                action.value = this.parseValue(form.value);
                action.active = form.active;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, list, append);
            showModal(true, 'input[name="name"]', 'action');
        });
    }

    showSceneAction(action, list, append)
    {
        loadHTML('html/automation/sceneAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="scene"]').value = action.scene ?? '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="active"]').checked = action.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                action.scene = form.scene;
                action.active = form.active;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, list, append);
            showModal(true, 'textarea[name="scene"]', 'action');
        });
    }

    showTelegramAction(action, list, append)
    {
        loadHTML('html/automation/telegramAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="message"]').value = action.message ?? '';
            modal.querySelector('textarea[name="file"]').value = action.file ?? '';
            modal.querySelector('textarea[name="keyboard"]').value = action.keyboard ?? '';
            modal.querySelector('input[name="thread"]').value = action.thread ? action.thread : '';
            modal.querySelector('input[name="chats"]').value = action.chats ? action.chats.join(', ') : '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="rich"]').checked = action.rich ?? false;
            modal.querySelector('input[name="silent"]').checked = action.silent ?? false;

            modal.querySelector('input[name="remove"]').checked = action.remove ?? false;
            modal.querySelector('input[name="remove"]').addEventListener('click', function() { modal.querySelector('input[name="update"]').checked = false });

            modal.querySelector('input[name="update"]').checked = action.update ?? false;
            modal.querySelector('input[name="update"]').addEventListener('click', function() { modal.querySelector('input[name="remove"]').checked = false });

            modal.querySelector('input[name="active"]').checked = action.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let chats = form.chats ? form.chats.split(',').map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                action.message = form.message;
                action.file = form.file;
                action.keyboard = form.keyboard;
                action.chats = chats.length ? chats : null;
                action.rich = form.rich;
                action.silent = form.silent;
                action.remove = form.remove;
                action.update = form.update;
                action.active = form.active;

                if (form.thread)
                    action.thread = form.thread;
                else
                    delete action.thread;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, list, append);
            showModal(true, 'textarea[name="message"]', 'action');
        });
    }

    showShellAction(action, list, append)
    {
        loadHTML('html/automation/shellAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="command"]').value = action.command ?? '';
            modal.querySelector('input[name="timeout"]').value = action.timeout ?? 30;
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="active"]').checked = action.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                action.command = form.command;
                action.timeout = form.timeout;
                action.active = form.active;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, list, append);
            showModal(true, 'textarea[name="command"]', 'action');
        });
    }

    showConditionAction(action, list, append)
    {
        loadHTML('html/automation/conditionAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('select[name="conditionType"]').value = action.conditionType ?? 'AND';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="hideElse"]').checked = action.hideElse;
            modal.querySelector('input[name="active"]').checked = action.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.conditionType = form.conditionType;
                action.hideElse = form.hideElse;
                action.active = form.active;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                {
                    action.conditions = new Array();
                    action.then = new Array();
                    action.else = new Array();
                    list.push(action);
                }

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, list, append);
            showModal(true, 'input[name="triggerName"]');
        });
    }

    showLoopAction(action, list, append)
    {
        loadHTML('html/automation/loopAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="count"]').value = action.count ?? 3;
            modal.querySelector('select[name="conditionType"]').value = action.conditionType ?? 'AND';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="atLeastOnce"]').checked = action.atLeastOnce;
            modal.querySelector('input[name="hideWhile"]').checked = action.hideWhile;
            modal.querySelector('input[name="active"]').checked = action.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                action.count = form.count;
                action.conditionType = form.conditionType;
                action.atLeastOnce = form.atLeastOnce;
                action.hideWhile = form.hideWhile;
                action.active = form.active;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                {
                    action.conditions = new Array();
                    action.actions = new Array();
                    list.push(action);
                }

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, list, append);
            showModal(true, 'textarea[name="count"]', 'action');
        });
    }

    showDelayAction(action, list, append)
    {
        loadHTML('html/automation/delayAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="delay"]').value = action.delay ?? 1;
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="active"]').checked = action.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (!form)
                    return;

                action.delay = form.delay;
                action.active = form.active;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, list, append);
            showModal(true, 'textarea[name="delay"]', 'action');
        });
    }

    showExitAction(action, list, append)
    {
        loadHTML('html/automation/exitAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="active"]').checked = action.active ?? true;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.active = form.active;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, list, append);
            showModal(true, 'input[name="triggerName"]');
        });
    }

    showAlert(page)
    {
        loadHTML('html/automation/alert.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = this.data.name;
            modal.querySelector('.leave').addEventListener('click', function() { this.updated = false; this.controller.showPage(page); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }
}
