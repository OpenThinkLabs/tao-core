/**
 * GenerisTreeClass is a easy to use container for the tree widget, 
 * it provides the common behavior for a Class/Instance Rdf resource tree
 * 
 * @example new GenerisTreeClass('#tree-container', 'myData.php', {});
 * @see GenerisTreeClass.defaultOptions for options example
 * 
 * @require jquery >= 1.3.2 [http://jquery.com/]
 * @require jstree >= 0.9.9 [http://jstree.com/]
 * 
 * @author Bertrand Chevrier, <chevrier.bertrand@gmail.com>
 */ 

GenerisTreeClass.instances = [];

/**
 * Constructor
 * @param {String} selector the jquery selector of the tree container
 * @param {String} dataUrl the url to call, it must provide the json data to populate the tree 
 * @param {Object} options
 */
function GenerisTreeClass(selector, dataUrl, options){
	try{
		if(!options){
			options = GenerisTreeClass.defaultOptions;
		}
		this.selector = selector;
		this.options = options;
		this.dataUrl = dataUrl;
		var instance = this;
		
		if(!options.instanceName){
			options.instanceName = 'instance';
		}
		
		GenerisTreeClass.instances[GenerisTreeClass.instances.length + 1] = instance;
		
		this.treeOptions = {
			data: {
				type: "json",
				async : true,
				opts: {
					method : "POST",
					url: instance.dataUrl
				}
			},
			types: {
			 "default" : {
					renameable	: false,
					deletable	: true,
					creatable	: true,
					draggable	: false
				}
			},
			ui: {
				theme_name : "custom"
			},
			callback : {
				beforedata:function(NODE, TREE_OBJ) { 
					return { 
						type : $(TREE_OBJ.container).attr('id'),
						filter: $("#filter-content-" + options.actionId).val()
					} 
				},
				onload: function(TREE_OBJ){
					TREE_OBJ.open_branch($("li.node-class:first"));
				},
				ondata: function(DATA, TREE_OBJ){
					if(instance.options.instanceClass){
						if(DATA.children){
							function addClassToNodes(nodes, clazz){
								$.each(nodes, function(i, node){
									if(node.attributes['class'] == 'node-instance'){
										node.attributes['class'] = 'node-instance ' + clazz;
									}
									if(node.children){
										addClassToNodes(node.children, clazz);
									}
								});
							}
							addClassToNodes(DATA.children, instance.options.instanceClass);
						}
					}
					return DATA;
				},
				onselect: function(NODE, TREE_OBJ){
					
					if($(NODE).hasClass('node-class') && instance.options.editClassAction){
						_load(instance.options.formContainer, 
							instance.options.editClassAction,
							{classUri:$(NODE).attr('id')}
						);
					}
					if($(NODE).hasClass('node-instance') && instance.options.editInstanceAction){
						PNODE = TREE_OBJ.parent(NODE);
						_load(instance.options.formContainer, 
							instance.options.editInstanceAction, 
							{classUri: $(PNODE).attr('id'),  uri: $(NODE).attr('id')}
						);
					}
					return false;
				}
			},
			plugins: {
				contextmenu : {
					items : {
						select: {
							label: "Edit",
							icon: "/tao/views/img/pencil.png",
							visible : function (NODE, TREE_OBJ) {
								if( ($(NODE).hasClass('node-instance') &&  instance.options.editInstanceAction)  || 
									($(NODE).hasClass('node-class') &&  instance.options.editClassAction) ){
									return true;
								}
								return false;
							},
							action  : function(NODE, TREE_OBJ){
								TREE_OBJ.select_branch(NODE);
							},
		                    separator_before : true
						},
						subclass: {
							label: "Add subclass",
							icon	: "/tao/views/img/class_add.png",
							visible: function (NODE, TREE_OBJ) {
								if(NODE.length != 1) {
									return false; 
								}
								if(!$(NODE).hasClass('node-class') || !instance.options.subClassAction){ 
									return false;
								}
								return TREE_OBJ.check("creatable", NODE);
							},
							action  : function(NODE, TREE_OBJ){
								GenerisTreeClass.addClass({
									id: $(NODE).attr('id'),
									url: instance.options.subClassAction,
									NODE: NODE,
									TREE_OBJ: TREE_OBJ
								});
							},
		                    separator_before : true
						},
						instance:{
							label: "Add " + instance.options.instanceName,
							icon	: "/tao/views/img/instance_add.png",
							visible: function (NODE, TREE_OBJ) {
								if(NODE.length != 1) {
									return false; 
								}
								if(!$(NODE).hasClass('node-class') || !instance.options.createInstanceAction){ 
									return false;
								}
								return TREE_OBJ.check("creatable", NODE);
							},
							action: function (NODE, TREE_OBJ) { 
								GenerisTreeClass.addInstance({
									url: instance.options.createInstanceAction,
									id: $(NODE).attr('id'),
									NODE: NODE,
									TREE_OBJ: TREE_OBJ,
									cssClass: instance.options.instanceClass
								});
							}
						},
						duplicate:{
							label	: "Duplicate",
							icon	: "/tao/views/img/duplicate.png",
							visible	: function (NODE, TREE_OBJ) { 
									if($(NODE).hasClass('node-instance')  && instance.options.duplicateAction){
										return true;
									}
									return false;
								}, 
							action	: function (NODE, TREE_OBJ) { 
								GenerisTreeClass.cloneNode({
									url: instance.options.duplicateAction,
									NODE: NODE,
									TREE_OBJ: TREE_OBJ
								});
							}
						},
						del:{
							label	: "Remove",
							icon	: "/tao/views/img/delete.png",
							visible	: function (NODE, TREE_OBJ) { 
								var ok = true; 
								$.each(NODE, function () { 
									if(TREE_OBJ.check("deletable", this) == false || !instance.options.deleteAction) 
										ok = false; 
										return false; 
									}); 
									return ok; 
								}, 
							action	: function (NODE, TREE_OBJ) { 
								GenerisTreeClass.removeNode({
									url: instance.options.deleteAction,
									NODE: NODE,
									TREE_OBJ: TREE_OBJ
								});
								return false;
							} 
						},
						remove: false,
						create: false,
						rename: false
					}
				}
			}
		};
		
		//create the tree
		$(selector).tree(this.treeOptions);
		
		$("#open-action-" + options.actionId).click(function(){
			$.tree.reference(instance.selector).open_all();
		});
		$("#close-action-" + options.actionId).click(function(){
			$.tree.reference(instance.selector).close_all();
		});
		
		$("#filter-action-" + options.actionId).click(function(){
			$.tree.reference(instance.selector).refresh();
		});
		$("#filter-content-" + options.actionId).bind('keypress', function(e) {
	        if(e.keyCode==13 && this.value.length > 0){
				$.tree.reference(instance.selector).refresh();
	        }
		});

	}
	catch(exp){
		//console.log(exp);
	}
}

