// Handle offcanvas parameter
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("offcanvas") === "false") {
  document.getElementById("summary-btn").style.display = "none";
  document.getElementById("filter-btn").style.display = "none";

  const summaryText = document.getElementById("summary-text").innerHTML;
  const summaryTop = document.getElementById("summary-top");
  const summary = document.getElementById("summary");
  summary.classList.remove("show");
  // Show summary at top of map instead
  summaryTop.innerHTML = summaryText;
  summaryTop.style.display = "block";
  summaryTop.style.padding = "10px";
}

// Initialize map
var map = L.map("map", {
  zoomControl: false,
  zoomSnap: 0.01,
}).setView([15, 0], 3);

L.tileLayer("https://{s}.tile.osm.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

L.control
  .zoom({
    position: "bottomright",
  })
  .addTo(map);

var allMarkers = [];
var markerClusterGroup = L.markerClusterGroup({
  maxClusterRadius: 40,        
  disableClusteringAtZoom: 10, 
  spiderfyOnMaxZoom: true,     
  showCoverageOnHover: false,  
  zoomToBoundsOnClick: true    
});

// Add all event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Date validation listeners
  const fromDate = document.getElementById("from-date");
  const toDate = document.getElementById("to-date");

  fromDate.addEventListener("change", function() {
    if (this.value) {
      toDate.min = this.value;
    }
  });

  toDate.addEventListener("change", function() {
    if (this.value) {
      fromDate.max = this.value;
    }
  });

  // Form submit listener
  const filterForm = document.getElementById("filter-form");
  if (filterForm) {
    filterForm.addEventListener("submit", applyFilter);
  }

  // Reset button listener
  const resetBtn = document.getElementById("reset-filters-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetFilters);
  }
});

function resetFilters() {
  // Reload the page without any query parameters
  window.location.href = window.location.pathname;
}

function applyFilter(event) {
  event.preventDefault();
  const errorMessage = document.getElementById("error-message");
  var fromDateInput = document.getElementById("from-date").value;
  var toDateInput = document.getElementById("to-date").value;
  var selectedCountry = document.getElementById("country-filter").value;
  var selectedCity = document.getElementById("city-filter").value;
  var selectedService = document.getElementById("service-filter").value;
  var selectedVersion = document.getElementById("version-filter").value;

  var fromDate = fromDateInput ? new Date(fromDateInput) : null;
  var toDate = toDateInput ? new Date(toDateInput) : null;
  if (fromDate && toDate && fromDate > toDate) {
    errorMessage.textContent = "Date range is not valid! 'To' date must be after 'From' date.";
    return;
  } else {
    errorMessage.textContent = "";
  }

  // Show spinner
  document.getElementById("spinner-overlay").style.display = "flex";

  // Build query parameters for server-side filtering
  const params = new URLSearchParams();
  if (fromDate) {
    params.append('from', fromDate.toISOString());
  }
  if (toDate) {
    params.append('to', toDate.toISOString());
  }
  if (selectedCountry) {
    params.append('country', selectedCountry);
  }
  if (selectedCity) {
    params.append('city', selectedCity);
  }
  if (selectedService) {
    params.append('service', selectedService);
  }
  if (selectedVersion) {
    params.append('version', selectedVersion);
  }

  // Reload page with query parameters
  window.location.href = window.location.pathname + '?' + params.toString();
};

function filterMarkers(filters) {
  markerClusterGroup.clearLayers();

  var filteredMarkers = allMarkers.filter(function(item) {
    var passes = true;

    if (filters.fromDate && new Date(item.data.last_seen) < filters.fromDate) {
      passes = false;
    }
    if (filters.toDate && new Date(item.data.last_seen) > filters.toDate) {
      passes = false;
    }
    if (filters.country && item.data.country !== filters.country) {
      passes = false;
    }
    if (filters.city && item.data.city !== filters.city) {
      passes = false;
    }
    if (filters.version && item.data.magistrala_version !== filters.version) {
      passes = false;
    }
    if (filters.service && !item.data.services.includes(filters.service)) {
      passes = false;
    }

    return passes;
  });

  filteredMarkers.forEach(function(item) {
    markerClusterGroup.addLayer(item.marker);
  });

  updateCountryTable(filteredMarkers);
}

