import json

# Read the audio.json file
with open('public/assets/audio.json', 'r', encoding='utf-8') as f:
    reciters = json.load(f)

# Update each reciter with type and reading fields
for reciter in reciters:
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
with open('public/assets/audio.json', 'w', encoding='utf-8') as f:
    json.dump(reciters, f, ensure_ascii=False, indent=2)

print(f"Updated {len(reciters)} reciters with style and reading metadata")
