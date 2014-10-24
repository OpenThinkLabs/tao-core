define([
    'jquery',
    'lodash',
    'i18n',
    'core/pluginifier',
    'tpl!ui/datatable/tpl/layout'
], function($, _, __, Pluginifier, layout){

    'use strict';

    var ns = 'datatable',
    defaults = {
        'start'   : 0,
        'rows'    : 25,
        'model'   : null,
        'actions' : null
    },
    actionHeader= {
        id : null,
        label : __('Actions'),
        sortable : false
    };

    /**
     * The dataTable component makes you able to browse itemss and bind specific
     * actions to undertake for edition and removal of them.
     *
     * @exports ui/datatable
     */
    var dataTable = {

        /**
         * Initialize the plugin.
         *
         * Called the jQuery way once registered by the Pluginifier.
         * @example $('selector').datatable({});
         *
         * @constructor
         * @param {Object} options - the plugin options
         * @param {String} options.url - the URL of the service used to retrieve the resources.
         * @param {Function} options.actions.xxx - the callback function for items xxx, with a single parameter representing the identifier of the items.
         * @fires dataTable#create.datatable
         * @returns {jQueryElement} for chaining
         */
        init: function(options) {

            return this.each(function() {
                var $elt = $(this);
                options = _.defaults(options, defaults);

                var data = {
                    'rows': options.rows,
                    'page': 1,
                    'sortby': 'id',
                    'sortorder': 'asc'
                };

                dataTable._query($elt, options, data, function(){

                    $elt.trigger('create.datatable');
                });
            });
        },

        _query: function($elt, options, data, done){

            $.ajax({
                url: options.url,
                data: data,
                type: 'GET'
            }).done(function(response) {

                // Add the list of custom actions to the response for the tpl
                response.actions = _.keys(options.actions);

                // Add the column into the model
                if (options.actions !== null && _.last(options.model).label !== actionHeader.label) {
                    options.model.push(actionHeader);
                }
                // Add the model to the response for the tpl
                response.model = options.model;
                // Call the rendering
                var $rendering = $(layout(response));

                // Attach a listener to every action button created
                _.forEach(options.actions,function(action,name){
                    $rendering
                        .off('click','.'+name)
                        .on('click','.'+name, function(e){
                            e.preventDefault();
                            var $elt = $(this);
                            action.apply($elt,[$elt.parent().data('item-identifier')]);
                        });
                });

                // Now $rendering takes the place of $elt...
                var $forwardBtn = $rendering.find('.datatable-forward');
                var $backwardBtn = $rendering.find('.datatable-backward');
                var $sortBy = $rendering.find('th[data-sort-by]');
                var $sortElement = $rendering.find('[data-sort-by="'+ data.sortby +'"]');

                $forwardBtn.click(function() {
                    dataTable._next($elt, options, data);
                });

                $backwardBtn.click(function() {
                    dataTable._previous($elt, options, data);
                });

                $sortBy.click(function() {
                    dataTable._sort($elt, options, data, this);
                });

                // Remove sorted class from all th
                $('th.sorted',$rendering).removeClass('sorted');
                // Add the sorted class to the sorted element and the order class
                $sortElement.addClass('sorted').addClass('sorted_'+data.sortorder);

                if (data.page === 1) {
                    $backwardBtn.attr('disabled', '');
                } else {
                    $backwardBtn.removeAttr('disabled');
                }

                if (response.page >= response.total) {
                    $forwardBtn.attr('disabled', '');
                } else {
                    $forwardBtn.removeAttr('disabled');
                }


                $elt.html($rendering);

                if(_.isFunction(done)){
                    done();
                }
            });
        },

        _next: function($elt, options, data) {
            data.page +=1;
            dataTable._query($elt, options, data);
        },

        _previous: function($elt, options, data) {
            data.page -= 1;
            dataTable._query($elt, options, data);
        },
        _sort: function($elt, options, data, sortBy) {
            var sortingElement = $(sortBy).data('sort-by');
            if (data.sortorder == 'asc' && data.sortby == sortingElement) {
                // If I already sort asc this element
                data.sortorder = 'desc';
            }else{
                // If I never sort by this element or
                // I sort by this element & the order was desc
                data.sortorder = 'asc';
            }
            // Change the sorting element anyway.
            data.sortby = sortingElement;
            // Call the query
            dataTable._query($elt, options, data);
        }
    };

    Pluginifier.register(ns, dataTable);
});