( function ( $, L, prettySize ) {
	var map, heat;
	var num_overlap = 0;
	var curr_overlap = 0;

	// Start at the beginning
	fireBaseSetup();
	var database = firebase.database();
	var marker = -1;
	setup();

	 function getLocationGeo(lat, lng) {
  		var src = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + lat + ',' + lng + '&key=MY_GOOGLE_GEOCODING_KEY';
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

    function centerMap(latlng) {
    	$( 'body' ).addClass( 'map-active' );
    	if(marker != -1) {
    		map.removeLayer(marker); //remove existing markers
    	}
    	map.setView([latlng[0],latlng[1]], 14);
    	marker = L.marker([latlng[0], latlng[1]]).addTo(map);
    	getLocationGeo(latlng[0],latlng[1]);
    }

	function setup() {
		// Initialize the map
		map = L.map( 'map' ).setView([0,0], 2);

		L.tileLayer('http://{s}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png', {
			attribution: 'Tiles courtesy of <a href="http://openstreetmap.se/" target="_blank">OpenStreetMap Sweden</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(map);

		readOverlapData(curr_overlap);
		var interval = setInterval(timed_overlap_switch, 7000);
	}

	function readOverlapData(num) {
		var data = database.ref("overlap" + '/location_data');
		data.on('value', function(snapshot) {
			var val = snapshot.val();
			num_overlap = val.length;
			centerMap(val[num]);
		});
    }

    function no_overlap() {
		$( 'body' ).removeClass( 'working' );
		$( '#matching' ).addClass( 'hidden' );
		$( '#no_overlap' ).removeClass( 'hidden' );
	}

	function timed_overlap_switch() {
		if(curr_overlap < (num_overlap -1)) {
			curr_overlap = curr_overlap +1;	
		} else {
			curr_overlap = 0;
		}
		
		readOverlapData(curr_overlap);
	}

}( jQuery, L, prettySize ) );
