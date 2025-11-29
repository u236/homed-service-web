'use strict';

'require view';
'require fs';
'require ui';
var isReadonlyView=!L.hasViewPermission()||null;
var HOMEdPort=8080;
function getHOMEdPort(configuration){
    var section='';
    configuration.split(/[\r\n]+/).forEach(function(line){
        if(/^\s*([^=;]+?)\s*=\s*(.*?)\s*$/.test(line)){
            var match = line.match(/^\s*([^=;]+?)\s*=\s*(.*?)\s*$/);
            if(section=='server' && match[1]=='port'){
                HOMEdPort = match[2];
            }
        }else if(/^\s*\[\s*([^\]]*)\s*\]\s*$/.test(line)){
            var match = line.match(/^\s*\[\s*([^\]]*)\s*\]\s*$/);
            section = match[1];
        };
    });
}
return view.extend({
    load:function(){
        return L.resolveDefault(fs.read('/etc/homed/homed-web.conf'),'');
    },
    handleSave:function(ev){
        var value=(document.querySelector('textarea').value||'');
        return fs.write('/etc/homed/homed-web.conf',value).then(function(rc){
            document.querySelector('textarea').value=value;
            getHOMEdPort(value);
            document.querySelector('#HomedLink').href= location.protocol+'//'+location.host+':'+HOMEdPort+'/';
            ui.addNotification(null,E('p',_('Configuration have been succesfully saved!')),'info');
        }).catch(function(e){
            ui.addNotification(null,E('p',_('Unable to save configuration: %s').format(e.message)));
        });
    },
    render:function(configuration){
        getHOMEdPort(configuration);
        return E([
            E('h2',_('HOMEd Web Service Configuration')),
            E('p',{'class':'cbi-section-descr'},_('Documentation can be found <a href="https://wiki.homed.dev/web/configuration" target="_blank">here</a>.')),
            HOMEdPort!=0?E('p',{'class':'cbi-section-descr'},_('<a id="HomedLink" href="'+location.protocol+'//'+location.host+':'+HOMEdPort+'/" target="_blank">Go to HOMEd Web</a>.')):E('div'),
            E('p',{},E('textarea',{'style':'width:100%','rows':25,'disabled':isReadonlyView},[configuration!=null?configuration:'']))
        ]);
},
    handleSaveApply:null,
    handleReset:null
});
