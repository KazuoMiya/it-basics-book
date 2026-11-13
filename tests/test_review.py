import io
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing, redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from book import ROOT, EXERCISE_GOAL, check_table_width, fences, load, runnable, sample_sql
from check_examples import check_answers, check_chapters, python_output, sql_first_rows, sql_statements
from output import build_output


def database():
    db = sqlite3.connect(':memory:', isolation_level=None)
    db.execute('PRAGMA foreign_keys = ON')
    db.executescript(sample_sql(['members', 'products', 'orders', 'accounts']))
    return db


BALANCES = 'SELECT account_id, balance FROM accounts ORDER BY account_id'


def chapter(chapter_id):
    return next(ch for ch in load() if ch['id'] == chapter_id)


def example(chapter_id, snippet):
    return next(r['code'] for r in chapter(chapter_id)['runs'] if snippet in r['code'])


def results(code, tables=('members', 'products', 'orders', 'accounts'), keep_going=False):
    """Run SQL one statement at a time, as the web book does; with keep_going, continue after errors."""
    with closing(sqlite3.connect(':memory:', isolation_level=None)) as db:
        db.execute('PRAGMA foreign_keys = ON')
        db.executescript(sample_sql(list(tables)))
        out = {'tables': [], 'errors': []}
        for sql in sql_statements(code):
            try:
                cur = db.execute(sql)
            except sqlite3.Error as error:
                if not keep_going:
                    raise
                out['errors'].append(str(error))
                continue
            if cur.description:
                out['tables'].append(cur.fetchall())
        out['in_transaction'] = db.in_transaction
        out['balances'] = db.execute(BALANCES).fetchall() if 'accounts' in tables else None
        return out


def cells(rows):
    return [['NULL' if value is None else str(value) for value in row] for row in rows]


def printed_tables(chapter_id, snippet):
    """Tables printed after an example, up to the next heading or code block."""
    ch = chapter(chapter_id)
    run = next(r for r in ch['runs'] if snippet in r['code'])
    lines, tables, i = ch['lines'], [], run['end'] + 1
    while i < len(lines) and not lines[i].startswith(('#', '```')):
        if lines[i].startswith('|'):
            start = i
            while i < len(lines) and lines[i].startswith('|'):
                i += 1
            tables.append([[c.strip() for c in line.strip().strip('|').split('|')] for line in lines[start + 2:i]])
        else:
            i += 1
    return tables