function updateCountryTable(markers) {
  var countryCounts = {};
  markers.forEach(function(item) {
    var country = item.data.country;
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  });

  var tableBody = document.querySelector("#country-table tbody");
  tableBody.innerHTML = "";

  Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).forEach(function([country, count]) {
    var row = document.createElement("tr");
    row.style.cursor = "pointer";
    row.innerHTML = `
      <td>${country}</td>
      <td><span class="badge bg-secondary">${count}</span></td>
    `;
    row.addEventListener("click", function () {
      getCountryCoordinates(country, function (lat, lng) {
        map.setView([lat, lng], 6);
      });
    });
    tableBody.appendChild(row);
  });

  var summaryTextElement = document.getElementById("summary-text");
  var totalDeployments = markers.length;
  var totalCountries = Object.keys(countryCounts).length;
  summaryTextElement.innerHTML = `Magistrala currently has <span class="fw-semibold">${totalDeployments}</span> deployments in <span class="fw-semibold">${totalCountries}</span> countries.`;

  var summaryTop = document.getElementById("summary-top");
  if (summaryTop.style.display === "block") {
    summaryTop.innerHTML = summaryTextElement.innerHTML;
  }
}

// Function to retrieve coordinates for a given country using Nominatim API
function getCountryCoordinates(country, callback) {
  var url =
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
    encodeURIComponent(country);

  fetch(url)
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      if (data.length > 0) {
        try {
          const context = `country lookup for "${country}"`;
          const coords = assertValidLatLng(data[0].lat, data[0].lon, context);
          callback(coords.lat, coords.lng);
        } catch (validationError) {
          console.error(validationError.message);
        }
      } else {
        console.log("Coordinates not found for country: " + country);
      }
    })
    .catch(function (error) {
      console.log("Error retrieving coordinates:", error);
    });
}

/**
 * Authoritative validator for latitude/longitude coordinates.
 * Throws descriptive error if coordinates are invalid.
 * Returns validated numeric coordinates.
 * 
 * @param {any} latRaw - Raw latitude value from data source
 * @param {any} lngRaw - Raw longitude value from data source
 * @param {string} context - Context string for error messages (e.g., "telemetry entry", "record ID")
 * @returns {{lat: number, lng: number}} Validated numeric coordinates
 * @throws {Error} If coordinates are invalid with descriptive error message
 */
function assertValidLatLng(latRaw, lngRaw, context = "record") {
  // Check for undefined/null
  if (latRaw === undefined || latRaw === null) {
    throw new Error(`Invalid coordinate in ${context}: latitude is ${latRaw}. Source: ${JSON.stringify({lat: latRaw, lng: lngRaw})}`);
  }
  if (lngRaw === undefined || lngRaw === null) {
    throw new Error(`Invalid coordinate in ${context}: longitude is ${lngRaw}. Source: ${JSON.stringify({lat: latRaw, lng: lngRaw})}`);
  }

  // Convert to numbers explicitly
  const latNum = Number(latRaw);
  const lngNum = Number(lngRaw);

  // Validate they are numbers (not NaN)
  if (isNaN(latNum)) {
    throw new Error(`Invalid coordinate in ${context}: latitude "${latRaw}" cannot be parsed as number. Source: ${JSON.stringify({lat: latRaw, lng: lngRaw})}`);
  }
  if (isNaN(lngNum)) {
    throw new Error(`Invalid coordinate in ${context}: longitude "${lngRaw}" cannot be parsed as number. Source: ${JSON.stringify({lat: latRaw, lng: lngRaw})}`);
  }

  // Validate they are finite
  if (!isFinite(latNum)) {
    throw new Error(`Invalid coordinate in ${context}: latitude ${latNum} is not finite. Source: ${JSON.stringify({lat: latRaw, lng: lngRaw})}`);
  }
  if (!isFinite(lngNum)) {
    throw new Error(`Invalid coordinate in ${context}: longitude ${lngNum} is not finite. Source: ${JSON.stringify({lat: latRaw, lng: lngRaw})}`);
  }

  // Validate geographic ranges: lat ∈ [-90, 90], lng ∈ [-180, 180]
  if (latNum < -90 || latNum > 90) {
    throw new Error(`Invalid coordinate in ${context}: latitude ${latNum} is outside valid range [-90, 90]. Source: ${JSON.stringify({lat: latRaw, lng: lngRaw})}`);
  }
  if (lngNum < -180 || lngNum > 180) {
    throw new Error(`Invalid coordinate in ${context}: longitude ${lngNum} is outside valid range [-180, 180]. Source: ${JSON.stringify({lat: latRaw, lng: lngRaw})}`);
  }

  // Reject (0, 0) as it's likely invalid (Gulf of Guinea, but unlikely to be a real deployment)
  if (latNum === 0 && lngNum === 0) {
    throw new Error(`Invalid coordinate in ${context}: coordinates (0, 0) are likely invalid. Source: ${JSON.stringify({lat: latRaw, lng: lngRaw})}`);
  }

  return { lat: latNum, lng: lngNum };
}

