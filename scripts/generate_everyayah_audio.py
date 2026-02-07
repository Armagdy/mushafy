import json

# List of all reciters with their display names, Arabic names, and folder names
RECITERS = [
    {"name": "Abdul Basit Abdul Samad", "nameAr": "عبد الباسط عبد الصمد", "folder": "AbdulSamad_64kbps_QuranExplorer.Com"},
    {"name": "Abdul Basit Mujawwad", "nameAr": "عبد الباسط عبد الصمد - مجود", "folder": "Abdul_Basit_Mujawwad_128kbps"},
    {"name": "Abdul Basit Murattal (192kbps)", "nameAr": "عبد الباسط عبد الصمد - مرتل", "folder": "Abdul_Basit_Murattal_192kbps"},
    {"name": "Abdul Basit Murattal (64kbps)", "nameAr": "عبد الباسط عبد الصمد - مرتل", "folder": "Abdul_Basit_Murattal_64kbps"},
    {"name": "Abdullaah Awaad Al-Juhaynee", "nameAr": "عبد الله عواد الجهني", "folder": "Abdullaah_3awwaad_Al-Juhaynee_128kbps"},
    {"name": "Abdullah Basfar (192kbps)", "nameAr": "عبد الله بصفر", "folder": "Abdullah_Basfar_192kbps"},
    {"name": "Abdullah Basfar (32kbps)", "nameAr": "عبد الله بصفر", "folder": "Abdullah_Basfar_32kbps"},
    {"name": "Abdullah Basfar (64kbps)", "nameAr": "عبد الله بصفر", "folder": "Abdullah_Basfar_64kbps"},
    {"name": "Abdullah Matroud", "nameAr": "عبد الله مطرود", "folder": "Abdullah_Matroud_128kbps"},
    {"name": "Abdurrahmaan As-Sudais (192kbps)", "nameAr": "عبد الرحمن السديس", "folder": "Abdurrahmaan_As-Sudais_192kbps"},
    {"name": "Abdurrahmaan As-Sudais (64kbps)", "nameAr": "عبد الرحمن السديس", "folder": "Abdurrahmaan_As-Sudais_64kbps"},
    {"name": "Abu Bakr Ash-Shaatree (128kbps)", "nameAr": "أبو بكر الشاطري", "folder": "Abu_Bakr_Ash-Shaatree_128kbps"},
    {"name": "Abu Bakr Ash-Shaatree (64kbps)", "nameAr": "أبو بكر الشاطري", "folder": "Abu_Bakr_Ash-Shaatree_64kbps"},
    {"name": "Ahmed Neana", "nameAr": "أحمد نعينع", "folder": "Ahmed_Neana_128kbps"},
    {"name": "Ahmed Ibn Ali Al-Ajamy (ketaballah)", "nameAr": "أحمد بن علي العجمي", "folder": "Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net"},
    {"name": "Ahmed Ibn Ali Al-Ajamy (QuranExplorer)", "nameAr": "أحمد بن علي العجمي", "folder": "Ahmed_ibn_Ali_al-Ajamy_64kbps_QuranExplorer.Com"},
    {"name": "Akram AlAlaqimy", "nameAr": "أكرم العلاقمي", "folder": "Akram_AlAlaqimy_128kbps"},
    {"name": "Alafasy (128kbps)", "nameAr": "مشاري راشد العفاسي", "folder": "Alafasy_128kbps"},
    {"name": "Alafasy (64kbps)", "nameAr": "مشاري راشد العفاسي", "folder": "Alafasy_64kbps"},
    {"name": "Ali Hajjaj AlSuesy", "nameAr": "علي حجاج السويسي", "folder": "Ali_Hajjaj_AlSuesy_128kbps"},
    {"name": "Ali Jaber", "nameAr": "علي جابر", "folder": "Ali_Jaber_64kbps"},
    {"name": "Ayman Sowaid", "nameAr": "أيمن سويد", "folder": "Ayman_Sowaid_64kbps"},
    {"name": "Sahih Ibrahim (English)", "nameAr": "إبراهيم ووك - ترجمة إنجليزية", "folder": "English/Sahih_Intnl_Ibrahim_Walk_192kbps"},
    {"name": "Fares Abbad", "nameAr": "فارس عباد", "folder": "Fares_Abbad_64kbps"},
    {"name": "Ghamadi", "nameAr": "سعد الغامدي", "folder": "Ghamadi_40kbps"},
    {"name": "Hani Rifai (192kbps)", "nameAr": "هاني الرفاعي", "folder": "Hani_Rifai_192kbps"},
    {"name": "Hani Rifai (64kbps)", "nameAr": "هاني الرفاعي", "folder": "Hani_Rifai_64kbps"},
    {"name": "Hudhaify (128kbps)", "nameAr": "علي الحذيفي", "folder": "Hudhaify_128kbps"},
    {"name": "Hudhaify (32kbps)", "nameAr": "علي الحذيفي", "folder": "Hudhaify_32kbps"},
    {"name": "Hudhaify (64kbps)", "nameAr": "علي الحذيفي", "folder": "Hudhaify_64kbps"},
    {"name": "Al Husary (128kbps)", "nameAr": "محمود خليل الحصري", "folder": "Husary_128kbps"},
    {"name": "Al Husary - Mujawwad (128kbps)", "nameAr": "محمود خليل الحصري - مجود", "folder": "Husary_128kbps_Mujawwad"},
    {"name": "Al Husary (64kbps)", "nameAr": "محمود خليل الحصري", "folder": "Husary_64kbps"},
    {"name": "Al Husary - Muallim", "nameAr": "محمود خليل الحصري - معلم", "folder": "Husary_Muallim_128kbps"},
    {"name": "Al Husary - Mujawwad (64kbps)", "nameAr": "محمود خليل الحصري - مجود", "folder": "Husary_Mujawwad_64kbps"},
    {"name": "Ibrahim Akhdar (32kbps)", "nameAr": "إبراهيم الأخضر", "folder": "Ibrahim_Akhdar_32kbps"},
    {"name": "Ibrahim Akhdar (64kbps)", "nameAr": "إبراهيم الأخضر", "folder": "Ibrahim_Akhdar_64kbps"},
    {"name": "Karim Mansoori", "nameAr": "كريم منصوري", "folder": "Karim_Mansoori_40kbps"},
    {"name": "Khaalid Abdullaah Al-Qahtaanee", "nameAr": "خالد عبد الله القحطاني", "folder": "Khaalid_Abdullaah_al-Qahtaanee_192kbps"},
    {"name": "Maher AlMuaiqly (128kbps)", "nameAr": "ماهر المعيقلي", "folder": "MaherAlMuaiqly128kbps"},
    {"name": "Maher AlMuaiqly (64kbps)", "nameAr": "ماهر المعيقلي", "folder": "Maher_AlMuaiqly_64kbps"},
    {"name": "Al Menshawi (16kbps)", "nameAr": "محمد صديق المنشاوي", "folder": "Menshawi_16kbps"},
    {"name": "Al Menshawi (32kbps)", "nameAr": "محمد صديق المنشاوي", "folder": "Menshawi_32kbps"},
    {"name": "Al Minshawy - Mujawwad (192kbps)", "nameAr": "محمد صديق المنشاوي - مجود", "folder": "Minshawy_Mujawwad_192kbps"},
    {"name": "Al Minshawy - Mujawwad (64kbps)", "nameAr": "محمد صديق المنشاوي - مجود", "folder": "Minshawy_Mujawwad_64kbps"},
    {"name": "Al Minshawy - Murattal", "nameAr": "محمد صديق المنشاوي - مرتل", "folder": "Minshawy_Murattal_128kbps"},
    {"name": "Mohammad Al Tablaway (128kbps)", "nameAr": "محمد الطبلاوي", "folder": "Mohammad_al_Tablaway_128kbps"},
    {"name": "Mohammad Al Tablaway (64kbps)", "nameAr": "محمد الطبلاوي", "folder": "Mohammad_al_Tablaway_64kbps"},
    {"name": "Muhammad AbdulKareem", "nameAr": "محمد عبد الكريم", "folder": "Muhammad_AbdulKareem_128kbps"},
    {"name": "Muhammad Ayyoub (128kbps)", "nameAr": "محمد أيوب", "folder": "Muhammad_Ayyoub_128kbps"},
    {"name": "Muhammad Ayyoub (32kbps)", "nameAr": "محمد أيوب", "folder": "Muhammad_Ayyoub_32kbps"},
    {"name": "Muhammad Ayyoub (64kbps)", "nameAr": "محمد أيوب", "folder": "Muhammad_Ayyoub_64kbps"},
    {"name": "Muhammad Jibreel (128kbps)", "nameAr": "محمد جبريل", "folder": "Muhammad_Jibreel_128kbps"},
    {"name": "Muhammad Jibreel (64kbps)", "nameAr": "محمد جبريل", "folder": "Muhammad_Jibreel_64kbps"},
    {"name": "Muhsin Al Qasim", "nameAr": "محسن القاسم", "folder": "Muhsin_Al_Qasim_192kbps"},
    {"name": "Basfar - MultiLanguage", "nameAr": "عبد الله بصفر - متعدد اللغات", "folder": "MultiLanguage/Basfar_Walk_192kbps"},
    {"name": "Mustafa Ismail", "nameAr": "مصطفى إسماعيل", "folder": "Mustafa_Ismail_48kbps"},
    {"name": "Nabil Rifa3i", "nameAr": "نبيل الرفاعي", "folder": "Nabil_Rifa3i_48kbps"},
    {"name": "Nasser Alqatami", "nameAr": "ناصر القطامي", "folder": "Nasser_Alqatami_128kbps"},
    {"name": "Parhizgar", "nameAr": "شهريار پرهیزگار", "folder": "Parhizgar_48kbps"},
    {"name": "Sahl Yassin", "nameAr": "سهل ياسين", "folder": "Sahl_Yassin_128kbps"},
    {"name": "Salaah AbdulRahman Bukhatir", "nameAr": "صلاح عبد الرحمن بوخاطر", "folder": "Salaah_AbdulRahman_Bukhatir_128kbps"},
    {"name": "Salah Al Budair", "nameAr": "صلاح البدير", "folder": "Salah_Al_Budair_128kbps"},
    {"name": "Saood Ash-Shuraym (128kbps)", "nameAr": "سعود الشريم", "folder": "Shuraym_128kbps"},
    {"name": "Saood Ash-Shuraym (64kbps)", "nameAr": "سعود الشريم", "folder": "Shuraym_64kbps"},
    {"name": "Yaser Salamah", "nameAr": "ياسر سلامة", "folder": "Yaser_Salamah_128kbps"},
    {"name": "Yasser Ad-Dussary", "nameAr": "ياسر الدوسري", "folder": "Dussary_128kbps"},
    {"name": "Ahmed Ibn Ali Al-Ajamy (128kbps)", "nameAr": "أحمد بن علي العجمي", "folder": "ahmed_ibn_ali_al_ajamy_128kbps"},
    {"name": "Aziz Alili", "nameAr": "عزيز عليلي", "folder": "aziz_alili_128kbps"},
    {"name": "Khalefa Al Tunaiji", "nameAr": "خليفة الطنيجي", "folder": "khalefa_al_tunaiji_64kbps"},
    {"name": "Mahmoud Ali Al Banna", "nameAr": "محمود علي البنا", "folder": "mahmoud_ali_al_banna_32kbps"},
    {"name": "Hedayatfar - with translations by Fooladvand", "nameAr": "هدایت فر - مع ترجمة فولادوند", "folder": "translations/Fooladvand_Hedayatfar_40Kbps"},
    {"name": "Makarem Kabiri - with translations", "nameAr": "مکارم کبیری - مع ترجمة", "folder": "translations/Makarem_Kabiri_16Kbps"},
    {"name": "Balayev - with azerbaijani translations", "nameAr": "بالاييف - مع ترجمة أذربيجانية", "folder": "translations/azerbaijani/balayev"},
    {"name": "Besim Korkut - with translations", "nameAr": "بسيم كوركوت - مع ترجمة", "folder": "translations/besim_korkut_ajet_po_ajet"},
    {"name": "Farhat Hashmi - with Urdu translations", "nameAr": "فرحت هاشمي - مع ترجمة أردية", "folder": "translations/urdu_farhat_hashmi"},
    {"name": "Shamshad Ali Khan - with Urdu translations", "nameAr": "شمشاد علي خان - مع ترجمة أردية", "folder": "translations/urdu_shamshad_ali_khan_46kbps"},
    {"name": "Abdul Basit - warsh", "nameAr": "عبد الباسط عبد الصمد - ورش", "folder": "warsh/warsh_Abdul_Basit_128kbps"},
    {"name": "Ibrahim Al Dosary - warsh", "nameAr": "إبراهيم الدوسري - ورش", "folder": "warsh/warsh_ibrahim_aldosary_128kbps"},
    {"name": "Yassin Al Jazaery - warsh", "nameAr": "ياسين الجزائري - ورش", "folder": "warsh/warsh_yassin_al_jazaery_64kbps"}
]

