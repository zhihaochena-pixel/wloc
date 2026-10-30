#!/usr/bin/env python3
"""Offline smoke test; writes only inside a temporary test directory."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

PY = sys.executable
SCRIPT = Path(__file__).with_name('memory.py')


def run(env, *args, success=True):
    cp = subprocess.run([PY, str(SCRIPT), *args], env=env, text=True, capture_output=True)
    if success and cp.returncode:
        raise AssertionError(f"{args}: {cp.stderr}")
    if not success and cp.returncode == 0:
        raise AssertionError(f"Should have rejected: {args}: {cp.stdout}")
    return json.loads(cp.stdout if cp.returncode == 0 else cp.stderr)


def main():
    with tempfile.TemporaryDirectory(prefix='muse-love-test-') as tmp:
        env = os.environ.copy()
        db = Path(tmp) / 'data' / 'relations.db'
        env['MUSE_LOVE_DB'] = str(db)
        assert run(env, 'status')['storage_enabled'] is False
        assert not db.exists(), 'status must not create the DB'
        run(env, 'person', 'upsert', '--id', 'A', '--stage', '熟悉', success=False)
        assert run(env, 'consent','on','--confirm','YES')['storage_enabled']
        run(env, 'person', 'upsert', '--id', 'A', '--stage', '熟悉', '--summary', '共同喜欢咖啡')
        run(env, 'note','add','--person','A','--date','2026-10-30','--kind','互动','--fact','对方主动提议喝咖啡', '--inference','可能有兴趣', '--next','询问时间')
        run(env, 'companion','set','--name','阿星','--style','风趣有边界')
        actual = run(env,'person','show','--id','A')
        assert len(actual['notes']) == 1
        assert '阿星' not in json.dumps(actual, ensure_ascii=False), 'fictional persona must stay separate'
        exported = Path(tmp) / 'export.json'
        run(env,'export','--out', str(exported))
        assert json.loads(exported.read_text(encoding='utf-8'))['companion']['name'] == '阿星'
        run(env,'consent','off')
        run(env,'note','add','--person','A','--date','2026-10-30','--kind','互动','--fact','不能存', success=False)
        run(env,'forget','--id','A','--confirm','DELETE')
        assert run(env,'person','list')['people'] == []
        run(env,'forget-all','--confirm','DELETE_ALL')
        assert not db.exists()
    print('PASS: privacy gate / memory write-read / compartmentalization / export / delete / no auto-create')


if __name__ == '__main__':
    main()
