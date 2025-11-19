# update_data.py (FINAL, ROBUST CORRECTION)

import os
import requests
import json
from icalendar import Calendar
from datetime import datetime, timedelta, date

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
            dtstart = component.get('dtstart').dt
            dtend = component.get('dtend').dt
            
            # --- FIX 1: Normalize dtend to a naive datetime object ---
            if isinstance(dtend, datetime):
                # Strip any timezone info to make it "naive" (comparable)
                end_time_comparison = dtend.replace(tzinfo=None) 
            else:
                # If it's a simple date, convert to datetime at midnight
                end_time_comparison = datetime.combine(dtend, datetime.min.time())
            
            # --- FIX 2: Normalize dtstart and set loop start ---
            if isinstance(dtstart, datetime):
                # Strip timezone and normalize to midnight of the start day
                start_date_normalized = datetime(dtstart.year, dtstart.month, dtstart.day)
            else:
                # Simple date converted to datetime at midnight
                start_date_normalized = datetime.combine(dtstart, datetime.min.time())
            
            current_date = start_date_normalized
            
            # Loop condition now compares two strictly defined naive datetime objects
            while current_date < end_time_comparison:
                date_str = current_date.strftime('%Y-%m-%d')
                busy_dates.add(date_str)
                current_date += timedelta(days=1)
                
        except Exception as e:
            # We will ignore errors caused by tricky recurrences and log them
            # This is the line that will show the successful processing going forward
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