# Number of ayahs in each surah
SURAH_AYAH_COUNT = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99,
    128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38,
    29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18,
    12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29,
    19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8,
    11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
]

def generate_audio_url(reciter_folder, surah, ayah):
    """Generate the audio URL for a specific ayah."""
    surah_str = str(surah).zfill(3)
    ayah_str = str(ayah).zfill(3)
    return f"https://everyayah.com/data/{reciter_folder}/{surah_str}{ayah_str}.mp3"

def generate_reciter_data():
    """Generate JSON data for all reciters."""
    reciters_data = []
    
    for reciter in RECITERS:
        reciter_info = {
            "name": reciter["name"],
            "nameAr": reciter["nameAr"],
            "folder": reciter["folder"],
            "baseUrl": f"https://everyayah.com/data/{reciter['folder']}",
            "surahs": []
        }
        
        # Generate data for each surah
        for surah_num in range(1, 115):  # 114 surahs
            ayah_count = SURAH_AYAH_COUNT[surah_num - 1]
            surah_data = {
                "surahNumber": surah_num,
                "ayahCount": ayah_count,
                "ayahs": []
            }
            
            # Generate URLs for each ayah
            for ayah_num in range(1, ayah_count + 1):
                ayah_data = {
                    "ayahNumber": ayah_num,
                    "audioUrl": generate_audio_url(reciter["folder"], surah_num, ayah_num)
                }
                surah_data["ayahs"].append(ayah_data)
            
            reciter_info["surahs"].append(surah_data)
        
        reciters_data.append(reciter_info)
    
    return reciters_data

