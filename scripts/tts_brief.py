"""brief_script.py 대본을 음성으로 읽어 dashboard/data/brief.mp3·brief.json 생성 (GitHub Actions).
- 저장소 Secret ELEVENLABS_API_KEY + Variable ELEVENLABS_VOICE_ID 가 있으면 ElevenLabs 사용
- 없거나 실패하면(또는 FORCE_MELO=1) 오픈소스 MeloTTS(MIT, CPU)로 만든다."""
import json, os, subprocess, sys, wave, urllib.request
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from brief_script import build_both

OUT = ROOT / 'dashboard' / 'data'
date, disp, lines = build_both()
meta_path = OUT / 'brief.json'
KEY = os.environ.get('ELEVENLABS_API_KEY', '').strip()
VID = os.environ.get('ELEVENLABS_VOICE_ID', '').strip()
EL_MODEL = os.environ.get('ELEVENLABS_MODEL', '').strip() or 'eleven_multilingual_v2'
use_el = bool(KEY and VID) and os.environ.get('FORCE_MELO') != '1'
voice_tag = f'ElevenLabs {VID} {EL_MODEL}' if use_el else 'MeloTTS 한국어 (오픈소스)'
if meta_path.exists():
    old = json.load(open(meta_path, encoding='utf-8'))
    if old.get('date') == date and old.get('speech') == lines and old.get('voice_tag', 'MeloTTS 한국어 (오픈소스)') == voice_tag and (OUT / 'brief.mp3').exists():
        print('same script, skip'); sys.exit(0)


def el_line(text, prev, nxt):
    url = f'https://api.elevenlabs.io/v1/text-to-speech/{VID}?output_format=pcm_24000'
    body = {'text': text, 'model_id': EL_MODEL, 'previous_text': prev, 'next_text': nxt,
            'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.2, 'speed': 1.05}}
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST',
                                 headers={'xi-api-key': KEY, 'Content-Type': 'application/json', 'Accept': 'audio/pcm'})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    return np.frombuffer(raw[: len(raw) // 2 * 2], dtype='<i2').astype(np.float32) / 32768


def synth():
    if use_el:
        sr = 24000
        gen = lambda i, line: el_line(line, lines[i - 1] if i else '', lines[i + 1] if i + 1 < len(lines) else '')
    else:
        from melo.api import TTS
        model = TTS(language='KR', device='cpu')
        spk = model.hps.data.spk2id['KR']
        sr = model.hps.data.sampling_rate
        gen = lambda i, line: np.asarray(model.tts_to_file(line, spk, None, speed=1.05, quiet=True), dtype=np.float32)
    gap = np.zeros(int(sr * 0.35), dtype=np.float32)
    chunks, starts, t = [], [], 0.0
    for i, line in enumerate(lines):
        audio = gen(i, line)
        starts.append(round(t, 2))
        chunks += [audio, gap]
        t += (len(audio) + len(gap)) / sr
    return sr, chunks, starts, t


try:
    sr, chunks, starts, t = synth()
except Exception as e:
    if not use_el:
        raise
    print('ElevenLabs 실패 → MeloTTS로 다시 만들기 필요:', e)
    sys.exit(3)
pcm = np.concatenate(chunks)
pcm = np.clip(pcm / max(1e-6, np.abs(pcm).max()) * 0.9, -1, 1)
wav = OUT / 'brief.wav'
with wave.open(str(wav), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((pcm * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-ac', '1', '-ar', '24000', '-b:a', '64k', str(OUT / 'brief.mp3')], check=True)
wav.unlink()
json.dump({'date': date, 'lines': disp, 'speech': lines, 'starts': starts, 'duration': round(t, 2), 'audio': 'brief.mp3', 'voice': 'ElevenLabs AI 음성' if use_el else 'MeloTTS 한국어 (오픈소스)', 'voice_tag': voice_tag}, open(meta_path, 'w', encoding='utf-8'), ensure_ascii=False)
print('ok', date, len(lines), 'lines', round(t, 1), 's')
