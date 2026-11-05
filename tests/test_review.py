import io
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing, redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from book import ROOT, EXERCISE_GOAL, check_table_width, load, runnable, sample_sql
from check_examples import check_chapters, python_output, sql_first_rows, sql_statements
from output import build_output


def database():
    db = sqlite3.connect(':memory:', isolation_level=None)
    db.execute('PRAGMA foreign_keys = ON')
    db.executescript(sample_sql(['members', 'products', 'orders', 'accounts']))
    return db


def example(chapter, snippet):
    runs = next(ch for ch in load() if ch['id'] == chapter)['runs']
    return next(r['code'] for r in runs if snippet in r['code'])


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

    def test_ordinary_adjacent_output_still_parses(self):
        for caption in ('', '実行結果は次のとおりです。\n\n'):
            block, = runnable(('```python\nprint(1)\n```\n\n' + caption + '```text\n1\n```').splitlines())
            self.assertEqual(block['expected'], {'kind': 'text', 'text': '1'})
        block, = runnable('```sql\nSELECT 1 AS n;\n```\n\n| n |\n| --- |\n| 1 |'.splitlines())
        self.assertEqual(block['expected']['rows'], [['1']])

    def test_transfer_checks_both_updates(self):
        sql = example('ch5', 'INSERT OR ROLLBACK')
        for setup in ('', "DELETE FROM accounts WHERE account_id='B'",
                      "UPDATE accounts SET balance=5000 WHERE account_id='A'"):
            with self.subTest(setup=setup), closing(database()) as db:
                db.execute(setup)
                balances = 'SELECT account_id, balance FROM accounts ORDER BY account_id'
                before = db.execute(balances).fetchall()
                if setup:
                    with self.assertRaises(sqlite3.IntegrityError):
                        db.executescript(sql)
                    self.assertFalse(db.in_transaction)
                    self.assertEqual(db.execute(balances).fetchall(), before)
                else:
                    db.executescript(sql)
                    self.assertEqual(db.execute(balances).fetchall(), [('A', 40000), ('B', 40000)])

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
