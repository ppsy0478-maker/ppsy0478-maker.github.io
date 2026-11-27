"""Supertonic 한국어 목소리 샘플 만들기 → /tmp/samples/*.mp3"""
import subprocess, sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from brief_script import build_both
from supertonic import TTS
out = Path('samples'); out.mkdir(exist_ok=True)
d, disp, sp = build_both()
text = ' '.join(disp[:3])
tts = TTS(auto_download=True)
names = []
for v in [f'{g}{i}' for g in 'FM' for i in range(1, 6)]:
    try:
        style = tts.get_voice_style(voice_name=v)
    except Exception as e:
        print('skip', v, e); continue
    wav, dur = tts.synthesize(text, voice_style=style, lang='ko')
    p = out / f'{v}.wav'; tts.save_audio(wav, str(p))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(p), '-ac', '1', '-b:a', '64k', str(out / f'{v}.mp3')], check=True); p.unlink()
    names.append(v); print('ok', v, round(float(dur if not hasattr(dur, '__len__') else dur[0]), 1))
# 숫자 처리 비교용: 읽기용(한글로 바꾼) 문장
style = tts.get_voice_style(voice_name=names[0])
wav, dur = tts.synthesize(' '.join(sp[:3]), voice_style=style, lang='ko')
tts.save_audio(wav, str(out / 'cmp.wav'))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(out / 'cmp.wav'), '-ac', '1', '-b:a', '64k', str(out / f'{names[0]}_spoken.mp3')], check=True); (out / 'cmp.wav').unlink()
print('TEXT:', text)