/**
 * @return {Object} the tree instance
 */
GenerisTreeClass.prototype.getTree = function(){
	return $.tree.reference(this.selector);
}

/**
 * @var GenerisTreeClass.defaultOptions is an example of options to provide to the tree
 */
GenerisTreeClass.defaultOptions = {
	formContainer: '#form-container'
};

/**
 * select a node in the current tree
 * @param {String} id
 * @return {Boolean}
 */
GenerisTreeClass.selectTreeNode = function(id){
	i=0;
	while(i < GenerisTreeClass.instances.length){
		aGenerisTree = GenerisTreeClass.instances[i];
		if(aGenerisTree){
			aJsTree = aGenerisTree.getTree();
			if(aJsTree){
				if(aJsTree.select_branch($("li[id='"+id+"']"))){
					return true;
				}
			}
		}
		i++;
	}
	return false;
}

/**
 * Enable you to retrieve the right tree instance and node instance from an Uri
 * @param {String} uri is the id of the tree node
 * @return {Object}
 */
function getTreeOptions(uri){
	if (uri) {
		i = 0;
		while (i < GenerisTreeClass.instances.length) {
			aGenerisTree = GenerisTreeClass.instances[i];
			if (aGenerisTree) {
				aJsTree = aGenerisTree.getTree();
				if (aJsTree) {
					if (aJsTree.get_node($("li[id='" + uri + "']"))) {
						return {
							NODE: aJsTree.get_node($("li[id='" + uri + "']")),
							TREE_OBJ: aJsTree
						};
					}
				}
			}
			i++;
		}
	}
	return false;
}

