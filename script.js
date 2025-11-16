// Your unique "Secret iCal Address" is pasted here
const ICAL_URL = 'https://calendar.google.com/calendar/ical/ilsi4rnri8qtq4c%40group.calendar.google.com/private-2702f2b45bcbfe0dbf0256bedac6f46a/basic.ics';


// Run the script once the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchCalendar();
});

async function fetchCalendar() {
    // THIS IS THE FIX: We use a proxy to get around the CORS security error.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(ICAL_URL)}`;

    try {
        // We now fetch the proxy URL instead of the direct iCal URL
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
            
            // Handle multi-day events
            const endDate = event.endDate.toJSDate();
            // For all-day events, endDate is the start of the *next* day, so this loop works
            for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
                busyDates.add(d.toISOString().split('T')[0]); // Add 'YYYY-MM-DD' format
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
            
            const dateString = currentDate.toISOString().split('T')[0];
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
