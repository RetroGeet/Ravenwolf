// Your unique "Secret iCal Address"
const ICAL_URL = 'https://calendar.google.com/calendar/ical/ilsi4rnri8qtqnn95rsitlbq4c@group.calendar.google.com/private-2702f2b45bcbfe0dbf0256bedac6f46a/basic.ics';


// Run the script once the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchCalendar();
});

async function fetchCalendar() {
    // We are still using the proxy
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(ICAL_URL)}`;

    try {
        // We now fetch the new proxy URL
        const response = await fetch(proxyUrl); 
        if (!response.ok) {
            throw new Error('Failed to fetch calendar. Check the iCal URL.');
        }
        const data = await response.text();
        
        // Parse the iCal data
        const jcalData = ICAL.parse(data);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        // Create a Set of all busy dates for fast lookup
        const busyDates = new Set();
        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            const startDate = event.startDate.toJSDate();
            const endDate = event.endDate.toJSDate();

            // Normalize the start date to midnight (local time)
            let loopDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

            // Loop from the normalized start date until we are no longer before the end date
            while (loopDate < endDate) {
                
                // ⬇️ ⬇️ ⬇️ THIS IS THE FIX ⬇️ ⬇️ ⬇️
                // Format the date string manually to avoid UTC conversion errors
                const dateString = toYYYYMMDD(loopDate);
                busyDates.add(dateString);
                // ⬆️ ⬆️ ⬆️ THIS IS THE FIX ⬆️ ⬆️ ⬆️
                
                // Increment the loop date by one day
                loopDate.setDate(loopDate.getDate() + 1);
            }
        });

        // Now, generate the list of Fridays and Saturdays
        generateAvailabilityList(busyDates);

    } catch (error) {
        console.error('Error fetching or parsing calendar:', error);
        document.getElementById('loading').innerHTML = '<p style="color: red;">Error loading calendar. Please check the console.</p>';
    }
}

function generateAvailabilityList(busyDates) {
    const listElement = document.getElementById('availability-list');
    const today = new Date();
    // Set 'currentDate' to the *next* Friday to start our loop
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + (5 - today.getDay() + 7) % 7); // Find next Friday

    // Set the end date to Dec 31st of the *next* year
    const endYear = today.getFullYear() + 1;
    const finalDate = new Date(endYear, 11, 31); // 11 = December

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    let currentMonth = -1;

    // Loop through all days until the end date
    while (currentDate <= finalDate) {
        // Check if the day is a Friday (5) or Saturday (6)
        const dayOfWeek = currentDate.getDay();
        
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            
            // Add a month header if it's a new month
            if (currentDate.getMonth() !== currentMonth) {
                currentMonth = currentDate.getMonth();
                const monthName = currentDate.toLocaleString('default', { month: 'long' });
                const monthHeader = document.createElement('li');
                monthHeader.innerHTML = `<h3>${monthName} ${currentDate.getFullYear()}</h3>`;
                monthHeader.style.backgroundColor = '#eee';
                monthHeader.style.textAlign = 'center';
                listElement.appendChild(monthHeader);
            }
            
            // ⬇️ ⬇️ ⬇️ THIS IS THE SECOND FIX ⬇️ ⬇️ ⬇️
            // Format the date string manually to match the Set
            const dateString = toYYYYMMDD(currentDate);
            // ⬆️ ⬆️ ⬆️ THIS IS THE SECOND FIX ⬆️ ⬆️ ⬆️

            const li = document.createElement('li');
            li.textContent = currentDate.toLocaleString('en-GB', dateOptions);

            // Check if this date is in our busy Set
            if (busyDates.has(dateString)) {
                li.classList.add('unavailable');
                li.textContent += ' - UNAVAILABLE';
            } else {
                li.classList.add('available');
                li.textContent += ' - AVAILABLE';
            }
            listElement.appendChild(li);
        }

        // Move to the next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Hide the "Loading..." message
    document.getElementById('loading').style.display = 'none';
}


// ⬇️ ⬇️ ⬇️ THIS IS THE NEW HELPER FUNCTION ⬇️ ⬇️ ⬇️
// Formats a Date object as 'YYYY-MM-DD' in local time
function toYYYYMMDD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0'); // +1 because month is 0-indexed
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
// ⬆️ ⬆️ ⬆️ THIS IS THE NEW HELPER FUNCTION ⬆️ ⬆️ ⬆️