/**
 * Sub class action
 * @param {Object} options
 */
GenerisTreeClass.addClass = function(options){
	var TREE_OBJ = options.TREE_OBJ;
	var NODE = options.NODE;
	$.ajax({
		url: options.url,
		type: "POST",
		data: {classUri: options.id, type: 'class'},
		dataType: 'json',
		success: function(response){
			if(response.uri){
				TREE_OBJ.select_branch(
					TREE_OBJ.create({
						data: response.label,
						attributes: {
							id: response.uri,
							'class': 'node-class'
						}
					}, TREE_OBJ.get_node(NODE[0])));
			}
		}
	});
}

/**
 * conveniance method to subclass
 * @param {String} uri
 * @param {String} classUri
 * @param {String} url
 */
function subClass(uri, classUri, url){
	var options = getTreeOptions(classUri);
	if(options){
		options.id = classUri;
		options.url = url;
		GenerisTreeClass.addClass(options);
	}
}

/**
 * add an instance
 * @param {Object} options
 */
GenerisTreeClass.addInstance = function(options){
	var TREE_OBJ = options.TREE_OBJ;
	var NODE = options.NODE;
	var  cssClass = 'node-instance';
	if(options.cssClass){
		 cssClass += ' ' + options.cssClass;
	}
	
	$.ajax({
		url: options.url,
		type: "POST",
		data: {classUri: options.id, type: 'instance'},
		dataType: 'json',
		success: function(response){
			if (response.uri) {
				TREE_OBJ.select_branch(TREE_OBJ.create({
					data: response.label,
					attributes: {
						id: response.uri,
						'class': cssClass
					}
				}, TREE_OBJ.get_node(NODE[0])));
			}
		}
	});
}

/**
 * conveniance method to instanciate
 * @param {String} uri
 * @param {String} classUri
 * @param {String} url
 */
function instanciate(uri, classUri, url){
	var options = getTreeOptions(classUri);
	if(options){
		options.id = classUri;
		options.url = url;
		GenerisTreeClass.addInstance(options);
	}
}

/**
 * remove a resource
 * @param {Object} options
 */
GenerisTreeClass.removeNode = function(options){
	var TREE_OBJ = options.TREE_OBJ;
	var NODE = options.NODE;
	if(confirm("Please confirm deletion")){
		$.each(NODE, function () { 
			data = false;
			var selectedNode = this;
			if($(selectedNode).hasClass('node-class')){
				data =  {classUri: $(selectedNode).attr('id')}
			}
			if($(selectedNode).hasClass('node-instance')){
				PNODE = TREE_OBJ.parent(selectedNode);
				data =  {uri: $(selectedNode).attr('id'), classUri: $(PNODE).attr('id')}
			}
			if(data){
				$.ajax({
					url: options.url,
					type: "POST",
					data: data,
					dataType: 'json',
					success: function(response){
						if(response.deleted){
							TREE_OBJ.remove(selectedNode); 
						}
					}
				});
			}
		}); 
	}
}

/**
 * conveniance method to instanciate
 * @param {String} uri
 * @param {String} classUri
 * @param {String} url
 */