async function logJSONData() {
  // Get map data from global variable injected by Go template
  const spinner = document.getElementById("spinner-overlay");
  
  if (!window.MAP_DATA) {
    console.error("MAP_DATA not found. Check if the Go template is rendering correctly.");
    if (spinner) {
      spinner.style.display = "none";
    }
    return;
  }

  // Safety timeout: hide spinner after 5 seconds no matter what
  const safetyTimeout = setTimeout(() => {
    console.warn("Safety timeout: forcing spinner to hide");
    if (spinner) {
      spinner.style.display = "none";
    }
  }, 5000);
  
  try {
    const obj = JSON.parse(window.MAP_DATA);
    const telemetryData = obj.Telemetry || [];
    
    console.log("Processing", telemetryData.length, "telemetry entries");

    // Show spinner while loading markers
    if (spinner && telemetryData.length > 0) {
      spinner.style.display = "flex";
    }

    // Process markers in batches to avoid blocking the UI
    const batchSize = 50;
    let processedCount = 0;
    
    for (let i = 0; i < telemetryData.length; i += batchSize) {
      const batch = telemetryData.slice(i, i + batchSize);

      // Process batch asynchronously with proper yielding
      await new Promise(resolve => {
        setTimeout(() => {
          try {
            requestAnimationFrame(() => {
              try {
                batch.forEach((tel) => {
                  // Skip non-objects
                  if (!tel || typeof tel !== 'object') {
                    return;
                  }

                  // Check if coordinate properties exist
                  if (!('latitude' in tel) || !('longitude' in tel)) {
                    const context = `telemetry entry (ip: ${tel.ip_address || 'unknown'}, country: ${tel.country || 'unknown'})`;
                    console.error(`Missing coordinate properties in ${context}. Available keys: ${Object.keys(tel).join(', ')}`);
                    return;
                  }

                  // Validate coordinates using authoritative validator
                  let coords;
                  try {
                    const context = `telemetry entry (ip: ${tel.ip_address || 'unknown'}, country: ${tel.country || 'unknown'})`;
                    coords = assertValidLatLng(tel.latitude, tel.longitude, context);
                  } catch (validationError) {
                    // Log the error with full context - this is a data quality issue
                    console.error(validationError.message);
                    return;
                  }

                  // Create marker with validated coordinates
                  // No try-catch here - if L.circle fails with valid coords, it's a Leaflet bug
                  const last_seen = new Date(tel.last_seen);
                  const marker = L.circle([coords.lat, coords.lng], {
                    radius: 1000,
                  }).bindPopup(
                    `<h3>Deployment details</h3>
                              <p style="font-size: 12px;">version:\t${
                                tel.magistrala_version || "unknown"
                              }</p>
                              <p style="font-size: 12px;">last seen:\t${last_seen}</p>
                              <p style="font-size: 12px;">country:\t${
                                tel.country || "-"
                              }</p>
                              <p style="font-size: 12px;">city:\t${tel.city || "-"}</p>
                              <p style="font-size: 12px;">Services:\t${(tel.services || []).join(
                                ", "
                              )}</p>`
                  );

                  allMarkers.push({
                    marker: marker,
                    data: tel
                  });
                  processedCount++;
                });
              } catch (err) {
                console.error("Error processing batch:", err);
              }
              resolve();
            });
          } catch (err) {
            console.error("Error in requestAnimationFrame:", err);
            resolve(); // Always resolve to continue processing
          }
        }, 10); // Small delay to yield control
      });
    }

    console.log("Processed", processedCount, "markers, adding to map...");

    // Add all markers to the map and apply filters
    try {
      // Add markers to cluster group first
      allMarkers.forEach(function(item) {
        markerClusterGroup.addLayer(item.marker);
      });
      
      map.addLayer(markerClusterGroup);
      console.log("Markers added to map, hiding spinner...");
      
      // Hide spinner immediately after adding markers to map
      clearTimeout(safetyTimeout);
      if (spinner) {
        spinner.style.display = "none";
        console.log("Spinner hidden");
      }
      
      // Apply filters asynchronously to avoid blocking
      setTimeout(() => {
        try {
          filterMarkers({});
        } catch (err) {
          console.error("Error filtering markers:", err);
        }
      }, 100);
    } catch (err) {
      console.error("Error adding markers to map:", err);
      // Hide spinner on error
      clearTimeout(safetyTimeout);
      if (spinner) {
        spinner.style.display = "none";
      }
    }

  } catch (error) {
    console.error("Error loading map data:", error);
    // Always hide spinner on error
    clearTimeout(safetyTimeout);
    if (spinner) {
      spinner.style.display = "none";
    }
  }
}

// Initialize map data asynchronously
logJSONData();
