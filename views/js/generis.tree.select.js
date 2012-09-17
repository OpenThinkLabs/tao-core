/**
 * GenerisTreeSelectClass is an easy to use container for the checkbox tree widget,
 * it provides the common behavior for a selectable Class/Instance Rdf resource tree
 *
 * @example new GenerisTreeClass('#tree-container', 'myData.php', {});
 * @see GenerisTreeClass.defaultOptions for options example
 *
 * @require jquery >= 1.3.2 [http://jquery.com/]
 * @require jstree = 0.9.9 [http://jstree.com/]
 *
 * @author Bertrand Chevrier, <bertrand.chevrier@tudor.lu>
 * @author Jehan Bihin (class)
 */

define(['require', 'jquery', 'generis.tree'], function(req, $, GenerisTreeClass) {
	var GenerisTreeSelectClass = GenerisTreeClass.extend({
		/**
		 * Constructor
		 * @param {String} selector the jquery selector of the tree container
		 * @param {String} dataUrl the url to call, it must provide the json data to populate the tree
		 * @param {Object} options
		 */
		init: function(selector, dataUrl, options) {
			this.checkedNodes = (typeof options.checkedNodes != "undefined") ? options.checkedNodes.slice(0) : new Array ();
			if (options.callback && options.callback.checkPaginate) {
				this.checkPaginate = options.callback.checkPaginate;
			}
			var instance = this;

			/**
			 * Display priority DISPLAY_SELECTED.
			 * Display in priority the previously selected instances ..
			 */
			this.DISPLAY_SELECTED = 1;

			var treeOptions = {
				types: {
					"default" : {
						draggable	: false
					}
				},
				ui: {
					theme_name : "checkbox"
				},
				callback: {
					//before check
					beforecheck: function(NODE, TREE_OBJ) {
						var nodeId = $(NODE).prop('id');

						if (instance.isRefreshing) {
							if ($.inArray(nodeId, instance.checkedNodes) == -1) {
								return false;
							}
						}

						if (NODE.hasClass('node-class')) {
							if (instance.getMeta (nodeId, 'displayed') != instance.getMeta(nodeId, 'count')) {
								instance.paginateInstances(NODE, TREE_OBJ, {limit:0, checkedNodes:"*"});
								return false;
							}
						} else {
							var indice = $.inArray(nodeId, instance.checkedNodes);
							if (indice == -1) {
								instance.checkedNodes.push(nodeId);
							} else {
								// The widget should stop the propagation
								return true;
							}
						}
						return true;
					},
					//before check
					beforeuncheck: function(NODE, TREE_OBJ) {
						var nodeId = $(NODE).prop('id');
						var indice = $.inArray(nodeId, instance.checkedNodes);

						if (NODE.hasClass('node-class')) {
							//
						} else {
							if (indice != -1) {
								instance.checkedNodes.splice(indice,1);
								//delete instance.checkedNodes[indice];
							}
						}

						return true;
					},
					//Before receive data from server, return the POST parameters
					beforedata: function(NODE, TREE_OBJ) {
						var returnValue = instance.defaultServerParameters;
						//If a NODE is given, send its identifier to the server
						if (NODE) {
							returnValue['classUri'] = $(NODE).prop('id');
						}
						//Augment with the serverParameters
						for (var key in instance.serverParameters) {
							if (instance.serverParameters[key] != null) {
								returnValue[key] = instance.serverParameters[key];
							}
						}
						//Augment with the selected nodes
						returnValue['selected'] = instance.checkedNodes;
						return returnValue;
					},
					//
					onopen: function (NODE, TREE_OBJ) {
						if (instance.checkedNodes) {
							instance.check(instance.checkedNodes);
						}
					},
					//
					onload: function(TREE_OBJ) {
						instance.check(instance.checkedNodes);

						if (instance.options.loadCallback) {
							instance.options.loadCallback();
						}

						instance.isRefreshing = false;
					},
					onchange: function(NODE, TREE_OBJ) {
						if (instance.options.onChangeCallback && !instance.isRefreshing) {
							instance.options.onChangeCallback(NODE, TREE_OBJ);
						}
					},
					//when a node is selected
					onselect: function(NODE, TREE_OBJ) {
						if ($(NODE).hasClass('paginate-more')) {
							instance.paginateInstances($(NODE).parent().parent(), TREE_OBJ);
							return;
						}
						if ($(NODE).hasClass('paginate-all')) {
							var parentNodeId = $(NODE).parent().parent().prop('id');
							var limit = instance.getMeta(parentNodeId, 'count') - instance.getMeta(parentNodeId, 'displayed');
							instance.paginateInstances($(NODE).parent().parent(), TREE_OBJ, {'limit': limit});
							return;
						}

						var nodeId = $(NODE).prop('id');

	/*
						var indice = $.inArray(nodeId, instance.checkedNodes);
						if(indice == -1){
	//						console.log('ADD TO VARS 2');
							instance.checkedNodes.push(nodeId);
						}else{
	//						console.log('DEL TO VARS 2');
							delete instance.checkedNodes[indice];
						}
	*/
						return true;
					},
					//
					ondata: function(DATA, TREE_OBJ) {
						//automatically open the children of the received node
						if (DATA.children) {
							DATA.state = 'open';
						}

						//extract meta data from children
						instance.extractMeta(DATA);
						return DATA;
					}
				},
				plugins : {
					checkbox : {three_state : true}
				}
			};

			//Add server parameters to the treeOptions variable
			for (var i in this.serverParameters) {
				treeOptions.data.opts[i] = this.serverParameters[i];
			}

			//create the tree
			this._super(selector, dataUrl, options, treeOptions);

			$("#saver-action-" + this.options.actionId).click({instance: this}, function(e){
				e.data.instance.saveData();
			});
		},

		trace: function() {
			/*console.log('TRACE '+
				arguments.callee.caller
				.arguments.callee.caller
				.arguments.callee.caller
				.arguments.callee.caller
			);*/
		},

		/**
		 * Paginate function, display more instances
		 */
		paginateInstances: function(NODE, TREE_OBJ, pOptions, callback) {
			var nodeId = NODE[0].id;
			var instancesLeft = this.getMeta(nodeId, "count") - this.getMeta(nodeId, "displayed");
			var options = {
				"classUri": nodeId,
				"subclasses": 0,
				"offset": this.getMeta(nodeId, "position"),
				"limit": instancesLeft < this.paginate ? instancesLeft : this.paginate
			};
			options = $.extend(options, pOptions);

			$.post(this.dataUrl, options, (function(instance) {return function(DATA) {
				//Hide paginate options
				instance.hidePaginate(NODE, TREE_OBJ);
				//Display incoming nodes
				for (var i=0; i<DATA.length; i++) {
					DATA[i].attributes['class'] = instance.options.instanceClass+" node-instance node-draggable";
					if (!$('#'+DATA[i].attributes['id'], $(TREE_OBJ.container)).length) TREE_OBJ.create(DATA[i], TREE_OBJ.get_node(NODE[0]));
					// If the check all options. Add the incoming nodes to the list of node to check
					if (options.checkedNodes == "*") {
						instance.checkedNodes.push(DATA[i].attributes.id);
					}
				}
				// Update meta data
				instance.setMeta(nodeId, "displayed", instance.getMeta(nodeId, "displayed")+DATA.length);
				instance.setMeta(nodeId, "position", instance.getMeta(nodeId, "position")+DATA.length);
				//refresh pagination options
				instance.refreshPaginate(NODE, TREE_OBJ);

				//If options checked nodes
				if (options.checkedNodes) {
					// If options check all, check not checked nodes
					if (options.checkedNodes == "*") {
						$(NODE).find('ul:first').children().each(function(){
							if ($(this).hasClass('node-instance')) {
								$(this).find("a:not(.checked, .undetermined)").each(function (){
									instance.checkedNodes.push($(this).parent().prop('id'));
								});
							}
						});
					} else {
						instance.checkedNodes = options.checkedNodes;
					}
				}

				instance.check(instance.checkedNodes);

				//Execute callback;
				if (callback) {
					callback(NODE, TREE_OBJ);
				}
			};})(this), "json");
		},

		/**
		 * Check the tree instances
		 * @param {Array} elements the list of ids of instances to check
		 */
		check: function(elements) {
			var self = this;

			$.each(elements, function(i, elt){
				if (elt != null) {
					NODE = $(self.selector).find("li[id='"+elt+"']");
					if (NODE.length > 0) {
						if ($(NODE).hasClass('node-instance')) {
							$.tree.plugins.checkbox.check(NODE);
						}
					} else {
						for (var i in self.checkedNodes) {
							if (self.checkedNodes[i] == elt) {
								delete self.checkedNodes[i];
							}
						}
					}
				}
			});
		},

		/**
		 * Get the checked nodes
		 * @return {array}
		 */
		getChecked: function() {
			var returnValue = new Array ();
			$.each($.tree.plugins.checkbox.get_checked(this.getTree()), function(i, NODE) {
				if ($(NODE).hasClass('node-instance')) {
					returnValue.push($(NODE).prop('id'));
				}
			});
			return returnValue;
		},

		/**
		 * save the checked instances in the tree by sending the ids using an ajax request
		 */
		saveData: function() {
			var instance = this;
			var toSend = {};
			var index = 0;

			helpers.loading();
			/*$.each($.tree.plugins.checkbox.get_checked(this.getTree()), function(i, NODE){
				if ($(NODE).hasClass('node-instance')) {
					toSend2['instance_' + index2] = $(NODE).prop('id');
					index2++;
				}
			});*/

			nodes = this.getChecked();
			for (var i in nodes) {
				toSend['instance_'+index] = nodes[i];
				index++;
			}

			var uriField, classUriField = null;
			if (this.options.relatedFormId) {
				var uriEltSelector = "#" + this.options.relatedFormId + " :input[name=uri]";
				if ($(uriEltSelector).length) {
					uriField = $(uriEltSelector);
				}

				var classUriEltSelector = "#" + this.options.relatedFormId + " :input[name=classUri]";
				if ($(classUriEltSelector).length) {
					classUriField = $(classUriEltSelector);
				}
			}

			if (!uriField) {
				uriField = $("input[name=uri]");
			}
			if (!classUriField) {
				classUriField = $("input[name=classUri]");
			}

			if (uriField) {
				toSend.uri = uriField.val();
			}

			if (classUriField) {
				toSend.classUri = classUriField.val();
			}

			$.ajax({
				url: this.options.saveUrl,
				type: "POST",
				data: toSend,
				dataType: 'json',
				success: function(response) {
					if (response.saved) {
						if (instance.options.saveCallback) {
							instance.options.saveCallback(toSend);
						}
						helpers.createInfoMessage(__('Selection saved successfully'));
					}
				},
				complete: function() {
					helpers.loaded();
				}
			});
		}
	});

	return GenerisTreeSelectClass;
});