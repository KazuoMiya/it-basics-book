# ITのしくみ入門（仮題）

コンピューター、データ、プログラム、データベース、ネットワーク、セキュリティのしくみを、「なぜそうなるのか」「実際にはどう動いているのか」から学ぶIT入門書の原稿です。

Web版: https://kazuomiya.github.io/it-basics-book/

Web版では、本文中のPythonとSQLのコード例をその場で実行・編集できます。Pythonはブラウザーの中で動くPython 3.12（Pyodide）、SQLはブラウザーの中で動くSQLite（sql.js）で実行します。実行ボタンに入力したコードは端末上で処理します。Pythonの実行欄は通信を制限した専用環境で動きます。SQLは実行中に「中断」を押せます。

## 構成

| 章 | ファイル |
| --- | --- |
| 序論　画面の向こう側をのぞいてみよう | [manuscript/00-intro.md](manuscript/00-intro.md) |
| 第1章　部品の役割分担を見抜く | [manuscript/01-computer.md](manuscript/01-computer.md) |
| 第2章　あらゆる情報を0と1に置き換える | [manuscript/02-data.md](manuscript/02-data.md) |
| 第3章　書いたコードが動き出すまでを追う | [manuscript/03-program.md](manuscript/03-program.md) |
| 第4章　データを整え、すばやく探し出す | [manuscript/04-data-structures.md](manuscript/04-data-structures.md) |
| 第5章　大量のデータを速く正しく管理する | [manuscript/05-database.md](manuscript/05-database.md) |
| 第6章　メッセージが世界を旅する道のりをたどる | [manuscript/06-network.md](manuscript/06-network.md) |
| 第7章　攻撃の手口を知り、守りを固める | [manuscript/07-security.md](manuscript/07-security.md) |
| おわりに | [manuscript/08-outro.md](manuscript/08-outro.md) |

```
manuscript/      原稿（章ごとのMarkdown。これが正本）
figures/         図（SVG）。figures/src/ は図の元になったコード
examples/sql/    SQLのコード例で使うサンプルテーブル
site/            Web版の見た目と動き（CSS・JavaScript）
tools/           ビルドとコード例の確認に使うスクリプト
book.json        書名、リポジトリ、読み込むライブラリの設定
```

## 原稿の書き方

- 章のファイルは、1行目を `# 第N章　タイトル` にします。節は `## N-M　タイトル`、項は `###` です。
- 図は `![図N-M　キャプション](../figures/fig-N-M.svg)` の1行で入れます。
- 表のキャプションは、表の直前の段落に `表N-M　タイトル` と書きます。
- ` ```python ` と ` ```sql ` のコードは、Web版で実行ボタン付きになります。直後に置いた実行結果（Pythonは ` ``` ` のブロック、SQLは表）は「本書に掲載の結果」として表示されます。
- コードブロックには、言語名の後ろにオプションを書けます。

| 書き方 | 意味 |
| --- | --- |
| ` ```python id=photos ` | このコードに名前を付ける |
| ` ```python uses=photos ` | 名前を付けたコードを先に（表示せずに）実行してから、このコードを実行する |
| ` ```sql tables=members,products ` | 用意するサンプルテーブルを指定する（省略時はすべて） |
| ` ```python raises=IndexError ` | この例が意図的に起こす例外の種類を指定する |
| ` ```sql unordered ` | 結果表を行順に依存せず比較する（重複行は区別する） |
| ` ```python norun ` | 実行ボタンを付けない |

## 手元でビルドする

Python 3.12 を使います。

```sh
pip install -r requirements.txt
python tools/check_examples.py   # コード例が本の結果どおりに動くか確かめる
python tools/build.py            # _site/ にWeb版を作る
python -m http.server --bind 127.0.0.1 -d _site   # http://localhost:8000/ で確認する
```

ビルドはnpmから指定版の実行環境を取得し、固定したハッシュを照合してWeb版と一緒に配布します。オフラインで組み立てるには、`book.json` にある2つの配布アーカイブをフォルダに置き、`--runtime-cache フォルダ名` を指定します。既存の出力はビルドが生成した内容と一致するときだけ置換します。旧版の出力や独自ファイルがある場合は、新しい出力先を指定してください。

`tools/check_examples.py` は原稿に書かれたPythonを手元の権限で実行します。他者の変更を検証するときは、事前に内容を確認するか、認証情報のない使い捨て環境を使ってください。

`main` ブランチに push すると、GitHub Actions がコード例を確かめてからWeb版を組み立て、GitHub Pages に公開します。

## 修正後の確認

`python -m unittest discover -s tests` で振込の失敗・売上集計・ビルド先の保護などを検証できます。Web版を生成した後は、次の手順でChromeを使って掲載例と実行環境を確認できます。

```sh
npm install --no-save --package-lock=false --ignore-scripts playwright-core@1.62.1
npx --no-install playwright-core install chromium
node tests/web.cjs _site
```

インストール済みのChromeを使う場合は、`CHROME_PATH` に実行ファイルのパスを指定すれば、2行目は省略できます。

## 図を作り直すとき

図は `figures/src/*.jsx`（ReactのJSXで書いたSVG）から作っています。作り直すには Node.js と react・react-dom・typescript が必要です。

```sh
node tools/render_figs.js
```

## ライセンス

未定です。現時点では、本書の原稿・図・著者が書いたコードの著作権は著者に帰属します。Web版に同梱するPyodideとsql.jsには各配布物のライセンスが適用されます。ライセンス文は生成先の `runtime/` に含まれます。