def extract_quality(folder_name):
    """Extract quality (bitrate) from folder name."""
    import re
    match = re.search(r'(\d+)kbps', folder_name, re.IGNORECASE)
    if match:
        return f"{match.group(1)}kbps"
    return "unknown"

def generate_simplified_format():
    """Generate a simplified JSON format with just reciter info and base URL pattern."""
    reciters_simple = []
    
    for reciter in RECITERS:
        reciter_info = {
            "name": reciter["name"],
            "nameAr": reciter["nameAr"],
            "folder": reciter["folder"],
            "quality": extract_quality(reciter["folder"]),
            "baseUrl": f"https://everyayah.com/data/{reciter['folder']}",
            "urlPattern": f"https://everyayah.com/data/{reciter['folder']}/SSSAAA.mp3",
            "description": "SSS = Surah number (3 digits), AAA = Ayah number (3 digits)"
        }
        reciters_simple.append(reciter_info)
    
    return reciters_simple

if __name__ == "__main__":
    print("Generating EveryAyah audio data...")
    
    # Generate simplified format only
    print("\nGenerating simplified format (reciters with URL pattern)...")
    simple_data = generate_simplified_format()
    with open("everyayah_reciters_simple.json", "w", encoding="utf-8") as f:
        json.dump(simple_data, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved to everyayah_reciters_simple.json ({len(simple_data)} reciters)")
    
    print("\n✓ File generated successfully!")
    print("\nYou can construct URLs on the fly using the pattern: baseUrl + '/' + surahNum(3-digit) + ayahNum(3-digit) + '.mp3'")
