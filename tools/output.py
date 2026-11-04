"""Publish a complete build without deleting unrelated or edited files."""
import hashlib
import json
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path

from book import ROOT

MARKER = '.it-book-output.json'
SOURCE = {'tools', 'site', 'examples', 'figures', 'manuscript'}


def inventory(directory):
    entries = {}
    for p in directory.rglob('*'):
        if p.is_symlink():
            raise ValueError(f'出力内のシンボリックリンクは置換できません: {p}')
        name = p.relative_to(directory).as_posix()
        if name == MARKER:
            continue
        entries[name] = None if p.is_dir() else hashlib.sha256(p.read_bytes()).hexdigest()
    return entries


@contextmanager
def build_output(destination):
    if destination.is_symlink():
        raise ValueError(f'出力先はシンボリックリンクにできません: {destination}')
    dest = destination.resolve()
    if dest == ROOT or dest in ROOT.parents:
        raise ValueError(f'ソースを含む場所には出力できません: {dest}')
    parts = dest.relative_to(ROOT).parts if dest.is_relative_to(ROOT) else ()
    if parts and (parts[0] in SOURCE or any(part.startswith('.') for part in parts)):
        raise ValueError(f'ソースディレクトリには出力できません: {dest}')
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=dest.parent, prefix='.it-book-stage-') as tmp:
        stage = Path(tmp) / 'site'
        stage.mkdir()
        yield stage
        (stage / MARKER).write_text(json.dumps(inventory(stage), sort_keys=True), encoding='utf-8')
        lock = dest.with_name('.' + dest.name + '.build-lock')
        backup = dest.with_name('.' + dest.name + '.previous')
        lock.mkdir()  # serialize the ownership check and replacement
        try:
            if backup.exists() or backup.is_symlink():
                raise ValueError(f'前回の出力が残っています: {backup}')
            if dest.exists():
                if not dest.is_dir() or dest.is_symlink():
                    raise ValueError(f'出力先はディレクトリではありません: {dest}')
                if any(dest.iterdir()):
                    marker = dest / MARKER
                    if not marker.is_file() or marker.is_symlink() or json.loads(marker.read_text()) != inventory(dest):
                        raise ValueError(f'既存ファイルを保護しました。空の別の出力先を指定してください: {dest}')
                dest.rename(backup)
            try:
                stage.rename(dest)
            except BaseException:
                if backup.exists():
                    backup.rename(dest)
                raise
            if backup.exists():
                shutil.rmtree(backup)
        finally:
            lock.rmdir()
