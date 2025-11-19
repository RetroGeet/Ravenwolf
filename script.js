// New Hybrid Script Logic

// The old proxy URL is kept for the optional "live" attempt
const ICAL_URL = 'https://calendar.google.com/calendar/ical/ilsi4rnri8qtqnn95rsitlbq4c@group.calendar.google.com/private-2702f2b45bcbfe0dbf0256bedac6f46a/basic.ics';
const PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(ICAL_URL)}`;

// The new local fallback file (the result of the GitHub Action)
const FALLBACK_URL = '/data.json';
const TIMEOUT_MS = 8000; // 8 seconds to wait for live proxy

// --- HELPER FUNCTION (Same as before, moved here) ---
function toYYYYMMDD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// --- HYBRID FETCH LOGIC ---

// 1. Attempts to get live data via the proxy with a timeout
function fetchLiveCalendarWithTimeout(timeout) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Live proxy connection timed out')), timeout);

        fetch(PROXY_URL)
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error('Proxy returned an error status.');
                // We expect ICS text if successful
                return response.text(); 
            })
            .then(icsText => {
                // We must parse the ICS text using the ical.js library
                const jcalData = ICAL.parse(icsText);
                const comp = new ICAL.Component(jcalData);
                const vevents = comp.getAllSubcomponents('vevent');
                
                // Process the busy dates just like the Python script
                const busyDates = new Set();
                vevents.forEach(vevent => {
                    const event = new ICAL.Event(vevent);
                    const startDate = event.startDate.toJSDate();
                    const endDate = event.endDate.toJSDate();

                    let loopDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

                    while (loopDate < endDate) {
                        busyDates.add(toYYYYMMDD(loopDate));
                        loopDate.setDate(loopDate.getDate() + 1);
                    }
                });
                // Return the final busy list array
                resolve(Array.from(busyDates)); 
            })
            .catch(error => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

// 2. Attempts to get the local JSON file (the fallback)
function fetchFallback() {
    return fetch(FALLBACK_URL)
        .then(response => {
            if (!response.ok) throw new Error('Local data.json not found.');
            // Expecting JSON array from the GitHub Action
            return response.json(); 
        });
}


// --- MAIN EXECUTION ---
async function loadCalendarData() {
    let busyDates = [];
    let source = '';

    try {
        // RACE CONDITION: Try the live proxy. If it fails or times out, the catch block runs.
        busyDates = await fetchLiveCalendarWithTimeout(TIMEOUT_MS);
        source = 'Live (Fresh)';
    } catch (liveError) {
        console.warn('Live proxy failed or timed out. Falling back to local data.', liveError.message);
        
        try {
            // FALLBACK: Load the local JSON file
            busyDates = await fetchFallback();
            source = `Nightly (${new Date().toLocaleDateString()})`;
        } catch (fallbackError) {
            // CRITICAL FAILURE
            console.error('CRITICAL: Both live and fallback failed.', fallbackError);
            document.getElementById('loading').innerHTML = '<p style="color: red;">Error: Cannot load calendar data from any source.</p>';
            return;
        }
    }

    // Pass the final busy list to the rendering function
    generateAvailabilityList(busyDates, source);
}

// --- RENDERING FUNCTION (Largely Unchanged) ---
function generateAvailabilityList(busyDatesArray, source) {
    const listElement = document.getElementById('availability-list');
    const loadingElement = document.getElementById('loading');
    
    // Convert array back to Set for fast lookup
    const busyDates = new Set(busyDatesArray); 

    const today = new Date();
    // Start from the next Friday
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + (5 - today.getDay() + 7) % 7); 

    // Set the end date to Dec 31st of the next year
    const endYear = today.getFullYear() + 1;
    const finalDate = new Date(endYear, 11, 31);

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    let currentMonth = -1;

    // Loop through all days until the end date
    while (currentDate <= finalDate) {
        const dayOfWeek = currentDate.getDay();
        
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            
            // Add a month header 
            if (currentDate.getMonth() !== currentMonth) {
                currentMonth = currentDate.getMonth();
                const monthName = currentDate.toLocaleString('default', { month: 'long' });
                const monthHeader = document.createElement('li');
                monthHeader.innerHTML = `<h3>${monthName} ${currentDate.getFullYear()}</h3>`;
                monthHeader.style.backgroundColor = '#eee';
                monthHeader.style.textAlign = 'center';
                listElement.appendChild(monthHeader);
            }
            
            const dateString = toYYYYMMDD(currentDate);
            const li = document.createElement('li');
            li.textContent = currentDate.toLocaleString('en-GB', dateOptions);

            if (busyDates.has(dateString)) {
                li.classList.add('unavailable');
                li.textContent += ' - UNAVAILABLE';
            } else {
                li.classList.add('available');
                li.textContent += ' - AVAILABLE';
            }
            listElement.appendChild(li);
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Add the source note at the end of the list
    const sourceNote = document.createElement('li');
    sourceNote.style.fontSize = '0.7em';
    sourceNote.style.color = '#888';
    sourceNote.textContent = `Data Source: ${source}`;
    listElement.appendChild(sourceNote);


    loadingElement.style.display = 'none';
}

// Start the whole process
loadCalendarData();