class BookTests(unittest.TestCase):
    def test_exercise_goal_is_explicit_and_paired(self):
        for lang, code, output, expected in (
            ('python', 'print(1)', '```text\n2\n```', {'kind': 'text', 'text': '2'}),
            ('sql', 'SELECT 1 AS n;', '| n |\n| --- |\n| 2 |',
             {'kind': 'table', 'columns': ['n'], 'rows': [['2']]}),
        ):
            with self.subTest(lang=lang):
                lines = f'```{lang} exercise=sample\n{code}\n```\n\n{EXERCISE_GOAL}\n\n{output}\n\n次の説明'.splitlines()
                block, = runnable(lines)
                self.assertEqual(block['expected'], expected)
                self.assertEqual(lines[block['consume_end'] + 2], '次の説明')
                with self.assertRaisesRegex(ValueError, '目標の出力'):
                    runnable([line for line in lines if line != EXERCISE_GOAL])
                with self.assertRaisesRegex(ValueError, '目標出力'):
                    runnable(lines[:6])

    def test_every_exercise_has_a_matching_answer(self):
        goal = {'kind': 'text', 'text': '1'}
        problem = {'attrs': {'exercise': 'p'}, 'expected': goal}
        answer = lambda expected: {'attrs': {'answer': 'p'}, 'expected': expected}
        with redirect_stdout(io.StringIO()):
            self.assertEqual(check_answers([{'runs': [problem]}]), 1)
            self.assertEqual(check_answers([{'runs': [problem, answer({'kind': 'text', 'text': '2'})]}]), 1)
            self.assertEqual(check_answers([{'runs': [answer(goal)]}]), 1)
            self.assertEqual(check_answers([{'runs': [problem, answer(goal)]}]), 0)
        self.assertEqual(check_answers(load()), 0)

    def test_ordinary_adjacent_output_still_parses(self):
        for caption in ('', '実行結果は次のとおりです。\n\n'):
            block, = runnable(('```python\nprint(1)\n```\n\n' + caption + '```text\n1\n```').splitlines())
            self.assertEqual(block['expected'], {'kind': 'text', 'text': '1'})
        block, = runnable('```sql\nSELECT 1 AS n;\n```\n\n| n |\n| --- |\n| 1 |'.splitlines())
        self.assertEqual(block['expected']['rows'], [['1']])

    def test_transfer_commits_or_rolls_back_as_printed(self):
        commit = results(example('ch5', 'COMMIT;'))
        self.assertEqual(commit['tables'], [[('A', 40000), ('B', 40000)]])
        self.assertEqual(commit['balances'], [('A', 40000), ('B', 40000)])
        rollback = results(example('ch5', 'ROLLBACK;'))
        self.assertEqual(rollback['tables'], [[('A', 40000), ('B', 40000)], [('A', 50000), ('B', 30000)]])
        self.assertEqual(rollback['balances'], [('A', 50000), ('B', 30000)])
        # 2回目のSELECTの結果として紙面に載せた表も、実行結果と一致する
        self.assertEqual(printed_tables('ch5', 'ROLLBACK;')[1], cells(rollback['tables'][1]))
        self.assertEqual(printed_tables('ch5', 'LEFT JOIN orders ON')[1],
                         cells(results(example('ch5', 'LEFT JOIN orders ON'))['tables'][1]))

    def test_sql_examples_are_portable_and_safe_when_errors_are_ignored(self):
        # エラー後も続行する環境（sqlite3コマンドの既定など）で流しても、掲載例はエラーを起こさず、
        # トランザクションを開いたままにせず、口座の合計金額を変えない。
        runs = [r for r in chapter('ch5')['runs'] if r['lang'] == 'sql']
        self.assertGreaterEqual(len(runs), 15)
        for r in runs:
            with self.subTest(line=r['start'] + 1):
                self.assertNotRegex(r['code'].upper(), r'OR\s+ROLLBACK|CHANGES\(|TEMP\s+TABLE')
                done = results(r['code'], r['tables'], keep_going=True)
                self.assertEqual(done['errors'], [])
                self.assertFalse(done['in_transaction'])
                if 'accounts' in r['tables']:
                    self.assertEqual(sum(balance for _, balance in done['balances']), 80000)

    def test_failed_transfer_must_be_rolled_back_by_the_caller(self):
        transfer = example('ch5', 'COMMIT;')
        overdraft, = [f['code'] for f in fences(chapter('ch5')['lines']) if 'balance - 60000' in f['code']]
        with closing(database()) as db:  # 本文のとおり、残高不足の引き落としはCHECK制約で拒まれる
            with self.assertRaisesRegex(sqlite3.IntegrityError, 'CHECK'):
                db.execute(overdraft)
            self.assertEqual(db.execute(BALANCES).fetchall(), [('A', 50000), ('B', 30000)])
        for setup in ("UPDATE accounts SET balance = 5000 WHERE account_id = 'A'",
                      "UPDATE accounts SET account_id = 'Z' WHERE account_id = 'B'"):
            with self.subTest(setup=setup):
                with closing(database()) as db:  # 本文の手順：エラーか、更新件数が1でなければROLLBACK
                    db.execute(setup)
                    before = db.execute(BALANCES).fetchall()
                    for sql in sql_statements(transfer):
                        if sql.strip().upper().startswith('SELECT'):
                            continue
                        try:
                            ok = db.execute(sql).rowcount == 1 or not sql.strip().upper().startswith('UPDATE')
                        except sqlite3.IntegrityError:
                            ok = False
                        if not ok:
                            db.execute('ROLLBACK')
                            break
                    self.assertFalse(db.in_transaction)
                    self.assertEqual(db.execute(BALANCES).fetchall(), before)
                # 本文が警告する事故：失敗を無視してCOMMITまで進めると、片方の更新だけが確定する
                ignored = results(setup + ';' + transfer, keep_going=True)
                self.assertNotEqual(sum(balance for _, balance in ignored['balances']), sum(b for _, b in before))

    def test_outer_join_exercise_needs_both_fixes(self):
        run = next(r for r in chapter('ch5')['runs'] if r['attrs'].get('exercise') == 'member-orders')
        goal = run['expected']['rows']
        self.assertEqual(goal[-1], ['伊藤 直樹', '0'])
        half_fixed = run['code'].replace('JOIN orders', 'LEFT JOIN orders')
        self.assertEqual(cells(results(half_fixed)['tables'][0])[-1], ['伊藤 直樹', '1'])

    def test_sales_keeps_order_price_and_product_identity(self):
        with closing(database()) as db:
            db.execute("INSERT INTO products VALUES (104,'マグカップ',800)")
            db.execute("INSERT INTO orders VALUES (1005,1,104,1,800,'2026-10-04')")
            db.execute("UPDATE products SET price=1500 WHERE product_id=101")
            sales = db.execute(example('ch5', 'AS sales')).fetchall()
            self.assertIn((101, 'マグカップ', 3600), sales)
            self.assertIn((104, 'マグカップ', 800), sales)

    def test_sql_checks_full_input(self):
        def run(code):
            return sql_first_rows({'code': code, 'tables': ['accounts']})
        with self.assertRaises(sqlite3.OperationalError):
            run('SELECT 1; SELEC 2')
        self.assertEqual(run("SELECT ';' AS a; SELECT 2")['rows'], [[';']])
        self.assertEqual(len(list(sql_statements("CREATE TEMP TRIGGER t AFTER INSERT ON accounts "
                                                 "BEGIN SELECT 1; SELECT 2; END; SELECT 3;"))), 2)

    def test_unexpected_python_error(self):
        block = dict(code="raise RuntimeError('example')", mode='script', attrs={})
        with self.assertRaises(ValueError):
            python_output(block)
        block['attrs']['raises'] = 'RuntimeError'
        self.assertEqual(python_output(block), 'RuntimeError: example')
        block['code'] = 'pass'
        with self.assertRaises(ValueError):
            python_output(block)

    def test_checker_exit_status_and_unordered_multiplicity(self):
        def status(block):
            block['start'] = 0
            with redirect_stdout(io.StringIO()), self.assertRaises(SystemExit) as result:
                check_chapters([{'path': Path('example.md'), 'runs': [block]}])
            return result.exception.code

        block = dict(lang='sql', tables=['accounts'], code='SELECT 2 AS n UNION ALL SELECT 1 UNION ALL SELECT 1',
                     expected={'columns': ['n'], 'rows': [['1'], ['2'], ['1']]}, attrs={'unordered': True})
        self.assertEqual(status(block), 0)
        block['attrs'] = {}
        self.assertEqual(status(block), 1)
        block['attrs'] = {'unordered': True}
        block['expected']['rows'].pop()
        self.assertEqual(status(block), 1)
        self.assertEqual(status(dict(lang='sql', tables=[], code='SELEC 1', expected=None)), 1)
        self.assertEqual(status(dict(lang='python', code='raise RuntimeError()', mode='script', expected=None)), 1)

    def test_wide_table_is_rejected_before_padding(self):
        lines = ['|' + 'a|' * 200, '|' + '-|' * 200] + ['|x|'] * 200
        with self.assertRaisesRegex(ValueError, '64列'):
            check_table_width(lines)
        check_table_width(['`' * 3] + lines + ['`' * 3])

    def test_build_preserves_existing_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'book'
            with build_output(dest) as stage:
                (stage / 'index.html').write_text('first')
            with self.assertRaises(RuntimeError), build_output(dest) as stage:
                (stage / 'index.html').write_text('incomplete')
                raise RuntimeError('missing input')
            self.assertEqual((dest / 'index.html').read_text(), 'first')
            with build_output(dest) as stage:
                (stage / 'index.html').write_text('second')
            self.assertEqual((dest / 'index.html').read_text(), 'second')
            (dest / 'notes').write_text('keep')
            with self.assertRaises(ValueError), build_output(dest):
                pass
            self.assertEqual((dest / 'notes').read_text(), 'keep')

    def test_build_refuses_source(self):
        for dest in [ROOT, ROOT.parent, ROOT / 'manuscript', ROOT / '.git']:
            with self.subTest(dest=dest), self.assertRaises(ValueError), build_output(dest):
                pass
