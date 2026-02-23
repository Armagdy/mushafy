import json

# Read the consolidated reciters.json file
with open('public/assets/reciters.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

reciters = data['reciters']

# Update each EveryAyah reciter with type and reading fields
everyayah_count = 0
for reciter in reciters:
    # Only process EveryAyah reciters
    if reciter.get('source') != 'everyayah':
        continue
    
    everyayah_count += 1
    
    # Determine recitation style (type)
    name_lower = reciter['name'].lower()
    folder_lower = reciter['folder'].lower()
    
    if 'mujawwad' in name_lower or 'mujawwad' in folder_lower:
        reciter['style'] = 'mujawwad'
    else:
        reciter['style'] = 'murattal'
    
    # Determine reading type
    if 'warsh' in folder_lower or 'warsh' in name_lower:
        reciter['reading'] = 'warsh'
        reciter['readingAr'] = 'ورش'
    else:
        reciter['reading'] = 'hafs'
        reciter['readingAr'] = 'حفص'

# Write back to file
with open('public/assets/reciters.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Updated {everyayah_count} EveryAyah reciters with style and reading metadata")
