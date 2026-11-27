"""brief_script.py 대본을 오픈소스 한국어 TTS(MeloTTS, MIT)로 읽어 dashboard/data/brief.mp3·brief.json 생성.
GitHub Actions에서 실행 (CPU)."""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from brief_script import build_both

OUT = ROOT / 'dashboard' / 'data'
date, disp, lines = build_both()
meta_path = OUT / 'brief.json'
if meta_path.exists():
    old = json.load(open(meta_path, encoding='utf-8'))
    if old.get('date') == date and old.get('speech') == lines and (OUT / 'brief.mp3').exists():
        print('same script, skip'); sys.exit(0)

from melo.api import TTS
model = TTS(language='KR', device='cpu')
spk = model.hps.data.spk2id['KR']
sr = model.hps.data.sampling_rate
gap = np.zeros(int(sr * 0.35), dtype=np.float32)
chunks, starts, t = [], [], 0.0
for line in lines:
    audio = model.tts_to_file(line, spk, None, speed=1.05, quiet=True)
    audio = np.asarray(audio, dtype=np.float32)
    starts.append(round(t, 2))
    chunks += [audio, gap]
    t += (len(audio) + len(gap)) / sr
pcm = np.concatenate(chunks)
pcm = np.clip(pcm / max(1e-6, np.abs(pcm).max()) * 0.9, -1, 1)
wav = OUT / 'brief.wav'
with wave.open(str(wav), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((pcm * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-ac', '1', '-ar', '24000', '-b:a', '64k', str(OUT / 'brief.mp3')], check=True)
wav.unlink()
json.dump({'date': date, 'lines': disp, 'speech': lines, 'starts': starts, 'duration': round(t, 2), 'audio': 'brief.mp3', 'voice': 'MeloTTS 한국어 (오픈소스)'}, open(meta_path, 'w', encoding='utf-8'), ensure_ascii=False)
print('ok', date, len(lines), 'lines', round(t, 1), 's')
