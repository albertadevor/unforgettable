( function ( $, L, prettySize ) {
	var map, heat;
	var num_overlap = 0;
	var curr_overlap = 0;

	// Start at the beginning
	fireBaseSetup();
	var database = firebase.database();
	stageOne();
	var marker = -1;
	var markerGroup;

	function fireBaseSetup() {
		var config = {
	        apiKey: "MY_FIREBASE_API_KEY",
	        authDomain: "unforget-table.firebaseapp.com",
	        databaseURL: "https://unforget-table.firebaseio.com",
	        storageBucket: "unforget-table.appspot.com",
	        messagingSenderId: "1032429507306"
      };
      firebase.initializeApp(config);
	}

	function getLocationGeo(lat, lng) {
  		var src = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + lat + ',' + lng + '&key=MY_GOOGLE_API_KEY';
  		var src = $.getJSON(src, function(data) {
  			for(var i=0; i<data.results[0].address_components.length; i++) {
  				var component = data.results[0].address_components[i];
  				var component_type = component.types;
				for(var j = 0; j<component_type.length; j++) {
					if (component_type[j] == 'sublocality' ||  component_type[j] == 'locality') {
						var found_location = component.short_name;
						document.getElementById('locus').innerHTML = found_location;

					}
				}
  			}
  		});
  	}

    function writeUserLocationData(userId, location_data) {
        database.ref(userId).set({
          location_data : location_data
        });
    }

    function checkForPartnerData() {
    	//this is where we tell user we are looking for user data
		$( '#working' ).addClass( 'hidden' );
		$( '#matching' ).removeClass( 'hidden' );

		//make sure we have data from both users
		var data = database.ref(1 + '/location_data');
		data.on('value', function(snapshot) {
			var arr1 = snapshot.val();
			var data = database.ref(2 + '/location_data');
			data.on('value', function(snapshot) {
				var arr2 = snapshot.val();
				matchData(arr1, arr2);
			});
		});
    }

    function readOverlapData(curr_index) {
		var data = database.ref("overlap" + '/location_data');
		data.on('value', function(snapshot) {
			var val = snapshot.val();
			centerMap(val[curr_index]);
		});
    }

    function centerMap(latlng) {
    	console.log(marker);
    	if(marker != -1) {
    		markerGroup.removeLayer(marker); //remove existing markers
    	}
    	map.setView([latlng[0],latlng[1]], 14);
    	marker = L.marker([latlng[0], latlng[1]]).addTo(markerGroup);
    	getLocationGeo(latlng[0],latlng[1]);
    }

    function matchData(arr1, arr2) {
    	//match data 

		var overlap = []
    	for(var i=0; i< arr1.length; i++) {
    		//console.log(arr1[i]);
    		for(var j=0; j < arr2.length; j++) {

    			if (arr1[i].toString() == arr2[j].toString()) {
    				overlap.push(arr1[i]);
    			}
    		}
    	}

    	num_overlap = overlap.length;
    	if(num_overlap ==0) {
    		no_overlap();
    	} else {
    		writeUserLocationData("overlap", overlap);
    		stageThree(arr1.length + arr2.length);
    	}
    }


	function stageOne () {
		var dropzone;
		// Initialize the map
		map = L.map( 'map' ).setView([0,0], 2);
		L.tileLayer('http://{s}.tile.openstreetmap.se/hydda/base/{z}/{x}/{y}.png', {
			attribution: 'Tiles courtesy of <a href="http://openstreetmap.se/" target="_blank">OpenStreetMap Sweden</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(map);

		markerGroup = L.layerGroup().addTo(map);

		// Initialize the dropzone
		dropzone = new Dropzone( document.body, {
			url: '/',
			previewsContainer: document.createElement( 'div' ),
			clickable: false,
			accept: function ( file, done ) {
				waitSubmit(file);
				dropzone.disable(); //done with uploading
			}
		} );

		$( '#file' ).change( function () {
			waitSubmit( this.files[0] );
			dropzone.disable();
		} );
	}

	/* essentially step 1.5 */
	function waitSubmit(file) {

		var submitButton = document.getElementById('btnSubmit');

		submitButton.addEventListener("click", function() {
			var username_num = document.getElementById('selected_name').selectedIndex;

			if (username_num == "0") {
				alert("please choose a user!");
			} else {
				stageTwo(file, username_num);
			}
		});
	}

	function stageTwo ( file, name ) {

		// First, change tabs
		$( 'body' ).addClass( 'working' );
		$( '#intro' ).addClass( 'hidden' );
		$( '#working' ).removeClass( 'hidden' );

		// Now start working!
		processFile( file );

		function status ( message ) {
			$( '#currentStatus' ).text( message );
		}

		function processFile ( file ) {
			var fileSize = prettySize( file.size ),
				reader = new FileReader();

			status( 'Preparing to import file (' + fileSize + ')...' );

			function getLocationDataFromJson ( data ) {
				var SCALAR_E7 = 0.0000001, // Since Google Takeout stores latlngs as integers
					locations = JSON.parse( data ).locations;

				if ( !locations || locations.length === 0 ) {
					throw new ReferenceError( 'No location data found.' );
				}

				return locations.map( function ( location ) {
					return [ location.latitudeE7 * SCALAR_E7, location.longitudeE7 * SCALAR_E7 ];
				} );
			}

			function getLocationDataFromKml ( data ) {
				var KML_DATA_REGEXP = /<when>(.*?)<\/when>\s*<gx:coord>(\S*)\s(\S*)\s(\S*)<\/gx:coord>/g,
					locations = [],
					match = KML_DATA_REGEXP.exec( data );

				// match
				//  [1] ISO 8601 timestamp
				//  [2] longitude
				//  [3] latitude
				//  [4] altitude (not currently provided by Location History)

				while ( match !== null ) {
					locations.push( [ Number( match[3] ), Number( match[2] ) ] );
					match = KML_DATA_REGEXP.exec( data );
				}
				return locations;
			}

			reader.onprogress = function ( e ) {
				var percentLoaded = Math.round( ( e.loaded / e.total ) * 100 );
				status( percentLoaded + '% of ' + fileSize + ' loaded...' );
			};

			reader.onload = function ( e ) {
				var latlngs;

				status( 'Generating map...' );

				try {
					if ( /\.kml$/i.test( file.name ) ) {
						latlngs = getLocationDataFromKml( e.target.result );
					} else {
						latlngs = getLocationDataFromJson( e.target.result );
					}
				} catch ( ex ) {
					status( 'Something went wrong generating your map. Ensure you\'re uploading a Google Takeout JSON file that contains location data and try again, or create an issue on GitHub if the problem persists. (error: ' + ex.message + ')' );
					return;
				}

				//heuristic to only add meaningfully differnt points to the database
				var locations_set = new Set();
				latlngs.forEach(function(geo_coords) {
					geo_coords[0] = geo_coords[0].toFixed(2);
					geo_coords[1] = geo_coords[1].toFixed(2);
					geo_coords = geo_coords.toString();
					//converting to string because sets cannot check for same objects only primitives
					if(!locations_set.has(geo_coords)) {
						locations_set.add(geo_coords);
					}
				});

				var final_geo_array = Array.from(locations_set);

				//prevent database overload
				if(final_geo_array.length > 1000) {
					final_geo_array = final_geo_array.slice(0, 1000);
				}

				//convert back to numbers
				final_geo_array.forEach(function(item, index, array) {
					item = "[" + item + "]";
					item = JSON.parse(item);

					array[index] = item;

				});
				writeUserLocationData(name, final_geo_array);
				checkForPartnerData();
			};

			reader.onerror = function () {
				status( 'Something went wrong reading your JSON file. Ensure you\'re uploading a "direct-from-Google" JSON file and try again, or create an issue on GitHub if the problem persists. (error: ' + reader.error + ')' );
			};

			reader.readAsText( file );
		}
	}

	function stageThree ( numberProcessed ) {
		var $done = $( '#done' );

		// Change tabs :D
		$( 'body' ).removeClass( 'working' );
		$( '#matching' ).addClass( 'hidden' );
		$done.removeClass( 'hidden' );

		// Update count
		$( '#numberProcessed' ).text( numberProcessed.toLocaleString() );

		readOverlapData(0);
		var nextButton = document.getElementById('next');

		nextButton.addEventListener("click", function() {
			overlap_switch();
		});
	}

	function no_overlap() {
		$( 'body' ).removeClass( 'working' );
		$( '#matching' ).addClass( 'hidden' );
		$( '#no_overlap' ).removeClass( 'hidden' );
	}

	function overlap_switch() {
		if(curr_overlap < (num_overlap -1)) {
			curr_overlap = curr_overlap +1;	
		} else {
			curr_overlap = 0;
		}
		
		readOverlapData(curr_overlap);
	}

}( jQuery, L, prettySize ) );