function removeNode(uri, classUri, url){
	var options = getTreeOptions(uri);
	if(!options){
		options = getTreeOptions(classUri);
	}
	if(options){
		options.url = url;
		GenerisTreeClass.removeNode(options);
	}
}

/**
 * clone a resource
 * @param {Object} options
 */
GenerisTreeClass.cloneNode = function(options){
	var TREE_OBJ = options.TREE_OBJ;
	var NODE = options.NODE;
	var PNODE = TREE_OBJ.parent(NODE);
	$.ajax({
		url: options.url,
		type: "POST",
		data: {classUri: $(PNODE).attr('id'), uri: $(NODE).attr('id')},
		dataType: 'json',
		success: function(response){
			if(response.uri){
				TREE_OBJ.select_branch(
					TREE_OBJ.create({
						data: response.label,
						attributes: {
							id: response.uri,
							'class': 'node-instance'
						}
					},
					TREE_OBJ.get_node(PNODE)
					)
				);
			}
		}
	});
}

/**
 * conveniance method to clone
 * @param {String} uri
 * @param {String} classUri
 * @param {String} url
 */
function duplicateNode(uri, classUri, url){
	console.log('test');
	var options = getTreeOptions(uri);
	console.log(options);
	if(options){
		options.url = url;
		GenerisTreeClass.cloneNode(options);
	}
}

/**
 * Rename a node
 * @param {Object} options
 */
GenerisTreeClass.renameNode = function(options){
	var TREE_OBJ = options.TREE_OBJ;
	var NODE = options.NODE;
	$.ajax({
		url: options.url,
		type: "POST",
		data: {uri: $(NODE).attr('id'), newName: TREE_OBJ.get_text(NODE)},
		dataType: 'json',
		success: function(response){
			if(!response.renamed){
				TREE_OBJ.rename(NODE, response.oldName);	
			}
		}
	});
}

/**
 * Open a popup
 * @param {String} uri
 * @param {String} classUri
 * @param {String} url
 */
function fullScreen(uri, classUri, url){
	url += '?uri='+uri+'&classUri='+classUri;
	window.open(url, 'tao', 'width=800,height=600,menubar=no,toolbar=no');
}

/**
 * Add a new property
 * @param {String} uri
 * @param {String} classUri
 * @param {String} url
 */
function addProperty(uri, classUri, url){
	var index = ($(".form-group").size() - 1);
	$.ajax({
		url: url,
		type: "POST",
		data: {
			index: index,
			classUri: classUri
		},
		dataType: 'html',
		success: function(response){
			$("#property_actions").before(response);
			formGroupElt = $("#property_" + index);
			if(formGroupElt){
				formGroupElt.addClass('form-group-opened');
			}
			initNavigation();
			window.location = '#propertyAdder';
		}
	});
}

/**
 * Load the result table with the tree instances in parameter
 * @param {String} uri
 * @param {String} classUri
 * @param {String} url
 */
function resultTable(uri, classUri, url){
	options = getTreeOptions(classUri);
	TREE_OBJ = options.TREE_OBJ;
	NODE = options.NODE;
	
	function getInstances(TREE_OBJ, NODE){
		NODES = new Array();
		$.each(TREE_OBJ.children(NODE), function(i, CNODE){
			if ($(CNODE).hasClass('node-instance')) {
				NODES.push($(CNODE).attr('id'));
			}
			if ($(CNODE).hasClass('node-class')) {
				subNodes = getInstances(TREE_OBJ, CNODE);
				NODES.concat(subNodes);
			}
		});
		return NODES;
	}
	data = {};
	instances = getInstances(TREE_OBJ, NODE);
	i=0;
	while(i< instances.length){
		data['uri_'+i] = instances[i];
		i++;
	}
	data.classUri = classUri;
	_load(getMainContainerSelector(), url, data);
}
