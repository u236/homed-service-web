class Automation
{
    intervals = [setInterval(function() { this.checkDevices(); this.updateLastTriggered(); }.bind(this), 100)];
    service = 'automation';

    triggerType = ['property', 'mqtt', 'telegram', 'time', 'interval', 'startup'];
    triggerStatement = ['equals', 'above', 'below', 'between', 'outside', 'changes', 'updates'];

    conditionType = ['property', 'mqtt', 'state', 'date', 'time', 'week', 'pattern', 'AND', 'OR', 'NOT'];
    conditionStatement = ['equals', 'differs', 'above', 'below', 'between', 'outside'];

    actionType = ['property', 'mqtt', 'state', 'telegram', 'shell', 'condition', 'delay', 'exit'];
    actionStatement = ['value', 'increase', 'decrease'];

    content = document.querySelector('.content .container');
    status = new Object();
    data = new Object();

    constructor(controller, instance)
    {
        this.controller = controller;

        if (!instance)
            return;

        this.service += '/' + instance;
    }

    isArrayStatement(statement)
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

    checkDevices()
    {
        if (this.controller.page != this.service || !this.status.automations)
            return;

        this.status.automations.forEach((item, index) =>
        {
            let row = document.querySelector('tr[data-index="' + index + '"]');

            if (!row)
                return;

            Object.keys(item).forEach(key =>
            { 
                if (!Array.isArray(item[key])) 
                    return;
                
                item[key].forEach(element => { if (element.type == 'property' && !this.controller.findDevice(element).info) row.classList.add('incomplete'); else row.classList.remove('incomplete'); });
            });
        });
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
                        cell.innerHTML = '<i class="icon-trash"></i>';
                        cell.classList.add('remove');
                        cell.addEventListener('click', function() { cell.innerHTML = '<div class="dataLoader"></div>'; this.controller.socket.publish('command/' + this.service, {action: 'removeState', state: state}); this.removeState = true; }.bind(this));
                        break;
                }
            }
        });

        table.querySelectorAll('tr').forEach(row => { if (!list.includes(row.dataset.state)) row.remove(); });

        modal.querySelector('.empty').style.display = list.length ? 'none' : 'block';
        table.style.display = list.length ? 'table' : 'none';

        sortTable(table, 0);
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = 'Automation ' + this.status.version;
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':

                let check = this.status.automations?.map(automation => automation.name);

                this.status = message;
                this.status.automations?.forEach(item => { if (!item.conditions) item.conditions = new Array(); });

                if (this.controller.service == this.service)
                {
                    if (JSON.stringify(check) != JSON.stringify(this.status.automations?.map(automation => automation.name)))
                        this.controller.showPage(this.service);

                    this.updateStates();
                    this.updatePage();
                }

                break;

            case 'event':

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

    parseValue(value)
    {
        return value ? value == 'true' || value == 'false' ? value == 'true' : isNaN(value) ? value : parseFloat(value) : null;
    }

    shieldValue(value)
    {
        if (typeof(value) == 'string')
            value = value.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        return value;
    }    

    itemProperty(item, form = false)
    {
        if (item.endpoint != 'triggerEndpoint' || item.property != 'triggerProperty')
        {
            let device = this.controller.findDevice(item);

            if (form)
                return (device.info ? device.info.name : '<span class="error">' + item.endpoint + '</span>') + ' <i class="icon-right"></i> ' + exposeTitle(device, item.endpoint, item.property);

            return '<span class="value">' + (device.info ? device.info.name : '<span class="error">' + item.endpoint + '</span>') + '</span> <i class="icon-right"></i> <span class="value">' + exposeTitle(device, item.endpoint, item.property) + '</span>';
        }
        
        return form ? '<i>Trigger Property</i>' : '<span class="value"><i>Trigger Property</i></span>';
    }

    handleCopy(item, list, append)
    {
        let element = modal.querySelector('.copy');

        if (append)
        {
            element.style.display = 'none';
            return;
        }

        element.addEventListener('click', function() { list.push(structuredClone(item)); this.showAutomationInfo(); }.bind(this));
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

                for (let i = 0; i < this.triggerStatement.length; i++)
                {
                    let statement = this.triggerStatement[i];

                    if (!trigger.hasOwnProperty(statement))
                        continue;

                    data = (trigger.type == 'property' ? this.itemProperty(trigger) + ' ' : '<span class="value">' + trigger.topic + '</span> ' + (trigger.property ? '<i class="icon-right"></i> <span class="value">' + trigger.property + '</span> ' : '')) + this.statementString(statement);

                    if (statement == 'updates')
                        break;

                    data += ' <span class="value">' + (this.isArrayStatement(statement) && Array.isArray(trigger[statement]) ? trigger[statement].join('</span> and <span class="value">') : this.shieldValue(trigger[statement])) + '</span>'; // TODO: shieldValue for array statements
                }

                break;

            case 'telegram':
                data = '<span class="value">' + this.shieldValue(trigger.message) + '</span>' + (trigger.chats ? ' from <span class="value">' + trigger.chats.join(', ') + '</span>': '');
                break;

            case 'time':
                data = '<span class="value">' + trigger.time + '</span>';
                break;

            case 'interval':
                data = 'every <span class="value">' + trigger.interval + '</span> ' + (trigger.interval != 1 ? 'minutes' : 'minute');
                break;

            case 'startup':
                data = trigger.name ? '' : '<span class="shade"><i>without name</i></span>';
                break;
        }

        if (trigger.offset)
            data += ' with <span class="value">' + trigger.offset + '</span> ' + (trigger.offset != 1 ? 'minutes' : 'minute') + ' offset';

        if (trigger.name)
            data += (trigger.offset ? ' and ' : ' with ') + 'name <span class="value">' + trigger.name + '</span>';

        if (trigger.force)
            data += ' <span class="shade">[force]</span>';

        return data.trim();
    }

    conditionInfo(condition)
    {
        if (condition.type == 'week')
            return '<span class="value">' + condition.days.join(', ') + '</span>';

        for (let i = 0; i < this.conditionStatement.length; i++)
        {
            let statement = this.conditionStatement[i];
            let value;

            if (!condition.hasOwnProperty(statement))
                continue;

            value = this.isArrayStatement(statement) && Array.isArray(condition[statement]) ? condition[statement].join('</span> and <span class="value">') : this.shieldValue(condition[statement]); // TODO: parseString for array statements

            switch (condition.type)
            {
                case 'property':
                case 'mqtt':
                    return (condition.type == 'property' ? this.itemProperty(condition) + ' ' : '<span class="value">' + condition.topic + '</span> ' + (condition.property ? '<i class="icon-right"></i> <span class="value">' + condition.property + '</span> ' : '')) + this.statementString(statement) + ' <span class="value">' + value + '</span>';

                case 'state':
                case 'pattern':
                    return '<span class="value">' + condition[condition.type == 'state' ? 'name' : 'pattern'] + '</span> ' + this.statementString(statement) + ' <span class="value">' + value + '</span>';

                case 'date':
                    return this.statementString(statement) + ' <span class="value">' + value + '</span>';

                case 'time':
                    return this.statementString(statement) + ' <span class="value">' + value + '</span>';
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

                    data = this.itemProperty(action) + ' <i class="icon-right"></i> ' + (statement == 'increase' ? '<span class="value">+</span> ' : statement == 'decrease' ? '<span class="value">-</span> ' : '') + '<span class="value">' + this.shieldValue(action[statement]) + '</span>';
                }

                break;

            case 'mqtt':
                data = '<span class="value">' + this.shieldValue(action.message) + '</span> to <span class="value">' + action.topic + '</span> topic' + (action.retain ? ' <span class="value">retained</span>' : '');
                break;

            case 'state':
                data = (action.value || action.value == false ? 'set' : 'remove') + ' <span class="value">' + action.name + '</span>' + (action.value || action.value == false ? ' to <span class="value">' + this.shieldValue(action.value) + '</span>' : '');
                break;

            case 'telegram':
                data = (action.file ? '[file]' : '<span class="value">' + this.shieldValue(action.message) + '</span>') + (action.chats ? ' to <span class="value">' + action.chats.join(', ') + '</span>': '');
                break;

            case 'shell':
                data = '<span class="value">' + this.shieldValue(action.command) + '</span>';
                break;

            case 'condition':
            case 'exit':
                data = action.triggerName ? '' : '<span class="shade"><i>any trigger</i></span>';
                break;

            case 'delay':
                data = '<span class="value">' + this.shieldValue(action.delay) + '</span> seconds';
                break;
        }

        if (action.triggerName)
            data += ' when trigger is <span class="value">' + action.triggerName + '</span>';

        if (action.silent)
            data += ' <span class="shade">[silent]</span>';

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

    conditionList(automation, list, table, level = 0, colSpan = 0)
    {
        if (!list?.length && level)
            list = new Array(new Object());

        list?.forEach((condition, index) =>
        {
            let row = table.insertRow();

            for (let i = 0; i < 3; i++)
            {
                let cell = row.insertCell();

                switch (i)
                {
                    case 0:
                        for (let j = 0; j < level; j++) cell.innerHTML += '<span class="tiny ' + (j < level - 1 ? 'shade' : 'warning') + ' "><i class="icon-enter"></i></span> ';
                        cell.innerHTML += ['AND', 'OR', 'NOT'].includes(condition.type) ? '<span class="value">' + condition.type + '</span>' : condition.type ?? '<span class="shade"><i>no conditions</i></span>';
                        break;

                    case 1:

                        if (!condition.type)
                            break;

                        if (colSpan)
                            cell.colSpan = colSpan;

                        if (['AND', 'OR', 'NOT'].includes(condition.type))
                        {
                            cell.innerHTML = '<div class="dropdown"><i class="icon-plus"></i></div>';
                            cell.classList.add('right');
                            addDropdown(cell.querySelector('.dropdown'), automation.conditionType, function(type) { automation.conditionDropdown(automation, condition.conditions, type); }, 7);
                            automation.conditionList(automation, condition.conditions, table, level + 1, colSpan);
                            break;
                        }

                        cell.innerHTML = automation.conditionInfo(condition) ?? '<i>undefined</i>';
                        cell.classList.add('edit');
                        cell.addEventListener('click', function() { automation.showCondition(condition, list); });
                        break;

                    case 2:

                        if (!condition.type)
                            break;

                        cell.innerHTML = '<i class="icon-trash"></i>';
                        cell.classList.add('remove', 'right');
                        cell.addEventListener('click', function() { list.splice(index, 1); automation.showAutomationInfo(); });
                        break;
                }
            }
        });
    }

    actionList(automation, list, table, level = 0)
    {
        let condition = false;

        if (!list?.length && level)
            list = new Array(new Object());

        list?.forEach((action, index) =>
        {
            let row = table.insertRow();

            for (let i = 0; i < 5; i++)
            {
                let cell = row.insertCell();

                if (!level && (condition || (index && action.type == 'condition')))
                    cell.classList.add('edge');

                switch (i)
                {
                    case 0:
                        for (let j = 0; j < level; j++) cell.innerHTML += '<span class="tiny ' + (j < level - 1 ? 'shade' : 'warning') + '"><i class="icon-enter"></i></span> ';
                        cell.innerHTML += action.type == 'condition' ? '<span class="value">CONDITION</span>' : action.type ?? '<span class="shade"><i>do nothing</i></span>';
                        break;

                    case 1:

                        if (!action.type)
                            break;

                        cell.innerHTML = automation.actionInfo(action) ?? '<i>undefined</i>';
                        cell.classList.add('edit');
                        cell.addEventListener('click', function() { automation.showAction(action, list); });

                        if (action.type != 'condition')
                            break;

                        for (let j = 0; j < (action.hideElse && !action.else.length ? 2 : 3); j++)
                        {
                            let actionRow = table.insertRow();
                            let nameCell = actionRow.insertCell();
                            let actionCell = actionRow.insertCell();

                            for (let k = 0; k <= level - 1; k++)
                                nameCell.innerHTML += '<span class="tiny ' + (k < level ? 'shade' : 'warning') + '"><i class="icon-enter"></i></span> ';

                            nameCell.colSpan = 4;
                            actionCell.innerHTML = '<div class="dropdown"><i class="icon-plus"></i></div>';

                            switch (j)
                            {
                                case 0:
                                    nameCell.innerHTML += '<span class="value">IF</span> <span class="value">' + action.conditionType + '</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.conditionType, function(type) { automation.conditionDropdown(automation, action.conditions, type); }, 7);
                                    automation.conditionList(automation, action.conditions, table, level + 1, 3);
                                    break;

                                case 1:
                                    nameCell.innerHTML += '<span class="value">THEN</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.actionType, function(type) { automation.showAction({type: type}, action.then, true); }, 5);
                                    automation.actionList(automation, action.then, table, level + 1);
                                    break;

                                case 2:
                                    nameCell.innerHTML += '<span class="value">ELSE</span>';
                                    addDropdown(actionCell.querySelector('.dropdown'), automation.actionType, function(type) { automation.showAction({type: type}, action.else, true); }, 5);
                                    automation.actionList(automation, action.else, table, level + 1);
                                    break;
                            }
                        }

                        break;

                    case 2:

                        if (!action.type || list.length < 2 || index == list.length - 1)
                            break;

                        cell.innerHTML = '<i class="icon-down"></i>';
                        cell.classList.add('move');
                        cell.addEventListener('click', function() { list[index + 1] = list.splice(index, 1, list[index + 1])[0]; automation.showAutomationInfo(); });
                        break;

                    case 3:

                        if (!action.type || list.length < 2 || !index)
                            break;

                        cell.innerHTML = '<i class="icon-up"></i>';
                        cell.classList.add('move');
                        cell.addEventListener('click', function() { list[index - 1] = list.splice(index, 1, list[index - 1])[0]; automation.showAutomationInfo(); });
                        break;

                    case 4:

                        if (!action.type)
                            break;

                        cell.innerHTML = '<i class="icon-trash"></i>';
                        cell.classList.add('remove');
                        cell.addEventListener('click', function() { list.splice(index, 1); automation.showAutomationInfo(); });
                        break;
                }
            }

            condition = action.type == 'condition' ? true : false;
        });
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split('=') : new Array();
        let automation;

        menu.innerHTML  = '<span id="states"><i class="icon-settings"></i> States</span>';
        menu.innerHTML += '<span id="list"><i class="icon-list"></i> List</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';
        menu.innerHTML += '<span id="import" class="mobileHidden"><i class="icon-upload"></i> Import</span>';

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

        if (list[0] == 'index')
            automation = this.status.automations?.[list[1]];

        if (automation)
        {
            this.data = structuredClone(automation);
            this.uuid = automation.uuid;
            this.showAutomationInfo(false);
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

                row.addEventListener('click', function() { this.controller.showPage(this.service + '?index=' + index); }.bind(this));
                row.dataset.index = index;

                if (!item.active)
                    row.classList.add('inactive');

                for (let i = 0; i < 5; i++)
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

                        case 1: cell.innerHTML = '<span class="value">' + item.triggers.length + '</span>'; cell.classList.add('center'); break;
                        case 2: cell.innerHTML = item.conditions.length ? '<span class="value">' + item.conditions.length + '</span>' : empty; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = '<span class="value">' + item.actions.length + '</span>'; cell.classList.add('center'); break;
                        case 4: cell.innerHTML = empty; cell.classList.add('lastTriggered', 'right'); break;
                    }
                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { let once = cell.classList.contains('once'); sortTable(table, this.dataset.index, true, once); if (!once) localStorage.setItem('automationSort', this.dataset.index); }));
            sortTable(table, localStorage.getItem('automationSort') ?? 0);
            addTableSearch(table, 'automations', 'automation', 6);
        });
    }

    showAutomationInfo(updated = true, add = false)
    {
        loadHTML('html/automation/automationInfo.html', this, this.content, function()
        {
            let triggers;
            let conditions;
            let actions;

            if (updated)
            {
                this.content.querySelector('.save').classList.add('warning');
                this.updated = true;
            }

            if (add)
            {
                this.data = {active: true, triggers: new Array(), conditions: new Array(), actions: new Array()};
                delete this.uuid;
            }

            if (this.uuid)
            {
                let automations = new Array();
                let list = new Array();
                let current;

                this.status.automations.forEach((automation, index) => { automations.push([index, automation.name.toLowerCase()]); });

                automations.sort(function(a, b) { return a[1] < b[1] ? -1 : 1; }).forEach((item, index) =>
                {
                    if (this.data.name.toLowerCase() == item[1])
                        current = index;

                    list.push(item[0]);
                });

                handleArrowButtons(this.content, list, current, function(index) { this.controller.showPage(this.service + '?index=' + index); }.bind(this));
            }
            else
            {
                this.content.querySelector('.remove').style.display = 'none';
                this.content.querySelector('.copy').style.display = 'none';
                this.content.querySelector('.export').style.display = 'none';
                this.content.querySelector('.previous').style.display = 'none';
                this.content.querySelector('.next').style.display = 'none';
            }

            if (!this.data.name)
                this.data.name = 'Automation ' + randomString(4);

            this.content.querySelector('.edit').addEventListener('click', function() { this.showAutomationEdit(); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showAutomationRemove(); }.bind(this));
            this.content.querySelector('.save').addEventListener('click', function() { this.controller.socket.publish('command/' + this.service, {action: 'updateAutomation', automation: this.uuid, data: this.data}); }.bind(this));
            this.content.querySelector('.copy').addEventListener('click', function() { delete this.data.active; this.data.name += ' (copy)'; delete this.uuid; this.showAutomationInfo(); }.bind(this));

            this.content.querySelector('.export').addEventListener('click', function()
            {
                let data = structuredClone(this.data);
                let item = document.createElement("a");

                delete data.active;
                delete data.lastTriggered;
                delete data.name;
                delete data.uuid;

                item.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
                item.download = this.data.name + '.json';
                item.click();

            }.bind(this));

            this.content.querySelector('.name').innerHTML = this.data.name + (this.uuid ? '' : ' <span class="value warning">NEW</span>');
            this.content.querySelector('.note').innerHTML = this.data.note ?? '';
            this.content.querySelector('.mode').innerHTML = '<span class="value">' + this.data.mode + '</span>';
            this.content.querySelector('.debounce').innerHTML = '<span class="value">' + (this.data.debounce ?? 0) + '</span> seconds';
            this.content.querySelector('.active').innerHTML = this.data.active ? '<i class="icon-true success"></i>' : '<i class="icon-false shade"></i>';

            triggers = this.content.querySelector('.triggers');
            conditions = this.content.querySelector('.conditions');
            actions = this.content.querySelector('.actions');

            addDropdown(this.content.querySelector('.addTrigger'), this.triggerType, function(type) { this.showTrigger({type: type}, true); }.bind(this));
            addDropdown(this.content.querySelector('.addCondition'), this.conditionType, function(type) { this.conditionDropdown(this, this.data.conditions, type); }.bind(this), 7);
            addDropdown(this.content.querySelector('.addAction'), this.actionType, function(type) { this.showAction({type: type}, this.data.actions, true); }.bind(this), 5);

            this.data.triggers.forEach((trigger, index) =>
            {
                let row = triggers.insertRow();

                for (let i = 0; i < 3; i++)
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
                            cell.innerHTML = '<i class="icon-trash"></i>';
                            cell.classList.add('remove');
                            cell.addEventListener('click', function() { this.data.triggers.splice(index, 1); this.showAutomationInfo(); }.bind(this));
                            break;
                    }
                }
            });

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
            modal.querySelector('input[name="active"]').checked = this.data.active;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                this.data.name = form.name;
                this.data.note = form.note;
                this.data.mode = form.mode;
                this.data.debounce = form.debounce;
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
            case 'telegram':  this.showTelegramAction(action, list, append); break;
            case 'shell':     this.showShellAction(action, list, append); break;
            case 'condition': this.showConditionAction(action, list, append); break;
            case 'delay':     this.showDelayAction(action, list, append); break;
            case 'exit':      this.showExitAction(action, list, append); break;
        }
    }

    showPropertyItem(item, list, statements, append, type)
    {
        loadHTML('html/automation/propertyItem.html', this, modal.querySelector('.data'), function()
        {
            let properties = this.controller.propertiesList(type != 'trigger');
            let data;

            modal.querySelector('.name').innerHTML = 'Property ' + type;
            modal.querySelector('.property').innerHTML = append ? 'Select property there <i class="icon-right"></i>' : this.itemProperty(item, true);

            addDropdown(modal.querySelector('.dropdown'), Object.keys(properties), function(key)
            {
                data = properties[key];
                modal.querySelector('.property').innerHTML = this.itemProperty(data, true);
                modal.querySelector('.property').classList.remove('error');

            }.bind(this));

            statements.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = this.statementString(statement);
                option.value = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!item.hasOwnProperty(statement))
                    return;

                modal.querySelector('select[name="statement"]').value = statement;

                if (this.isArrayStatement(statement))
                {
                    modal.querySelector('input[name="min"]').value = item[statement][0];
                    modal.querySelector('input[name="max"]').value = item[statement][1];
                }
                else
                    modal.querySelector('textarea[name="value"]').value = statement != 'updates' ? item[statement] : '';

                this.valueForm(modal, statement);
            });

            modal.querySelector('#value.dropdown').style.display = type == 'trigger' ? 'none' : 'inline';

            modal.querySelector('.triggerName').style.display = type == 'condition' ? 'none' : 'block';
            modal.querySelector('input[name="triggerName"]').value = (type == 'trigger' ? item.name : item.triggerName) ?? '';

            modal.querySelector('.force').style.display = type != 'trigger' ? 'none' : 'block';
            modal.querySelector('input[name="force"]').checked = item.force ?? false;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (data)
                {
                    item.endpoint = data.endpoint;
                    item.property = data.property;
                }

                if (!item.endpoint || !item.property)
                {
                    modal.querySelector('.property').classList.add('error');
                    return;
                }

                statements.forEach(statement => delete item[statement]);
                item[form.statement] = this.isArrayStatement(form.statement) ? [this.parseValue(form.min), this.parseValue(form.max)] : form.statement != 'updates' ? this.parseValue(form.value) : true;

                if (form.triggerName)
                    item[type == 'trigger' ? 'name' : 'triggerName'] = form.triggerName;
                else
                    delete item[type == 'trigger' ? 'name' : 'triggerName'];

                if (form.force && type == 'trigger')
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
            showModal(true);
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

                if (this.isArrayStatement(statement))
                {
                    modal.querySelector('input[name="min"]').value = item[statement][0];
                    modal.querySelector('input[name="max"]').value = item[statement][1];
                }
                else
                    modal.querySelector('textarea[name="value"]').value = statement != 'updates' ? item[statement] : '';

                this.valueForm(modal, statement);
            });

            modal.querySelector('#value.dropdown').style.display = type == 'trigger' ? 'none' : 'inline';

            modal.querySelector('.triggerName').style.display = type == 'condition' ? 'none' : 'block';
            modal.querySelector('input[name="triggerName"]').value = (type == 'trigger' ? item.name : item.triggerName) ?? '';

            modal.querySelector('.force').style.display = type != 'trigger' ? 'none' : 'block';
            modal.querySelector('input[name="force"]').checked = item.force ?? false;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                statements.forEach(statement => delete item[statement]);

                item.topic = form.topic;
                item.property = form.property;
                item[form.statement] = this.isArrayStatement(form.statement) ? [this.parseValue(form.min), this.parseValue(form.max)] : form.statement != 'updates' ? this.parseValue(form.value) : true;

                if (form.triggerName)
                    item[type == 'trigger' ? 'name' : 'triggerName'] = form.triggerName;
                else
                    delete item[type == 'trigger' ? 'name' : 'triggerName'];

                if (form.force && type == 'trigger')
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
            showModal(true, 'input[name="topic"]');
        });
    }

    showTelegramTrigger(trigger, append)
    {
        loadHTML('html/automation/telegramTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="message"]').value = trigger.message ?? '';
            modal.querySelector('input[name="chats"]').value = trigger.chats ? trigger.chats.join(', ') : '';
            modal.querySelector('input[name="name"]').value = trigger.name ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let chats = form.chats ? form.chats.split(',').map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                trigger.message = form.message.trim();
                trigger.chats = chats.length ? chats : null;

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
            showModal(true, 'textarea[name="message"]');
        });
    }

    showTimeTrigger(trigger, append)
    {
        loadHTML('html/automation/timeTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="time"]').value = trigger.time ?? '12:00';
            modal.querySelector('input[name="name"]').value = trigger.name ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                trigger.time = form.time;

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
            showModal(true, 'input[name="time"]');
        });
    }

    showIntervalTrigger(trigger, append)
    {
        loadHTML('html/automation/intervalTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="interval"]').value = trigger.interval ?? 10;
            modal.querySelector('input[name="offset"]').value = trigger.offset ?? 0;
            modal.querySelector('input[name="name"]').value = trigger.name ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                trigger.interval = form.interval;
                trigger.offset = form.offset;

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
            showModal(true, 'input[name="interval"]');
        });
    }

    showStartupTrigger(trigger, append)
    {
        loadHTML('html/automation/startupTrigger.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="name"]').value = trigger.name ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

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
            showModal(true, 'input[name="name"]');
        });
    }

    showStatePatternCondition(condition, list, append, type)
    {
        loadHTML('html/automation/' + type + 'Condition.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector(type == 'state' ? 'input[name="name"]' : 'textarea[name="pattern"]').value = condition[type == 'state' ? 'name' : 'pattern'] ?? '';

            this.conditionStatement.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = this.statementString(statement);
                option.value = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!condition.hasOwnProperty(statement))
                    return;

                    modal.querySelector('select[name="statement"]').value = statement;

                if (this.isArrayStatement(statement))
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

                this.conditionStatement.forEach(statement => delete condition[statement]);

                condition[item] = form[item];
                condition[form.statement] = this.isArrayStatement(form.statement) ? [this.parseValue(form.min), this.parseValue(form.max)] : this.parseValue(form.value);

                if (append)
                    list.push(condition);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(condition, this.data.conditions, append);
            showModal(true, type == 'state' ? 'input[name="name"]' : 'textarea[name="pattern"]');
        });
    }

    showDateTimeCondition(condition, list, append, type)
    {
        loadHTML('html/automation/' + type + 'Condition.html', this, modal.querySelector('.data'), function()
        {
            this.conditionStatement.forEach(statement =>
            {
                let option = document.createElement('option');

                option.innerHTML = this.statementString(statement);
                option.value = statement;
                modal.querySelector('select[name="statement"]').append(option);

                if (!condition.hasOwnProperty(statement))
                    return;

                modal.querySelector('select[name="statement"]').value = statement;

                if (this.isArrayStatement(statement))
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

                this.conditionStatement.forEach(statement => delete condition[statement]);
                condition[form.statement] = this.isArrayStatement(form.statement) ? [form.start, form.end] : form.value;

                if (append)
                    list.push(condition);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('select[name="statement"]').addEventListener('change', function(event) { this.valueForm(modal, event.target.value); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(condition, this.data.conditions, append);
            showModal(true, 'input[name="value"]');
        });
    }

    showWeekCondition(condition, list, append)
    {
        loadHTML('html/automation/weekCondition.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="days"]').value = condition.days ? condition.days.join(', ') : '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let days = form.days ? form.days.split(',').map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                condition.days = days.length ? days : null;

                if (append)
                    list.push(condition);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(condition, this.data.conditions, append);
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

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.topic = form.topic;
                action.message = form.message.trim();
                action.retain = form.retain;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'input[name="topic"]');
        });
    }

    showStateAction(action, list, append)
    {
        loadHTML('html/automation/stateAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="name"]').value = action.name ?? '';
            modal.querySelector('textarea[name="value"]').value = action.value ?? '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.name = form.name;
                action.value = this.parseValue(form.value);

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'input[name="name"]');
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
            modal.querySelector('input[name="silent"]').checked = action.silent ?? false;

            modal.querySelector('input[name="remove"]').checked = action.remove ?? false;
            modal.querySelector('input[name="remove"]').addEventListener('click', function() { modal.querySelector('input[name="update"]').checked = false });

            modal.querySelector('input[name="update"]').checked = action.update ?? false;
            modal.querySelector('input[name="update"]').addEventListener('click', function() { modal.querySelector('input[name="remove"]').checked = false });

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let chats = form.chats ? form.chats.split(',').map(item => parseInt(item)).filter(item => !isNaN(item)) : new Array();

                action.message = form.message.trim();
                action.file = form.file.trim();
                action.keyboard = form.keyboard.trim();
                action.chats = chats.length ? chats : null;
                action.silent = form.silent;
                action.remove = form.remove;
                action.update = form.update;

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

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'textarea[name="message"]');
        });
    }

    showShellAction(action, list, append)
    {
        loadHTML('html/automation/shellAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="command"]').value = action.command ?? '';
            modal.querySelector('input[name="timeout"]').value = action.timeout ?? 30;
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.command = form.command.trim();
                action.timeout = form.timeout;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'textarea[name="command"]');
        });
    }

    showConditionAction(action, list, append)
    {
        loadHTML('html/automation/conditionAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('select[name="conditionType"]').value = action.conditionType ?? 'AND';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';
            modal.querySelector('input[name="hideElse"]').checked = action.hideElse;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.conditionType = form.conditionType;
                action.hideElse = form.hideElse;

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

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'input[name="triggerName"]');
        });
    }

    showDelayAction(action, list, append)
    {
        loadHTML('html/automation/delayAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('textarea[name="delay"]').value = action.delay ?? '';
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                action.delay = form.delay;

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
            showModal(true, 'textarea[name="delay"]');
        });
    }

    showExitAction(action, list, append)
    {
        loadHTML('html/automation/exitAction.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('input[name="triggerName"]').value = action.triggerName ?? '';

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (form.triggerName)
                    action.triggerName = form.triggerName;
                else
                    delete action.triggerName;

                if (append)
                    list.push(action);

                this.showAutomationInfo();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.handleCopy(action, this.data.actions, append);
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
