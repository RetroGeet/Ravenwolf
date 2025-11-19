# update_data.py

import os
import requests
import json
from icalendar import Calendar
from datetime import datetime, timedelta

def get_busy_dates(ical_url):
    # Fetch data (server-to-server)
    try:
        response = requests.get(ical_url, timeout=15)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching iCal URL: {e}")
        return []

    cal = Calendar.from_ical(response.text)
    busy_dates = set()

    for component in cal.walk('vevent'):
        try:
            dtstart_comp = component.get('dtstart')
            dtend_comp = component.get('dtend')
            if not dtstart_comp or not dtend_comp: continue
            
            dtstart = dtstart_comp.dt
            dtend = dtend_comp.dt
            
            # Normalize to the start of the day (handling date vs datetime objects)
            if not isinstance(dtstart, datetime):
                start_date = datetime.combine(dtstart, datetime.min.time())
            else:
                start_date = datetime(dtstart.year, dtstart.month, dtstart.day)
            
            current_date = start_date
            
            # Loop, adding one day at a time
            while current_date < dtend:
                date_str = current_date.strftime('%Y-%m-%d')
                busy_dates.add(date_str)
                current_date += timedelta(days=1)
                
        except Exception as e:
            print(f"Error processing event: {e}")
            
    return sorted(list(busy_dates))

# Get the secret URL from the GitHub environment variable
ICAL_URL = os.environ.get('ICAL_SECRET_URL')
if not ICAL_URL:
    print("Error: ICAL_SECRET_URL is not set.")
    exit(1)

# Generate the busy list and save it locally
busy_list = get_busy_dates(ICAL_URL)
with open('data.json', 'w') as f:
    json.dump(busy_list, f, indent=4)

print(f"Successfully updated data.json with {len(busy_list)} busy dates.")
