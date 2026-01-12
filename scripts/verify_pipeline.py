
import requests
import time
import sys
import os
import json
import wave
import struct

BASE_URL = "http://localhost:5001/api"
TEST_FILE = "test_audio_verify.wav"
OUTPUT_FILE = "verified_output.wav"

def create_test_audio(filename):
    print(f"Generating test audio: {filename}...")
    sample_rate = 44100
    duration = 2  # seconds
    n_frames = sample_rate * duration
    
    with wave.open(filename, 'w') as obj:
        obj.setnchannels(1)  # mono
        obj.setsampwidth(2)  # 2 bytes
        obj.setframerate(sample_rate)
        
        # Generate 440Hz sine wave
        import math
        amplitude = 32767 // 2
        frequency = 440
        data = bytearray()
        for i in range(n_frames):
            value = int(amplitude * math.sin(2 * math.pi * frequency * i / sample_rate))
            data.extend(struct.pack('<h', value))
        obj.writeframes(data)
    print("Test audio created.")

def check_health():
    try:
        r = requests.get(f"{BASE_URL}/health")
        r.raise_for_status()
        print("✅ Backend Health: OK")
        return True
    except Exception as e:
        print(f"❌ Backend Health Failed: {e}")
        return False

def upload_file(filename):
    print("Uploading file...")
    with open(filename, 'rb') as f:
        r = requests.post(f"{BASE_URL}/upload", files={'file': f})
        r.raise_for_status()
        data = r.json()
        print(f"✅ Upload Successful. File ID: {data['file_id']}")
        return data['file_id']

def process_file(file_id):
    print("Starting processing job...")
    payload = {
        "file_id": file_id,
        "config": {
            "denoiseStrength": 0.5,
            "upscaleFactor": 1
        }
    }
    r = requests.post(f"{BASE_URL}/process", json=payload)
    r.raise_for_status()
    data = r.json()
    print(f"✅ Job Started. Job ID: {data['job_id']}")
    return data['job_id']

def poll_status(job_id):
    print("Polling for completion...")
    while True:
        r = requests.get(f"{BASE_URL}/status/{job_id}")
        r.raise_for_status()
        data = r.json()
        status = data['status']
        stage = data.get('current_stage', 'unknown')
        progress = data.get('progress', 0)
        
        sys.stdout.write(f"\rStatus: {status} | Stage: {stage} | Progress: {progress}%   ")
        sys.stdout.flush()
        
        if status == 'complete':
            print("\n✅ Processing Complete!")
            return True
        elif status == 'error':
            print(f"\n❌ Processing Failed: {data.get('error')}")
            return False
            
        time.sleep(1)

def download_output(job_id, output_filename):
    print(f"Downloading output to {output_filename}...")
    r = requests.get(f"{BASE_URL}/download/{job_id}", stream=True)
    r.raise_for_status()
    with open(output_filename, 'wb') as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    print("✅ Download Successful.")
    
    # Verify file is a valid WAV
    try:
        with wave.open(output_filename, 'rb') as wav:
            print(f"✅ Verified Output WAV: {wav.getnchannels()}ch, {wav.getframerate()}Hz")
    except Exception as e:
        print(f"❌ Output Verification Failed: {e}")
        return False
    return True

def main():
    print("--- VOXIS PIPELINE VERIFICATION ---")
    
    if not check_health():
        sys.exit(1)
        
    create_test_audio(TEST_FILE)
    
    try:
        file_id = upload_file(TEST_FILE)
        job_id = process_file(file_id)
        if poll_status(job_id):
            download_output(job_id, OUTPUT_FILE)
            print("\n🎉 ALL TESTS PASSED SUCCESSFULLY")
        else:
            print("\n❌ TESTS FAILED AT PROCESSING")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    finally:
        # Cleanup
        if os.path.exists(TEST_FILE):
            os.remove(TEST_FILE)
        if os.path.exists(OUTPUT_FILE):
            os.remove(OUTPUT_FILE)

if __name__ == "__main__":
    main()
