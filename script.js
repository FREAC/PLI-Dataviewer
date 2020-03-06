require([
    // ArcGIS
    "esri/Map",
    "esri/PopupTemplate",
    "esri/layers/FeatureLayer",
    "esri/layers/MapImageLayer",
    "esri/tasks/QueryTask",
    "esri/tasks/support/Query",
    "esri/views/MapView",
    "esri/symbols/SimpleFillSymbol",
    "esri/symbols/SimpleLineSymbol",
    "esri/renderers/ClassBreaksRenderer",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/geometry/geometryEngine",
    "dojo/query",

    // Widgets
    "esri/widgets/Home",
    "esri/widgets/Zoom",
    "esri/widgets/Compass",
    "esri/widgets/Search",
    "esri/widgets/Legend",
    "esri/widgets/BasemapToggle",
    "esri/widgets/ScaleBar",
    "esri/widgets/Attribution",
    "esri/tasks/Locator",

    // Bootstrap
    "bootstrap/Collapse",
    "bootstrap/Dropdown",

    // Calcite Maps
    "calcite-maps/calcitemaps-v0.7",
    "calcite-maps/calcitemaps-arcgis-support-v0.7",

    "dojo/_base/Color",
    "dojo/number",
    "dojo/dom",
    "dojo/dom-construct",
    "dojo/domReady!"
], function (Map, PopupTemplate, FeatureLayer, MapImageLayer, QueryTask, Query, MapView, SimpleFillSymbol, SimpleLineSymbol, ClassBreaksRenderer,
    Graphic, GraphicsLayer, geometryEngine, query, Home, Zoom, Compass, Search, Legend, BasemapToggle, ScaleBar, Attribution,
    Locator, Collapse, Dropdown, CalciteMaps, CalciteMapArcGISSupport, Color, number, dom, domConstruct) {

    /******************************************************************
     *
     * Create the map, view and widgets
     * 
     ******************************************************************/

    var parcelsTemplate = {
        title: 'Owner: {own_name}',
        content: "<p><b>Parcel ID:</b> {parcel_id}</p>" +
            "<p><b>State Parcel ID:</b> {state_par_}</p>" +
            "<p><b>PLI Code:</b> {pli_code}</p>" +
            "<p><b>Size:</b> {custom_size:NumberFormat(places: 2)} Acres<p>" +
            "<p><b>Value:</b> ${av_nsd:NumberFormat(places: 2)}</p>" +
            "<p><b>TRS:</b> {twn} {rng} {sec}</p>" +
            "<p><b>Legal Description:</b> {s_legal}</p>",
    };

    var parcelsSearchTemplate = {
        title: 'Owner: {OWN_NAME}',
        content: "<p><b>Parcel ID:</b> {PARCEL_ID}</p>" +
            "<p><b>State Parcel ID:</b> {STATE_PAR_}</p>" +
            "<p><b>PLI Code:</b> {PLI_CODE}</p>" +
            "<p><b>Size:</b> {custom_size} Acres<p>" +
            "<p><b>Value:</b> ${AV_NSD}</p>" +
            "<p><b>TRS:</b> {TWN} {RNG} {SEC}</p>" +
            "<p><b>Legal Description:</b> {S_LEGAL}</p>",
        actions: [{
            title: "Visit the FL Public Lands Inventory Website",
            id: "pliWebsite",
            className: "esri-icon-launch-link-external"
        }]
    };

    var highlightSymbol = new SimpleLineSymbol(
        SimpleLineSymbol.STYLE_SOLID,
        new Color([96, 96, 96]), 3);



    function createSymbol(color) {
        return new SimpleFillSymbol({
            color: color,
            style: "solid",
            outline: {
                width: 0.75,
                color: [0, 0, 0, 0.2]
            }
        })
    }

    var parcelRenderer = new ClassBreaksRenderer({
        field: "pli_code",
        legendOptions: {
            title: "Land Owner Index"
        },
        classBreakInfos: [{
            minValue: 0,
            maxValue: 2000,
            label: "State Lands",
            symbol: createSymbol("#7fc97f")
        }, {
            minValue: 2000,
            maxValue: 3000,
            label: "Volunteer Fire Department Lands",
            symbol: createSymbol("#e41a1c")
        }, {
            minValue: 3000,
            maxValue: 4000,
            label: "Federal Lands",
            symbol: createSymbol("#a65628")
        }, {
            minValue: 4000,
            maxValue: 5000,
            label: "County Lands",
            symbol: createSymbol("#984ea3")
        }, {
            minValue: 5000,
            maxValue: 6000,
            label: "Municipal Lands",
            symbol: createSymbol("#386cb0")
        }, {
            minValue: 6000,
            maxValue: 7000,
            label: "Other or Non-Private Lands",
            symbol: createSymbol("#f0027f")
        }, {
            minValue: 7000,
            maxValue: 8999,
            label: "Special District Lands",
            symbol: createSymbol("#fec44f")
        }]
    });

    var highlightGraphic;
    var parcelData = [];
    var currentIndex;

    var parcelsLayerURL = "https://maps.freac.fsu.edu/arcgis/rest/services/PLI/PLI/MapServer/";
    var parcelsLayer = new MapImageLayer({
        url: parcelsLayerURL,
        title: "Parcels Layer",
        sublayers: [{
            id: 0,
            title: "State Agencies",
            visible: true,
            minScale: 150000,
            renderer: parcelRenderer
        }]
    });

    var selectionLayer = new GraphicsLayer({
        listMode: "hide",
        visible: true
    });

    // Map
    var map = new Map({
        basemap: "topo",
        layers: [parcelsLayer, selectionLayer]
    });

    // View
    var mapView = new MapView({
        container: "mapViewDiv",
        map: map,
        padding: {
            top: 50,
            bottom: 0
        },
        center: [-82.28, 27.8],
        zoom: 7,
        ui: {
            components: []
        }
    });

    // Popup and panel sync
    mapView.when(function () {
        CalciteMapArcGISSupport.setPopupPanelSync(mapView);
    });

    //  Mouse click data query
    // inputs the geometry of the data query feature, and matches to it. 
    function mouseclickQueryTask(url, geometry) {
        var queryTask = new QueryTask({
            url: url
        });
        var params = new Query({
            geometry: geometry,
            returnGeometry: true,
            outFields: ["own_name", "parcel_id", "state_par_", "pli_code", "custom_size", "av_nsd", "twn", "rng", "sec", "s_legal"]
        });
        return queryTask.execute(params);
    }

    function togglePanel() {
        $('#allpanelsDiv > div').each(function () {
            // turn off all panels that are not target
            if (this.id != 'panelPopup') {
                this.setAttribute('class', 'panel collapse');
                this.setAttribute('style', 'height:0px;');
            } else {
                this.setAttribute('class', 'panel collapse in');
                this.setAttribute('style', 'height:auto;');
                $('#' + this.id + '>div').each(function () {
                    if (this.id === 'collapsePopup') {
                        this.setAttribute('class', 'panel-collapse collapse in');
                        this.setAttribute('style', 'height:auto;');
                    }
                });
            }
        });
    }

    query(mapView).on('click', function (response) {
        mouseclickQueryTask(parcelsLayerURL + '/0', response.mapPoint)
            .then(function (response) {
                mapView.graphics.removeAll();
                selectionLayer.graphics.removeAll();
                highlightGraphic = new Graphic(response.features[0].geometry, highlightSymbol);
                selectionLayer.graphics.add(highlightGraphic);
                $('#ownerdiv').html('<b>Owner Name:</b> ' + response.features[0].attributes.own_name);
                $('#parcelIDdiv').html('<b>Parcel ID:</b> ' + response.features[0].attributes.parcel_id);
                $('#stateParceldiv').html('<b>State Parcel ID:</b> ' + response.features[0].attributes.state_par_);
                $('#pliCodediv').html('<b>PLI Code:</b> ' + response.features[0].attributes.pli_code);
                $('#valuediv').html('<b>Value:</b> $' + response.features[0].attributes.av_nsd.toLocaleString());
                $('#sizediv').html('<b>Size:</b> ' + response.features[0].attributes.custom_size.toLocaleString() + ' Acres');
                $('#trsdiv').html('<b>Township, Range, Section:</b> ' + response.features[0].attributes.twn + ' ' + response.features[0].attributes.rng + ' ' + response.features[0].attributes.sec);
                $('#sharemap').html('<b>Share parcel:</b> <a target="_blank" href=' + 'http://hermes.freac.fsu.edu/pli-dataviewer/share?parcel_id=' + response.features[0].attributes.parcel_id + '>http://hermes.freac.fsu.edu/pli-dataviewer/share?parcel_id=' + response.features[0].attributes.parcel_id + '</a>');
                $('#legaldiv').html('<b>Legal Description:</b> ' + response.features[0].attributes.s_legal);
                $('#arraylengthdiv').html('Parcel ' + 1 + ' of ' + response.features.length);
                $('#numinput').val(1);
                $('#selectAgencyPanel').val(response.features[0].attributes.own_name);
                return response;
            })
            .then(togglePanel());
    });

    //  Dropdown panel function
    function buildSelectPanel(url, attribute, zoomParam, panelParam) {

        var task = new QueryTask({
            url: url
        });

        var params = new Query({
            where: attribute + " IS NOT NULL",
            outFields: [attribute],
            returnDistinctValues: true,
            returnExceededLimitFeatures: true,
        });

        var option = domConstruct.create("option");
        option.text = zoomParam;
        dom.byId(panelParam).add(option);

        task.execute(params)
            .then(function (response) {
                var features = response.features;
                var values = features.map(function (feature) {
                    return feature.attributes[attribute];
                });
                return values;
            })
            .then(function (uniqueValues) {
                uniqueValues.sort();
                uniqueValues.forEach(function (value) {
                    var option = domConstruct.create("option");
                    option.text = value;
                    dom.byId(panelParam).add(option);
                });
            });
    }

    function queryParcelOwners(feature) {

        var task = new QueryTask({
            url: parcelsLayerURL + "/0"
        });

        var params = new Query({
            outFields: ["own_name", "parcel_id", "state_par_", "pli_code", "custom_size", "av_nsd", "twn", "rng", "sec", "s_legal"],
            where: "own_name = '" + feature + "'",
            returnGeometry: true
        });

        task.execute(params)
            .then(function (response) {
                parcelData.length = 0;
                for (i = 0; i < response.features.length; i++) {
                    parcelData.push(response.features[i]);
                };

                // Zoom to feature
                var ext = response.features[0].geometry.extent;
                var cloneExt = ext.clone();
                mapView.goTo({
                    target: response.features[0],
                    extent: cloneExt.expand(1.75)
                });

                // Add selection to graphic
                selectionLayer.graphics.removeAll();
                highlightGraphic = new Graphic(response.features[0].geometry, highlightSymbol);
                selectionLayer.graphics.add(highlightGraphic);

                $('#ownerdiv').html('<b>Owner Name:</b> ' + response.features[0].attributes.own_name);
                $('#parcelIDdiv').html('<b>Parcel ID:</b> ' + response.features[0].attributes.parcel_id);
                $('#stateParceldiv').html('<b>State Parcel ID:</b> ' + response.features[0].attributes.state_par_);
                $('#pliCodediv').html('<b>PLI Code:</b> ' + response.features[0].attributes.pli_code);
                $('#valuediv').html('<b>Value:</b> $' + response.features[0].attributes.av_nsd.toLocaleString());
                $('#sizediv').html('<b>Size:</b> ' + parcelData[0].attributes.custom_size.toLocaleString() + ' Acres');
                $('#trsdiv').html('<b>Township, Range, Section:</b> ' + response.features[0].attributes.twn + ' ' + response.features[0].attributes.rng + ' ' + response.features[0].attributes.sec);
                $('#sharemap').html('<b>Share parcel:</b> <a target="_blank" href=' + 'http://hermes.freac.fsu.edu/pli-new/?parcel_id=' + response.features[0].attributes.parcel_id + '>http://hermes.freac.fsu.edu/pli-new/?parcel_id=' + response.features[0].attributes.parcel_id + '</a>');
                $('#legaldiv').html('<b>Legal Description:</b> ' + response.features[0].attributes.s_legal);
                $('#arraylengthdiv').html('Parcel 1 of ' + response.features.length);
                var currentIndex = 0;
                return response;
            });
    }

    function querySearch(owner, parcel) {

        var task = new QueryTask({
            url: parcelsLayerURL + "/0"
        });

        var params = new Query({
            outFields: ["own_name", "parcel_id", "state_par_", "pli_code", "custom_size", "av_nsd", "twn", "rng", "sec", "s_legal"],
            where: "own_name = '" + owner + "'",
            returnGeometry: true
        });

        task.execute(params)
            .then(function (response) {
                parcelData.length = 0;
                for (i = 0; i < response.features.length; i++) {
                    parcelData.push(response.features[i]);
                };
                for (i = 0; i < response.features.length; i++) {
                    if (parcel == response.features[i].attributes.parcel_id) {
                        return i;
                    }
                }
            })
            .then(function (i) {
                $('#ownerdiv').html('<b>Owner Name:</b> ' + parcelData[i].attributes.own_name);
                $('#parcelIDdiv').html('<b>Parcel ID:</b> ' + parcelData[i].attributes.parcel_id);
                $('#stateParceldiv').html('<b>State Parcel ID:</b> ' + parcelData[i].attributes.state_par_);
                $('#pliCodediv').html('<b>PLI Code:</b> ' + parcelData[i].attributes.pli_code);
                $('#valuediv').html('<b>Value:</b> $' + parcelData[i].attributes.av_nsd.toLocaleString());
                $('#sizediv').html('<b>Size:</b> ' + parcelData[i].attributes.custom_size.toLocaleString() + ' Acres');
                $('#trsdiv').html('<b>Township, Range, Section:</b> ' + parcelData[i].attributes.twn + ' ' + parcelData[i].attributes.rng + ' ' + parcelData[i].attributes.sec);
                $('#legaldiv').html('<b>Legal Description:</b> ' + parcelData[i].attributes.s_legal);
                $('#sharemap').html('<b>Share parcel:</b> <a target="_blank" href=' + 'http://hermes.freac.fsu.edu/pli-new/?parcel_id=' + parcelData[i].attributes.parcel_id + '>http://hermes.freac.fsu.edu/pli-new/?parcel_id=' + parcelData[i].attributes.parcel_id + '</a>');
                $('#arraylengthdiv').html('Parcel ' + (i + 1) + ' of ' + parcelData.length);
                $('#numinput').val(i + 1);
                $('#selectAgencyPanel').val(parcelData[i].attributes.own_name);
            });
    }

    function indexParcels(e) {
        if (e < parcelData.length || e > 0) {

            $('#arraylengthdiv').html('Parcel ' + (e) + ' of ' + parcelData.length);
            $('#ownerdiv').html('<b>Owner Name:</b> ' + parcelData[e - 1].attributes.own_name);
            $('#parcelIDdiv').html('<b>Parcel ID:</b> ' + parcelData[e - 1].attributes.parcel_id);
            $('#stateParceldiv').html('<b>State Parcel ID:</b> ' + parcelData[e - 1].attributes.state_par_);
            $('#pliCodediv').html('<b>PLI Code:</b> ' + parcelData[e - 1].attributes.pli_code);
            $('#valuediv').html('<b>Value:</b> $' + parcelData[e - 1].attributes.av_nsd.toLocaleString());
            $('#sizediv').html('<b>Size:</b> ' + parcelData[e - 1].attributes.custom_size.toLocaleString() + ' Acres');
            $('#trsdiv').html('<b>Township, Range, Section:</b> ' + parcelData[e - 1].attributes.twn + ' ' + parcelData[e - 1].attributes.rng + ' ' + parcelData[e - 1].attributes.sec);
            $('#sharemap').html('<b>Share parcel:</b> <a target="_blank" href=' + 'http://hermes.freac.fsu.edu/pli-new/?parcel_id=' + parcelData[e - 1].attributes.parcel_id + '>http://hermes.freac.fsu.edu/pli-new/?parcel_id=' + parcelData[e - 1].attributes.parcel_id + '</a>');
            $('#legaldiv').html('<b>Legal Description:</b> ' + parcelData[e - 1].attributes.s_legal);
            currentIndex = e;
        }
    }

    // Build State Agency dropdown
    buildSelectPanel(parcelsLayerURL + "/0", "own_name", "Select a State Agency", "selectAgencyPanel");

    // Search - add to navbar
    var searchWidget = new Search({
        container: "searchWidgetDiv",
        view: mapView,
        allPlaceHolder: "Text search for Parcel ID",
        sources: [{
            featureLayer: {
                url: parcelsLayerURL,
                popupTemplate: parcelsSearchTemplate
            },
            searchFields: ["parcel_id", "state_par_", "own_city", "own_name"],
            suggestionTemplate: "PID: {parcel_id}, State PID: {state_par_}, City: {own_city}, Parcel Name: {own_name}",
            displayField: "PLI_CODE",
            exactMatch: false,
            outFields: ["pli_code", "parcel_id", "own_name", "own_state", "state_par_", "custom_size", "av_nsd", "twn", "sec", "s_legal", "rng"],
            name: "Florida Public Land Inventories Parcels",
            placeholder: "Search by Parcel ID, City, or County",
            resultGraphicEnabled: true,
            resultSymbol: highlightSymbol,
            autoNavigate: false,
            popupEnabled: false
        }, {
            locator: new Locator({
                url: "//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
            }),
            singleLineFieldName: "SingleLine",
            name: "Geocoder",
            localSearchOptions: {
                minScale: 300000,
                distance: 50000
            },
            placeholder: "Search Geocoder",
            maxResults: 3,
            maxSuggestions: 6,
            suggestionsEnabled: true,
            minSuggestCharacters: 0,
            countryCode: "US"
        }],
    });

    CalciteMapArcGISSupport.setSearchExpandEvents(searchWidget);

    // Map widgets
    var home = new Home({
        view: mapView
    });
    mapView.ui.add(home, "top-left");

    var zoom = new Zoom({
        view: mapView
    });
    mapView.ui.add(zoom, "top-left");

    var compass = new Compass({
        view: mapView
    });
    mapView.ui.add(compass, "top-left");

    var basemapToggle = new BasemapToggle({
        view: mapView,
        secondBasemap: "satellite"
    });
    mapView.ui.add(basemapToggle, "bottom-right");

    var scaleBar = new ScaleBar({
        view: mapView
    });
    mapView.ui.add(scaleBar, "bottom-left");

    var attribution = new Attribution({
        view: mapView
    });
    mapView.ui.add(attribution, "manual");

    // Panel widgets - add legend
    var legendWidget = new Legend({
        container: "legendDiv",
        view: mapView,
        layerInfos: [{
            layer: parcelsLayer,
            title: "Florida Public Lands Inventory"
        }]
    });

    var clearBtn = document.getElementById("clearButton");
    mapView.ui.add(clearBtn, "top-left");

    // Set initial opacity value
    mapView.when(parcelsLayer.opacity = .5);

    // Watch Opacity-Slider
    query("#opacity-slider").on("input", function () {
        var value = parseFloat(dom.byId("opacity-slider").value);
        dom.byId("opacity-label").innerText = "Opacity: " + Math.round(value * 100) + "%";
        parcelsLayer.opacity = value;
    });

    // Watch search result
    searchWidget.on("select-result", function (event) {
        console.log(event);
        var ext = event.result.extent;
        var cloneExt = ext.clone();
        mapView.goTo({
            target: event.result.feature,
            extent: cloneExt.expand(1.75)
        });
    });

    // Watch Select State Agency dropdown
    query("#selectAgencyPanel").on("change", function (e) {
        $('#numinput').val(1);
        queryParcelOwners(e.target.value);
    });

    // Listen for number input
    query("#numinput").on("change", function (e) {
        if (e.target.value <= parcelData.length && e.target.value >= 1) {

            indexParcels(e.target.value);
            var parcelVal = $('#numinput').val();
            var indexVal = parcelVal - 1;

            // Determine the index value
            var parcelVal = $('#numinput').val();
            var indexVal = parcelVal - 1;

            // Go to the selected parcel
            var ext = parcelData[indexVal].geometry.extent;
            var cloneExt = ext.clone();
            mapView.goTo({
                target: parcelData[indexVal],
                extent: cloneExt.expand(1.75)
            });

            // Remove current selection
            selectionLayer.graphics.removeAll();

            // Highlight the selected parcel
            highlightGraphic = new Graphic(parcelData[indexVal].geometry, highlightSymbol);
            selectionLayer.graphics.add(highlightGraphic);
        } else {
            $('#numinput').val(currentIndex);
        }
    });

    // Listen for the back button
    query("#back").on("click", function () {
        if ($('#numinput').val() > 1) {
            updateIndex("back");
        }
    });

    // Listen for forward button
    query("#forward").on("click", function () {
        if ($('#numinput').val() < parcelData.length) {
            updateIndex("forward");
        }
    });

    function updateIndex(button) {

        value = $('#numinput').val();
        value = parseInt(value);
        if (button === "forward") {
            indexParcels(++value);
        } else {
            indexParcels(--value);
        }
        $('#numinput').val(value);

        // Determine the index value
        var parcelVal = $('#numinput').val();
        var indexVal = parcelVal - 1;

        // Go to the selected parcel
        var ext = parcelData[indexVal].geometry.extent;
        var cloneExt = ext.clone();
        mapView.goTo({
            target: parcelData[indexVal],
            extent: cloneExt.expand(1.75)
        });

        // Remove current selection
        selectionLayer.graphics.removeAll();

        // Highlight the selected parcel
        highlightGraphic = new Graphic(parcelData[indexVal].geometry, highlightSymbol);
        selectionLayer.graphics.add(highlightGraphic);
    }

    searchWidget.on("search-complete", function (event) {
        selectionLayer.graphics.removeAll();
        // The results are stored in the event Object[]
        var owner = event.results[0].results[0].feature.attributes.own_name;
        var parcel = event.results[0].results[0].feature.attributes.parcel_id;
        querySearch(owner, parcel);
        togglePanel();
    });

    // Clear all graphics and div elements of information panel  
    clearBtn = dom.byId("clearButton");

    query(clearBtn).on("click", function (response) {
        mapView.graphics.removeAll();
        selectionLayer.graphics.removeAll();
        $('#arraylengthdiv').html('');
        $('#ownerdiv').html('');
        $('#parcelIDdiv').html('');
        $('#stateParceldiv').html('');
        $('#pliCodediv').html('');
        $('#valuediv').html('');
        $('#sizediv').html('');
        $('#trsdiv').html('');
        $('#legaldiv').html('');
        $('#numinput').val('');
        $('#selectAgencyPanel')[0].selectedIndex = 0;
        parcelData = [];
    });
});