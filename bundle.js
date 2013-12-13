;(function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
var pojosync = require('pojosync');
PojoSync = new pojosync.Client(io);

var D = function(tag, contents){
  var el = document.createElement(tag);
  if(contents){
    append(el, contents);
  }
  return el;
};

Spreadsheet = function(rows, columns){
  this.rows = [];
  this.type = 'Sheet';
  for (var i = 0; i < rows; i++) {
    var row = {cols:[], type: 'Row' };
    for(var j =0; j < columns; j++){
      row.cols.push({ type: 'Cell', value: ''});
    }
    this.rows.push(row);
  };
};

var SheetToHtml = function(sheet,table_id){
  var table = document.getElementById(table_id);
  var body = D('tbody');
  var head = D('thead'), headrow = D('tr');
  head.appendChild(headrow);
  table.appendChild(head);
  var width = sheet.rows[0].cols.length;
  var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for(var x=0;x<width;x++){
    var th = D('th');
    th.innerHTML = letters[x];
    headrow.appendChild(th);
  }
  for (var i = 0; i < sheet.rows.length; i++) {
    var row = sheet.rows[i];
    var tr = D('tr');
    for (var j=0;j < row.cols.length; j++) {
      var cell = row.cols[j];
      var td = D('td');
      var inpt = D('input');
      inpt.value = cell.value;
      inpt.id = cell.id;
      inpt.onchange = (function(cell, inpt){
        return function(){
          cell.value = inpt.value;
          PojoSync.put(cell);
        };
      })(cell, inpt);
      td.appendChild(inpt);
      tr.appendChild(td);
    };
    body.appendChild(tr);
    table.appendChild(body);
  };

};

PojoSync.list({id: 'spreadsheet1'}, function(list){
  console.log(list);
  Sheet = list[0] || new Spreadsheet(50,15);
  Sheet.id='spreadsheet1';
  PojoSync.put(Sheet);
  SheetToHtml(Sheet, 'spreadsheet');
  PojoSync.addSocketCallback(function(d){
    console.log("pojosync socket callback", d);
    for(var k in d){
      var el = document.getElementById(k);
      if(el){
        el.value = d[k].value;
      }
    }
  });
});
module.exports = {
 PojoSync: PojoSync,
 Spreadsheet: Spreadsheet
};


},{"pojosync":2}],2:[function(require,module,exports){
module.exports = {
  Client : require('./lib/client.js'),
  Server : require('./lib/server.js'),
  Store  : require('./lib/store.js'),
  Utils  : require('./lib/utils.js') 
};

},{"./lib/client.js":3,"./lib/server.js":4,"./lib/store.js":5,"./lib/utils.js":6}],3:[function(require,module,exports){
var Store = require('./store.js');
var Utils = require('./utils.js');

var Client = function(io){
  var self = this;
  self.lists = [];
  self.socket = io.connect();
  self.Store = new Store();
  self.socket.on('put', function (data) {
    for(var id in data){
      var resource = data[id];
      if(!Utils.resourceIsEmpty(resource)){
        self.Store.unflatten(resource, data);
        self.Store.put(resource);
        self.addToLists(resource);
      } else { 
        self.Store.delete(resource);
        self.removeFromLists(resource);
      }
    }
    self.callSocketCallbacks(data);
  });
  self.socketCallbacks = [];
};

Client.prototype.list = function(params, callback){
  var self = this;
  var list = {filter: params, contents: [] };
  self.lists.push(list);
  self.socket.emit('list', params, function(data){
    console.log("list returns", data);
     self.Store.unflattenAndMerge(data.index);
     for (var i = 0; i < data.ids.length; i++) {
       var id = data.ids[i];
       var resource = self.Store.get(id);
       if(list.contents.indexOf(resource)==-1){
         list.contents.push(resource);
       }
     };
     self.callSocketCallbacks();
     if(callback){
       callback(list.contents);
     }
  });
  return list.contents;
};

Client.prototype.put = function(resource, callback){ 
  var self = this;
  self.Store.put(resource);
  var data = self.Store.flatten(resource);
  for(var id in data){
    self.addToLists(data[id]);
  }
  this.socket.emit('put', data, function(data){
    if(callback){
      callback(data);
    }
    self.callSocketCallbacks(data);
  }); 
  return resource;
};
Client.prototype.delete = function(data, callback){ 
  this.put({id: data.id }, callback);
  this.removeFromLists(data);
};

Client.prototype.addToLists = function(resource){
  var self = this;
  for (var i = 0; i < this.lists.length; i++) {
    var list = this.lists[i];
    var ids = list.contents.map(function(r){ return r.id; });
    if( self.Store.matchesFilter(resource, list.filter) 
        && (ids.indexOf(resource.id) < 0) 
      ){
      list.contents.unshift(resource);
    }
  };
};

Client.prototype.removeFromLists = function(resource){
  var self = this;
  for (var i = 0; i < self.lists.length; i++) {
    var list = self.lists[i];
    for(var j = 0; j < list.contents.length; j++){
      if(list.contents[j].id==resource.id){
        list.contents.splice(j,1);
      }
    }
  };
};

Client.prototype.addSocketCallback = function(fun){
  if(this.socketCallbacks.indexOf(fun) == -1){
    this.socketCallbacks.push(fun);
  }
};

Client.prototype.removeSocketCallback = function(fun){
  var index = this.socketCallbacks.indexOf(fun);
  if(index > -1){
    this.socketCallbacks.splice(index,1);
  }
};

Client.prototype.callSocketCallbacks = function(data){
  for(var i = 0 ; i < this.socketCallbacks.length; i++){
    this.socketCallbacks[i](data);
  }
};

module.exports = Client;

},{"./store.js":5,"./utils.js":6}],4:[function(require,module,exports){
var fs = require('fs');
var Store = require('./store.js');
var Client = require('./client.js');
var Server = function(io){  
  var self = this;
  self.Store = new Store();
  self.lists = [];
  self.readStore();
  self.io = io;
  io.sockets.on('connection', function (socket) {
    console.log("Client connected");
    socket.on('put', function (data, callback) {
      console.log("Server.put", data);
      socket.broadcast.emit('put', data);
      self.Store.unflattenAndPut(data);
      callback();
      self.persistStore();
    });
    socket.on('list', function(params, callback){
      var data = self.Store.list(params);
      console.log("listing ", params, data);
      var ids = data.map(function(r){return r.id});
      var index = self.Store.flatten(data);
      callback({ids: ids, index: index});
    });
  });
};

Server.prototype.put = function(resource){
   var id_ed_resource = this.Store.put(resource);
   this.io.sockets.emit('put', this.Store.flatten(id_ed_resource));
   this.persistStore();
   return id_ed_resource;
};

Server.prototype.list = function(query){
  return this.Store.list(query);
};

Server.prototype.readStore = function(){
  var store_str = fs.readFileSync('livemodel.data.json', {flag: 'a+'});
  if(store_str.length){
    var store = JSON.parse(store_str);
    this.Store.unflattenAndPut(store);
  }
};

Server.prototype.persistStore = function(){
  fs.writeFile('livemodel.data.json', JSON.stringify(this.Store.flattenStore()),
  function (err) {
    if (err) {
      throw err;
    }
  });
};

module.exports = Server;

},{"./client.js":3,"./store.js":5,"fs":7}],5:[function(require,module,exports){
var Utils = require('./utils.js');

var Store = function(){
  this.index = {};
};

Store.prototype.indexResource = function(resource,index){
  var self= this;
  index = index || {};
  if(Array.isArray(resource)){
    for(var i = 0; i < resource.length;i++){
      self.indexResource(resource[i], index);
    }
    return resource;
  } else if(typeof resource=='object' && resource){
    if(resource.id && index[resource.id]){
      return;
    }
    self.assignID(resource);
    index[resource.id]=true;
    if(!self.get(resource.id)){
      self.index[resource.id]=resource;
    }
    for(var p in resource){
      self.indexResource(resource[p], index);
    }
  }
};

Store.prototype.assignID = function(resource){
  if(!resource.hasOwnProperty('id')){
    var now = new Date();
    var epoch = new Date('2013-12-06');
    var letters = "abcdefghijklmnopqrstuvwxyz";
    var id = '';
    for(var i =0;i<4;i++){
      id+= letters.charAt(Math.floor(Math.random() * letters.length));
    }
    resource.id = id + String(now.getTime() - epoch.getTime());
  }
  return resource;
};

Store.prototype.merge = function(resource, replace){
  this.assignID(resource);
  this.indexResource(resource);
  var munge= replace? Utils.replaceResourceContents : Utils.mergeResourceContents;
  munge(this.index[resource.id], resource);
  return this.index[resource.id];
};

Store.prototype.put = function(resource){
  return this.merge(resource, true);
};


Store.prototype.get = function(id){
  return this.index[id];
}

Store.prototype.delete = function(resource){
  delete this.index[resource.id];
};

Store.prototype.listAll = function(){
  var objects = [];
  for(var id in this.index){ 
    if(this.index.hasOwnProperty(id)) {
      objects.push(this.index[id]);
    }
  }
  return objects;

};

Store.prototype.list = function(params){
  var self = this;
  return self.listAll().filter(function(resource){
    return self.matchesFilter(resource, params);
  });
};

Store.prototype.matchesFilter = function(resource, filter){
    for(var k in filter){
      if(!resource.hasOwnProperty(k) || resource[k]!=filter[k]){
        return false;
      }
    }
    return true;
};

Store.prototype.flatten = function(resource, index){
  var self= this;
  var firstCall = index? false : true;
  var index = index ||  {};
  var copy = {};
  if(Array.isArray(resource)){
    copy = [];
    for(var i = 0; i < resource.length;i++){
      copy[i] = self.flatten(resource[i], index);
    }
  } else if(typeof resource=='object' && resource){
    if(resource.id && index[resource.id]){
      return '@'+resource.id;
    }
    index[resource.id] = copy;
    for(var p in resource){
      copy[p] = self.flatten(resource[p], index);
    }
    return firstCall? index : '@'+resource.id;
  } else { //string/boolean/number
    return resource;
  }
  return firstCall? index : copy;
};

Store.prototype.flattenStore = function(){
  var flatIndex = {};
  for(var id in this.index){
    if(this.index.hasOwnProperty(id)){
      this.flatten(this.get(id), flatIndex);
    }
  }
  return flatIndex;
};

Store.prototype.unflattenAndPut = function(data){
  for(var id in data){
    this.unflatten(data[id], data);
    this.put(data[id]);
  }
};

Store.prototype.unflattenAndMerge = function(data){
  for(var id in data){
    this.unflatten(data[id], data);
    this.merge(data[id]);
  }
};

Store.prototype.unflatten = function(resource, index, unflattened){ 
  var self= this
    , unflattened = unflattened || [];
  if(resource && resource.id && unflattened.indexOf(resource.id) != -1){
    return resource;
  } 
  if(typeof(resource)=='string' && resource[0]=='@'){
    var resource_object = index[resource.slice(1)];
    self.unflatten(resource_object, index, unflattened);
    return resource_object;
  } else if(resource && typeof(resource)=='object'){
    unflattened.push(resource.id);
    for(var p in resource){
      switch(typeof(resource[p])){
        case 'object': 
          self.unflatten(resource[p], index, unflattened);
          break;
         default:
          resource[p] = self.unflatten(resource[p],index, unflattened);
          break;
      }
    }
  } else {
    return resource;
  }
};

module.exports = Store;

},{"./utils.js":6}],6:[function(require,module,exports){

var Utils = {

  copyResource: function(resource){
    var clone = {};
    for(var p in resource){
      if(typeof(resource[p]=='object')){
        clone[p]=Utils.copyResource(resource[p]);
      } else {
        clone[p]=resource[p];
      }
    }
    return clone;
  },
  resourceIsEmpty: function(resource){
    var keys = Object.keys(resource);
    return !keys.length || (keys.length==1 && keys[0]=='id');
  },
  replaceResourceContents: function(before,after){ 
    Utils.mergeResourceContents(before,after,true);
    for(var p in before){
      if(!after.hasOwnProperty(p)){
        delete before[p];
      }
    }
  },
  mergeResourceContents: function(before,after,replace){
    if(before==after){ 
      return before; 
    }
    if(!before){ 
      before = after;
      return before;
    }
    for(var p in after){
      if(after.hasOwnProperty(p)){
        switch(typeof after[p]){
          case 'object':
            if(before.hasOwnProperty(p)){
              if(replace){
                Utils.replaceResourceContents(before[p],after[p]);
              } else{
                Utils.mergeResourceContents(before[p],after[p]);
              }
            } else {
             before[p] = after[p];
            }
            break;
          case 'number':
          case 'string':
          case 'boolean':
          default:
            before[p]=after[p];
            break;
        }
      }
    }
  }
};
module.exports = Utils;

},{}],7:[function(require,module,exports){
// nothing to see here... no file methods for the browser

},{}]},{},[1])
;