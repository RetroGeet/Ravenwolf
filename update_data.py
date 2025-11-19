# update_data.py

import os
import requests
import json
from icalendar import Calendar
from datetime import datetime, timedelta, date

def get_busy_dates(ical_url):
    # Fetch data
    try:
        response = requests.get(ical_url, timeout=15)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching iCal URL: {e}")
        return []

    cal = Calendar.from_ical(response.text)
    busy_dates = set()
    event_count = 0
    
    for component in cal.walk('vevent'):
        try:
            # 1. Extract the raw objects
            dtstart_prop = component.get('dtstart')
            dtend_prop = component.get('dtend')

            if not dtstart_prop or not dtend_prop:
                continue

            dtstart = dtstart_prop.dt
            dtend = dtend_prop.dt

            # 2. Force EVERYTHING to be a simple date object (strips time & timezone)
            if isinstance(dtstart, datetime):
                start_date = dtstart.date()
            else:
                start_date = dtstart # It is already a date

            if isinstance(dtend, datetime):
                end_date = dtend.date()
            else:
                end_date = dtend # It is already a date

            # 3. Handle Single Day Timed Events (e.g., Gig 7pm - 11pm)
            # If start and end are the same day, the loop below wouldn't run. 
            # We force the end date to be at least 1 day after start.
            if end_date <= start_date:
                end_date = start_date + timedelta(days=1)

            # 4. Loop through the days
            current_date = start_date
            while current_date < end_date:
                busy_dates.add(current_date.strftime('%Y-%m-%d'))
                current_date += timedelta(days=1)
            
            event_count += 1

        except Exception as e:
            # Log error but keep processing other events
            print(f"Skipping specific event due to data error: {e}")
            
    print(f"Successfully processed {event_count} events.")
    return sorted(list(busy_dates))

# Get the secret URL from the GitHub environment variable
ICAL_URL = os.environ.get('ICAL_SECRET_URL')
if not ICAL_URL:
    print("Error: ICAL_SECRET_URL is not set.")
    exit(1)

# Generate the busy list and save it locally
busy_list = get_busy_dates(ICAL_URL)

# Write the file
with open('data.json', 'w') as f:
    json.dump(busy_list, f, indent=4)

print(f"Finished. Saved {len(busy_list)} busy days to data.json.")
